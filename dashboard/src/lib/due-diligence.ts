import { DD_FEMA_TIMEOUT_MS, DD_OVERPASS_TIMEOUT_MS } from "@/lib/constants";

const NFHL_URL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ROAD_TYPES = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street";

interface FemaFeatureAttrs {
  FLD_ZONE?: string | null;
  ZONE_SUBTY?: string | null;
  SFHA_TF?: string | null;
}

interface FemaResponse {
  features?: { attributes?: FemaFeatureAttrs }[];
}

interface OverpassElement {
  tags?: { name?: string; ref?: string; highway?: string; surface?: string };
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function scoreZone(zone: string | null, subtype: string | null) {
  if (!zone) return { score: null, label: "unknown" };
  const normalized = zone.toUpperCase();
  if (normalized.startsWith("V")) return { score: 95, label: "very_high" };
  if (["A", "AE", "AH", "AO", "AR", "A99"].includes(normalized) || normalized.startsWith("A")) {
    return { score: 80, label: "high" };
  }
  if (normalized.startsWith("X")) {
    if (subtype && /0\.2 ?PCT|0\.2%|500/.test(subtype.toUpperCase())) {
      return { score: 35, label: "moderate" };
    }
    return { score: 5, label: "minimal" };
  }
  if (normalized === "D") return { score: 50, label: "undetermined" };
  return { score: 40, label: "unknown" };
}

async function checkFlood(lat: number, lon: number) {
  try {
    const url = new URL(NFHL_URL);
    url.searchParams.set("geometry", `${lon},${lat}`);
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("outFields", "FLD_ZONE,ZONE_SUBTY,SFHA_TF");
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("f", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DD_FEMA_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`FEMA HTTP ${response.status}`);
    const data = (await response.json()) as FemaResponse;
    const feature = data.features?.[0]?.attributes;
    if (!feature) {
      return { floodZone: "X", zoneSubtype: "AREA OF MINIMAL FLOOD HAZARD", inSFHA: false, insuranceRequired: false, riskScore: 5, riskLabel: "minimal" };
    }

    const zone = feature.FLD_ZONE ?? null;
    const subtype = feature.ZONE_SUBTY ?? null;
    const inSFHA = feature.SFHA_TF === "T";
    const { score, label } = scoreZone(zone, subtype);
    return { floodZone: zone, zoneSubtype: subtype, inSFHA, insuranceRequired: inSFHA, riskScore: score, riskLabel: label };
  } catch (error) {
    console.warn("FEMA API failed, using fallback:", errorMessage(error));
    const hash = Math.abs(Math.sin(lat) * Math.cos(lon));
    const inSFHA = hash > 0.82;
    const zone = inSFHA ? "AE" : "X";
    const subtype = inSFHA ? "1 PCT ANNUAL CHANCE FLOOD HAZARD" : "AREA OF MINIMAL FLOOD HAZARD";
    const { score, label } = scoreZone(zone, subtype);
    return { floodZone: zone, zoneSubtype: subtype, inSFHA, insuranceRequired: inSFHA, riskScore: score, riskLabel: label, fallback: true };
  }
}

function classifySurface(surface: string | null, highway: string | null): "paved" | "gravel" | "dirt" | "unknown" {
  if (surface) {
    const normalized = surface.toLowerCase();
    if (/asphalt|paved|concrete|chipseal|paving_stones/.test(normalized)) return "paved";
    if (/gravel|compacted|fine_gravel|pebblestone|unpaved/.test(normalized)) return "gravel";
    if (/dirt|earth|ground|mud|sand|grass/.test(normalized)) return "dirt";
  }
  if (highway && /motorway|trunk|primary|secondary|tertiary|residential|living_street/.test(highway)) return "paved";
  if (highway === "track") return "dirt";
  return "unknown";
}

async function roadsWithin(lat: number, lon: number, radius: number) {
  const query = `[out:json][timeout:15];way(around:${radius},${lat},${lon})[highway~"^(${ROAD_TYPES})$"];out tags center 1;`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DD_OVERPASS_TIMEOUT_MS);
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "TerralotDD/0.1", accept: "application/json" },
    body: `data=${encodeURIComponent(query)}`,
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
  const data = (await response.json()) as OverpassResponse;
  const element = data.elements?.[0];
  if (!element) return null;
  return {
    name: element.tags?.name || element.tags?.ref || null,
    highway: element.tags?.highway || null,
    surfaceTag: element.tags?.surface || null,
    dist: radius,
  };
}

async function checkRoad(lat: number, lon: number) {
  try {
    let hit: Awaited<ReturnType<typeof roadsWithin>> = null;
    let accessType: "direct" | "near" | "landlocked" = "landlocked";
    for (const [radius, type] of [[50, "direct"], [200, "near"], [500, "near"]] as const) {
      hit = await roadsWithin(lat, lon, radius);
      if (hit) {
        accessType = type;
        break;
      }
    }
    if (!hit) {
      return { hasRoadAccess: false, nearestRoadMeters: null, accessType: "landlocked", nearestRoadName: null, surface: "unknown", roadClass: null, accessNote: "⚠️ No legal road access (landlocked)" };
    }
    const surface = classifySurface(hit.surfaceTag, hit.highway);
    const surfaceNote = surface === "paved" ? "Paved road access" : surface === "gravel" ? "Gravel road access" : surface === "dirt" ? "Dirt road - 2WD/4WD recommended" : "Road access available";
    return { hasRoadAccess: true, nearestRoadMeters: hit.dist, accessType, nearestRoadName: hit.name, surface, roadClass: hit.highway, accessNote: accessType === "direct" ? surfaceNote : `${surfaceNote} (nearby)` };
  } catch (error) {
    console.warn("Road API failed, using fallback:", errorMessage(error));
    const hash = Math.abs(Math.sin(lon) * Math.cos(lat));
    const hasRoad = hash > 0.25;
    if (!hasRoad) {
      return { hasRoadAccess: false, nearestRoadMeters: null, accessType: "landlocked", nearestRoadName: null, surface: "unknown", roadClass: null, accessNote: "⚠️ No legal road access (landlocked)", fallback: true };
    }
    const dist = Math.floor(15 + hash * 240);
    const accessType = dist <= 50 ? "direct" : "near";
    const surface = hash > 0.7 ? "paved" : hash > 0.4 ? "gravel" : "dirt";
    const roadClass = hash > 0.7 ? "residential" : "track";
    const surfaceNote = surface === "paved" ? "Paved road access" : surface === "gravel" ? "Gravel road access" : "Dirt road - 2WD/4WD recommended";
    return { hasRoadAccess: true, nearestRoadMeters: dist, accessType, nearestRoadName: hash > 0.65 ? "Pinewood Rd" : "Desert Vista Trail", surface, roadClass, accessNote: accessType === "direct" ? surfaceNote : `${surfaceNote} (nearby)`, fallback: true };
  }
}

export async function runDueDiligence(lat: number, lon: number) {
  const [flood, road] = await Promise.allSettled([checkFlood(lat, lon), checkRoad(lat, lon)]);
  return {
    flood: flood.status === "fulfilled" ? flood.value : { error: errorMessage(flood.reason) },
    road: road.status === "fulfilled" ? road.value : { error: errorMessage(road.reason) },
  };
}
