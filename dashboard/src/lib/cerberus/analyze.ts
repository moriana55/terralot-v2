// Cerberus per-lead AUTO-ANALYSIS pipeline core (PURE, no I/O, deterministic).
//
// THE VISION
//   Cerberus captures leads from every source. This module is the brain that
//   chews on ONE raw lead/parcel at a time and produces a rich, explainable
//   `LeadAnalysis`: normalize → comps/margin → underwrite → buy-box verdict →
//   risk/red-flags. The batch endpoint (api/admin/cerberus/analyze) feeds the
//   real backlog through `analyzeLead` and persists the result; the Intel
//   dashboard + drill-down render it.
//
// HONESTY CONTRACT (mirrors the rest of the app)
//   • Never fabricates a value — comp value is null when we lack honest inputs
//     (no sane acreage / no comparable $/acre), and the verdict degrades to a
//     low-confidence score proxy rather than inventing a margin.
//   • Deterministic + side-effect free: same input → same output, no env, no DB,
//     no network. AI narrative is layered ON TOP by the caller (env-gated); this
//     core always returns a rule-based narrative so it works offline.
//   • Never throws on missing/garbage fields. Every facet that has no data
//     contributes 0 and lowers confidence.
//
// REUSE (no re-implementation of valuation logic)
//   saneAcres/saneBid/intrinsicValue/medianPpa from lib/land-valuation, and the
//   exact buy-box rubric (lib/buy-box) for the AL/BEKLE/GEÇ verdict + score.

import { z } from "zod";
import {
  saneAcres,
  saneBid,
  intrinsicValue,
  bulkAdjustedPpa,
  type Confidence,
} from "@/lib/land-valuation";
import { buyBox, verdictOf, VERDICT_TR, type Verdict, type BuyBox } from "@/lib/buy-box";

// ── Input contract ───────────────────────────────────────────────────────────
// A raw lead can come straight off a tax_delinquent_properties row OR a freshly
// normalized scraper payload. Permissive on presence, strict on type/length.
const numish = z.coerce.number().finite().optional().nullable();
const strish = (max: number) => z.coerce.string().trim().max(max).optional().nullable();

export const RawLeadSchema = z.object({
  id: strish(100),
  dedup_key: strish(400),
  apn: strish(120),
  parcel_id: strish(120),
  source: strish(80),
  state: strish(60),
  county: strish(120),
  property_address: strish(300),
  owner_name: strish(200),
  acres: numish,
  minimum_bid: numish,
  judgment_amount: numish,
  final_score: numish,
  deal_score: numish,
  discount_pct: numish,
  savings: numish,
  liquidity_score: numish,
  county_pop_growth: numish,
  road_access: strish(40),
  flood_score: numish,
  dd_checked: z.coerce.boolean().optional().nullable(),
  lat: numish,
  lng: numish,
  sale_date: strish(40),
  raw_url: strish(500),
}).passthrough();

export type RawLead = z.infer<typeof RawLeadSchema>;

// Market context the caller resolves ONCE (e.g. /api/market-rates medians) and
// passes in, so the pure core never touches the DB. All optional.
export interface MarketContext {
  /** state-abbr → median retail $/acre (e.g. { TX: 14600 }). */
  stateRates?: Record<string, number>;
  /** "ST/COUNTY" (county UPPERCASE, no " COUNTY" suffix) → median $/acre. */
  countyRates?: Record<string, number>;
  /**
   * GERÇEK county demografisi (county_demographics tablosundan). Anahtar
   * "ST/COUNTY" (UPPERCASE, " COUNTY" eki yok). Talep/likidite faseti bu
   * gerçek nüfus büyümesi + medyan geliri kullanır; lead satırı taşımasa bile.
   * Underwrite endpoint'iyle tutarlı — uydurma değil, ACS verisi.
   */
  demographics?: Record<string, { popGrowth5y?: number | null; medianIncome?: number | null; population?: number | null }>;
}

// ── Output: a rich, structured LeadAnalysis ──────────────────────────────────
export type RiskLevel = "info" | "warn" | "critical";

export interface RiskFlag {
  code: string;
  level: RiskLevel;
  label: string; // Turkish, human-readable
}

