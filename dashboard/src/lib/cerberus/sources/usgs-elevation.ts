// USGS Elevation Point Query Service (EPQS) — elevation by lat/lng.
// Free, no key. https://epqs.nationalmap.gov/v1/json?x=LNG&y=LAT&units=Feet
//
// Signal produced: ground elevation (feet + meters) → a terrain signal. Very
// low elevation near water can corroborate flood risk; this is surfaced
// informationally and never fabricated.

import { fetchJson, qs } from "./http";

export interface ElevationInfo {
  feet: number | null;
  meters: number | null;
}

/** PURE: normalize an EPQS JSON response → ElevationInfo. */
export function parseUsgsElevation(json: unknown): ElevationInfo | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  // v1 shape: { value: 1234.56, ... }  (older: USGS_Elevation_Point_Query_Service.Elevation_Query.Elevation)
  let raw: unknown = o.value;
  if (raw == null) {
    const legacy = (o.USGS_Elevation_Point_Query_Service as Record<string, unknown> | undefined)
      ?.Elevation_Query as Record<string, unknown> | undefined;
    raw = legacy?.Elevation;
  }
  const feet = Number(raw);
  // EPQS returns -1000000 as a sentinel for "no data".
  if (!Number.isFinite(feet) || feet <= -100000) return null;
  return { feet: Math.round(feet), meters: Math.round(feet * 0.3048) };
}

/** Query elevation (feet) at a coordinate. Returns null on failure. */
export async function elevationAtLatLng(lat: number, lng: number): Promise<ElevationInfo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const url = "https://epqs.nationalmap.gov/v1/json?" + qs({ x: lng, y: lat, units: "Feet", wkid: 4326 });
  const json = await fetchJson(url, { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 90 });
  return parseUsgsElevation(json);
}
