// OSM Overpass API — nearest road/highway → REAL road-access / landlocked.
// Free, no key. https://overpass-api.de/api/interpreter
//
// Signal produced: distance (meters) to the nearest mapped road within a search
// radius → a road_access classification ("direct" / "near" / "landlocked") that
// REPLACES the guessed flag. Landlocked (no road within radius) is a structural
// value-killer, so getting this REAL matters most of all the sources.
//
// We query `way[highway]` around the point and let Overpass return centers; we
// compute the min haversine distance ourselves (defensive, no geometry deps).

import { fetchJson } from "./http";

export type RoadAccess = "direct" | "near" | "landlocked";

export interface AccessInfo {
  /** Meters to the nearest mapped road, or null if none within the radius. */
  nearestRoadMeters: number | null;
  /** Classification fed into the buy-box rubric. */
  access: RoadAccess;
  /** Name/type of the nearest road, if known. */
  roadName: string | null;
  roadType: string | null;
}

const RADIUS_M = 800; // search out to 800m; beyond that we call it landlocked.

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance → access band. <=60m direct (adjacent), <=radius near, else landlocked. */
export function classifyAccess(meters: number | null): RoadAccess {
  if (meters == null) return "landlocked";
  if (meters <= 60) return "direct";
  if (meters <= RADIUS_M) return "near";
  return "landlocked";
}

/**
 * PURE: given the parcel point + an Overpass JSON response, find the nearest
 * road element (node center) and classify access. Tested with mocked JSON.
 */
export function parseOverpassNearestRoad(json: unknown, lat: number, lng: number): AccessInfo {
  const none: AccessInfo = { nearestRoadMeters: null, access: "landlocked", roadName: null, roadType: null };
  if (!json || typeof json !== "object") return none;
  const elements = (json as Record<string, unknown>).elements;
  if (!Array.isArray(elements) || elements.length === 0) return none;

  let best: { d: number; name: string | null; type: string | null } | null = null;
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const e = el as Record<string, unknown>;
    // Overpass `out center;` puts coords on .center for ways, or directly on nodes.
    const center = e.center as Record<string, unknown> | undefined;
    const elat = Number(center?.lat ?? e.lat);
    const elng = Number(center?.lon ?? e.lon);
    if (!Number.isFinite(elat) || !Number.isFinite(elng)) continue;
    const d = haversineMeters(lat, lng, elat, elng);
    const tags = e.tags as Record<string, unknown> | undefined;
    if (!best || d < best.d) {
      best = {
        d,
        name: typeof tags?.name === "string" ? tags.name : null,
        type: typeof tags?.highway === "string" ? tags.highway : null,
      };
    }
  }
  if (!best) return none;
  const meters = Math.round(best.d);
  return { nearestRoadMeters: meters, access: classifyAccess(meters), roadName: best.name, roadType: best.type };
}

/** Query the nearest road to a coordinate. Returns null on failure. */
export async function accessAtLatLng(lat: number, lng: number): Promise<AccessInfo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // Public/drivable roads only (skip footways/cycleways) for genuine vehicle access.
  const query =
    `[out:json][timeout:8];` +
    `way(around:${RADIUS_M},${lat},${lng})` +
    `["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street)$"];` +
    `out center 40;`;
  const json = await fetchJson("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    timeoutMs: 9000,
    revalidate: 60 * 60 * 24 * 14,
  });
  if (json == null) return null;
  return parseOverpassNearestRoad(json, lat, lng);
}
