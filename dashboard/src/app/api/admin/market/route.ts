import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { medianPpa } from "@/lib/land-valuation";
import { normCounty, abbrState } from "@/lib/cerberus/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// MARKET ANALYTICS (read-only, gated) — powers /admin/market.
//
// CoStar-style market intelligence aggregated LIVE from the real tables:
//   • lead_analyses        → per-state/county deal aggregates (avg $/acre comp,
//                            median discount/margin, deal volume, AL/BEKLE/GEÇ
//                            distribution, opportunity score).
//   • competitor_listings  → market $/acre medians per state/county (supply-side
//                            retail benchmark, listing volume).
//   • upcoming_sales       → forward supply: count of upcoming tax-sales per
//                            state/county (a real "what's coming to market" signal).
//
// HONEST DEGRADATION: missing tables/empty tables return tableReady flags + empty
// arrays so the UI shows truthful empty states, never invented metrics. Nothing is
// fabricated; medians come straight from the same pure helpers the pipeline uses.
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSES = "lead_analyses";
const LISTINGS = "competitor_listings";
const UPCOMING = "upcoming_sales";
const DB_PAGE = 1000;

type Verdict = "BUY" | "WATCH" | "PASS";

interface CountyAgg {
  state: string;
  county: string;
  deals: number;
  buy: number;
  watch: number;
  pass: number;
  marginSum: number;
  marginN: number;
  discountSum: number;
  discountN: number;
  compPpaSum: number;
  compPpaN: number;
  scoreSum: number;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const b = [...arr].sort((a, c) => a - c);
  const m = Math.floor(b.length / 2);
  return Math.round(b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2);
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  // ── 1) lead_analyses → per-county deal aggregates ───────────────────────────
  const counties = new Map<string, CountyAgg>();
  const marginsByCounty = new Map<string, number[]>();
  const discountsByCounty = new Map<string, number[]>();
  let analysesTableReady = true;
  let totalDeals = 0;
  const verdictTotals: Record<Verdict, number> = { BUY: 0, WATCH: 0, PASS: 0 };

  try {
    let from = 0;
    for (let page = 0; page < 30; page++) {
      const { data, error } = await s
        .from(ANALYSES)
        .select("state,county,verdict,score,margin,discount_pct,per_acre,comp_value,acres")
        .range(from, from + DB_PAGE - 1);
      if (error) { analysesTableReady = false; break; }
      if (!data || data.length === 0) break;
      for (const r of data as Record<string, unknown>[]) {
        const st = abbrState(r.state as string) || (typeof r.state === "string" ? r.state : null);
        const cty = normCounty(r.county as string) || (typeof r.county === "string" ? r.county : null);
        if (!st || !cty) continue;
        const k = `${st}/${cty}`;
        let agg = counties.get(k);
        if (!agg) {
          agg = { state: st, county: cty, deals: 0, buy: 0, watch: 0, pass: 0, marginSum: 0, marginN: 0, discountSum: 0, discountN: 0, compPpaSum: 0, compPpaN: 0, scoreSum: 0 };
          counties.set(k, agg);
        }
        agg.deals++;
        totalDeals++;
        const v = String(r.verdict || "") as Verdict;
        if (v === "BUY") { agg.buy++; verdictTotals.BUY++; }
        else if (v === "WATCH") { agg.watch++; verdictTotals.WATCH++; }
        else if (v === "PASS") { agg.pass++; verdictTotals.PASS++; }
        agg.scoreSum += num(r.score) ?? 0;
        const margin = num(r.margin);
        if (margin != null) { agg.marginSum += margin; agg.marginN++; (marginsByCounty.get(k) ?? marginsByCounty.set(k, []).get(k)!).push(margin); }
        const disc = num(r.discount_pct);
        if (disc != null) { agg.discountSum += disc; agg.discountN++; (discountsByCounty.get(k) ?? discountsByCounty.set(k, []).get(k)!).push(disc); }
        const ppa = num(r.per_acre);
        if (ppa != null && ppa > 0) { agg.compPpaSum += ppa; agg.compPpaN++; }
      }
      if (data.length < DB_PAGE) break;
      from += DB_PAGE;
    }
  } catch {
    analysesTableReady = false;
  }

  // ── 2) competitor_listings → market $/acre median per state + county ────────
  const listingByState = new Map<string, { price: unknown; acres: unknown }[]>();
  const listingByCounty = new Map<string, { price: unknown; acres: unknown }[]>();
  let listingsTableReady = true;
  try {
    let from = 0;
    for (let page = 0; page < 30; page++) {
      const { data, error } = await s.from(LISTINGS).select("state,county,price,acres").range(from, from + DB_PAGE - 1);
      if (error) { listingsTableReady = false; break; }
      if (!data || data.length === 0) break;
      for (const r of data as { state: string; county: string; price: unknown; acres: unknown }[]) {
        const st = abbrState(r.state);
        if (!st) continue;
        (listingByState.get(st) ?? listingByState.set(st, []).get(st)!).push({ price: r.price, acres: r.acres });
        const cty = normCounty(r.county);
        if (cty) {
          const k = `${st}/${cty}`;
          (listingByCounty.get(k) ?? listingByCounty.set(k, []).get(k)!).push({ price: r.price, acres: r.acres });
        }
      }
      if (data.length < DB_PAGE) break;
      from += DB_PAGE;
    }
  } catch {
    listingsTableReady = false;
  }

