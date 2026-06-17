import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-county demographic profile from the ACS 5-yr enrichment
// (scraper/build-county-demographics.js -> county_demographics table).
// The Deal Screener combines these facets into an opportunity score client-side.
// If the table or data is missing, return an empty list — never throw.
const normCounty = (c: string | null) =>
  (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();

export interface CountyProfile {
  state: string;
  county: string;
  income: number | null;       // median household income ($)
  medianAge: number | null;    // median age (years)
  population: number | null;
  homeValue: number | null;    // median home value ($)
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  // Public marketing data (allowlisted in middleware) — rate-limited, no gate.

  const s = supabaseAdmin();
  const counties: CountyProfile[] = [];

  try {
    let from = 0;
    for (;;) {
      const { data, error } = await s
        .from("county_demographics")
        .select("state,county,median_household_income,median_age,population,median_home_value")
        .range(from, from + 999);
      // Table absent / not yet created / any read error -> graceful empty.
      if (error) return NextResponse.json({ counties: [] });
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (!r.state || !r.county) continue;
        const nc = normCounty(r.county);
        if (!nc || nc === r.state.toUpperCase()) continue;
        counties.push({
          state: r.state,
          county: nc,
          income: r.median_household_income ?? null,
          medianAge: r.median_age ?? null,
          population: r.population ?? null,
          homeValue: r.median_home_value ?? null,
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch {
    return NextResponse.json({ counties: [] });
  }

  return NextResponse.json({ counties });
}
