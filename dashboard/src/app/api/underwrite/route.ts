import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { aiEnabled, aiNarrative } from "@/lib/ai-narrative";
import { saneAcres, saneBid, medianPpa, intrinsicValue } from "@/lib/land-valuation";

// Input contract — every field optional, but the request must identify a parcel
// by at least one of leadId/apn/address (enforced after parse). Strings are
// length-capped so a hostile caller can't push huge payloads into ILIKE queries
// or the AI prompt. Coordinates are bounded to valid lat/lng ranges.
const underwriteSchema = z.object({
  leadId: z.string().trim().min(1).max(100).optional(),
  apn: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  state: z.string().trim().max(60).optional(),
  county: z.string().trim().max(120).optional(),
  acres: z.coerce.number().finite().nonnegative().max(1_000_000).optional(),
  minBid: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// AI PARCEL UNDERWRITING
//
// Input (POST JSON): { leadId? } OR { apn?, address?, state?, county?, acres?, lat?, lng? }
//   • leadId      → pulls the row from tax_delinquent_properties (richest signals)
//   • apn/address → looks up a matching lead; if none, underwrites from the raw
//                   fields the caller passed (manual mode)
//
// Output: a structured BUY / WATCH / PASS verdict with an explainable score and
// a list of weighted reasons, synthesized from every signal we can find:
//   final_score, discount/savings, county demographics + growth, market $/acre,
// road access + flood (live dd-check when lat/lng exist), owner contactability.
//
// RUBRIC (documented & deterministic — 0..100):
//   value gap      30%  intrinsic comp value vs minimum bid (or final_score proxy)
//   demand         20%  county population growth + median income (liquidity)
//   access         15%  road access (landlocked = 0) — unbuildable killer
//   flood          10%  inverse of FEMA flood risk
//   market         10%  parcel size vs county retail $/acre availability
//   competition    10%  struck-off / off-market beats live auction
//   contact         5%  reachable owner (direct-mail path) bonus
//
//   verdict: score>=65 BUY · 45-64 WATCH · <45 PASS
//   Any HARD FAIL (landlocked, or value gap negative) caps verdict at PASS/WATCH.
//
// If OPENAI_API_KEY is set, the structured signals are also turned into a short
// investor narrative; otherwise a deterministic narrative template is returned.
//
// VALUATION HONESTY (see lib/land-valuation): acreage and bids are sanitized
// (the scraped data has 80,000-acre parsing errors and billion-dollar bids), the
// $/acre benchmark is an outlier-stripped median, and the intrinsic value is
// bulk-adjusted for parcel size and hard-capped. When we can't value a parcel
// honestly (no sane acreage or no comparable $/acre), we report NO number and
// the value-gap facet falls back to recorded signals — never a fabricated value.
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  valueGap: 30,
  demand: 20,
  access: 15,
  flood: 10,
  market: 10,
  competition: 10,
  contact: 5,
} as const;

const FULL2: Record<string, string> = {
  Texas: "TX", Florida: "FL", Georgia: "GA", Tennessee: "TN", "North Carolina": "NC",
  "New York": "NY", Arizona: "AZ", "New Mexico": "NM", Colorado: "CO", California: "CA",
  Arkansas: "AR", Nevada: "NV", Kentucky: "KY",
};
const abbr = (s: string | null): string | null => {
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return FULL2[s] ?? null;
};
const normCounty = (c: string | null) =>
  (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

interface LeadShape {
  id?: string;
  apn?: string | null;
  state?: string | null;
  county?: string | null;
  acres?: number | null;
  minimum_bid?: number | null;
  judgment_amount?: number | null;
  final_score?: number | null;
  deal_score?: number | null;
  discount_pct?: number | null;
  savings?: number | null;
  liquidity_score?: number | null;
  county_pop_growth?: number | null;
  road_access?: string | null;
  flood_score?: number | null;
  dd_checked?: boolean | null;
  owner_name?: string | null;
  source?: string | null;
  lat?: number | null;
  lng?: number | null;
  property_address?: string | null;
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const raw = await req.json().catch(() => ({}));
  const parsed = underwriteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const body = parsed.data;
  // Must identify a parcel by at least one selector or enough manual fields.
  if (!body.leadId && !body.apn && !body.address && !(body.state && body.county && body.acres != null)) {
    return NextResponse.json(
      { error: "missing_parcel", message: "leadId, apn, address ya da (state + county + acres) gerekli." },
      { status: 400 }
    );
  }
  const s = supabaseAdmin();

  // 1) Resolve the parcel ----------------------------------------------------
  let lead: LeadShape | null = null;
  try {
    if (body.leadId) {
      const { data } = await s.from("tax_delinquent_properties").select("*").eq("id", body.leadId).maybeSingle();
      lead = (data as LeadShape) ?? null;
    } else if (body.apn) {
      const { data } = await s.from("tax_delinquent_properties").select("*").ilike("apn", `%${body.apn.replace(/[%,]/g, "")}%`).limit(1);
      lead = (data?.[0] as LeadShape) ?? null;
    } else if (body.address) {
      const q = body.address.replace(/[%,]/g, "").trim();
      const { data } = await s.from("tax_delinquent_properties").select("*").ilike("property_address", `%${q}%`).limit(1);
      lead = (data?.[0] as LeadShape) ?? null;
    }
  } catch {
    lead = null;
  }

  // manual mode: build a lead from the caller-supplied (validated) fields
  if (!lead) {
    lead = {
      apn: body.apn ?? null,
      state: body.state ?? null,
      county: body.county ?? null,
      acres: body.acres ?? null,
      minimum_bid: body.minBid ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      property_address: body.address ?? null,
    };
  }

  const st = abbr(lead.state ?? null);
  const cty = normCounty(lead.county ?? null);
  const dataGaps: string[] = [];

  // 2) County demographics ---------------------------------------------------
  let demo: { income: number | null; population: number | null; popGrowth: number | null } = {
    income: null, population: null, popGrowth: lead.county_pop_growth ?? null,
  };
  if (st && cty) {
    try {
      const { data } = await s
        .from("county_demographics")
        .select("median_household_income,population,pop_growth_5y")
        .eq("state", st)
        .ilike("county", `%${cty}%`)
        .limit(1);
      const d = data?.[0] as { median_household_income?: number; population?: number; pop_growth_5y?: number } | undefined;
      if (d) {
        demo = {
          income: d.median_household_income ?? null,
          population: d.population ?? null,
          popGrowth: d.pop_growth_5y ?? lead.county_pop_growth ?? null,
        };
      }
    } catch { /* graceful */ }
  }
  if (demo.income == null) dataGaps.push("county_demographics (income/population)");

  // 3) Market $/acre benchmark (outlier-stripped median; county comp preferred) -
  // medianPpa rejects acreage parsing errors and $/acre outliers before the median.
  let countyRate: number | null = null;
  let stateRate: number | null = null;
  if (st) {
    try {
      const { data } = await s.from("competitor_listings").select("county,price,acres").eq("state", st).limit(2000);
      const all = (data as { county: string; price: unknown; acres: unknown }[]) || [];
      stateRate = medianPpa(all.map((r) => ({ price: r.price, acres: r.acres })));
      if (cty) {
        const inCounty = all.filter((r) => normCounty(r.county) === cty);
        countyRate = medianPpa(inCounty.map((r) => ({ price: r.price, acres: r.acres })));
      }
    } catch { /* graceful */ }
  }
  // The headline $/acre signal we show: county comp if we have it, else state.
  const perAcre: number | null = countyRate ?? stateRate;
  if (perAcre == null) dataGaps.push("market $/acre benchmark (competitor_listings)");

  // 4) Live flood + road via dd-check when coords exist ----------------------
  let floodScore: number | null = lead.flood_score ?? null;
  let roadAccess: string | null = lead.road_access ?? null;
  if (lead.lat && lead.lng && (!lead.dd_checked || floodScore == null)) {
    try {
      const base = req.nextUrl.origin;
      const r = await fetch(`${base}/api/dd-check?lat=${lead.lat}&lon=${lead.lng}`, {
        headers: { cookie: req.headers.get("cookie") || "" },
      });
      const j = await r.json();
      floodScore = j?.flood?.riskScore ?? floodScore;
      roadAccess = j?.road?.accessType ?? roadAccess;
    } catch { /* graceful */ }
  }
  if (floodScore == null) dataGaps.push("flood risk (no lat/lng or FEMA unavailable)");
  if (roadAccess == null) dataGaps.push("road access (no lat/lng)");

  // 5) Intrinsic comp value (sanitized + bulk-adjusted + capped) -------------
  // saneAcres rejects parsing-error acreage; intrinsicValue refuses to value a
  // parcel without acreage or comps (returns null) and bulk-discounts big tracts.
  // We deliberately do NOT fall back to judgment_amount — back-taxes ≠ land value.
  const sAcres = saneAcres(lead.acres);
  const { value: compValue, confidence: valueConf } = intrinsicValue({ acres: sAcres, countyRate, stateRate });
  const benchValue = compValue; // honest comp value or null — never a fabricated number
  const minBid = saneBid(lead.minimum_bid);
  if (sAcres == null && lead.acres != null) dataGaps.push("acreage missing/implausible (no honest value)");
  else if (compValue == null && sAcres != null) dataGaps.push("intrinsic value (no comparable $/acre for this market)");

  // ── Rubric facets (each 0..1) ────────────────────────────────────────────
  const reasons: { label: string; pts: number; note: string }[] = [];

  // value gap — honest comp value vs sane min-bid; else fall back to recorded
  // signals (never invent a value). Gap is bounded 0..1 so it can't blow up.
  let valueGapN = 0;
  let valueGapNote = "değer açığı verisi yok (acreage/comp eksik)";
  let hardFailValue = false;
  if (benchValue && benchValue > 0 && minBid != null) {
    const gap = (benchValue - minBid) / benchValue; // 0..1 (or negative)
    valueGapN = clamp(gap, 0, 1);
    if (gap < 0) { hardFailValue = true; valueGapNote = `min teklif comp değerin üstünde (${Math.round(gap * 100)}%)`; }
    else valueGapNote = `~${Math.round(gap * 100)}% indirim (comp $${benchValue.toLocaleString()} vs teklif $${minBid.toLocaleString()})${valueConf !== "high" ? " · doğrulanmalı" : ""}`;
  } else if (lead.discount_pct != null) {
    valueGapN = clamp(lead.discount_pct / 100, 0, 1);
    valueGapNote = `kayıtlı indirim %${lead.discount_pct} (comp yok)`;
  } else if (lead.final_score != null) {
    valueGapN = clamp(lead.final_score / 100, 0, 1);
    valueGapNote = `Cerberus skoru proxy (${lead.final_score}/100)`;
  }
  reasons.push({ label: "Değer açığı", pts: WEIGHTS.valueGap * valueGapN, note: valueGapNote });

  // demand / liquidity
  let demandN = 0;
  const growth = demo.popGrowth;
  if (growth != null) demandN += clamp((growth + 0.02) / 0.12); // -2%..+10% → 0..1
  if (demo.income != null) demandN += clamp((demo.income - 35000) / 55000); // $35k..$90k
  if (lead.liquidity_score != null) demandN += clamp(lead.liquidity_score / 100);
  demandN = demandN === 0 ? 0 : clamp(demandN / (Number(growth != null) + Number(demo.income != null) + Number(lead.liquidity_score != null)));
  reasons.push({
    label: "Talep / likidite",
    pts: WEIGHTS.demand * demandN,
    note: growth != null ? `nüfus ${(growth * 100).toFixed(1)}%/5y${demo.income ? ` · gelir $${demo.income.toLocaleString()}` : ""}` : "demografi verisi sınırlı",
  });

  // access (HARD FAIL if landlocked)
  let accessN = 0.5;
  let landlocked = false;
  if (roadAccess === "direct") accessN = 1;
  else if (roadAccess === "near") accessN = 0.75;
  else if (roadAccess === "landlocked") { accessN = 0; landlocked = true; }
  reasons.push({
    label: "Yol erişimi",
    pts: WEIGHTS.access * accessN,
    note: roadAccess ? (landlocked ? "LANDLOCKED — değer kırıcı" : roadAccess) : "bilinmiyor (orta varsayıldı)",
  });

  // flood
  const floodN = floodScore == null ? 0.5 : clamp(1 - floodScore / 100);
  reasons.push({
    label: "Sel riski",
    pts: WEIGHTS.flood * floodN,
    note: floodScore == null ? "bilinmiyor" : floodScore >= 80 ? "yüksek risk" : floodScore >= 35 ? "orta" : "düşük",
  });

  // market data availability
  const marketN = perAcre ? 1 : 0.3;
  reasons.push({
    label: "Piyasa benchmark",
    pts: WEIGHTS.market * marketN,
    note: perAcre ? `state medyanı $${perAcre.toLocaleString()}/acre` : "yetersiz comp",
  });

  // competition
  const src = (lead.source || "").toUpperCase();
  const competitionN = /STRUCK/.test(src) ? 1 : /^TAX:/.test(src) ? 0.6 : 0.4;
  reasons.push({
    label: "Rekabet",
    pts: WEIGHTS.competition * competitionN,
    note: /STRUCK/.test(src) ? "struck-off (rakipsiz)" : /^TAX:/.test(src) ? "açık artırma" : "retail / bilinmiyor",
  });

  // owner contact
  const reachable = !!lead.owner_name && !/absentee|unknown|county tax|no owner/i.test(lead.owner_name);
  reasons.push({
    label: "Sahip iletişimi",
    pts: WEIGHTS.contact * (reachable ? 1 : 0.2),
    note: reachable ? "ulaşılabilir (direct-mail)" : "iletişim zor",
  });

  let score = Math.round(reasons.reduce((a, r) => a + r.pts, 0));
  // hard caps
  if (landlocked) score = Math.min(score, 40);
  if (hardFailValue) score = Math.min(score, 44);
  score = clamp(score);

  const verdict: "BUY" | "WATCH" | "PASS" = score >= 65 ? "BUY" : score >= 45 ? "WATCH" : "PASS";

  // 6) Narrative -------------------------------------------------------------
  const det = deterministicNarrative(verdict, score, reasons, { st, cty, acres: lead.acres ?? null, compValue, minBid, landlocked, hardFailValue });
  let narrative = det;
  let narrativeSource: "ai" | "rule-based" = "rule-based";
  if (aiEnabled()) {
    const ai = await aiNarrative({
      system: "You are a land-acquisition underwriter. Be concise (<120 words), decisive, and reference the numbers given. Output one tight paragraph, no markdown headers.",
      prompt: `Underwrite this US raw-land parcel. Verdict=${verdict}, score=${score}/100.\nLocation: ${cty || "?"}, ${st || "?"} · ${lead.acres ?? "?"} acres.\nComp value: ${compValue ? "$" + compValue.toLocaleString() : "unknown"}; min bid: ${minBid != null ? "$" + minBid.toLocaleString() : "unknown"}.\nSignals: ${reasons.map((r) => `${r.label}=${Math.round(r.pts)}pt (${r.note})`).join("; ")}.\nData gaps: ${dataGaps.join(", ") || "none"}.\nGive a crisp BUY/WATCH/PASS rationale.`,
    });
    if (ai) { narrative = ai; narrativeSource = "ai"; }
  }

  return NextResponse.json({
    resolved: !!lead.id,
    parcel: {
      id: lead.id ?? null,
      apn: lead.apn ?? null,
      state: st,
      county: cty || lead.county || null,
      acres: lead.acres ?? null,
      address: lead.property_address ?? null,
    },
    verdict,
    score,
    rubric: WEIGHTS,
    reasons: reasons.map((r) => ({ ...r, pts: Math.round(r.pts) })),
    signals: {
      compValue, perAcre, minBid, floodScore, roadAccess, popGrowth: growth, income: demo.income,
      valueConfidence: compValue != null ? valueConf : null,
      valueBasis: compValue != null ? (countyRate ? "county_comp" : "state_comp") : "none",
    },
    dataGaps,
    narrative,
    narrativeSource,
    aiAvailable: aiEnabled(),
  });
}

function deterministicNarrative(
  verdict: string,
  score: number,
  reasons: { label: string; pts: number; note: string }[],
  ctx: { st: string | null; cty: string; acres: number | null; compValue: number | null; minBid: number | null; landlocked: boolean; hardFailValue: boolean },
): string {
  const loc = [ctx.cty, ctx.st].filter(Boolean).join(", ") || "bu parsel";
  const top = [...reasons].sort((a, b) => b.pts - a.pts).slice(0, 2).map((r) => r.note);
  const weak = [...reasons].sort((a, b) => a.pts - b.pts).slice(0, 2).map((r) => `${r.label.toLowerCase()} (${r.note})`);
  const head =
    verdict === "BUY" ? `AL — ${loc} ${score}/100 ile güçlü bir fırsat.`
      : verdict === "WATCH" ? `İZLE — ${loc} ${score}/100; potansiyel var ama doğrulama gerek.`
        : `GEÇ — ${loc} ${score}/100, risk/getiri zayıf.`;
  const valuePart = ctx.compValue && ctx.minBid != null
    ? ` Comp değeri ≈ $${ctx.compValue.toLocaleString()}, min teklif $${ctx.minBid.toLocaleString()}.`
    : "";
  const killers = ctx.landlocked ? " ⚠️ Landlocked — yol erişimi olmadan değer ciddi düşer." : ctx.hardFailValue ? " ⚠️ Min teklif tahmini değerin üstünde." : "";
  return `${head}${valuePart} Güçlü yanlar: ${top.join("; ")}. Zayıf/riskli: ${weak.join("; ")}.${killers} (Kural-tabanlı; OPENAI_API_KEY ayarlanınca AI anlatımı devreye girer.)`;
}
