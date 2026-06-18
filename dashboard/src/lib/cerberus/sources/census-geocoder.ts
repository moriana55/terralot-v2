// US Census Geocoder — address → lat/lng + state/county FIPS + census tract.
// Free, no key. https://geocoding.geo.census.gov
//
// Signal produced: canonical coordinates (so a parcel with only an address can
// be enriched by the lat/lng sources) + FIPS codes (so the ACS demographics
// adapter can query the exact county/tract). Always real, never estimated.
//
// Endpoint (onelineaddress, current public benchmark):
//   geocoding.geo.census.gov/geocoder/geographies/onelineaddress
//     ?address=...&benchmark=Public_AR_Current&vintage=Current_Current&format=json

import { fetchJson, qs } from "./http";

export interface CensusGeo {
  lat: number;
  lng: number;
  matchedAddress: string | null;
  stateFips: string | null; // 2-digit
  countyFips: string | null; // 3-digit (county within state)
  tract: string | null; // 6-digit census tract code
}

/**
 * PURE: normalize a Census geocoder `geographies` response into CensusGeo.
 * Returns null when there is no usable match. Tested with mocked JSON.
 */
export function parseCensusGeocode(json: unknown): CensusGeo | null {
  if (!json || typeof json !== "object") return null;
  const result = (json as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return null;
  const matches = (result as Record<string, unknown>).addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const m = matches[0] as Record<string, unknown>;

  const coords = m.coordinates as Record<string, unknown> | undefined;
  const x = Number(coords?.x); // longitude
  const y = Number(coords?.y); // latitude
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(y) > 90 || Math.abs(x) > 180) return null;

  let stateFips: string | null = null;
  let countyFips: string | null = null;
  let tract: string | null = null;
  const geos = m.geographies as Record<string, unknown> | undefined;
  if (geos && typeof geos === "object") {
    // Census Tracts layer carries STATE/COUNTY/TRACT together.
    const tracts = (geos["Census Tracts"] ?? geos["Census Blocks"]) as unknown;
    const arr = Array.isArray(tracts) ? tracts : null;
    const g0 = arr && arr[0] && typeof arr[0] === "object" ? (arr[0] as Record<string, unknown>) : null;
    if (g0) {
      const st = g0.STATE != null ? String(g0.STATE) : null;
      const co = g0.COUNTY != null ? String(g0.COUNTY) : null;
      const tr = g0.TRACT != null ? String(g0.TRACT) : null;
      stateFips = st && /^\d{1,2}$/.test(st) ? st.padStart(2, "0") : null;
      countyFips = co && /^\d{1,3}$/.test(co) ? co.padStart(3, "0") : null;
      tract = tr && /^\d{1,6}$/.test(tr) ? tr.padStart(6, "0") : null;
    }
  }

  return {
    lat: y,
    lng: x,
    matchedAddress: typeof m.matchedAddress === "string" ? m.matchedAddress : null,
    stateFips,
    countyFips,
    tract,
  };
}

/** Geocode a one-line US address. Returns null on any failure. */
export async function geocodeAddress(address: string): Promise<CensusGeo | null> {
  const a = address?.trim();
  if (!a || a.length < 4) return null;
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" +
    qs({
      address: a,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json",
    });
  const json = await fetchJson(url, { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 30 });
  return parseCensusGeocode(json);
}

/**
 * Reverse-style coordinate → FIPS lookup via the `coordinates` benchmark, so a
 * parcel that already has lat/lng can still resolve its county/tract for ACS.
 */
export async function fipsForLatLng(lat: number, lng: number): Promise<CensusGeo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates?" +
    qs({
      x: lng,
      y: lat,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json",
    });
  const json = await fetchJson(url, { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 30 });
  // The coordinates endpoint nests under result.geographies (no addressMatches);
  // adapt it into the same shape the parser expects.
  if (json && typeof json === "object") {
    const result = (json as Record<string, unknown>).result as Record<string, unknown> | undefined;
    const geos = result?.geographies;
    if (geos) {
      const adapted = { result: { addressMatches: [{ coordinates: { x: lng, y: lat }, geographies: geos, matchedAddress: null }] } };
      return parseCensusGeocode(adapted);
    }
  }
  return null;
}
