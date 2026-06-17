import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { normalizeRows } from "@/lib/sync-deals";
import { SYNC_MAX_ROWS, SYNC_BATCH_SIZE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER → DASHBOARD SYNC (CRON_SECRET-protected, FAIL-CLOSED)
//
// Bridges the silo: the scraper writes leads to SQLite, the dashboard reads
// Supabase. This endpoint imports normalized scraper output into the
// `tax_delinquent_properties` table (idempotent, deduped by APN/parcel id).
//
// AUTH (two accepted callers, BOTH fail closed):
//   1. Automated cron / scraper job → `Authorization: Bearer <CRON_SECRET>`
//      or `?secret=<CRON_SECRET>`. If CRON_SECRET is UNSET, every bearer attempt
//      is rejected (never a no-op pass). Timing-safe compare.
//   2. A logged-in admin in the browser → the gate cookie (requireGate). When the
//      gate is dormant (real Clerk), Clerk/middleware already governs access.
//
// DATA SOURCE (POST body, validated):
//   { "rows": [ ...raw scraper rows... ] }     ← preferred: caller POSTs the data
//   { "filePath": "/abs/or/relative/path.json" } ← reads a JSON array from disk;
//                                                   only allowed when SYNC_ALLOW_FILE=1
//   {}  with SYNC_SOURCE_FILE env set          ← reads the configured export file
//
// If NO source resolves, we return an honest 422 "no_source_configured" with the
// exact wiring the owner must do — we do NOT fabricate or partially import.
//
// OWNER MUST WIRE (see report): export scraper rows to JSON and either POST them
// here on a schedule, or set SYNC_SOURCE_FILE to that export path. The scraper
// lacks Supabase creds today; this is the missing bridge.
// ─────────────────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  rows: z.array(z.unknown()).max(SYNC_MAX_ROWS).optional(),
  filePath: z.string().trim().min(1).max(500).optional(),
  dryRun: z.coerce.boolean().optional(),
});

// Constant-time string compare so the secret can't be guessed via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function bearerOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL CLOSED — no secret set ⇒ no bearer access
  const header = req.headers.get("authorization") || "";
  const fromHeader = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const fromQuery = req.nextUrl.searchParams.get("secret") || "";
  const presented = fromHeader || fromQuery;
  return !!presented && safeEqual(presented, secret);
}

