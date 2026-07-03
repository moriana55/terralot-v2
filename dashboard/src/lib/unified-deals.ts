// Unified deal engine — normalizes every local deal source into a single shape
// and enriches it with comp-based valuation. Extracted from
// /api/admin/all-deals so BOTH the (gated) admin API and the public buyer page
// (/p/[id] — server component) can share ONE data source. Read-only: it only
// reads the existing JSON datasets, never writes.

import mohave from "@/data/mohave-offmarket.json";
import realDeals from "@/data/real-deals.json";
import cheapLand from "@/data/cheap-land.json";
import propstreamNM from "@/data/import-propstream-nm-luna.json";
import { supabaseAdmin } from "@/lib/supabase";
import { priceParcel } from "@/lib/pricing";
import { medianPpa } from "@/lib/land-valuation";
import { valuationMismatch, dealGrade } from "@/lib/deal-quality";
import attomPpaData from "@/data/attom-ppa.json";

// ATTOM gerçek satış $/acre — bölge bazında (offline script ile üretildi).
export const ATTOM_PPA = (attomPpaData as { ppa?: Record<string, { ppa: number; n: number; yearMin?: number; yearMax?: number }> }).ppa ?? {};
// Değerlemenin "as-of" tarihi: ATTOM emsal verisi en son ne zaman çekildi (şeffaflık).
export const ATTOM_ASOF: string | null = (attomPpaData as { generatedAt?: string }).generatedAt ?? null;

export type UnifiedDeal = {
  id: string;
  source: string;
  sourceLabel: string;
  state: string;
  county: string;
  region: string;
  owner: string;
  ownerState: string;
  absentee: boolean;
  address: string;
  acres: number;
  landValue: number; // county assessed value (NOT comp market value)
  estOffer: number;
  estResale: number;
  spread: number;
  score: number | null;
  apn: string;
  lat: number | null;
  lng: number | null;
  mapUrl: string;
  // ── comp-based valuation (real; null/0 when no comps) ──
  marketValue: number | null;
  comps: number;
  mailSafe: boolean;
  valBasis: string;
  dealGrade: string | null; // A/B/C — yalnızca comp-değerli deal'lerde (yoksa null)
};

type BaseDeal = Omit<UnifiedDeal, "marketValue" | "comps" | "mailSafe" | "valBasis" | "dealGrade">;

export const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? "" : String(v));

export const SOURCE_LABELS: Record<string, string> = {
  mohave: "Mohave Off-Market",
  dallas: "Gerçek Dealler (Dallas)",
  "cheap-land": "Ucuz Boş Arsa",
  "propstream-nm": "PropStream — Luna NM",
};

let BASE: BaseDeal[] | null = null;

// ── State/county normalization (mirrors /api/parcel-comps) ──
const FULL: Record<string, string> = {
  alabama: "AL", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  florida: "FL", georgia: "GA", idaho: "ID", kentucky: "KY", louisiana: "LA",
  nevada: "NV", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  ohio: "OH", oklahoma: "OK", oregon: "OR", tennessee: "TN", texas: "TX", utah: "UT",
};
const ABBR = new Set(Object.values(FULL));
function normState(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (/^[A-Za-z]{2}$/.test(t) && ABBR.has(t.toUpperCase())) return t.toUpperCase();
  const low = t.toLowerCase();
  for (const [name, ab] of Object.entries(FULL)) if (low === name || low.startsWith(name + " ")) return ab;
  return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null;
}
export const normCounty = (c: string | null | undefined) =>
  (c || "").toUpperCase().replace(/ COUNTY$/i, "").trim();

// Each dataset wraps its array under a different key.
const arrOf = (d: unknown, ...keys: string[]): Record<string, unknown>[] => {
  const o = d as Record<string, unknown>;
  for (const k of keys) if (Array.isArray(o?.[k])) return o[k] as Record<string, unknown>[];
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};

