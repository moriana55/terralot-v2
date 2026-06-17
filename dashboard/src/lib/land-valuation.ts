// Shared land-data sanitization + valuation.
// The scraped tax-sale data contains garbage outliers (acreage of 80,000+,
// minimum bids in the billions) and ~66% of parcels have no acreage at all.
// These helpers reject implausible values so downstream features (arbitrage,
// underwriting, comps) never produce nonsense like "$9.3B intrinsic / -100%".

// Bounds derived from profiling the live data (p99 acres ≈ 159, comp $/acre
// median ≈ $14.6k / p99 ≈ $210k, sane tax-lot bids well under $10M).
export const SANE = {
  ACRE_MIN: 0.01,
  ACRE_MAX: 1000, // anything larger is almost always a parsing error for these micro-lots
  PPA_MIN: 500, // $/acre floor for raw-land comps
  PPA_MAX: 250_000, // $/acre ceiling — drops listing outliers before taking a median
  BID_MIN: 1,
  BID_MAX: 10_000_000, // a tax-lot min-bid above this is garbage data
  INTRINSIC_MAX: 10_000_000, // hard cap on any single-parcel estimate
} as const;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Acreage if plausible, else null (rejects 0/null and parsing-error outliers). */
export function saneAcres(v: unknown): number | null {
  const n = num(v);
  return n != null && n >= SANE.ACRE_MIN && n <= SANE.ACRE_MAX ? n : null;
}

/** A dollar amount (bid/judgment) if plausible, else null. */
export function saneBid(v: unknown): number | null {
  const n = num(v);
  return n != null && n >= SANE.BID_MIN && n <= SANE.BID_MAX ? n : null;
}

/** Is a price-per-acre value usable for a comp median? */
export function sanePpa(ppa: number): boolean {
  return Number.isFinite(ppa) && ppa >= SANE.PPA_MIN && ppa <= SANE.PPA_MAX;
}

/** Median $/acre from comparable listings, with outliers stripped. null if too few. */
export function medianPpa(rows: { price: unknown; acres: unknown }[], minSample = 3): number | null {
  const ppa: number[] = [];
  for (const r of rows) {
    const price = num(r.price);
    const acres = saneAcres(r.acres);
    if (price != null && price > 0 && acres != null) {
      const v = price / acres;
      if (sanePpa(v)) ppa.push(v);
    }
  }
  if (ppa.length < minSample) return null;
  ppa.sort((a, b) => a - b);
  const m = Math.floor(ppa.length / 2);
  return Math.round(ppa.length % 2 ? ppa[m] : (ppa[m - 1] + ppa[m]) / 2);
}

// A discount above this is almost never a real raw-land opportunity — it signals
// incomplete price data (min-bid = only back-taxes) or a non-comparable comp.
// We cap the displayed discount here and flag such parcels for manual review.
export const DISCOUNT_CAP = 70;

// Raw land sells for progressively LESS per acre as the parcel grows (the
// "acreage / bulk discount"). A 135-acre tract is not worth small-lot $/acre.
// Scale the comp rate down for larger parcels: ~full rate up to REF acres, then
// a square-root decay floored at 12% of the small-lot rate.
const REF_ACRES = 5;
export function bulkAdjustedPpa(ppa: number, acres: number): number {
  if (acres <= REF_ACRES) return ppa;
  const factor = Math.max(0.12, Math.sqrt(REF_ACRES / acres));
  return Math.round(ppa * factor);
}

export type Basis = "county_comp" | "state_comp" | "none";
export type Confidence = "high" | "medium" | "low";

/**
 * Estimate a parcel's intrinsic land value from acreage × a comparable $/acre
 * rate. Returns null when we lack the inputs to value it honestly (no acreage
 * or no comps) — callers should treat that as "insufficient data", NOT $0.
 * Deliberately does NOT use judgment_amount (back-taxes owed ≠ land value).
 */
export function intrinsicValue(opts: {
  acres: number | null;
  countyRate?: number | null;
  stateRate?: number | null;
}): { value: number | null; basis: Basis; confidence: Confidence } {
  const { acres, countyRate, stateRate } = opts;
  if (acres == null) return { value: null, basis: "none", confidence: "low" };
  const rate = countyRate && countyRate > 0 ? countyRate : stateRate && stateRate > 0 ? stateRate : null;
  if (rate == null) return { value: null, basis: "none", confidence: "low" };
  const basis: Basis = countyRate && countyRate > 0 ? "county_comp" : "state_comp";
  const value = Math.min(Math.round(acres * bulkAdjustedPpa(rate, acres)), SANE.INTRINSIC_MAX);
  // Large tracts valued off generic comps are inherently lower-confidence.
  const confidence: Confidence = acres > 50 ? "low" : basis === "county_comp" ? "high" : "medium";
  return { value, basis, confidence };
}