  // ── 3) upcoming_sales → forward supply per state + county ───────────────────
  const upcomingByState = new Map<string, number>();
  const upcomingByCounty = new Map<string, number>();
  let upcomingTableReady = true;
  let upcomingTotal = 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    let from = 0;
    for (let page = 0; page < 10; page++) {
      const { data, error } = await s
        .from(UPCOMING)
        .select("state,county,sale_date")
        .gte("sale_date", today)
        .range(from, from + DB_PAGE - 1);
      if (error) { upcomingTableReady = false; break; }
      if (!data || data.length === 0) break;
      for (const r of data as { state: string; county: string }[]) {
        const st = abbrState(r.state) || r.state;
        if (!st) continue;
        upcomingByState.set(st, (upcomingByState.get(st) ?? 0) + 1);
        upcomingTotal++;
        const cty = normCounty(r.county);
        if (cty) {
          const k = `${st}/${cty}`;
          upcomingByCounty.set(k, (upcomingByCounty.get(k) ?? 0) + 1);
        }
      }
      if (data.length < DB_PAGE) break;
      from += DB_PAGE;
    }
  } catch {
    upcomingTableReady = false;
  }

  // ── 4) Compose per-county rows ──────────────────────────────────────────────
  const countyRows = [...counties.values()].map((a) => {
    const k = `${a.state}/${a.county}`;
    const marketPpa = listingByCounty.has(k) ? medianPpa(listingByCounty.get(k)!, 3) : null;
    const buyRate = a.deals ? a.buy / a.deals : 0;
    const avgMargin = a.marginN ? a.marginSum / a.marginN : null;
    const medMargin = median((marginsByCounty.get(k) ?? []).map((m) => m * 100));
    const avgDiscount = a.discountN ? Math.round(a.discountSum / a.discountN) : null;
    const medDiscount = median(discountsByCounty.get(k) ?? []);
    const compPpa = a.compPpaN ? Math.round(a.compPpaSum / a.compPpaN) : null;
    // Opportunity score: blend BUY-rate, deal volume (log), median margin.
    const oppScore = Math.round(
      buyRate * 55 +
      Math.min(25, Math.log10(a.deals + 1) * 14) +
      Math.min(20, (medMargin ?? 0) * 0.4)
    );
    return {
      state: a.state,
      county: a.county,
      deals: a.deals,
      buy: a.buy,
      watch: a.watch,
      pass: a.pass,
      buyRate: Math.round(buyRate * 100),
      avgScore: a.deals ? Math.round(a.scoreSum / a.deals) : 0,
      avgMargin: avgMargin != null ? Math.round(avgMargin * 100) : null,
      medMargin,
      avgDiscount,
      medDiscount,
      compPpa,
      marketPpa,
      upcoming: upcomingByCounty.get(k) ?? 0,
      oppScore,
    };
  });

  countyRows.sort((a, b) => b.oppScore - a.oppScore || b.deals - a.deals);

  // ── 5) Per-state rollup ─────────────────────────────────────────────────────
  const stateMap = new Map<string, { state: string; deals: number; buy: number; watch: number; pass: number; counties: number; upcoming: number; marginVals: number[]; discountVals: number[] }>();
  for (const r of countyRows) {
    let st = stateMap.get(r.state);
    if (!st) { st = { state: r.state, deals: 0, buy: 0, watch: 0, pass: 0, counties: 0, upcoming: 0, marginVals: [], discountVals: [] }; stateMap.set(r.state, st); }
    st.deals += r.deals; st.buy += r.buy; st.watch += r.watch; st.pass += r.pass; st.counties++;
    st.upcoming += r.upcoming;
    if (r.medMargin != null) st.marginVals.push(r.medMargin);
    if (r.medDiscount != null) st.discountVals.push(r.medDiscount);
  }
  const stateRows = [...stateMap.values()].map((st) => {
    const marketPpa = listingByState.has(st.state) ? medianPpa(listingByState.get(st.state)!, 3) : null;
    return {
      state: st.state,
      deals: st.deals,
      buy: st.buy,
      watch: st.watch,
      pass: st.pass,
      counties: st.counties,
      buyRate: st.deals ? Math.round((st.buy / st.deals) * 100) : 0,
      medMargin: median(st.marginVals),
      medDiscount: median(st.discountVals),
      marketPpa,
      upcoming: st.upcoming + (upcomingByState.get(st.state) && !st.counties ? upcomingByState.get(st.state)! : 0),
      listingN: listingByState.get(st.state)?.length ?? 0,
    };
  }).sort((a, b) => b.deals - a.deals);

  return NextResponse.json({
    tableReady: {
      analyses: analysesTableReady,
      listings: listingsTableReady,
      upcoming: upcomingTableReady,
    },
    totals: {
      deals: totalDeals,
      counties: countyRows.length,
      states: stateRows.length,
      upcoming: upcomingTotal,
      verdicts: verdictTotals,
    },
    states: stateRows,
    counties: countyRows,
    topCounties: countyRows.slice(0, 15),
  });
}