export interface ScoreComponent {
  label: string;
  /** Points contributed to the 0..100 buy-box score (already weighted). */
  pts: number;
  /** Max points this facet could contribute. */
  max: number;
  note: string;
}

export interface LeadAnalysis {
  // identity / provenance
  parcelKey: string; // stable dedup id used for idempotent persistence
  leadId: string | null;
  apn: string | null;
  source: string | null;
  state: string | null;
  county: string | null;
  address: string | null;
  acres: number | null;

  // valuation
  compValue: number | null;
  perAcre: number | null;
  valueBasis: "county_comp" | "state_comp" | "none";
  valueConfidence: Confidence;
  minBid: number | null;
  margin: number | null; // 0..1 or null
  discountPct: number | null;

  // verdict
  verdict: Verdict;
  verdictTr: string;
  score: number; // 0..100
  components: ScoreComponent[];
  reasons: string[];
  confidence: BuyBox["confidence"];
  hardFail: boolean;

  // risk
  riskFlags: RiskFlag[];

  // enrichment provenance — which signals are REAL (measured) vs ESTIMATED
  // (rule-based/heuristic). Mirrors the honesty contract for the UI badge.
  // Maps a signal name → the source that measured it (FEMA/USGS/OSM/Census).
  // Empty when the parcel wasn't enriched (everything stays estimated).
  realSignals: Partial<
    Record<"road_access" | "flood_score" | "county_pop_growth" | "elevation" | "demographics", string>
  >;
  /** Full enrichment payload (flood zone, elevation, road distance, demographics) when enriched. */
  enrichment: EnrichmentSummary | null;

  // action + narrative
  suggestedAction: string; // Turkish, decisive
  narrative: string; // rule-based; caller may overwrite with AI
  narrativeSource: "ai" | "rule-based";

  // bookkeeping
  dataGaps: string[];
  analyzedAt: string;
  pipelineVersion: number;
}

// Serializable enrichment summary persisted alongside the analysis + rendered in
// the drill-down. Decoupled from enrich.ts's richer runtime types so the pure
// pipeline stays import-light and the JSON stored in `lead_analyses` is stable.
export interface EnrichmentSummary {
  floodZone: string | null;
  floodLabel: string | null;
  elevationFt: number | null;
  elevationM: number | null;
  nearestRoadM: number | null;
  roadAccess: string | null;
  roadName: string | null;
  population: number | null;
  medianIncome: number | null;
  popGrowth5y: number | null;
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
  sourcesOk: string[]; // e.g. ["FEMA","USGS","OSM","Census"]
  regridConnected: boolean;
  attomConnected: boolean;
  enrichedAt: string;
}

export const PIPELINE_VERSION = 2; // v2 = multi-source enrichment provenance

// ── Helpers (shared normalization, aligned with api/underwrite) ──────────────
const FULL2: Record<string, string> = {
  alabama: "AL", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  florida: "FL", georgia: "GA", idaho: "ID", illinois: "IL", indiana: "IN",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maryland: "MD", michigan: "MI",
  mississippi: "MS", missouri: "MO", montana: "MT", nevada: "NV", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "south carolina": "SC", tennessee: "TN", texas: "TX",
  utah: "UT", virginia: "VA", washington: "WA", wisconsin: "WI", wyoming: "WY",
};

export function abbrState(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return FULL2[t.toLowerCase()] ?? null;
}

