// Cerberus multi-source ENRICHMENT layer ("god mode" — honest edition).
//
// Given a parcel (lat/lng, or an address we geocode first), this pulls REAL US
// land/property facts from FREE, KEYLESS public APIs so each parcel's analysis is
// as truthful as possible. Then `enrichParcel` returns a single `ParcelEnrichment`
// the analysis pipeline folds into the verdict — REPLACING heuristics (guessed
// flood_score / road_access / pop-growth) with measured data WHERE AVAILABLE, and
// degrading gracefully to the rule-based values when a source is unreachable.
//
// HONESTY CONTRACT
//   • Every source is defensive (8s timeout, try/catch, null on failure) and can
//     NEVER crash the pipeline — see sources/http.ts.
//   • Each derived signal is tagged real-vs-estimated via `signals` so the UI can
//     badge it (kaynak: FEMA / USGS / OSM / Census).
//   • Free keyless sources only on the live path. Paid adapters (Regrid/ATTOM)
//     are env-gated stubs that no-op when their token is unset — no fabrication.
//
// OPT-IN + POLITE: enrichment is OFF by default in the batch analyzer and only
// runs when explicitly requested (?enrich=1), with small concurrency + a delay
// between parcels, so a large backlog never hammers the free APIs by accident.

import { geocodeAddress, fipsForLatLng, type CensusGeo } from "./sources/census-geocoder";
import { floodAtLatLng, type FloodInfo } from "./sources/fema-flood";
import { elevationAtLatLng, type ElevationInfo } from "./sources/usgs-elevation";
import { accessAtLatLng, type AccessInfo, type RoadAccess } from "./sources/osm-overpass";
import { demographicsForCounty, type Demographics } from "./sources/census-acs";
import {
  regridParcelAtLatLng,
  attomPropertyByAddress,
  regridConnected,
  attomConnected,
  type PaidResult,
  type RegridParcel,
  type AttomProperty,
} from "./sources/paid";

export type SourceTag = "FEMA" | "USGS" | "OSM" | "Census" | "Regrid" | "ATTOM";

/** A single enriched signal carries WHERE it came from + whether it's measured. */
export interface EnrichSignal<T> {
  value: T | null;
  source: SourceTag | null;
  /** true = measured from a real API; false = no data (caller keeps heuristic). */
  real: boolean;
  label: string; // Turkish, for the UI
}

export interface ParcelEnrichment {
  resolved: { lat: number | null; lng: number | null; geocoded: boolean };
  flood: EnrichSignal<FloodInfo>;
  elevation: EnrichSignal<ElevationInfo>;
  access: EnrichSignal<AccessInfo>;
  demographics: EnrichSignal<Demographics>;
  fips: { stateFips: string | null; countyFips: string | null; tract: string | null } | null;
  /** Paid adapters — present (connected:false) so the UI can show the upgrade path. */
  paid: {
    regrid: PaidResult<RegridParcel>;
    attom: PaidResult<AttomProperty>;
  };
  /** Which of the FOUR live free sources actually returned data this run. */
  sourcesOk: SourceTag[];
  enrichedAt: string;
  /** How long enrichment took (ms) — useful for the throttle budget. */
  tookMs: number;
}

export interface EnrichInput {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  state?: string | null;
  county?: string | null;
}

const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function emptySignal<T>(label: string): EnrichSignal<T> {
  return { value: null, source: null, real: false, label };
}

/**
 * Enrich ONE parcel from the free keyless sources. Always resolves (never
 * throws); any unreachable source just leaves its signal `real:false`.
 */
