import { NextRequest, NextResponse } from "next/server";

// Unified deal browser API — normalizes every local deal source into a single
// shape, then filters / paginates server-side (PropStream-style). Read-only:
// it only reads the existing JSON datasets, never writes.

import mohave from "@/data/mohave-offmarket.json";
import realDeals from "@/data/real-deals.json";
import cheapLand from "@/data/cheap-land.json";
import propstreamNM from "@/data/import-propstream-nm-luna.json";
import { supabaseAdmin } from "@/lib/supabase";
import { priceParcel } from "@/lib/pricing";
import { medianPpa } from "@/lib/land-valuation";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { valuationMismatch, dealGrade } from "@/lib/deal-quality";
import attomPpaData from "@/data/attom-ppa.json";

// ATTOM gerçek satış $/acre — bölge bazında (offline script ile üretildi).
const ATTOM_PPA = (attomPpaData as { ppa?: Record<string, { ppa: number; n: number; yearMin?: number; yearMax?: number }> }).ppa ?? {};
// Değerlemenin "as-of" tarihi: ATTOM emsal verisi en son ne zaman çekildi (şeffaflık).
const ATTOM_ASOF: string | null = (attomPpaData as { generatedAt?: string }).generatedAt ?? null;

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

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? "" : String(v));

const SOURCE_LABELS: Record<string, string> = {
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
const normCounty = (c: string | null | undefined) =>
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
async function getCompIndex() {
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
async function getDeals(): Promise<UnifiedDeal[]> {
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

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const all = await getDeals();

  const state = sp.get("state") || "";
  const source = sp.get("source") || "";
  const county = (sp.get("county") || "").toLowerCase();
  const q = (sp.get("q") || "").toLowerCase();
  const minAcres = sp.get("minAcres") ? num(sp.get("minAcres")) : null;
  const maxAcres = sp.get("maxAcres") ? num(sp.get("maxAcres")) : null;
  const minValue = sp.get("minValue") ? num(sp.get("minValue")) : null;
  const maxValue = sp.get("maxValue") ? num(sp.get("maxValue")) : null;
  const minSpread = sp.get("minSpread") ? num(sp.get("minSpread")) : null;
  const absentee = sp.get("absentee") === "1";
  const onlyComp = sp.get("onlyComp") === "1";
  const minGrade = sp.get("minGrade") || ""; // "A" → sadece A · "B" → A+B
  const sort = sp.get("sort") || "spread";
  const dir = sp.get("dir") === "asc" ? 1 : -1;
  const page = Math.max(1, num(sp.get("page")) || 1);
  const pageSize = Math.min(500, num(sp.get("pageSize")) || 50);

  const matches = (d: UnifiedDeal, ignoreState = false) =>
    (ignoreState || !state || d.state === state) &&
    (!source || d.source === source) &&
    (!county || d.county.toLowerCase().includes(county) || d.region.toLowerCase().includes(county)) &&
    (!q || d.owner.toLowerCase().includes(q) || d.address.toLowerCase().includes(q) || d.apn.toLowerCase().includes(q)) &&
    (minAcres == null || d.acres >= minAcres) &&
    (maxAcres == null || d.acres <= maxAcres) &&
    (minValue == null || d.landValue >= minValue) &&
    (maxValue == null || d.landValue <= maxValue) &&
    (minSpread == null || d.spread >= minSpread) &&
    (!absentee || d.absentee) &&
    (!onlyComp || (d.marketValue != null && d.valBasis !== "mismatch")) &&
    (!minGrade || (d.dealGrade != null && (minGrade === "B" ? d.dealGrade !== "C" : d.dealGrade === "A")));

  // Facets: state counts ignore the state filter so the picker stays useful.
  const byState: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalAll = 0;
  for (const d of all) {
    if (matches(d, true)) {
      byState[d.state] = (byState[d.state] || 0) + 1;
      totalAll++;
    }
  }

  const filtered = all.filter((d) => matches(d));
  for (const d of filtered) bySource[d.source] = (bySource[d.source] || 0) + 1;

  filtered.sort((a, b) => {
    const av = (a as unknown as Record<string, number>)[sort] ?? 0;
    const bv = (b as unknown as Record<string, number>)[sort] ?? 0;
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * dir;
    }
    return (av - bv) * dir;
  });

  const total = filtered.length;

  // ── Map mode: tüm noktalar (sayfalamadan, lat/lng olanlar, capped) ──
  if (sp.get("map") === "1") {
    const points = filtered
      .filter((d) => d.lat != null && d.lng != null)
      .slice(0, 3000)
      .map((d) => ({
        id: d.id, lat: d.lat, lng: d.lng, owner: d.owner, region: d.region,
        acres: d.acres, marketValue: d.marketValue, estOffer: d.estOffer,
        spread: d.spread, dealGrade: d.dealGrade, absentee: d.absentee, apn: d.apn,
        address: d.address, county: d.county, state: d.state,
        valBasis: d.valBasis, comps: d.comps,
        valAsOf: d.valBasis === "attom_region" ? ATTOM_ASOF : null,
        compYears: (() => {
          const a = ATTOM_PPA[`${d.state}|${d.region}`];
          return d.valBasis === "attom_region" && a?.yearMin ? `${a.yearMin}–${a.yearMax}` : null;
        })(),
      }));
    return NextResponse.json({ total, mapped: points.length, points });
  }

  const rows = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  // ── Real-data stats over the filtered set (CoStar-style summary) ──
  const idx = await getCompIndex();
  let totalAcres = 0;
  let withComp = 0;
  let compMarketSum = 0;
  let totalSpread = 0;
  let absenteeN = 0;
  const stMap = new Map<string, { count: number; acres: number; withComp: number; absentee: number }>();
  for (const d of filtered) {
    totalAcres += d.acres || 0;
    if (d.absentee) absenteeN++;
    let sd = stMap.get(d.state);
    if (!sd) { sd = { count: 0, acres: 0, withComp: 0, absentee: 0 }; stMap.set(d.state, sd); }
    sd.count++; sd.acres += d.acres || 0; if (d.absentee) sd.absentee++;
    if (d.marketValue != null && d.valBasis !== "mismatch") {
      withComp++;
      compMarketSum += d.marketValue;
      totalSpread += d.spread || 0;
      sd.withComp++;
    }
  }
  const byStateDetail = [...stMap.entries()].map(([st, v]) => ({
    state: st,
    count: v.count,
    acres: Math.round(v.acres),
    ppa: idx.state.get(st) ? Math.round(idx.state.get(st)!.ppa) : null,
    comps: idx.state.get(st)?.n ?? 0,
    withCompPct: v.count ? Math.round((v.withComp / v.count) * 100) : 0,
    absenteePct: v.count ? Math.round((v.absentee / v.count) * 100) : 0,
  })).sort((a, b) => b.count - a.count);
  // state $/acre medians (real comp index) limited to states present in facets
  const statePpa: Record<string, { ppa: number; n: number }> = {};
  for (const st of Object.keys(byState)) {
    const v = idx.state.get(st);
    if (v) statePpa[st] = { ppa: Math.round(v.ppa), n: v.n };
  }

  const stats = {
    totalAcres: Math.round(totalAcres),
    withComp,
    withCompPct: total ? Math.round((withComp / total) * 100) : 0,
    absenteePct: total ? Math.round((absenteeN / total) * 100) : 0,
    compMarketSum: Math.round(compMarketSum),
    totalSpread: Math.round(totalSpread),
    statePpa,
    byStateDetail,
  };

  return NextResponse.json({
    total,
    totalAll,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
    byState,
    bySource,
    sourceLabels: SOURCE_LABELS,
    stats,
    rows,
  });
}
