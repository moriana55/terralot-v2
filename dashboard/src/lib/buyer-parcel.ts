// Buyer-safe parcel projection for the PUBLIC /p/[id] page.
//
// SECURITY: /p/[id] is public by design (the WhatsApp link Ahmet sends US
// buyers). A UnifiedDeal carries internal deal-economics (blind-offer amount,
// spread/margin, comp market value, deal grade, owner identity, absentee flag,
// county-assessed value). NONE of that may reach a buyer. This module is the
// single choke point: it builds a NEW object from an explicit whitelist —
// never a spread of the source deal — so a new UnifiedDeal field can never
// leak to the public page by default.
//
// Pure + dependency-free (type-only import) so `node --test` can verify the
// whitelist without pulling JSON datasets or Supabase.

import type { UnifiedDeal } from "@/lib/unified-deals";

export interface BuyerParcel {
  id: string;
  apn: string;
  state: string;
  county: string;
  region: string;
  address: string;
  acres: number;
  lat: number | null;
  lng: number | null;
  /** Cash asking price (owner-finance available at the same sticker). 0 → "contact for price". */
  price: number;
}

/** Fields a buyer may see. Everything else on UnifiedDeal is internal. */
export const BUYER_SAFE_FIELDS = [
  "id", "apn", "state", "county", "region", "address", "acres", "lat", "lng", "price",
] as const;

/**
 * Internal deal-economics / owner fields that must NEVER appear in the buyer
 * payload (kept as an explicit list so the leak test stays honest even if
 * UnifiedDeal grows).
 */
export const BUYER_FORBIDDEN_FIELDS = [
  "owner", "ownerState", "absentee", "landValue", "estOffer", "estResale",
  "spread", "score", "marketValue", "comps", "mailSafe", "valBasis",
  "dealGrade", "source", "sourceLabel", "mapUrl",
  // MH-uygunluk iç sinyaldir (gerekçe metni iç satış dilini içerir) — alıcıya sızmaz.
  "useCode", "mh", "mhReason",
] as const;

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Projects a UnifiedDeal to its buyer-safe subset. Price = cash sale price
 * (estResale, already comp-derived; 0 when no trustworthy comp → the page
 * shows "contact for pricing" instead of a fabricated number).
 */
export function toBuyerParcel(deal: UnifiedDeal): BuyerParcel {
  return {
    id: String(deal.id),
    apn: String(deal.apn || ""),
    state: String(deal.state || ""),
    county: String(deal.county || ""),
    region: String(deal.region || ""),
    address: String(deal.address || ""),
    acres: finite(deal.acres) ?? 0,
    lat: finite(deal.lat),
    lng: finite(deal.lng),
    price: Math.max(0, Math.round(finite(deal.estResale) ?? 0)),
  };
}

/** Simple 0%-interest installment plan math (shared by page + tests). */
export function installmentPlan(price: number, down: number, monthly: number) {
  const d = Math.min(Math.max(0, Math.round(down)), Math.max(0, Math.round(price)));
  const m = Math.max(1, Math.round(monthly));
  const financed = Math.max(price - d, 0);
  const months = financed > 0 ? Math.ceil(financed / m) : 0;
  const lastPayment = months > 0 ? financed - (months - 1) * m : 0;
  return { down: d, monthly: m, financed, months, lastPayment, total: d + financed };
}
