import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { type Filters, type LeadRow, rankMatches, sweepLeads } from "@/lib/saved-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// SAVED SEARCH RUNNER
//
//   POST /api/saved-searches/run  { id }              → run one saved search
//   POST /api/saved-searches/run  { filters_json }    → ad-hoc dry run (no persist)
//
// Re-evaluates a saved filter set against tax_delinquent_properties, returns the
// current matches AND the NEW matches (ids not present at last run). Persists the
// new baseline + last_run_at when an `id` is given.
//
// Filtre + sıralama mantığı lib/saved-search.ts'te (run-all cron ile paylaşılır).
//
// EMAIL/CRON DELIVERY:
//   Bu endpoint yeni eşleşmeleri HESAPLAR. Toplu teslimat için günlük Vercel cron
//   /api/saved-searches/run-all'ı çağırır (vercel.json). RESEND_API_KEY yoksa
//   e-posta atlanır ama newMatches yine hesaplanır + UI'da gösterilir (degrade).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const s = supabaseAdmin();

  // resolve filters + prior baseline
  let filters: Filters = {};
  let priorIds = new Set<string>();
  let searchId: string | null = null;

  if (body.id) {
    searchId = String(body.id);
    try {
      const { data } = await s.from("saved_searches").select("*").eq("id", searchId).maybeSingle();
      if (!data) return NextResponse.json({ error: "search not found" }, { status: 404 });
      filters = (data.filters_json as Filters) || {};
      priorIds = new Set((data.baseline_ids as string[]) || []);
    } catch {
      return NextResponse.json({ error: "table unavailable" }, { status: 500 });
    }
  } else {
    filters = (body.filters_json as Filters) || (body as unknown as Filters) || {};
  }

  // sweep leads (shared paginator; graceful when table missing)
  const { rows, ok } = await sweepLeads(s);
  if (!ok) return NextResponse.json({ matches: [], newMatches: [], reason: "table unavailable" });

  const { total, capped, newMatches } = rankMatches(rows, filters, priorIds);

  // persist new baseline when running a stored search
  let delivered = false;
  if (searchId) {
    try {
      await s
        .from("saved_searches")
        .update({
          last_run_at: new Date().toISOString(),
          last_match_count: total,
          baseline_ids: capped.map((r: LeadRow) => r.id),
          updated_at: new Date().toISOString(),
        })
        .eq("id", searchId);
    } catch { /* graceful */ }

    // EMAIL DELIVERY STUB — only attempt if a key AND recipient exist.
    if (process.env.RESEND_API_KEY && newMatches.length > 0) {
      // TODO: send via Resend. Left unwired to avoid runtime dependency.
      delivered = false;
    }
  }

  return NextResponse.json({
    total,
    matches: capped,
    newMatches,
    newCount: newMatches.length,
    delivered,
    deliveryStub: !process.env.RESEND_API_KEY,
    note: process.env.RESEND_API_KEY
      ? "RESEND_API_KEY mevcut — e-posta gönderimi TODO (kod stub)."
      : "RESEND_API_KEY yok — yeni eşleşmeler döndürüldü, e-posta gönderilmedi (Vercel cron + Resend TODO).",
  });
}
