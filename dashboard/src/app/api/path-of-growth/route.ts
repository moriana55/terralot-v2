import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// PATH-OF-GROWTH PREDICTOR
//
// Ranks counties most likely to "heat up" in the next 12-18 months using a
// documented composite MOMENTUM score (0..100). Each facet is min-max normalized
// across the loaded county universe, then weighted:
//
//   growth1y      25%  short-term population growth (pop_growth_1y) — leading edge
//   growth5y      15%  sustained 5y population growth (pop_growth_5y)
//   permits       20%  building-permit volume + permits_growth (construction lead)
//   catalyst      20%  announced megaproject in county (jobs/housing demand shock)
//   dealMomentum  10%  rising A-grade tax-deal supply (more activity = liquidity)
//   wealth        10%  median income (absorption capacity for new buyers)
//
// Facets with missing data contribute 0 (normalization reallocates weight, so
// counties with partial data still rank sensibly). pop_growth_*/permits live in
// county_demographics (additive columns) — when absent, the score leans on the
// catalyst + deal-momentum + demographic signals it CAN see (graceful).
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = { growth1y: 0.25, growth5y: 0.15, permits: 0.20, catalyst: 0.20, dealMomentum: 0.10, wealth: 0.10 } as const;

const CATALYST_COUNTIES = new Set([
  "AZ/MARICOPA", "OH/LICKING", "TX/WILLIAMSON", "NY/ONONDAGA", "TX/GRAYSON",
  "TN/HAYWOOD", "KY/HARDIN", "GA/BRYAN", "NC/RANDOLPH", "KS/JOHNSON",
  "GA/MORGAN", "TX/TAYLOR", "LA/RICHLAND",
]);
const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  interface CRow {
    state: string; county: string;
    income: number | null; population: number | null;
    g1: number | null; g5: number | null; permits: number | null; permitsGrowth: number | null;
    aGrade: number; hasCatalyst: boolean;
  }
  const counties = new Map<string, CRow>();

  // 1) demographics + growth/permits ----------------------------------------
  try {
    let from = 0;
    for (;;) {
      const { data, error } = await s
        .from("county_demographics")
        .select("state,county,median_household_income,population,pop_growth_1y,pop_growth_5y,building_permits,permits_growth")
        .range(from, from + 999);
      if (error) break;
      if (!data || data.length === 0) break;
      for (const r of data as Record<string, unknown>[]) {
        const st = r.state as string;
        const nc = normCounty(r.county as string);
        if (!st || !nc || nc === st.toUpperCase()) continue;
        const key = `${st}/${nc}`;
        counties.set(key, {
          state: st, county: nc,
          income: (r.median_household_income as number) ?? null,
          population: (r.population as number) ?? null,
          g1: (r.pop_growth_1y as number) ?? null,
          g5: (r.pop_growth_5y as number) ?? null,
          permits: (r.building_permits as number) ?? null,
          permitsGrowth: (r.permits_growth as number) ?? null,
          aGrade: 0,
          hasCatalyst: CATALYST_COUNTIES.has(key),
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch { /* graceful */ }

  // 2) deal momentum from tax leads -----------------------------------------
  try {
    let from = 0;
    for (;;) {
      const { data } = await s.from("tax_delinquent_properties").select("state,county,final_score").range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data as { state: string; county: string; final_score: number | null }[]) {
        if (!r.state || !r.county) continue;
        const nc = normCounty(r.county);
        const key = `${r.state}/${nc}`;
        let row = counties.get(key);
        if (!row) {
          // county not in demographics — still track for catalyst/deal signal
          row = { state: r.state, county: nc, income: null, population: null, g1: null, g5: null, permits: null, permitsGrowth: null, aGrade: 0, hasCatalyst: CATALYST_COUNTIES.has(key) };
          counties.set(key, row);
        }
        if ((r.final_score ?? 0) >= 70) row.aGrade++;
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch { /* graceful */ }

  const rows = [...counties.values()];

  // bounds for normalization
  const bound = (sel: (r: CRow) => number | null) => {
    let min = Infinity, max = -Infinity;
    for (const r of rows) { const v = sel(r); if (v == null) continue; min = Math.min(min, v); max = Math.max(max, v); }
    if (!isFinite(min)) { min = 0; max = 0; }
    return { min, max };
  };
  const norm = (v: number | null, b: { min: number; max: number }) => (v == null || b.max <= b.min ? 0 : clamp01((v - b.min) / (b.max - b.min)));

  const bG1 = bound((r) => r.g1);
  const bG5 = bound((r) => r.g5);
  const bIncome = bound((r) => r.income);
  const bAGrade = bound((r) => r.aGrade);
  // permits: combine volume + growth into a single 0..1 then bound
  const permitSignal = (r: CRow): number | null => {
    if (r.permits == null && r.permitsGrowth == null) return null;
    const vol = r.permits ?? 0;
    const gr = r.permitsGrowth ?? 0;
    return vol * (1 + Math.max(-0.9, gr)); // growth-adjusted volume
  };
  const bPermit = bound(permitSignal);

  const scored = rows.map((r) => {
    const g1N = norm(r.g1, bG1);
    const g5N = norm(r.g5, bG5);
    const permitN = norm(permitSignal(r), bPermit);
    const catalystN = r.hasCatalyst ? 1 : 0;
    const dealN = norm(r.aGrade, bAGrade);
    const wealthN = norm(r.income, bIncome);
    const parts = {
      growth1y: WEIGHTS.growth1y * g1N,
      growth5y: WEIGHTS.growth5y * g5N,
      permits: WEIGHTS.permits * permitN,
      catalyst: WEIGHTS.catalyst * catalystN,
      dealMomentum: WEIGHTS.dealMomentum * dealN,
      wealth: WEIGHTS.wealth * wealthN,
    };
    const momentum = Math.round(100 * (parts.growth1y + parts.growth5y + parts.permits + parts.catalyst + parts.dealMomentum + parts.wealth));
    return {
      state: r.state, county: r.county, momentum,
      g1: r.g1, g5: r.g5, permits: r.permits, income: r.income, aGrade: r.aGrade, hasCatalyst: r.hasCatalyst,
      parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 100)])),
    };
  }).sort((a, b) => b.momentum - a.momentum);

  const hasGrowthData = rows.some((r) => r.g1 != null || r.g5 != null || r.permits != null);

  return NextResponse.json({
    counties: scored.slice(0, 100),
    weights: WEIGHTS,
    meta: { total: scored.length, hasGrowthData },
  });
}
