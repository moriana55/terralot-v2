import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// CERBERUS INTEL FUNNEL (read-only, gated)
//
// Aggregates the acquisition funnel for the /admin/cerberus cockpit, all LIVE
// from Supabase — nothing fabricated:
//   • captured   = rows in tax_delinquent_properties (every lead Cerberus has)
//   • analyzed   = rows in lead_analyses (processed by the pipeline)
//   • pending    = captured − analyzed (the backlog still to chew)
//   • verdict breakdown AL/BEKLE/GEÇ with counts
//   • top opportunities (highest score), recent red-flags, per-source coverage
//
// HONEST DEGRADATION: if lead_analyses doesn't exist yet (migration not applied)
// it returns tableReady:false so the UI can show the exact owner action. If the
// table is empty it returns zeros, never invented metrics.
// ─────────────────────────────────────────────────────────────────────────────

const TDP = "tax_delinquent_properties";
const ANALYSES = "lead_analyses";
const DB_PAGE = 1000;

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  // captured count (head request)
  let captured = 0;
  try {
    const { count } = await s.from(TDP).select("*", { count: "exact", head: true });
    captured = count ?? 0;
  } catch { /* graceful */ }

  // analyzed count + table readiness probe
  let analyzed = 0;
  let tableReady = true;
  try {
    const { count, error } = await s.from(ANALYSES).select("*", { count: "exact", head: true });
    if (error) tableReady = false;
    else analyzed = count ?? 0;
  } catch {
    tableReady = false;
  }

  if (!tableReady) {
    return NextResponse.json({
      tableReady: false,
      captured,
      analyzed: 0,
      pending: captured,
      verdicts: { BUY: 0, WATCH: 0, PASS: 0 },
      topOpportunities: [],
      recentFlags: [],
      sources: [],
      bySource: [],
      message: "`lead_analyses` tablosu yok. CERBERUS_ANALYSES_SETUP.sql'i Supabase'de çalıştır.",
    });
  }

  // Page through analyses (bounded) to build the funnel + lists.
  const verdicts = { BUY: 0, WATCH: 0, PASS: 0 };
  const bySource = new Map<string, { total: number; BUY: number; WATCH: number; PASS: number }>();
  const flagCounts = new Map<string, { code: string; level: string; label: string; count: number }>();
  let hardFails = 0;
  const top: {
    parcel_key: string; apn: string | null; state: string | null; county: string | null;
    score: number; verdict: string; margin: number | null; comp_value: number | null;
    min_bid: number | null; suggested_action: string | null;
  }[] = [];

  let from = 0;
  for (let page = 0; page < 30; page++) {
    const { data, error } = await s
      .from(ANALYSES)
      .select("parcel_key,apn,state,county,score,verdict,margin,comp_value,min_bid,hard_fail,risk_flags,source,suggested_action")
      .range(from, from + DB_PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as Record<string, unknown>[]) {
      const v = String(r.verdict || "") as keyof typeof verdicts;
      if (v in verdicts) verdicts[v]++;
      if (r.hard_fail) hardFails++;

      const src = (r.source as string) || "Bilinmiyor";
      const b = bySource.get(src) || { total: 0, BUY: 0, WATCH: 0, PASS: 0 };
      b.total++;
      if (v in verdicts) (b as Record<string, number>)[v]++;
      bySource.set(src, b);

      const flags = Array.isArray(r.risk_flags) ? (r.risk_flags as { code: string; level: string; label: string }[]) : [];
      for (const f of flags) {
        if (!f || !f.code) continue;
        const ex = flagCounts.get(f.code) || { code: f.code, level: f.level, label: f.label, count: 0 };
        ex.count++;
        flagCounts.set(f.code, ex);
      }

      top.push({
        parcel_key: r.parcel_key as string,
        apn: (r.apn as string) ?? null,
        state: (r.state as string) ?? null,
        county: (r.county as string) ?? null,
        score: Number(r.score) || 0,
        verdict: v,
        margin: r.margin == null ? null : Number(r.margin),
        comp_value: r.comp_value == null ? null : Number(r.comp_value),
        min_bid: r.min_bid == null ? null : Number(r.min_bid),
        suggested_action: (r.suggested_action as string) ?? null,
      });
    }
    if (data.length < DB_PAGE) break;
    from += DB_PAGE;
  }

  top.sort((a, b) => b.score - a.score || (b.margin ?? -1) - (a.margin ?? -1));

  const recentFlags = [...flagCounts.values()]
    .sort((a, b) => {
      const order = { critical: 0, warn: 1, info: 2 } as Record<string, number>;
      return (order[a.level] ?? 3) - (order[b.level] ?? 3) || b.count - a.count;
    })
    .slice(0, 8);

  const sources = [...bySource.entries()]
    .map(([source, c]) => ({ source, ...c }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    tableReady: true,
    captured,
    analyzed,
    pending: Math.max(0, captured - analyzed),
    verdicts,
    hardFails,
    topOpportunities: top.slice(0, 12),
    recentFlags,
    bySource: sources,
  });
}