export async function enrichParcel(input: EnrichInput): Promise<ParcelEnrichment> {
  const started = Date.now();
  let lat = numOrNull(input.lat);
  let lng = numOrNull(input.lng);
  let geocoded = false;
  let geo: CensusGeo | null = null;

  // 1) Resolve coordinates. If we lack lat/lng but have an address → Census geocode.
  if ((lat == null || lng == null) && input.address) {
    geo = await geocodeAddress(input.address);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      geocoded = true;
    }
  }

  // Sanity bound: anything outside plausible US-ish range is unusable.
  const usable = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const enrichment: ParcelEnrichment = {
    resolved: { lat, lng, geocoded },
    flood: emptySignal<FloodInfo>("Sel bölgesi bilinmiyor"),
    elevation: emptySignal<ElevationInfo>("Rakım bilinmiyor"),
    access: emptySignal<AccessInfo>("Yol erişimi ölçülmedi"),
    demographics: emptySignal<Demographics>("Demografi bilinmiyor"),
    fips: null,
    paid: {
      regrid: { connected: regridConnected(), source: "regrid", data: null, note: "REGRID_API_TOKEN ayarlanınca parsel/sahip verisi gelir." },
      attom: { connected: attomConnected(), source: "attom", data: null, note: "ATTOM_API_KEY ayarlanınca derin emlak verisi gelir." },
    },
    sourcesOk: [],
    enrichedAt: new Date().toISOString(),
    tookMs: 0,
  };

  if (!usable) {
    enrichment.tookMs = Date.now() - started;
    return enrichment; // no coordinates → nothing free to query; honest empty.
  }

  // 2) Resolve FIPS for ACS (use geocoder match if we had it, else coord lookup).
  if (!geo) geo = await fipsForLatLng(lat!, lng!);
  if (geo) {
    enrichment.fips = { stateFips: geo.stateFips, countyFips: geo.countyFips, tract: geo.tract };
  }

  // 3) Fan out the geo-point sources in parallel (each independently defensive).
  const [flood, elevation, access] = await Promise.all([
    floodAtLatLng(lat!, lng!),
    elevationAtLatLng(lat!, lng!),
    accessAtLatLng(lat!, lng!),
  ]);

  if (flood) {
    enrichment.flood = { value: flood, source: "FEMA", real: true, label: flood.label };
    enrichment.sourcesOk.push("FEMA");
  }
  if (elevation) {
    enrichment.elevation = {
      value: elevation,
      source: "USGS",
      real: true,
      label: elevation.feet != null ? `Rakım ≈ ${elevation.feet} ft (${elevation.meters} m)` : "Rakım bilinmiyor",
    };
    enrichment.sourcesOk.push("USGS");
  }
  if (access) {
    const m = access.nearestRoadMeters;
    enrichment.access = {
      value: access,
      source: "OSM",
      real: true,
      label:
        access.access === "landlocked"
          ? `${800}m içinde yol yok — LANDLOCKED`
          : `En yakın yol ${m} m${access.roadName ? ` (${access.roadName})` : ""} — ${access.access}`,
    };
    enrichment.sourcesOk.push("OSM");
  }

  // 4) Demographics via ACS (needs state+county FIPS from step 2).
  if (geo?.stateFips && geo?.countyFips) {
    const demo = await demographicsForCounty(geo.stateFips, geo.countyFips);
    if (demo) {
      enrichment.demographics = {
        value: demo,
        source: "Census",
        real: true,
        label:
          `Nüfus ${demo.population?.toLocaleString() ?? "?"}` +
          (demo.popGrowth5y != null ? ` · ${(demo.popGrowth5y * 100).toFixed(1)}%/5y` : "") +
          (demo.medianIncome != null ? ` · medyan gelir $${demo.medianIncome.toLocaleString()}` : ""),
      };
      enrichment.sourcesOk.push("Census");
    }
  }

  // 5) Paid adapters (no-op unless tokens set; never fabricate).
  if (regridConnected()) enrichment.paid.regrid = await regridParcelAtLatLng(lat!, lng!);
  if (attomConnected() && input.address) enrichment.paid.attom = await attomPropertyByAddress(input.address);

  enrichment.tookMs = Date.now() - started;
  return enrichment;
}

// ── Bridge: enrichment → analyzeLead signal overrides ────────────────────────
// Folds REAL signals into the shape `analyzeLead`'s RawLead expects, so the SAME
// pure rubric scores them. We only override a field when we measured it; missing
// signals fall back to whatever the lead row already carried (heuristic).

