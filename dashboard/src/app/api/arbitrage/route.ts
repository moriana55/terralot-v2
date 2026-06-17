import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// TAX-DEAL ARBITRAGE RADAR
//
// Scans tax_delinquent_properties and estimates INTRINSIC value for each parcel,
// then ranks by discount % vs the tax/min-bid (the price you can actually pay).
//
// Intrinsic value, best-available source (in priority order):
//   1) acres × county-median $/acre  (county comp — most accurate, needs county data)
//   2) acres × state-median $/acre   (state retail benchmark from competitor_listings)
//   3) judgment_amount               (assessor/judgment proxy)
//
// price floor = minimum_bid (fallback judgment_amount when no bid)
// discount %  = (intrinsicValue − price) / intrinsicValue
// value gap $ = intrinsicValue − price
//
// Only parcels with a positive, computable gap are ranked. Graceful when the
// pricing columns / market data are missing (returns whatever it can compute).
// ─────────────────────────────────────────────────────────────────────────────

const FULL: Record<string, string> = {
  alabama: "AL", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new mexico": "NM", "new york": "NY", "north carolina": "NC", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "south carolina": "SC", tennessee: "TN",
  texas: "TX", utah: "UT", virginia: "VA", washington: "WA", wisconsin: "WI", wyoming: "WY",
};
const ABBR = new Set(Object.values(FULL));
function normState(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Za-z]{2}$/.test(t) && ABBR.has(t.toUpperCase())) return t.toUpperCase();
  const low = t.toLowerCase();
  for (const [name, ab] of Object.entries(FULL)) if (low === name || low.startsWith(name + " ")) return ab;
  return null;
}
const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();
const median = (a: number[]) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();
  const stateFilter = req.nextUrl.searchParams.get("state");
  const minGap = Number(req.nextUrl.searchParams.get("minGap") || "0"); // min discount %

  // 1) Build county + state median $/acre tables from competitor_listings ----
  const stateRates: Record<string, number> = {};
  const countyRates: Record<string, number> = {};
  let benchmarkAvailable = false;
  try {
    const { data } = await s.from("competitor_listings").select("state,county,price,acres");
    const byState: Record<string, number[]> = {};
    const byCounty: Record<string, number[]> = {};
    for (const r of (data as { state: string; county: string; price: number; acres: number }[]) || []) {
      const st = normState(r.state);
      if (!st || !(r.price > 0) || !(r.acres > 0)) continue;
      const ppa = r.price / r.acres;
      (byState[st] ||= []).push(ppa);
      const cty = normCounty(r.county);
      if (cty) (byCounty[`${st}/${cty}`] ||= []).push(ppa);
    }
    for (const [k, arr] of Object.entries(byState)) if (arr.length >= 3) stateRates[k] = Math.round(median(arr) || 0);
    for (const [k, arr] of Object.entries(byCounty)) if (arr.length >= 3) countyRates[k] = Math.round(median(arr) || 0);
    benchmarkAvailable = Object.keys(stateRates).length > 0;
  } catch { /* graceful */ }

  // 2) Sweep tax leads -------------------------------------------------------
  interface Opp {
    id: string; state: string | null; county: string | null; apn: string | null;
    acres: number | null; price: number | null; intrinsic: number; gap: number;
    discountPct: number; basis: "county_comp" | "state_comp" | "judgment";
    finalScore: number | null; source: string | null; saleDate: string | null;
    ownerName: string | null; rawUrl: string | null;
  }
  const opps: Opp[] = [];
  let scanned = 0;

  try {
    let from = 0;
    for (;;) {
      let q = s
        .from("tax_delinquent_properties")
        .select("id,state,county,apn,acres,minimum_bid,judgment_amount,final_score,source,sale_date,owner_name,raw_url")
        .range(from, from + 999);
      if (stateFilter && stateFilter !== "all") q = q.eq("state", stateFilter);
      const { data, error } = await q;
      if (error) break;
      if (!data || data.length === 0) break;
      for (const r of data as Record<string, unknown>[]) {
        scanned++;
        const st = normState(r.state as string);
        const cty = normCounty(r.county as string);
        const acres = (r.acres as number) ?? null;
        const price = (r.minimum_bid as number) ?? (r.judgment_amount as number) ?? null;
        if (price == null || price <= 0) continue;

        // intrinsic value
        let intrinsic: number | null = null;
        let basis: Opp["basis"] = "judgment";
        if (acres && acres > 0 && st) {
          const cr = countyRates[`${st}/${cty}`];
          const sr = stateRates[st];
          if (cr) { intrinsic = Math.round(acres * cr); basis = "county_comp"; }
          else if (sr) { intrinsic = Math.round(acres * sr); basis = "state_comp"; }
        }
        if (intrinsic == null && r.judgment_amount && (r.judgment_amount as number) > 0) {
          intrinsic = r.judgment_amount as number; basis = "judgment";
        }
        if (intrinsic == null || intrinsic <= price) continue; // need a real positive gap

        const gap = intrinsic - price;
        const discountPct = Math.round((gap / intrinsic) * 100);
        if (discountPct < minGap) continue;

        opps.push({
          id: r.id as string, state: (r.state as string) ?? null, county: (r.county as string) ?? null,
          apn: (r.apn as string) ?? null, acres, price, intrinsic, gap, discountPct, basis,
          finalScore: (r.final_score as number) ?? null, source: (r.source as string) ?? null,
          saleDate: (r.sale_date as string) ?? null, ownerName: (r.owner_name as string) ?? null,
          rawUrl: (r.raw_url as string) ?? null,
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch { /* graceful */ }

  opps.sort((a, b) => b.discountPct - a.discountPct || b.gap - a.gap);
  const top = opps.slice(0, 100);

  const summary = {
    scanned,
    opportunities: opps.length,
    totalGap: opps.reduce((a, o) => a + o.gap, 0),
    avgDiscount: opps.length ? Math.round(opps.reduce((a, o) => a + o.discountPct, 0) / opps.length) : 0,
    benchmarkAvailable,
    countyComps: opps.filter((o) => o.basis === "county_comp").length,
  };

  return NextResponse.json({ summary, opportunities: top });
}