export async function POST(req: NextRequest) {
  // Public-route hygiene: rate-limit by IP before any work.
  const limited = enforceRateLimit(req, { limit: 12, windowMs: 60_000 });
  if (limited) return limited;

  // Auth: cron bearer OR admin gate. Either passing is enough; both fail closed.
  const cronAuthed = bearerOk(req);
  if (!cronAuthed) {
    const unauth = await requireGate(req);
    if (unauth) return unauth;
    // If the gate is dormant (no ADMIN_PASSWORD) AND no valid bearer, refuse —
    // we must never run an unauthenticated import.
    if (!process.env.ADMIN_PASSWORD && !process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "unauthorized", message: "CRON_SECRET veya ADMIN_PASSWORD ayarlı değil — import reddedildi (fail-closed)." },
        { status: 401 }
      );
    }
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { rows: bodyRows, filePath, dryRun } = parsed.data;

  // ── Resolve the data source ────────────────────────────────────────────────
  let source: unknown[] | null = null;
  let sourceLabel = "";

  if (Array.isArray(bodyRows)) {
    source = bodyRows;
    sourceLabel = "request_body";
  } else {
    // File path: explicit (gated by SYNC_ALLOW_FILE) or the configured env file.
    const allowFile = process.env.SYNC_ALLOW_FILE === "1";
    const target = filePath && allowFile ? filePath : process.env.SYNC_SOURCE_FILE;
    if (target) {
      try {
        const text = await readFile(target, "utf8");
        const json = JSON.parse(text);
        // Accept either a bare array or { rows: [...] } / { listings: [...] }.
        source = Array.isArray(json) ? json : (json.rows ?? json.listings ?? json.properties ?? null);
        sourceLabel = `file:${target}`;
      } catch (e) {
        return NextResponse.json(
          { error: "source_read_failed", message: e instanceof Error ? e.message : "dosya okunamadı", target },
          { status: 422 }
        );
      }
    }
  }

  if (!Array.isArray(source)) {
    return NextResponse.json(
      {
        error: "no_source_configured",
        message:
          "Senkronlanacak veri kaynağı yok. POST body'de `rows: [...]` gönderin, ya da SYNC_SOURCE_FILE env'ini scraper JSON export yoluna ayarlayın (alternatif: SYNC_ALLOW_FILE=1 ile body'de filePath).",
        ownerActions: [
          "Scraper çıktısını JSON dizisine aktar (örn. scraper/lgbs_all_properties.json zaten mevcut).",
          "Bu endpoint'e zamanlanmış olarak POST et: Authorization: Bearer $CRON_SECRET, body { rows: [...] }.",
          "Veya SYNC_SOURCE_FILE=/abs/path/export.json ayarla ve boş body ile POST et.",
          "CRON_SECRET'i hem dashboard env'ine hem scraper job'una koy.",
        ],
      },
      { status: 422 }
    );
  }

  if (source.length > SYNC_MAX_ROWS) {
    return NextResponse.json(
      { error: "too_many_rows", message: `En fazla ${SYNC_MAX_ROWS} satır kabul edilir, ${source.length} geldi.` },
      { status: 413 }
    );
  }

  // ── Normalize + dedup (pure) ───────────────────────────────────────────────
  const { rows, skipped, reasons } = normalizeRows(source);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      source: sourceLabel,
      received: source.length,
      valid: rows.length,
      skipped,
      skipReasons: reasons,
      sample: rows.slice(0, 3),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      source: sourceLabel,
      received: source.length,
      upserted: 0,
      skipped,
      skipReasons: reasons,
      message: "Geçerli satır yok — hiçbir şey yazılmadı.",
    });
  }

  // ── Upsert into Supabase in batches (idempotent on dedup_key) ──────────────
  const s = supabaseAdmin();
  let upserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += SYNC_BATCH_SIZE) {
    const batch = rows.slice(i, i + SYNC_BATCH_SIZE);
    const { error, count } = await s
      .from("tax_delinquent_properties")
      .upsert(batch, { onConflict: "dedup_key", ignoreDuplicates: false, count: "exact" });
    if (error) errors.push(error.message);
    else upserted += count ?? batch.length;
  }

  const status = errors.length && upserted === 0 ? 500 : 200;
  return NextResponse.json(
    {
      ok: errors.length === 0,
      source: sourceLabel,
      received: source.length,
      upserted,
      skipped,
      skipReasons: reasons,
      errors: errors.length ? errors.slice(0, 5) : undefined,
      note: errors.length
        ? "Bazı batch'ler başarısız oldu. Muhtemel neden: `dedup_key` kolonu/unique index yok. SYNC_SETUP.sql'i uygula."
        : undefined,
    },
    { status }
  );
}

// A GET probe so owners can confirm wiring without writing anything.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const cronAuthed = bearerOk(req);
  if (!cronAuthed) {
    const unauth = await requireGate(req);
    if (unauth) return unauth;
  }
  return NextResponse.json({
    ok: true,
    endpoint: "sync-deals",
    cronSecretConfigured: !!process.env.CRON_SECRET,
    sourceFileConfigured: !!process.env.SYNC_SOURCE_FILE,
    fileImportAllowed: process.env.SYNC_ALLOW_FILE === "1",
    maxRows: SYNC_MAX_ROWS,
    usage: "POST { rows:[...] } with Authorization: Bearer $CRON_SECRET (dryRun:true to preview).",
  });
}
