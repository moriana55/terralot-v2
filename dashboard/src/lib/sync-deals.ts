// Scraper → Dashboard ETL (pure, testable, no I/O).
//
// THE SILO PROBLEM
//   The scraper (../../scraper) writes leads to a local SQLite file
//   (zillow_listings.db → `listings`, `off_market_leads`, `tax_sales`). The
//   dashboard reads Supabase (`tax_delinquent_properties`). Nothing bridges the
//   two, so freshly scraped deals never reach the dashboard.
//
// THIS MODULE
//   Normalizes a raw scraper row (from SQLite OR an exported JSON array) into a
//   clean `tax_delinquent_properties` upsert payload. It:
//     • validates + coerces every field with zod (bad rows are dropped, not
//       crashed on),
//     • sanitizes acreage / bids with the same land-valuation guards the rest of
//       the app uses (rejects 80,000-acre parsing errors, billion-dollar bids),
//     • derives a stable dedup key from APN/parcel id (or a location+source
//       fallback) so re-running the import is idempotent — same parcel updates in
//       place instead of duplicating.
//
//   The HTTP endpoint (api/admin/sync-deals) handles auth + the actual Supabase
//   upsert; everything here is pure so it can be unit-tested and reused by a CLI.

import { z } from "zod";
import { saneAcres, saneBid } from "@/lib/land-valuation";

// ── Input contract ───────────────────────────────────────────────────────────
// Deliberately permissive on field NAMES (scrapers use many conventions) but
// strict on TYPES/length. Unknown extra keys are ignored. A row must carry at
// least one identity selector (apn/parcel id or a location) to be importable.
const numish = z.coerce.number().finite().optional().nullable();
const strish = (max: number) => z.coerce.string().trim().max(max).optional().nullable();

export const RawScraperRowSchema = z.object({
  // identity (any of these)
  apn: strish(120),
  parcel_id: strish(120),
  parcelId: strish(120),
  zpid: strish(60),

  // location
  state: strish(60),
  county: strish(120),
  city: strish(120),
  property_address: strish(300),
  street_address: strish(300),
  address: strish(300),
  zipcode: strish(20),

  // owner
  owner_name: strish(200),
  owner_address: strish(300),
  owner_phone: strish(60),
  owner_email: strish(200),

  // numbers
  acres: numish,
  lot_size_acres: numish,
  minimum_bid: numish,
  mao_price: numish,
  unpaid_taxes: numish,
  judgment_amount: numish,
  price: numish,
  zestimate: numish,
  zillow_comp_rate: numish,
  lat: numish,
  latitude: numish,
  lng: numish,
  longitude: numish,

  // provenance
  source: strish(80),
  sale_date: strish(40),
  case_number: strish(120),
  raw_url: strish(500),
  zillow_url: strish(500),
}).passthrough();

export type RawScraperRow = z.infer<typeof RawScraperRowSchema>;

// ── Output: a clean tax_delinquent_properties upsert row ─────────────────────
export interface DealUpsert {
  dedup_key: string;
  apn: string | null;
  source: string | null;
  state: string | null;
  county: string | null;
  property_address: string | null;
  owner_name: string | null;
  owner_address: string | null;
  acres: number | null;
  minimum_bid: number | null;
  judgment_amount: number | null;
  sale_date: string | null;
  case_number: string | null;
  raw_url: string | null;
  lat: number | null;
  lng: number | null;
  discount_pct: number | null;
  savings: number | null;
  scraped_at: string;
}

const firstStr = (...vals: (string | null | undefined)[]): string | null => {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
};
const firstNum = (...vals: (number | null | undefined)[]): number | null => {
  for (const v of vals) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Stable dedup key. Prefers a parcel identifier (APN / parcel id / zpid). Falls
 * back to source+state+county+address so even identifier-less rows dedup
 * sensibly. Used as the upsert conflict target so re-imports are idempotent.
 */
export function dedupKey(r: RawScraperRow): string | null {
  const pid = firstStr(r.apn, r.parcel_id, r.parcelId, r.zpid);
  if (pid) return `apn:${slug(pid)}`;
  const loc = firstStr(r.property_address, r.street_address, r.address);
  const st = firstStr(r.state);
  const cty = firstStr(r.county);
  const src = firstStr(r.source) || "scraper";
  if (loc && st) return `loc:${slug(src)}:${slug(st)}:${slug(cty || "")}:${slug(loc)}`;
  return null; // no usable identity → caller skips it
}

export interface NormalizeResult {
  rows: DealUpsert[];
  skipped: number;
  reasons: Record<string, number>;
}

/**
 * Normalize + validate + dedup a batch of raw scraper rows into upsert payloads.
 * Pure: no DB, no env. Invalid/identity-less rows are skipped (counted), never
 * thrown. Within a single batch, the last occurrence of a dedup key wins.
 */
export function normalizeRows(input: unknown[]): NormalizeResult {
  const reasons: Record<string, number> = {};
  const bump = (k: string) => { reasons[k] = (reasons[k] || 0) + 1; };
  const byKey = new Map<string, DealUpsert>();
  let skipped = 0;

  for (const raw of input) {
    const parsed = RawScraperRowSchema.safeParse(raw);
    if (!parsed.success) { skipped++; bump("invalid_shape"); continue; }
    const r = parsed.data;

    const key = dedupKey(r);
    if (!key) { skipped++; bump("no_identity"); continue; }

    const acres = saneAcres(firstNum(r.acres, r.lot_size_acres));
    // minimum bid: prefer an explicit min-bid, else the wholesale max-allowable-
    // offer (mao_price), else unpaid taxes as a last-resort floor.
    const minBid = saneBid(firstNum(r.minimum_bid, r.mao_price, r.unpaid_taxes));
    const judgment = saneBid(firstNum(r.judgment_amount, r.unpaid_taxes));

    // Comp/discount derivation — only when we have an honest comp basis.
    // zillow_comp_rate is $/acre; price/zestimate are absolute comps.
    let compValue: number | null = null;
    const ppa = firstNum(r.zillow_comp_rate);
    if (ppa != null && ppa > 0 && acres != null) compValue = Math.round(ppa * acres);
    else compValue = firstNum(r.zestimate, r.price);
    let discount_pct: number | null = null;
    let savings: number | null = null;
    if (compValue != null && compValue > 0 && minBid != null && compValue >= minBid) {
      discount_pct = Math.round(((compValue - minBid) / compValue) * 100);
      savings = compValue - minBid;
    }

    const lat = firstNum(r.lat, r.latitude);
    const lng = firstNum(r.lng, r.longitude);

    const row: DealUpsert = {
      dedup_key: key,
      apn: firstStr(r.apn, r.parcel_id, r.parcelId, r.zpid),
      source: firstStr(r.source) || "SCRAPER",
      state: firstStr(r.state),
      county: firstStr(r.county),
      property_address: firstStr(r.property_address, r.street_address, r.address),
      owner_name: firstStr(r.owner_name),
      owner_address: firstStr(r.owner_address),
      acres,
      minimum_bid: minBid,
      judgment_amount: judgment,
      sale_date: firstStr(r.sale_date),
      case_number: firstStr(r.case_number),
      raw_url: firstStr(r.raw_url, r.zillow_url),
      lat: lat != null && lat >= -90 && lat <= 90 ? lat : null,
      lng: lng != null && lng >= -180 && lng <= 180 ? lng : null,
      discount_pct,
      savings,
      scraped_at: new Date().toISOString(),
    };

    byKey.set(key, row); // last write wins within the batch
  }

  return { rows: [...byKey.values()], skipped, reasons };
}