export function normCounty(c: string | null | undefined): string | null {
  if (!c) return null;
  const t = c.toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();
  return t || null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Stable parcel key for idempotent persistence + dedup. Prefers an existing
 * dedup_key, then APN/parcel id, then a location fallback. Returns null when the
 * lead has no usable identity at all (caller skips it — never invents one).
 */
export function parcelKeyOf(r: RawLead): string | null {
  const existing = r.dedup_key?.trim();
  if (existing) return existing;
  const pid = (r.apn || r.parcel_id)?.trim();
  if (pid) return `apn:${slug(pid)}`;
  const loc = r.property_address?.trim();
  const st = r.state?.trim();
  const src = (r.source || "scraper").trim();
  if (loc && st) return `loc:${slug(src)}:${slug(st)}:${slug(r.county || "")}:${slug(loc)}`;
  return null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Resolve a comparable $/acre rate for this parcel from the market context. */
function resolveRates(
  st: string | null,
  cty: string | null,
  ctx: MarketContext,
): { countyRate: number | null; stateRate: number | null } {
  const stateRate = st && ctx.stateRates ? num(ctx.stateRates[st]) : null;
  let countyRate: number | null = null;
  if (st && cty && ctx.countyRates) countyRate = num(ctx.countyRates[`${st}/${cty}`]);
  return { countyRate, stateRate };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PIPELINE — analyzeLead(raw, ctx)
//
// (a) normalize/validate → (b) comps + discount/margin → (c) buy-box verdict +
// score + reasons (reuses the exact rubric) → (d) risk/red-flags → (e) action +
// rule-based narrative. Returns null ONLY when the lead has no identity at all.
// ─────────────────────────────────────────────────────────────────────────────
// Optional REAL-signal overrides folded in by the enrichment layer. Only the
// fields we MEASURED are present; everything else falls back to the lead row's
// heuristic value. `realSignals` records provenance for the honest UI badge.
export interface EnrichmentApplied {
  road_access?: string | null;
  flood_score?: number | null;
  county_pop_growth?: number | null;
  realSignals?: Partial<
    Record<"road_access" | "flood_score" | "county_pop_growth" | "elevation" | "demographics", string>
  >;
  summary?: EnrichmentSummary | null;
}

export function analyzeLead(
  raw: unknown,
  ctx: MarketContext = {},
  enriched?: EnrichmentApplied,
): LeadAnalysis | null {
  const parsed = RawLeadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;

  const parcelKey = parcelKeyOf(r);
  if (!parcelKey) return null;

  // Fold REAL measured signals over the heuristic lead row (only when present).
  // Kopyalayarak ilerle ki çağıranın enriched.realSignals nesnesi mutasyona uğramasın.
  const realSignals: Partial<
    Record<"road_access" | "flood_score" | "county_pop_growth" | "elevation" | "demographics", string>
  > = { ...(enriched?.realSignals ?? {}) };
  const roadAccessEff =
    enriched?.road_access != null ? enriched.road_access : (r.road_access ?? null);
  const floodScoreEff =
    enriched?.flood_score != null ? num(enriched.flood_score) : num(r.flood_score);
  const st = abbrState(r.state);
  const cty = normCounty(r.county);

  // GERÇEK county demografisi (county_demographics) — talep fasetini besler.
  const demoRow = st && cty && ctx.demographics ? ctx.demographics[`${st}/${cty}`] : undefined;
  const demoPopGrowth = demoRow ? num(demoRow.popGrowth5y) : null;
  const demoIncome = demoRow ? num(demoRow.medianIncome) : null;

  // popGrowth önceliği: canlı enrichment (Census) > county_demographics (ACS) > lead satırı.
  const popGrowthEff =
    enriched?.county_pop_growth != null
      ? num(enriched.county_pop_growth)
      : num(r.county_pop_growth) ?? demoPopGrowth;
  // GERÇEK demografi kullanıldıysa şeffaflık rozeti için kaynağı işaretle.
  if (demoPopGrowth != null && enriched?.county_pop_growth == null && r.county_pop_growth == null) {
    realSignals.demographics = "County ACS";
  }
  const sAcres = saneAcres(r.acres);
  const minBid = saneBid(r.minimum_bid);
  const dataGaps: string[] = [];

  // (b) comps + margin — honest intrinsic value from acreage × comparable $/acre.
  const { countyRate, stateRate } = resolveRates(st, cty, ctx);
  const { value: compValue, basis: valueBasis, confidence: valueConfidence } = intrinsicValue({
    acres: sAcres,
    countyRate,
    stateRate,
  });
  const perAcre = countyRate ?? stateRate ?? null;

  if (sAcres == null) dataGaps.push("acreage geçersiz/eksik (dürüst değer yok)");
  else if (compValue == null) dataGaps.push("comparable $/acre yok (bu pazar için)");
  if (perAcre == null) dataGaps.push("piyasa $/acre benchmark (competitor_listings)");

  // Derive discount_pct/savings from the comp if the row doesn't carry them.
  let discountPct = num(r.discount_pct);
  if (discountPct == null && compValue != null && compValue > 0 && minBid != null && compValue >= minBid) {
    discountPct = Math.round(((compValue - minBid) / compValue) * 100);
  }

  // (c) buy-box verdict — the SAME pure rubric the deal-screener uses, fed the
  // freshly-derived compValue so margin/score are real, not the stored proxy.
  const bx = buyBox({
    final_score: num(r.final_score),
    deal_score: num(r.deal_score),
    discount_pct: discountPct,
    savings: num(r.savings),
    liquidity_score: num(r.liquidity_score),
    county_pop_growth: popGrowthEff,
    road_access: roadAccessEff,
    flood_score: floodScoreEff,
    acres: sAcres,
    minimum_bid: minBid,
    compValue,
  });

  // Score components — break the 0..100 into explainable, weighted facets so the
  // drill-down can show EXACTLY why each parcel got its verdict.
  const components = buildComponents({
    margin: bx.margin,
    discountPct,
    finalScore: num(r.final_score) ?? num(r.deal_score),
    popGrowth: popGrowthEff,
    liquidity: num(r.liquidity_score),
    roadAccess: roadAccessEff,
    floodScore: floodScoreEff,
    savings: num(r.savings),
    compValue,
    minBid,
  });

  // (e) risk / red-flags — structural killers + soft warnings.
  const riskFlags = detectRisks({
    roadAccess: roadAccessEff,
    floodScore: floodScoreEff,
    compValue,
    minBid,
    sAcres,
    rawAcres: num(r.acres),
    ownerName: r.owner_name ?? null,
    ddChecked: !!r.dd_checked,
    valueConfidence,
    saleDate: r.sale_date ?? null,
    enrichedDD: !!(realSignals.road_access || realSignals.flood_score),
  });

  const suggestedAction = suggestAction(bx.verdict, riskFlags, { reachableOwner: ownerReachable(r.owner_name ?? null) });
  const narrative = ruleNarrative({
    verdict: bx.verdict,
    score: bx.score,
    st,
    cty,
    acres: r.acres ?? null,
    compValue,
    minBid,
    components,
    riskFlags,
  });

  return {
    parcelKey,
    leadId: r.id ?? null,
    apn: (r.apn || r.parcel_id) ?? null,
    source: r.source ?? null,
    state: st ?? r.state ?? null,
    county: cty ?? r.county ?? null,
    address: r.property_address ?? null,
    acres: r.acres ?? null,
    compValue,
    perAcre,
    valueBasis,
    valueConfidence,
    minBid,
    margin: bx.margin,
    discountPct,
    verdict: bx.verdict,
    verdictTr: VERDICT_TR[bx.verdict],
    score: bx.score,
    components,
    reasons: bx.reasons,
    confidence: bx.confidence,
    hardFail: bx.hardFail,
    riskFlags,
    realSignals,
    enrichment: enriched?.summary ?? null,
    suggestedAction,
    narrative,
    narrativeSource: "rule-based",
    dataGaps,
    analyzedAt: new Date().toISOString(),
    pipelineVersion: PIPELINE_VERSION,
  };
}

// ── Score components (explainable facets; weights mirror lib/buy-box) ─────────
function buildComponents(s: {
  margin: number | null;
  discountPct: number | null;
  finalScore: number | null;
  popGrowth: number | null;
  liquidity: number | null;
  roadAccess: string | null;
  floodScore: number | null;
  savings: number | null;
  compValue: number | null;
  minBid: number | null;
}): ScoreComponent[] {
  const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const out: ScoreComponent[] = [];

  // Value / margin (35)
  if (s.margin != null) {
    out.push({
      label: "Değer / marj",
      pts: Math.round(35 * s.margin),
      max: 35,
      note:
        s.compValue != null && s.minBid != null
          ? `~%${Math.round(s.margin * 100)} marj (comp $${s.compValue.toLocaleString()} vs teklif $${s.minBid.toLocaleString()})`
          : `~%${Math.round(s.margin * 100)} marj`,
    });
  } else if (s.discountPct != null) {
    out.push({ label: "Değer / marj", pts: Math.round(35 * clamp(s.discountPct / 100)), max: 35, note: `kayıtlı indirim %${s.discountPct} (comp yok)` });
  } else if (s.finalScore != null) {
    out.push({ label: "Değer / marj", pts: Math.round(35 * clamp(s.finalScore / 100)), max: 35, note: `Cerberus skoru proxy (${s.finalScore}/100)` });
  } else {
    out.push({ label: "Değer / marj", pts: 0, max: 35, note: "değer açığı verisi yok" });
  }

  // Demand / liquidity (20)
  let demandN = 0;
  let dc = 0;
  if (s.popGrowth != null) { demandN += clamp((s.popGrowth + 0.02) / 0.12); dc++; }
  if (s.liquidity != null) { demandN += clamp(s.liquidity / 100); dc++; }
  out.push({
    label: "Talep / likidite",
    pts: Math.round(20 * (dc ? demandN / dc : 0)),
    max: 20,
    note: s.popGrowth != null ? `nüfus ${(s.popGrowth * 100).toFixed(1)}%/5y` : "demografi sınırlı",
  });

  // Access (15)
  const access = s.roadAccess === "direct" ? 1 : s.roadAccess === "near" ? 0.75 : s.roadAccess === "landlocked" ? 0 : 0.5;
  out.push({
    label: "Yol erişimi",
    pts: Math.round(15 * access),
    max: 15,
    note: s.roadAccess === "landlocked" ? "LANDLOCKED — değer kırıcı" : s.roadAccess || "bilinmiyor (orta varsayıldı)",
  });

  // Flood (10)
  const floodN = s.floodScore == null ? 0.5 : clamp(1 - s.floodScore / 100);
  out.push({
    label: "Sel riski",
    pts: Math.round(10 * floodN),
    max: 10,
    note: s.floodScore == null ? "bilinmiyor" : s.floodScore >= 80 ? "yüksek risk" : s.floodScore >= 35 ? "orta" : "düşük",
  });

  // Discount bonus (10)
  out.push({
    label: "İndirim bonusu",
    pts: s.discountPct != null ? Math.round(10 * clamp(s.discountPct / 100)) : 0,
    max: 10,
    note: s.discountPct != null ? `%${s.discountPct} indirim` : "indirim verisi yok",
  });

  // Realized savings (10)
  out.push({
    label: "Tahmini tasarruf",
    pts: s.savings != null && s.savings > 0 ? Math.round(10 * clamp(s.savings / 50000)) : 0,
    max: 10,
    note: s.savings != null && s.savings > 0 ? `+$${s.savings.toLocaleString()}` : "tasarruf verisi yok",
  });

  return out;
}

// ── Risk / red-flags ─────────────────────────────────────────────────────────
function detectRisks(s: {
  roadAccess: string | null;
  floodScore: number | null;
  compValue: number | null;
  minBid: number | null;
  sAcres: number | null;
  rawAcres: number | null;
  ownerName: string | null;
  ddChecked: boolean;
  valueConfidence: Confidence;
  saleDate: string | null;
  enrichedDD?: boolean;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (s.roadAccess === "landlocked") flags.push({ code: "landlocked", level: "critical", label: "Landlocked — yol erişimi yok, değer ciddi düşer" });
  if (s.compValue != null && s.minBid != null && s.minBid > s.compValue)
    flags.push({ code: "bid_over_comp", level: "critical", label: "Min teklif comp değerin üstünde — değer açığı yok" });
  if (s.floodScore != null && s.floodScore >= 80) flags.push({ code: "high_flood", level: "warn", label: "Yüksek sel riski (FEMA)" });
  if (s.rawAcres != null && s.sAcres == null) flags.push({ code: "bad_acreage", level: "warn", label: "Acreage implausible/parse hatası — değer doğrulanmalı" });
  if (s.sAcres == null && s.rawAcres == null) flags.push({ code: "no_acreage", level: "warn", label: "Acreage yok — dürüst değer hesaplanamıyor" });
  if (s.enrichedDD) flags.push({ code: "enriched_verified", level: "info", label: "Yol/sel canlı kaynaklardan doğrulandı (FEMA/OSM)" });
  else if (!s.ddChecked) flags.push({ code: "no_dd", level: "info", label: "Due-diligence taraması yapılmamış (yol/sel doğrulanmadı)" });
  if (!ownerReachable(s.ownerName)) flags.push({ code: "owner_unreachable", level: "info", label: "Sahip iletişimi zor (direct-mail yolu belirsiz)" });
  if (s.valueConfidence === "low" && s.compValue != null) flags.push({ code: "low_value_conf", level: "info", label: "Değer düşük güvenli (büyük tract / state comp)" });

  if (s.saleDate) {
    const t = Date.parse(s.saleDate);
    if (Number.isFinite(t)) {
      const days = Math.floor((t - Date.now()) / 86_400_000);
      if (days >= 0 && days <= 14) flags.push({ code: "sale_imminent", level: "warn", label: `Satış yakın (~${days} gün) — hızlı karar gerekli` });
    }
  }

  return flags;
}

function ownerReachable(name: string | null): boolean {
  return !!name && !/absentee|unknown|county tax|no owner|n\/a/i.test(name);
}

// ── Suggested action (decisive, Turkish) ─────────────────────────────────────
function suggestAction(verdict: Verdict, flags: RiskFlag[], ctx: { reachableOwner: boolean }): string {
  const critical = flags.find((f) => f.level === "critical");
  if (critical) return `GEÇ önerilir — kritik risk: ${critical.label}.`;
  if (verdict === "BUY") {
    return ctx.reachableOwner
      ? "AL — teklif/outreach kuyruğuna al, sahibe direct-mail başlat, DD'yi doğrula."
      : "AL — açık artırma/struck-off yolunu kullan, on-site DD ile teyit et.";
  }
  if (verdict === "WATCH") return "BEKLE — comp/DD doğrulanınca yeniden değerlendir; fiyat düşerse fırsata döner.";
  return "GEÇ — risk/getiri zayıf; kaynakları daha güçlü leadlere ayır.";
}

// ── Rule-based narrative (always available; AI layered on top by caller) ──────
function ruleNarrative(s: {
  verdict: Verdict;
  score: number;
  st: string | null;
  cty: string | null;
  acres: number | null;
  compValue: number | null;
  minBid: number | null;
  components: ScoreComponent[];
  riskFlags: RiskFlag[];
}): string {
  const loc = [s.cty, s.st].filter(Boolean).join(", ") || "bu parsel";
  const sorted = [...s.components].sort((a, b) => b.pts - a.pts);
  const top = sorted.slice(0, 2).map((c) => c.note);
  const weak = [...s.components].sort((a, b) => a.pts - b.pts).slice(0, 2).map((c) => `${c.label.toLowerCase()} (${c.note})`);
  const head =
    s.verdict === "BUY" ? `AL — ${loc} ${s.score}/100 ile güçlü bir fırsat.`
      : s.verdict === "WATCH" ? `BEKLE — ${loc} ${s.score}/100; potansiyel var ama doğrulama gerek.`
        : `GEÇ — ${loc} ${s.score}/100, risk/getiri zayıf.`;
  const valuePart = s.compValue != null && s.minBid != null
    ? ` Comp değeri ≈ $${s.compValue.toLocaleString()}, min teklif $${s.minBid.toLocaleString()}.`
    : "";
  const critical = s.riskFlags.filter((f) => f.level === "critical").map((f) => f.label);
  const killers = critical.length ? ` ⚠️ ${critical.join("; ")}.` : "";
  return `${head}${valuePart} Güçlü yanlar: ${top.join("; ")}. Zayıf/riskli: ${weak.join("; ")}.${killers} (Kural-tabanlı; OPENAI_API_KEY ayarlanınca AI anlatımı devreye girer.)`;
}

// ── Batch helper (pure) — analyze a backlog, drop identity-less rows ──────────
export interface BatchResult {
  analyses: LeadAnalysis[];
  skipped: number;
}

/** Analyze an array of raw leads. Identity-less / invalid rows are skipped (counted). */
export function analyzeBatch(rows: unknown[], ctx: MarketContext = {}): BatchResult {
  const analyses: LeadAnalysis[] = [];
  let skipped = 0;
  for (const row of rows) {
    const a = analyzeLead(row, ctx);
    if (a) analyses.push(a);
    else skipped++;
  }
  return { analyses, skipped };
}

// Re-exports so consumers don't need a second import for the verdict band.
export { verdictOf, bulkAdjustedPpa };
export type { Verdict };
