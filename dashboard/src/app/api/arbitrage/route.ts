import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { saneAcres, saneBid, medianPpa, intrinsicValue, DISCOUNT_CAP, type Basis, type Confidence } from "@/lib/land-valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// TAX-DEAL ARBITRAGE RADAR
//
// Scans tax_delinquent_properties and estimates INTRINSIC land value for each
// parcel, then ranks by the dollar value gap vs the min-bid (the price you can
// actually pay).
//
// Intrinsic value = acres × median $/acre comp (county comp preferred, else
// state comp). We deliberately DO NOT fall back to judgment_amount — back taxes
// owed are not land value, and using them produced misleading "discounts".
//
// All inputs are sanitized (see lib/land-valuation): acreage outliers (the data
// has 80,000-acre parsing errors), billion-dollar bids, and $/acre comp outliers
// are rejected. Parcels we cannot value honestly (no acreage, ~66% of rows, or
// no comparable $/acre data for their market) are reported as skipped, NOT given
// a fake valuation.
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

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();
  const rawState = req.nextUrl.searchParams.get("state");
  // Bound the state filter to a sane token (2-letter abbr, "all", or null) so it
  // can't smuggle anything into the query; reject overly long junk.
  const stateFilter = rawState && rawState.length <= 30 ? rawState : null;
  // minGap: clamp to 0..100, NaN → 0 (never let NaN silently disable the filter).
  const rawGap = Number(req.nextUrl.searchParams.get("minGap"));
  const minGap = Number.isFinite(rawGap) ? Math.max(0, Math.min(100, rawGap)) : 0; // min discount %

  // 1) Build county + state median $/acre tables (outlier-stripped) ----------
  const stateRates: Record<string, number> = {};
  const countyRates: Record<string, number> = {};
  let benchmarkAvailable = false;
  try {
    const { data } = await s.from("competitor_listings").select("state,county,price,acres");
    const byState: Record<string, { price: unknown; acres: unknown }[]> = {};
    const byCounty: Record<string, { price: unknown; acres: unknown }[]> = {};
    for (const r of (data as { state: string; county: string; price: number; acres: number }[]) || []) {
      const st = normState(r.state);
      if (!st) continue;
      (byState[st] ||= []).push({ price: r.price, acres: r.acres });
      const cty = normCounty(r.county);
      if (cty) (byCounty[`${st}/${cty}`] ||= []).push({ price: r.price, acres: r.acres });
    }
    for (const [k, arr] of Object.entries(byState)) { const m = medianPpa(arr); if (m) stateRates[k] = m; }
    for (const [k, arr] of Object.entries(byCounty)) { const m = medianPpa(arr); if (m) countyRates[k] = m; }
    benchmarkAvailable = Object.keys(stateRates).length > 0;
  } catch { /* graceful */ }

  // 2) Sweep tax leads -------------------------------------------------------
  interface Opp {
    id: string; state: string | null; county: string | null; apn: string | null;
    acres: number | null; price: number; intrinsic: number; gap: number;
    discountPct: number; flagged: boolean; basis: Basis; confidence: Confidence; ppa: number;
    finalScore: number | null; source: string | null; saleDate: string | null;
    ownerName: string | null; rawUrl: string | null;
  }
  const opps: Opp[] = [];
  let scanned = 0, skippedNoPrice = 0, skippedNoAcreage = 0, skippedNoComps = 0, valued = 0;

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
        const acres = saneAcres(r.acres);
        const price = saneBid(r.minimum_bid) ?? saneBid(r.judgment_amount);

        if (price == null) { skippedNoPrice++; continue; }
        if (acres == null) { skippedNoAcreage++; continue; }

        const countyRate = st ? countyRates[`${st}/${cty}`] ?? null : null;
        const stateRate = st ? stateRates[st] ?? null : null;
        const { value: intrinsic, basis, confidence: baseConf } = intrinsicValue({ acres, countyRate, stateRate });
        if (intrinsic == null) { skippedNoComps++; continue; }
        valued++;

        if (intrinsic <= price) continue; // no positive gap → not an opportunity
        const gap = intrinsic - price;
        const rawDiscount = Math.round((gap / intrinsic) * 100);
        // A >70% discount on raw land almost always means incomplete price data
        // (min-bid = back-taxes only) — cap the displayed figure and flag for review.
        const flagged = rawDiscount > DISCOUNT_CAP;
        const discountPct = Math.min(rawDiscount, DISCOUNT_CAP);
        const confidence: Confidence = flagged ? "low" : baseConf;
        if (discountPct < minGap) continue;

        opps.push({
          id: r.id as string, state: (r.state as string) ?? null, county: (r.county as string) ?? null,
          apn: (r.apn as string) ?? null, acres, price, intrinsic, gap, discountPct, flagged, basis, confidence,
          ppa: Math.round(intrinsic / acres),
          finalScore: (r.final_score as number) ?? null, source: (r.source as string) ?? null,
          saleDate: (r.sale_date as string) ?? null, ownerName: (r.owner_name as string) ?? null,
          rawUrl: (r.raw_url as string) ?? null,
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch { /* graceful */ }

  // Rank real, confident opportunities first: unflagged before "too-good/verify",
  // then by confidence, then by absolute dollar gap.
  const confRank = { high: 2, medium: 1, low: 0 } as const;
  opps.sort((a, b) =>
    Number(a.flagged) - Number(b.flagged) ||
    confRank[b.confidence] - confRank[a.confidence] ||
    b.gap - a.gap ||
    b.discountPct - a.discountPct
  );
  const top = opps.slice(0, 100);
  const solid = opps.filter((o) => !o.flagged);

  const summary = {
    scanned,
    scoreable: valued, // parcels we could value honestly (sane acreage + comps)
    opportunities: opps.length, // of those, the ones trading below intrinsic
    flagged: opps.length - solid.length, // shown but need manual verification (capped discount)
    skippedNoPrice,
    skippedNoAcreage, // ~66% of the data lacks acreage
    skippedNoComps, // no comparable $/acre for that market
    totalGap: solid.reduce((a, o) => a + o.gap, 0),
    avgDiscount: solid.length ? Math.round(solid.reduce((a, o) => a + o.discountPct, 0) / solid.length) : 0,
    benchmarkAvailable,
    countyComps: opps.filter((o) => o.basis === "county_comp").length,
  };

  return NextResponse.json({ summary, opportunities: top });
}
