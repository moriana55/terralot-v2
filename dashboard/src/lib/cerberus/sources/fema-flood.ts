// FEMA National Flood Hazard Layer (NFHL) — flood zone by lat/lng.
// Free, no key. ArcGIS REST query against the NFHL MapServer.
//   https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query
// Layer 28 = "Flood Hazard Zones" (S_FLD_HAZ_AR polygons).
//
// Signal produced: the REAL FEMA flood zone (e.g. AE, A, VE, X, X500) at the
// point → a flood risk flag + a 0..100 flood_score that REPLACES the stored
// heuristic when available. High-risk Special Flood Hazard Areas (SFHA) are the
// A/V families; X is minimal risk.

import { fetchJson, qs } from "./http";

export interface FloodInfo {
  /** FEMA zone code, e.g. "AE", "X", "VE", or "AREA NOT INCLUDED". */
  zone: string | null;
  /** Whether the point sits in a Special Flood Hazard Area (1% annual chance). */
  sfha: boolean;
  /** Normalized 0..100 risk (higher = worse) derived from the zone family. */
  floodScore: number | null;
  /** Human Turkish label for the UI. */
  label: string;
}

/** Map a FEMA zone code to a 0..100 risk score + SFHA flag + TR label. */
export function scoreFloodZone(zoneRaw: string | null | undefined): FloodInfo {
  const zone = zoneRaw ? zoneRaw.trim().toUpperCase() : null;
  if (!zone || zone === "AREA NOT INCLUDED" || zone === "D") {
    // D = undetermined; not included = unmapped — honest "unknown".
    return { zone: zone || null, sfha: false, floodScore: null, label: "FEMA: belirsiz / haritalanmamış" };
  }
  // V/VE = coastal high hazard (worst). A-family = 1% annual SFHA. X = minimal.
  if (/^V/.test(zone)) return { zone, sfha: true, floodScore: 95, label: "FEMA: kıyı yüksek riski (V/VE) — SFHA" };
  if (/^A/.test(zone)) return { zone, sfha: true, floodScore: 85, label: "FEMA: sel riski yüksek (A/AE) — SFHA" };
  if (zone === "X500" || zone === "B" || /0\.2 PCT/.test(zone)) return { zone, sfha: false, floodScore: 35, label: "FEMA: orta (%0.2 yıllık şans bölgesi)" };
  if (zone === "X" || zone === "C") return { zone, sfha: false, floodScore: 10, label: "FEMA: minimal sel riski (X)" };
  return { zone, sfha: false, floodScore: 40, label: `FEMA bölgesi: ${zone}` };
}

/**
 * PURE: normalize an ArcGIS NFHL query response → FloodInfo.
 * No intersecting polygon ⇒ treat as outside SFHA (zone X, low risk), because
 * NFHL only digitizes hazard areas. Returns null only on a malformed response.
 */
export function parseFemaFlood(json: unknown): FloodInfo | null {
  if (!json || typeof json !== "object") return null;
  const features = (json as Record<string, unknown>).features;
  if (!Array.isArray(features)) return null;
  if (features.length === 0) {
    // Point not inside any mapped hazard polygon → effectively zone X.
    return { zone: "X", sfha: false, floodScore: 10, label: "FEMA: haritalanmış sel bölgesi dışında (≈X)" };
  }
  const attrs = (features[0] as Record<string, unknown>).attributes as Record<string, unknown> | undefined;
  const zone = attrs?.FLD_ZONE != null ? String(attrs.FLD_ZONE) : null;
  return scoreFloodZone(zone);
}

/** Query the NFHL flood zone at a coordinate. Returns null on failure. */
export async function floodAtLatLng(lat: number, lng: number): Promise<FloodInfo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const url =
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?" +
    qs({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: 4326,
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      returnGeometry: false,
      f: "json",
    });
  const json = await fetchJson(url, { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 14 });
  return parseFemaFlood(json);
}
