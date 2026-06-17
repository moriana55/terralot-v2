import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// LOOKALIKE COUNTY FINDER
//
//   GET /api/lookalike                                  → universe (county list)
//   GET /api/lookalike?state=TX&county=Grayson          → similar counties
//   GET /api/lookalike?...&metric=cosine|euclidean      → distance metric (default cosine)
//
// Picks a "winner" county and ranks every other county by demographic + growth
// similarity. Facets are pulled from county_demographics (reused via the same
// access pattern as deal-screener / county-demographics) plus deal-density and
// upcoming-sale signals from tax_delinquent_properties + upcoming_sales.
//
// FACET VECTOR (each z-score standardized across the universe, then compared):
//   income, medianAge, population, homeValue, popGrowth5y, dealDensity
//
//   similarity% = cosine  → 100 * (cos(a,b)+1)/2     (maps [-1,1] → [0,100])
//                 euclid  → 100 * exp(-dist/scale)    (closer → higher)
//
// Missing facets are imputed to the universe mean (z=0) so partial-data counties
// still rank sensibly. Graceful empty state when county_demographics is absent.
// ─────────────────────────────────────────────────────────────────────────────

const normCounty = (c: string | null) =>
  (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();

interface Facet {
  state: string;
  county: string;
  income: number | null;
  medianAge: number | null;
  population: number | null;
  homeValue: number | null;
  popGrowth: number | null;
  dealDensity: number; // # of A-grade (final_score>=70) deals
}

const FACET_KEYS = ["income", "medianAge", "population", "homeValue", "popGrowth", "dealDensity"] as const;
type FacetKey = (typeof FACET_KEYS)[number];

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const wantState = (sp.get("state") || "").toUpperCase().trim();
  const wantCounty = normCounty(sp.get("county"));
  const metric = sp.get("metric") === "euclidean" ? "euclidean" : "cosine";

  const s = supabaseAdmin();

  // 1) demographics (with optional growth columns) ---------------------------
  const facets: Facet[] = [];
  const byKey = new Map<string, Facet>();
  try {
    let from = 0;
    for (;;) {
      // try richer select (pop_growth_5y may not exist yet)
      let data: Record<string, unknown>[] | null = null;
      const rich = await s
        .from("county_demographics")
        .select("state,county,median_household_income,median_age,population,median_home_value,pop_growth_5y")
        .range(from, from + 999);
      if (rich.error) {
        const fb = await s
          .from("county_demographics")
          .select("state,county,median_household_income,median_age,population,median_home_value")
          .range(from, from + 999);
        if (fb.error) return NextResponse.json({ universe: [], similar: [] });
        data = fb.data as Record<string, unknown>[] | null;
      } else {
        data = rich.data as Record<string, unknown>[] | null;
      }
      if (!data || data.length === 0) break;
      for (const r of data) {
        const st = String(r.state || "").toUpperCase();
        const nc = normCounty(String(r.county || ""));
        if (!st || !nc || nc === st) continue;
        const f: Facet = {
          state: st,
          county: nc,
          income: (r.median_household_income as number) ?? null,
          medianAge: (r.median_age as number) ?? null,
          population: (r.population as number) ?? null,
          homeValue: (r.median_home_value as number) ?? null,
          popGrowth: (r.pop_growth_5y as number) ?? null,
          dealDensity: 0,
        };
        facets.push(f);
        byKey.set(`${st}/${nc}`, f);
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch {
    return NextResponse.json({ universe: [], similar: [] });
  }

  if (facets.length === 0) return NextResponse.json({ universe: [], similar: [] });

  // 2) deal density from tax_delinquent_properties ---------------------------
  try {
    let from = 0;
    for (;;) {
      const { data } = await s.from("tax_delinquent_properties").select("state,county,final_score").range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (!r.state || !r.county) continue;
        const nc = normCounty(r.county);
        const f = byKey.get(`${String(r.state).toUpperCase()}/${nc}`);
        if (f && (r.final_score ?? 0) >= 70) f.dealDensity++;
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch { /* graceful */ }

  // universe list (lightweight) for the picker
  const universe = facets
    .map((f) => ({ state: f.state, county: f.county }))
    .sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county));

  // No winner selected → just return the universe so the UI can populate the picker.
  if (!wantState || !wantCounty) return NextResponse.json({ universe, similar: [], winner: null });

  const winner = byKey.get(`${wantState}/${wantCounty}`);
  if (!winner) return NextResponse.json({ universe, similar: [], winner: null, reason: "winner not found" });

  // 3) standardize facets (z-scores across universe) -------------------------
  const stats: Record<FacetKey, { mean: number; std: number }> = {} as Record<FacetKey, { mean: number; std: number }>;
  for (const k of FACET_KEYS) {
    const vals = facets.map((f) => f[k]).filter((v): v is number => v != null && isFinite(v));
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const variance = vals.length ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length : 0;
    stats[k] = { mean, std: Math.sqrt(variance) || 1 };
  }
  const vec = (f: Facet): number[] =>
    FACET_KEYS.map((k) => {
      const v = f[k];
      if (v == null || !isFinite(v)) return 0; // impute to mean (z=0)
      return (v - stats[k].mean) / stats[k].std;
    });

  const wv = vec(winner);
  const dot = (a: number[], b: number[]) => a.reduce((s2, x, i) => s2 + x * b[i], 0);
  const mag = (a: number[]) => Math.sqrt(dot(a, a));
  const euclid = (a: number[], b: number[]) => Math.sqrt(a.reduce((s2, x, i) => s2 + (x - b[i]) ** 2, 0));
  const wMag = mag(wv) || 1;
  // euclidean scale ~ typical spread (sqrt of dimension count) for the exp decay
  const eScale = Math.sqrt(FACET_KEYS.length);

  const similar = facets
    .filter((f) => !(f.state === winner.state && f.county === winner.county))
    .map((f) => {
      const fv = vec(f);
      let similarity: number;
      if (metric === "euclidean") {
        const d = euclid(wv, fv);
        similarity = Math.round(100 * Math.exp(-d / eScale));
      } else {
        const cos = dot(wv, fv) / ((mag(fv) || 1) * wMag);
        similarity = Math.round(100 * ((cos + 1) / 2));
      }
      return {
        state: f.state,
        county: f.county,
        similarity,
        income: f.income,
        medianAge: f.medianAge,
        population: f.population,
        homeValue: f.homeValue,
        popGrowth: f.popGrowth,
        dealDensity: f.dealDensity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);

  return NextResponse.json({
    universe,
    metric,
    winner: {
      state: winner.state,
      county: winner.county,
      income: winner.income,
      medianAge: winner.medianAge,
      population: winner.population,
      homeValue: winner.homeValue,
      popGrowth: winner.popGrowth,
      dealDensity: winner.dealDensity,
    },
    facets: FACET_KEYS,
    similar,
  });
}
