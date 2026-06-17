import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

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
// filters_json schema (all optional):
//   { states: ["TX"], srcContains: "tax", minScore: 70, minAcres, maxAcres,
//     minBid, maxBid, county, hasOwner: true, limit }
//
// EMAIL/CRON DELIVERY — STUB:
//   This endpoint only COMPUTES new matches. To deliver alerts:
//   1. Add a Vercel cron in vercel.json:
//        { "crons": [{ "path": "/api/saved-searches/run-all", "schedule": "0 13 * * *" }] }
//      (run-all would loop every saved_searches row and call this logic).
//   2. Wire Resend (RESEND_API_KEY) to email `notify_email` the `newMatches`.
//   When RESEND_API_KEY is absent we just return the diff so the UI can preview.
// ─────────────────────────────────────────────────────────────────────────────

interface Filters {
  states?: string[];
  srcContains?: string;
  minScore?: number;
  minAcres?: number;
  maxAcres?: number;
  minBid?: number;
  maxBid?: number;
  county?: string;
  hasOwner?: boolean;
  limit?: number;
}

interface LeadRow {
  id: string;
  state: string | null;
  county: string | null;
  source: string | null;
  acres: number | null;
  minimum_bid: number | null;
  final_score: number | null;
  owner_name: string | null;
  property_address: string | null;
  scraped_at: string | null;
}

const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").trim();

function matches(r: LeadRow, f: Filters): boolean {
  if (f.states?.length && !(r.state && f.states.map((x) => x.toUpperCase()).includes(r.state.toUpperCase()))) return false;
  if (f.srcContains && !((r.source || "").toLowerCase().includes(f.srcContains.toLowerCase()))) return false;
  if (f.county && normCounty(r.county) !== normCounty(f.county)) return false;
  if (f.minScore != null && (r.final_score ?? 0) < f.minScore) return false;
  if (f.minAcres != null && (r.acres ?? 0) < f.minAcres) return false;
  if (f.maxAcres != null && (r.acres ?? Infinity) > f.maxAcres) return false;
  if (f.minBid != null && (r.minimum_bid ?? 0) < f.minBid) return false;
  if (f.maxBid != null && (r.minimum_bid ?? Infinity) > f.maxBid) return false;
  if (f.hasOwner && !(r.owner_name && !/unknown|no owner|county tax/i.test(r.owner_name))) return false;
  return true;
}

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

  // sweep leads
  const allMatches: LeadRow[] = [];
  try {
    let from = 0;
    for (;;) {
      const { data, error } = await s
        .from("tax_delinquent_properties")
        .select("id,state,county,source,acres,minimum_bid,final_score,owner_name,property_address,scraped_at")
        .range(from, from + 999);
      if (error) return NextResponse.json({ matches: [], newMatches: [], reason: "table unavailable" });
      if (!data || data.length === 0) break;
      for (const r of data as LeadRow[]) if (matches(r, filters)) allMatches.push(r);
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch {
    return NextResponse.json({ matches: [], newMatches: [] });
  }

  allMatches.sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
  const limit = Math.min(500, filters.limit ?? 200);
  const capped = allMatches.slice(0, limit);
  const newMatches = capped.filter((r) => !priorIds.has(r.id));

  // persist new baseline when running a stored search
  let delivered = false;
  if (searchId) {
    try {
      await s
        .from("saved_searches")
        .update({
          last_run_at: new Date().toISOString(),
          last_match_count: allMatches.length,
          baseline_ids: capped.map((r) => r.id),
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
    total: allMatches.length,
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
