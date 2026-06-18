import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { analyzeLead } from "@/lib/cerberus/analyze";
import { abbrState, normCounty } from "@/lib/cerberus/analyze";
import { enrichParcel, enrichmentToApplied } from "@/lib/cerberus/enrich";
import { medianPpa } from "@/lib/land-valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// PER-LEAD ANALYSIS (read-only, gated) — powers the drill-down.
//
// Lookup by ?key=<parcel_key> or ?apn=<apn>. Returns the PERSISTED analysis from
// lead_analyses when present. If a parcel has been captured but not yet analyzed
// (or the table doesn't exist), it analyzes it ON THE FLY from the live lead row
// so the drill-down always shows something honest — flagged `live:true`.
// ─────────────────────────────────────────────────────────────────────────────

const TDP = "tax_delinquent_properties";
const ANALYSES = "lead_analyses";

const qSchema = z.object({
  key: z.string().trim().max(400).optional(),
  apn: z.string().trim().max(120).optional(),
});

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 40 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const parsed = qSchema.safeParse({
    key: req.nextUrl.searchParams.get("key") ?? undefined,
    apn: req.nextUrl.searchParams.get("apn") ?? undefined,
  });
  if (!parsed.success || (!parsed.data.key && !parsed.data.apn)) {
    return NextResponse.json({ error: "missing_selector", message: "key veya apn gerekli." }, { status: 400 });
  }
  const { key, apn } = parsed.data;

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  // 1) Try the persisted analysis first.
  try {
    let q = s.from(ANALYSES).select("*");
    if (key) q = q.eq("parcel_key", key);
    else q = q.ilike("apn", `%${(apn || "").replace(/[%,]/g, "")}%`);
    const { data, error } = await q.limit(1);
    if (!error && data && data[0]) {
      return NextResponse.json({ stored: true, live: false, analysis: data[0] });
    }
  } catch { /* fall through to live */ }

  // 2) Not persisted (or table missing) → analyze the live lead row on the fly.
  let lead: Record<string, unknown> | null = null;
  try {
    let q = s.from(TDP).select("id,dedup_key,apn,source,state,county,property_address,owner_name,acres,minimum_bid,judgment_amount,final_score,deal_score,discount_pct,savings,liquidity_score,county_pop_growth,road_access,flood_score,dd_checked,lat,lng,sale_date,raw_url");
    if (key && key.startsWith("apn:")) q = q.ilike("apn", `%${key.slice(4).replace(/[%,-]/g, "")}%`);
    else if (apn) q = q.ilike("apn", `%${apn.replace(/[%,]/g, "")}%`);
    else if (key) q = q.eq("dedup_key", key);
    const { data } = await q.limit(1);
    lead = (data?.[0] as Record<string, unknown>) ?? null;
  } catch { /* graceful */ }

  if (!lead) {
    return NextResponse.json({ error: "not_found", message: "Bu parsel için analiz veya lead bulunamadı." }, { status: 404 });
  }

  // Resolve a market context just for this one parcel's state/county.
  const st = abbrState(lead.state as string);
  const cty = normCounty(lead.county as string);
  const ctx: { stateRates: Record<string, number>; countyRates: Record<string, number> } = { stateRates: {}, countyRates: {} };
  if (st) {
    try {
      const { data } = await s.from("competitor_listings").select("county,price,acres").eq("state", st).limit(2000);
      const all = (data as { county: string; price: unknown; acres: unknown }[]) || [];
      const sr = medianPpa(all.map((r) => ({ price: r.price, acres: r.acres })));
      if (sr != null) ctx.stateRates[st] = sr;
      if (cty) {
        const inCounty = all.filter((r) => normCounty(r.county) === cty);
        const cr = medianPpa(inCounty.map((r) => ({ price: r.price, acres: r.acres })), 4);
        if (cr != null) ctx.countyRates[`${st}/${cty}`] = cr;
      }
    } catch { /* graceful */ }
  }

  // Opt-in live enrichment for THIS one parcel (?enrich=1) — drill-down "god mode".
  // Single parcel, so the rate-limit budget is tiny; still fully defensive.
  const wantEnrich = req.nextUrl.searchParams.get("enrich") === "1";
  let analysis;
  if (wantEnrich) {
    const e = await enrichParcel({
      lat: typeof lead.lat === "number" ? lead.lat : null,
      lng: typeof lead.lng === "number" ? lead.lng : null,
      address: typeof lead.property_address === "string" ? lead.property_address : null,
      state: st,
      county: cty,
    });
    analysis = analyzeLead(lead, ctx, e.sourcesOk.length ? enrichmentToApplied(e) : undefined);
  } else {
    analysis = analyzeLead(lead, ctx);
  }
  if (!analysis) {
    return NextResponse.json({ error: "not_analyzable", message: "Lead'in kimliği yok (APN/konum), analiz edilemiyor." }, { status: 422 });
  }
  return NextResponse.json({ stored: false, live: true, enriched: wantEnrich, analysis });
}
