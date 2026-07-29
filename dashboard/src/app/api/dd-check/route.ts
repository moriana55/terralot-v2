import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { DD_FEMA_TIMEOUT_MS, DD_OVERPASS_TIMEOUT_MS } from "@/lib/constants";

// Bounded coordinate validation — rejects NaN/out-of-range before any external
// fetch, so the FEMA/Overpass calls can't be driven with junk input.
const coordSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const NFHL_URL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ROAD_TYPES = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street";

// Minimal shapes for the external API fields we actually read.
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
    const id = setTimeout(() => controller.abort(), DD_FEMA_TIMEOUT_MS);

    const res = await fetch(url.href, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    clearTimeout(id);

    if (!res.ok) throw new Error(`FEMA HTTP ${res.status}`);
    const data: FemaResponse = await res.json().catch(() => {
      throw new Error("FEMA returned invalid JSON");
    });
    const f = data.features?.[0]?.attributes;
    if (!f) return { floodZone: "X", zoneSubtype: "AREA OF MINIMAL FLOOD HAZARD", inSFHA: false, insuranceRequired: false, riskScore: 5, riskLabel: "minimal" };
    
    const zone = f.FLD_ZONE ?? null;
    const subtype = f.ZONE_SUBTY ?? null;
    const inSFHA = f.SFHA_TF === "T";
    const { score, label } = scoreZone(zone, subtype);
    return { floodZone: zone, zoneSubtype: subtype, inSFHA, insuranceRequired: inSFHA, riskScore: score, riskLabel: label };
  } catch (err: any) {
    console.warn("FEMA API failed:", err.message);
    // HONEST: do NOT fabricate flood data. Report unavailable so consumers
    // render "veri yok / unknown" instead of a fake zone.
    return {
      floodZone: null,
      zoneSubtype: null,
      inSFHA: null,
      insuranceRequired: null,
      riskScore: null,
      riskLabel: "unknown",
      error: err.message,
      fallback: true,
    };
  }
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
  const query = `[out:json][timeout:15];way(around:${radius},${lat},${lon})[highway~"^(${ROAD_TYPES})$"];out tags center 1;`;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DD_OVERPASS_TIMEOUT_MS);

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "VegaLandDD/0.1", accept: "application/json" },
    body: "data=" + encodeURIComponent(query),
    signal: controller.signal
  });
  clearTimeout(id);

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data: OverpassResponse = await res.json().catch(() => {
    throw new Error("Overpass returned invalid JSON");
  });
  const el = data.elements?.[0];
  if (!el) return null;
  return { name: el.tags?.name || el.tags?.ref || null, highway: el.tags?.highway || null, surfaceTag: el.tags?.surface || null, dist: radius };
}

async function checkRoad(lat: number, lon: number) {
  try {
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
  } catch (err: any) {
    console.warn("Road API failed:", err.message);
    // HONEST: do NOT fabricate road access (no fake distances/street names).
    return {
      hasRoadAccess: null,
      nearestRoadMeters: null,
      accessType: "unknown",
      nearestRoadName: null,
      surface: "unknown",
      roadClass: null,
      accessNote: "Yol verisi alınamadı (servis yanıt vermedi) — haritadan doğrula.",
      error: err.message,
      fallback: true,
    };
  }
}

// ─── Elektrik (OSM power) ─────────────────────────────────────────────────────
// Şebeke yakınlığı = arsanın değer + yaşanabilirlik sinyali. OSM'de dağıtım
// hattı (power=line/minor_line) ve direk (power=pole/tower) sorgulanır. HONEST:
// veri yoksa "bilinmiyor" döner, asla uydurma mesafe verilmez.
async function powerWithin(lat: number, lon: number, radius: number) {
  const query =
    `[out:json][timeout:15];(` +
    `way(around:${radius},${lat},${lon})[power~"^(line|minor_line|cable)$"];` +
    `node(around:${radius},${lat},${lon})[power~"^(pole|tower)$"];` +
    `);out tags center 1;`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DD_OVERPASS_TIMEOUT_MS);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "VegaLandDD/0.1", accept: "application/json" },
    body: "data=" + encodeURIComponent(query),
    signal: controller.signal,
  });
  clearTimeout(id);
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data: { elements?: { tags?: { power?: string } }[] } = await res.json().catch(() => {
    throw new Error("Overpass returned invalid JSON");
  });
  const el = data.elements?.[0];
  if (!el) return null;
  const p = el.tags?.power || "";
  const kind = /line|minor_line|cable/.test(p) ? "hat" : "direk";
  return { kind, dist: radius };
}

async function checkPower(lat: number, lon: number) {
  try {
    let hit: { kind: string; dist: number } | null = null;
    let proximity: "onsite" | "near" | "far" = "far";
    for (const [radius, type] of [[150, "onsite"], [500, "near"], [1500, "near"]] as const) {
      hit = await powerWithin(lat, lon, radius);
      if (hit) { proximity = type; break; }
    }
    if (!hit) return { hasPower: false, nearestPowerMeters: null, proximity: "none", powerKind: null, powerNote: "Yakında şebeke hattı bulunamadı (off-grid)" };
    const note = proximity === "onsite"
      ? `Şebeke arsada/bitişik (~${hit.dist}m, ${hit.kind})`
      : `Şebeke yakın (~${hit.dist}m, ${hit.kind})`;
    return { hasPower: true, nearestPowerMeters: hit.dist, proximity, powerKind: hit.kind, powerNote: note };
  } catch (err: any) {
    console.warn("Power API failed:", err.message);
    return { hasPower: null, nearestPowerMeters: null, proximity: "unknown", powerKind: null, powerNote: "Elektrik verisi alınamadı — haritadan doğrula.", error: err.message, fallback: true };
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  // Admin-gated (no-op when Clerk is live; internal underwrite/buildability
  // callers forward the session cookie so they still pass).
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const parsed = coordSchema.safeParse({
    lat: req.nextUrl.searchParams.get("lat"),
    lon: req.nextUrl.searchParams.get("lon"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "valid lat/lon required" }, { status: 400 });
  }
  const { lat, lon } = parsed.data;

  const [flood, road, power] = await Promise.allSettled([checkFlood(lat, lon), checkRoad(lat, lon), checkPower(lat, lon)]);

  return NextResponse.json({
    flood: flood.status === "fulfilled" ? flood.value : { error: (flood as any).reason?.message },
    road: road.status === "fulfilled" ? road.value : { error: (road as any).reason?.message },
    power: power.status === "fulfilled" ? power.value : { error: (power as any).reason?.message },
  });
}