function buildDeals(): BaseDeal[] {
  if (BASE) return BASE;
  const out: BaseDeal[] = [];

  // ── Mohave (all Arizona) ──────────────────────────────────────────────
  const mohaveRows = arrOf(mohave, "rows");
  for (let i = 0; i < mohaveRows.length; i++) {
    const r = mohaveRows[i];
    out.push({
      id: `mohave-${r.apn ?? i}`,
      source: "mohave",
      sourceLabel: SOURCE_LABELS.mohave,
      state: "AZ",
      county: "Mohave",
      region: str(r.region),
      owner: str(r.owner),
      ownerState: str(r.mailing_state),
      absentee: str(r.mailing_state) !== "AZ" && !!str(r.mailing_state),
      address: str(r.situs),
      acres: num(r.acres),
      landValue: num(r.land_value),
      estOffer: num(r.est_offer),
      // est_retail/est_margin were a fabricated $2,999/acre constant — NOT a real
      // comp. We do not surface fabricated resale/spread; needs comp verification.
      estResale: 0,
      spread: 0,
      score: r.score == null ? null : num(r.score),
      apn: str(r.apn),
      lat: r.lat == null ? null : num(r.lat),
      lng: r.lng == null ? null : num(r.lng),
      mapUrl: r.lat && r.lng ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : "",
    });
  }

  // ── Dallas real-deals (Texas) ─────────────────────────────────────────
  const realRows = arrOf(realDeals, "deals", "rows");
  for (let i = 0; i < realRows.length; i++) {
    const r = realRows[i];
    const mail = str(r.mailAddr);
    const mailState = (mail.match(/\b([A-Z]{2})\b\s*\d{5}/) || [])[1] || "";
    const offer = num(r.suggestedOffer);
    const spread = num(r.estSpread);
    out.push({
      id: `dallas-${r.apn ?? r.id ?? i}`,
      source: "dallas",
      sourceLabel: SOURCE_LABELS.dallas,
      state: "TX",
      county: "Dallas",
      region: "Dallas",
      owner: str(r.owner),
      ownerState: mailState,
      absentee: !!mailState && mailState !== "TX",
      address: str(r.address),
      acres: num(r.acres),
      landValue: num(r.landValue),
      estOffer: offer,
      estResale: offer + spread,
      spread: spread,
      score: null,
      apn: str(r.apn),
      lat: null,
      lng: null,
      mapUrl: str(r.mapUrl),
    });
  }

  // ── Cheap land (mixed states) ─────────────────────────────────────────
  const cheapRows = arrOf(cheapLand, "deals", "rows");
  for (let i = 0; i < cheapRows.length; i++) {
    const r = cheapRows[i];
    out.push({
      id: `cheap-${r.apn ?? r.id ?? i}`,
      source: "cheap-land",
      sourceLabel: SOURCE_LABELS["cheap-land"],
      state: str(r.state).toUpperCase(),
      county: str(r.county),
      region: str(r.county),
      owner: str(r.owner),
      ownerState: "",
      absentee: !!r.absentee,
      address: str(r.property),
      acres: num(r.acres),
      landValue: num(r.marketValue) || num(r.landValue),
      estOffer: num(r.acquireLow),
      estResale: num(r.marketValue),
      spread: num(r.spread),
      score: r.score == null ? null : num(r.score),
      apn: str(r.apn),
      lat: null,
      lng: null,
      mapUrl: str(r.mapUrl),
    });
  }

  // ── PropStream — Luna NM ──────────────────────────────────────────────
  const psRows = arrOf(propstreamNM, "rows", "deals");
  for (let i = 0; i < psRows.length; i++) {
    const r = psRows[i];
    out.push({
      id: `psnm-${r.apn ?? r.lead_id ?? i}`,
      source: "propstream-nm",
      sourceLabel: SOURCE_LABELS["propstream-nm"],
      state: str(r.state).toUpperCase() || "NM",
      county: str(r.county),
      region: str(r.region),
      owner: str(r.owner),
      ownerState: str(r.mailing_state),
      absentee: !!r.absentee,
      address: str(r.situs),
      acres: num(r.acres),
      landValue: num(r.land_value),
      estOffer: num(r.est_offer),
      estResale: num(r.est_retail),
      spread: num(r.est_margin),
      score: null,
      apn: str(r.apn),
      lat: r.lat == null ? null : num(r.lat),
      lng: r.lng == null ? null : num(r.lng),
      mapUrl: r.lat && r.lng ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : "",
    });
  }

  BASE = out;
  return out;
}

