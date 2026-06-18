// US Census ACS (American Community Survey) — county demographics by FIPS.
// api.census.gov works keyless at low volume; an optional CENSUS_API_KEY raises
// the limit. https://api.census.gov/data/2022/acs/acs5
//
// Signal produced: population + median household income for the county → fills a
// county_demographics-style signal used by the lookalike screener + scoring.
// Population GROWTH is computed by comparing two ACS vintages (current vs ~5y
// prior) so the buy-box "demand" facet uses a REAL number, not a heuristic.
//
// Variables:
//   B01003_001E = total population
//   B19013_001E = median household income (USD)

import { fetchJson, qs } from "./http";

export interface Demographics {
  population: number | null;
  medianIncome: number | null;
  /** 5-year population growth as a fraction (e.g. 0.06 = +6%), or null. */
  popGrowth5y: number | null;
  vintage: number | null;
  priorVintage: number | null;
}

/**
 * PURE: parse the ACS array-of-arrays response. First row is the header.
 * Returns { population, medianIncome } from the requested variables, or null.
 */
export function parseAcsRow(json: unknown): { population: number | null; medianIncome: number | null } | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const header = json[0];
  const row = json[1];
  if (!Array.isArray(header) || !Array.isArray(row)) return null;
  const idxPop = header.indexOf("B01003_001E");
  const idxInc = header.indexOf("B19013_001E");
  const numOrNull = (v: unknown): number | null => {
    const n = Number(v);
    // ACS uses large negative sentinels (e.g. -666666666) for "no data".
    if (!Number.isFinite(n) || n <= -1000000) return null;
    return n;
  };
  return {
    population: idxPop >= 0 ? numOrNull(row[idxPop]) : null,
    medianIncome: idxInc >= 0 ? numOrNull(row[idxInc]) : null,
  };
}

/** PURE: combine current + prior ACS population into a growth fraction. */
export function computeGrowth(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior <= 0) return null;
  const g = (current - prior) / prior;
  if (!Number.isFinite(g)) return null;
  // Clamp to a sane band so a bad FIPS join can't poison the score.
  return Math.max(-0.5, Math.min(2, g));
}

const CURRENT_VINTAGE = 2022;
const PRIOR_VINTAGE = 2017;

function acsUrl(vintage: number, stateFips: string, countyFips: string): string {
  return (
    `https://api.census.gov/data/${vintage}/acs/acs5?` +
    qs({
      get: "B01003_001E,B19013_001E,NAME",
      for: `county:${countyFips}`,
      in: `state:${stateFips}`,
      key: process.env.CENSUS_API_KEY || undefined, // optional; keyless works low-volume
    })
  );
}

/** Fetch county demographics + 5y population growth. Returns null on failure. */
export async function demographicsForCounty(stateFips: string, countyFips: string): Promise<Demographics | null> {
  if (!/^\d{2}$/.test(stateFips) || !/^\d{3}$/.test(countyFips)) return null;
  const [curJson, priorJson] = await Promise.all([
    fetchJson(acsUrl(CURRENT_VINTAGE, stateFips, countyFips), { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 30 }),
    fetchJson(acsUrl(PRIOR_VINTAGE, stateFips, countyFips), { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 30 }),
  ]);
  const cur = parseAcsRow(curJson);
  if (!cur) return null; // current is required; prior is best-effort
  const prior = parseAcsRow(priorJson);
  return {
    population: cur.population,
    medianIncome: cur.medianIncome,
    popGrowth5y: computeGrowth(cur.population, prior?.population ?? null),
    vintage: CURRENT_VINTAGE,
    priorVintage: prior ? PRIOR_VINTAGE : null,
  };
}
