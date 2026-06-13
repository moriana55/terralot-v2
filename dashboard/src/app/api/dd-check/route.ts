import { NextRequest, NextResponse } from "next/server";

const NFHL_URL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ROAD_TYPES = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street";

// ─── Flood ───────────────────────────────────────────────────────────────────

function scoreZone(zone: string | null, subtype: string | null) {
  if (!zone) return { score: null, label: "unknown" };
  const z = zone.toUpperCase();
  if (z === "V" || z === "VE" || z.startsWith("V")) return { score: 95, label: "very_high" };
  if (["A", "AE", "AH", "AO", "AR", "A99"].includes(z) || z.startsWith("A")) return { score: 80, label: "high" };
  if (z === "X" || z.startsWith("X")) {
    if (subtype && /0\.2 ?PCT|0\.2%|500/.test(subtype.toUpperCase())) return { score: 35, label: "moderate" };
    return { score: 5, label: "minimal" };
  }
  if (z === "D") return { score: 50, label: "undetermined" };
  return { score: 40, label: "unknown" };
}

async function checkFlood(lat: number, lon: number) {
  const url = new URL(NFHL_URL);
  url.searchParams.set("geometry", `${lon},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "FLD_ZONE,ZONE_SUBTY,SFHA_TF");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");

  const res = await fetch(url.href, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`FEMA HTTP ${res.status}`);
  const data: any = await res.json();
  const f = data.features?.[0]?.attributes;
  if (!f) return { floodZone: null, zoneSubtype: null, inSFHA: false, insuranceRequired: false, riskScore: null, riskLabel: "unknown" };
  const zone = f.FLD_ZONE ?? null;
  const subtype = f.ZONE_SUBTY ?? null;
  const inSFHA = f.SFHA_TF === "T";
  const { score, label } = scoreZone(zone, subtype);
  return { floodZone: zone, zoneSubtype: subtype, inSFHA, insuranceRequired: inSFHA, riskScore: score, riskLabel: label };
}

// ─── Road ────────────────────────────────────────────────────────────────────

function classifySurface(surface: string | null, highway: string | null): "paved" | "gravel" | "dirt" | "unknown" {
  if (surface) {
    const s = surface.toLowerCase();
    if (/asphalt|paved|concrete|chipseal|paving_stones/.test(s)) return "paved";
    if (/gravel|compacted|fine_gravel|pebblestone|unpaved/.test(s)) return "gravel";
    if (/dirt|earth|ground|mud|sand|grass/.test(s)) return "dirt";
  }
  if (highway) {
    if (/motorway|trunk|primary|secondary|tertiary|residential|living_street/.test(highway)) return "paved";
    if (highway === "track") return "dirt";
  }
  return "unknown";
}

async function roadsWithin(lat: number, lon: number, radius: number) {
  const query = `[out:json][timeout:25];way(around:${radius},${lat},${lon})[highway~"^(${ROAD_TYPES})$"];out tags center 1;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "TerralotDD/0.1", accept: "application/json" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data: any = await res.json();
  const el = data.elements?.[0];
  if (!el) return null;
  return { name: el.tags?.name || el.tags?.ref || null, highway: el.tags?.highway || null, surfaceTag: el.tags?.surface || null, dist: radius };
}

async function checkRoad(lat: number, lon: number) {
  let hit = null;
  let accessType: "direct" | "near" | "landlocked" = "landlocked";
  for (const [radius, type] of [[50, "direct"], [200, "near"], [500, "near"]] as const) {
    hit = await roadsWithin(lat, lon, radius);
    if (hit) { accessType = type; break; }
  }
  if (!hit) return { hasRoadAccess: false, nearestRoadMeters: null, accessType: "landlocked", nearestRoadName: null, surface: "unknown", roadClass: null, accessNote: "⚠️ No legal road access (landlocked)" };
  const surface = classifySurface(hit.surfaceTag, hit.highway);
  const surfaceNote = surface === "paved" ? "Paved road access" : surface === "gravel" ? "Gravel road access" : surface === "dirt" ? "Dirt road - 2WD/4WD recommended" : "Road access available";
  return { hasRoadAccess: true, nearestRoadMeters: hit.dist, accessType, nearestRoadName: hit.name, surface, roadClass: hit.highway, accessNote: accessType === "direct" ? surfaceNote : `${surfaceNote} (nearby)` };
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");
  if (isNaN(lat) || isNaN(lon)) return NextResponse.json({ error: "lat/lon required" }, { status: 400 });

  const [flood, road] = await Promise.allSettled([checkFlood(lat, lon), checkRoad(lat, lon)]);

  return NextResponse.json({
    flood: flood.status === "fulfilled" ? flood.value : { error: (flood as any).reason?.message },
    road: road.status === "fulfilled" ? road.value : { error: (road as any).reason?.message },
  });
}