// ── Comp $/acre index from competitor_listings (real asking/sold comps) ──
let COMP_INDEX: { county: Map<string, { ppa: number; n: number }>; state: Map<string, { ppa: number; n: number }> } | null = null;
export async function getCompIndex() {
  if (COMP_INDEX) return COMP_INDEX;
  const county = new Map<string, { ppa: number; n: number }>();
  const state = new Map<string, { ppa: number; n: number }>();
  try {
    const s = supabaseAdmin();
    // NOTE: competitor_listings has no sold_price column → asking-price comps.
    const { data } = await s
      .from("competitor_listings")
      .select("state,county,acres,price")
      .gt("acres", 0).gt("price", 0).limit(5000);
    const byCounty = new Map<string, { price: unknown; acres: unknown }[]>();
    const byState = new Map<string, { price: unknown; acres: unknown }[]>();
    const push = (m: Map<string, { price: unknown; acres: unknown }[]>, k: string, row: { price: unknown; acres: unknown }) => {
      let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(row);
    };
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const st = normState(r.state as string);
      if (!st) continue;
      const row = { price: r.price, acres: r.acres };
      push(byState, st, row);
      const co = normCounty(r.county as string);
      if (co) push(byCounty, `${st}|${co}`, row);
    }
    for (const [k, rows] of byCounty) { const m = medianPpa(rows); if (m) county.set(k, { ppa: m, n: rows.length }); }
    for (const [k, rows] of byState) { const m = medianPpa(rows); if (m) state.set(k, { ppa: m, n: rows.length }); }
  } catch {
    /* no comp table / no DB → empty index → honest "comp gerekli" */
  }
  COMP_INDEX = { county, state };
  return COMP_INDEX;
}

let ENRICHED: UnifiedDeal[] | null = null;
export async function getDeals(): Promise<UnifiedDeal[]> {
  if (ENRICHED) return ENRICHED;
  const base = buildDeals();
  const idx = await getCompIndex();
  ENRICHED = base.map((d): UnifiedDeal => {
    const co = idx.county.get(`${d.state}|${normCounty(d.county)}`);
    const st = idx.state.get(d.state);
    // 1. tercih: ATTOM bölge gerçek-satış $/acre · 2. rakip-ilan county · 3. eyalet
    const attom = ATTOM_PPA[`${d.state}|${d.region}`];
    const usedAttom = !!attom;
    const p = priceParcel({
      acres: d.acres,
      countyRate: attom?.ppa ?? co?.ppa ?? null,
      stateRate: st?.ppa ?? null,
      countyComps: attom?.n ?? co?.n ?? 0,
      stateComps: st?.n ?? 0,
    });
    // Sanity guard: if the comp value and the county-assessed value diverge by
    // >4× either way, the comp almost certainly doesn't fit this parcel type
    // (e.g. rural $/acre applied to an urban industrial lot). Don't surface a
    // confident lowball offer — flag it for manual verification.
    const mv = p.marketValue;
    const mismatch = valuationMismatch(mv, d.landValue);
    const grade = dealGrade({
      marketValue: mv, mismatch, absentee: d.absentee,
      acres: d.acres, mailSafe: p.mailSafe, assessed: d.landValue,
    });
    return {
      ...d,
      marketValue: mv,
      comps: p.comps,
      mailSafe: p.mailSafe && !mismatch,
      valBasis: mismatch ? "mismatch" : (usedAttom && p.basis === "county_comp" ? "attom_region" : p.basis),
      dealGrade: grade,
      estOffer: mismatch ? 0 : (p.offer ?? 0),
      estResale: mismatch ? 0 : (p.cashPrice ?? 0),
      spread: mismatch ? 0 : (p.cashPrice != null && p.offer != null ? p.cashPrice - p.offer : 0),
    };
  });
  return ENRICHED;
}
