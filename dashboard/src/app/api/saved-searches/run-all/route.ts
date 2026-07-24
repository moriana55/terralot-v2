import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireGate } from "@/lib/api-guard";
import { type Filters, type LeadRow, rankMatches, sweepLeads } from "@/lib/saved-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// SAVED SEARCH — TOPLU ÇALIŞTIRICI (GÜNLÜK CRON)
//
//   GET  /api/saved-searches/run-all   ← Vercel cron (vercel.json) günlük çağırır
//   POST /api/saved-searches/run-all   ← admin elle tetikleyebilir (gate'li)
//
// TÜM kayıtlı aramaları TEK lead süpürmesiyle çalıştırır (verimli), her arama
// için yeni eşleşmeleri hesaplar, baseline'ı günceller ve —RESEND_API_KEY
// varsa— notify_email'e özet gönderir. Key yoksa e-posta SESSİZCE atlanır ama
// yeni eşleşme sayıları yine döner (degrade — yeni env ZORUNLU değil).
//
// YETKİ: Vercel cron header'ı (x-vercel-cron) VEYA CRON_SECRET (varsa) VEYA
// admin gate. Hiçbiri yoksa 401 — açık kalmaz. CRON_SECRET opsiyonel.
// ─────────────────────────────────────────────────────────────────────────────

interface SavedSearchRow {
  id: string;
  name: string;
  filters_json: Filters | null;
  notify_email: string | null;
  baseline_ids: string[] | null;
}

function authorized(req: NextRequest): boolean {
  // 1) Vercel cron invocation adds this header automatically.
  if (req.headers.get("x-vercel-cron")) return true;
  // 2) Optional shared secret (no new env REQUIRED; used only if set).
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return false;
}

async function runAll(req: NextRequest): Promise<NextResponse> {
  // Cron/secret bypass OR admin gate — biri yeterli.
  if (!authorized(req)) {
    const unauth = await requireGate(req);
    if (unauth) return unauth;
  }

  const s = supabaseAdmin();

  // 1) Tüm kayıtlı aramalar.
  let searches: SavedSearchRow[] = [];
  try {
    const { data, error } = await s
      .from("saved_searches")
      .select("id,name,filters_json,notify_email,baseline_ids");
    if (error) return NextResponse.json({ ran: 0, results: [], reason: "table unavailable" });
    searches = (data as SavedSearchRow[]) || [];
  } catch {
    return NextResponse.json({ ran: 0, results: [], reason: "table unavailable" });
  }

  if (searches.length === 0) {
    return NextResponse.json({ ran: 0, results: [], note: "Kayıtlı arama yok." });
  }

  // 2) Lead havuzunu BİR KEZ süpür, tüm aramalarda paylaş.
  const { rows, ok } = await sweepLeads(s);
  if (!ok) return NextResponse.json({ ran: 0, results: [], reason: "leads table unavailable" });

  const hasResend = !!process.env.RESEND_API_KEY;
  const now = new Date().toISOString();
  const results: Array<{ id: string; name: string; total: number; newCount: number; emailed: boolean }> = [];

  // 3) Her aramayı çalıştır, baseline güncelle, (mümkünse) e-posta.
  for (const search of searches) {
    const filters = search.filters_json || {};
    const priorIds = new Set(search.baseline_ids || []);
    const { total, capped, newMatches } = rankMatches(rows, filters, priorIds);

    try {
      await s
        .from("saved_searches")
        .update({
          last_run_at: now,
          last_match_count: total,
          baseline_ids: capped.map((r: LeadRow) => r.id),
          updated_at: now,
        })
        .eq("id", search.id);
    } catch { /* graceful — bir aramanın yazımı hata verse diğerleri sürsün */ }

    let emailed = false;
    if (hasResend && search.notify_email && newMatches.length > 0) {
      emailed = await sendAlertEmail(search.notify_email, search.name, newMatches);
    }

    results.push({ id: search.id, name: search.name, total, newCount: newMatches.length, emailed });
  }

  const totalNew = results.reduce((a, r) => a + r.newCount, 0);
  return NextResponse.json({
    ran: results.length,
    totalNew,
    emailDelivery: hasResend,
    results,
    note: hasResend
      ? "RESEND_API_KEY mevcut — yeni eşleşmesi olan aramalara e-posta gönderildi."
      : "RESEND_API_KEY yok — yeni eşleşmeler hesaplandı, e-posta atlandı (degrade).",
  });
}

// Resend ile alarm e-postası. Key yoksa buraya HİÇ girilmez. Ağ/hata durumunda
// false döner — cron akışını bozmaz.
async function sendAlertEmail(to: string, searchName: string, newMatches: LeadRow[]): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.RESEND_FROM || "TerraLot Alerts <alerts@terralot.local>";
  const lines = newMatches
    .slice(0, 20)
    .map((m) => {
      const loc = [m.county, m.state].filter(Boolean).join(", ") || "—";
      const ac = m.acres != null ? `${m.acres} ac` : "";
      const bid = m.minimum_bid != null ? `$${Math.round(m.minimum_bid).toLocaleString("en-US")}` : "";
      const score = m.final_score != null ? `score ${m.final_score}` : "";
      return `<li>${[ac, loc, bid, score].filter(Boolean).join(" · ")}</li>`;
    })
    .join("");
  const html =
    `<h2>${escapeHtml(searchName)} — ${newMatches.length} new match${newMatches.length === 1 ? "" : "es"}</h2>` +
    `<ul>${lines}</ul>` +
    (newMatches.length > 20 ? `<p>…and ${newMatches.length - 20} more.</p>` : "");
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to,
        subject: `TerraLot: ${newMatches.length} new match${newMatches.length === 1 ? "" : "es"} — ${searchName}`,
        html,
      }),
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

export async function GET(req: NextRequest) {
  return runAll(req);
}

export async function POST(req: NextRequest) {
  return runAll(req);
}
