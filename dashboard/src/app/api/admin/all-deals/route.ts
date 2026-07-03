import { NextRequest, NextResponse } from "next/server";

// Unified deal browser API — normalizes every local deal source into a single
// shape, then filters / paginates server-side (PropStream-style). Read-only:
// it only reads the existing JSON datasets, never writes.
// Deal building/enrichment lives in @/lib/unified-deals (shared with the
// public buyer page /p/[id], which projects a buyer-safe subset only).

import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import {
  getDeals, getCompIndex, num, SOURCE_LABELS, ATTOM_PPA, ATTOM_ASOF,
  type UnifiedDeal,
} from "@/lib/unified-deals";

export type { UnifiedDeal };

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const all = await getDeals();

  // ── Tekil deal (one-pager / sunum sayfası): ?id=… → sadece o deal ──
  const wantId = sp.get("id");
  if (wantId) {
    const deal = all.find((d) => d.id === wantId) ?? null;
    if (!deal) return NextResponse.json({ deal: null }, { status: 404 });
    return NextResponse.json({ deal });
  }

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
  // ROAD Act MH filtresi: "1"/"likely" → sadece MH-uygun · "verify" → uygun+teyitli
  const mhParam = sp.get("mh") || "";
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
    (!mhParam || (mhParam === "verify" ? d.mh === "likely" || d.mh === "verify" : d.mh === "likely")) &&
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
        mh: d.mh, mhReason: d.mhReason,
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
  let mhLikely = 0;
  const stMap = new Map<string, { count: number; acres: number; withComp: number; absentee: number }>();
  for (const d of filtered) {
    totalAcres += d.acres || 0;
    if (d.absentee) absenteeN++;
    if (d.mh === "likely") mhLikely++;
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
    mhLikely,
    mhLikelyPct: total ? Math.round((mhLikely / total) * 100) : 0,
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