export interface EnrichedOverrides {
  road_access?: RoadAccess;
  flood_score?: number;
  county_pop_growth?: number;
  lat?: number;
  lng?: number;
  /** Provenance of each override for the LeadAnalysis output + UI badging. */
  realSignals: Partial<Record<"road_access" | "flood_score" | "county_pop_growth" | "elevation" | "demographics", SourceTag>>;
}

export function overridesFromEnrichment(e: ParcelEnrichment): EnrichedOverrides {
  const o: EnrichedOverrides = { realSignals: {} };
  if (e.resolved.lat != null) o.lat = e.resolved.lat;
  if (e.resolved.lng != null) o.lng = e.resolved.lng;
  if (e.access.real && e.access.value) {
    o.road_access = e.access.value.access;
    o.realSignals.road_access = "OSM";
  }
  if (e.flood.real && e.flood.value && e.flood.value.floodScore != null) {
    o.flood_score = e.flood.value.floodScore;
    o.realSignals.flood_score = "FEMA";
  }
  if (e.demographics.real && e.demographics.value) {
    if (e.demographics.value.popGrowth5y != null) {
      o.county_pop_growth = e.demographics.value.popGrowth5y;
      o.realSignals.county_pop_growth = "Census";
    }
    o.realSignals.demographics = "Census";
  }
  if (e.elevation.real) o.realSignals.elevation = "USGS";
  return o;
}

// ── Bridge: enrichment → the serializable summary persisted/rendered ─────────
import type { EnrichmentSummary, EnrichmentApplied } from "./analyze";

export function enrichmentToSummary(e: ParcelEnrichment): EnrichmentSummary {
  const f = e.flood.value;
  const el = e.elevation.value;
  const ac = e.access.value;
  const d = e.demographics.value;
  return {
    floodZone: f?.zone ?? null,
    floodLabel: e.flood.real ? e.flood.label : null,
    elevationFt: el?.feet ?? null,
    elevationM: el?.meters ?? null,
    nearestRoadM: ac?.nearestRoadMeters ?? null,
    roadAccess: ac?.access ?? null,
    roadName: ac?.roadName ?? null,
    population: d?.population ?? null,
    medianIncome: d?.medianIncome ?? null,
    popGrowth5y: d?.popGrowth5y ?? null,
    lat: e.resolved.lat,
    lng: e.resolved.lng,
    geocoded: e.resolved.geocoded,
    sourcesOk: e.sourcesOk,
    regridConnected: e.paid.regrid.connected,
    attomConnected: e.paid.attom.connected,
    enrichedAt: e.enrichedAt,
  };
}

/** Build the `EnrichmentApplied` argument for analyzeLead from an enrichment. */
export function enrichmentToApplied(e: ParcelEnrichment): EnrichmentApplied {
  const o = overridesFromEnrichment(e);
  return {
    road_access: o.road_access ?? null,
    flood_score: o.flood_score ?? null,
    county_pop_growth: o.county_pop_growth ?? null,
    realSignals: o.realSignals,
    summary: enrichmentToSummary(e),
  };
}

// ── Polite batch enrichment (small concurrency + delay) ──────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface BatchEnrichOpts {
  concurrency?: number; // default 2 — gentle on free APIs
  delayMs?: number; // default 350ms between parcels per worker
}

/**
 * Enrich many parcels politely: a tiny worker pool with a delay between calls.
 * Returns results in input order. Each parcel is independently defensive.
 */
export async function enrichMany(
  inputs: EnrichInput[],
  opts: BatchEnrichOpts = {},
): Promise<ParcelEnrichment[]> {
  const concurrency = Math.max(1, Math.min(4, opts.concurrency ?? 2));
  const delayMs = Math.max(0, opts.delayMs ?? 350);
  const out: ParcelEnrichment[] = new Array(inputs.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= inputs.length) break;
      out[i] = await enrichParcel(inputs[i]);
      if (delayMs) await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
  return out;
}
