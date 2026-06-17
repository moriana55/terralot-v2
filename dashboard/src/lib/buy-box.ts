// Shared, pure, rule-based "buy box" verdict for screened deals.
//
// This is the lightweight, client-safe sibling of /api/underwrite. The API route
// does the heavy, DB-backed underwriting (county comps, FEMA, $/acre medians) and
// returns BUY/WATCH/PASS. This module derives the SAME al/bekle/geç verdict from
// the per-row signals already stored on a tax_delinquent_properties row — so the
// deal-screener can rank/colour hundreds of rows instantly with zero network/AI.
//
// It is deterministic and explainable, never fabricates a value, and degrades
// honestly when signals are missing (low confidence, not a fake number).
//
// Verdict mapping is intentionally aligned with the API rubric:
//   score >= 65  → BUY    (al)
//   score 45..64 → WATCH  (bekle)
//   score < 45   → PASS    (geç)
// Hard fails (landlocked / min-bid above comp value) cap the verdict.

import { saneAcres, saneBid } from "@/lib/land-valuation";

export type Verdict = "BUY" | "WATCH" | "PASS";

export interface DealSignals {
  final_score?: number | null;
  deal_score?: number | null;
  discount_pct?: number | null;
  savings?: number | null;
  liquidity_score?: number | null;
  county_pop_growth?: number | null;
  road_access?: string | null;
  flood_score?: number | null;
  acres?: number | null;
  minimum_bid?: number | null;
  /** Optional comp value (acres × state/county $/acre) computed by the caller. */
  compValue?: number | null;
}

export interface BuyBox {
  verdict: Verdict;
  /** 0..100 composite, identical band logic to /api/underwrite. */
  score: number;
  /** Profit margin vs comp value, 0..1, or null when not derivable. */
  margin: number | null;
  /** Headline reasons, most → least impactful. */
  reasons: string[];
  /** True when a structural killer caps the verdict. */
  hardFail: boolean;
  /** "low" when the verdict leans on a Cerberus-score proxy rather than comps. */
  confidence: "high" | "medium" | "low";
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export const VERDICT_TR: Record<Verdict, string> = { BUY: "AL", WATCH: "BEKLE", PASS: "GEÇ" };

export function verdictOf(score: number): Verdict {
  return score >= 65 ? "BUY" : score >= 45 ? "WATCH" : "PASS";
}

/**
 * Profit margin = (compValue − minBid) / compValue, bounded 0..1.
 * Returns null when we can't compute it honestly (missing comp or sane bid).
 */
export function dealMargin(row: DealSignals): number | null {
  const comp = row.compValue;
  const bid = saneBid(row.minimum_bid);
  if (comp == null || comp <= 0 || bid == null) return null;
  return clamp((comp - bid) / comp, 0, 1);
}

/**
 * Rule-based buy box. Mirrors the API rubric's spirit using only stored signals.
 * Weights (sum 100): value/margin 35, demand 20, access 15, flood 10, discount 10,
 * realized savings 10. Facets with no data contribute 0 and lower confidence.
 */
export function buyBox(row: DealSignals): BuyBox {
  const reasons: string[] = [];
  let pts = 0;
  let usedComp = false;
  let hardFail = false;

  // 1) Value / margin (35) — prefer comp-derived margin, else discount, else score proxy.
  const margin = dealMargin(row);
  if (margin != null) {
    usedComp = true;
    pts += 35 * margin;
    const sAcres = saneAcres(row.acres);
    const bid = saneBid(row.minimum_bid);
    if (row.compValue != null && bid != null && row.compValue < bid) {
      hardFail = true;
      reasons.push("Min teklif comp değerin üstünde — değer açığı yok");
    } else {
      reasons.push(`~%${Math.round(margin * 100)} marj (comp $${row.compValue!.toLocaleString()} vs teklif $${bid!.toLocaleString()})${sAcres == null ? " · acreage doğrulanmalı" : ""}`);
    }
  } else if (row.discount_pct != null) {
    pts += 35 * clamp(row.discount_pct / 100, 0, 1);
    reasons.push(`Kayıtlı indirim %${row.discount_pct} (comp yok)`);
  } else if (row.final_score != null || row.deal_score != null) {
    const s = (row.final_score ?? row.deal_score)!;
    pts += 35 * clamp(s / 100, 0, 1);
    reasons.push(`Cerberus skoru proxy (${s}/100, comp/indirim yok)`);
  } else {
    reasons.push("Değer açığı verisi yok (comp/indirim/skor eksik)");
  }

  // 2) Demand / liquidity (20)
  let demandN = 0;
  let demandCount = 0;
  if (row.county_pop_growth != null) { demandN += clamp((row.county_pop_growth + 0.02) / 0.12, 0, 1); demandCount++; }
  if (row.liquidity_score != null) { demandN += clamp(row.liquidity_score / 100, 0, 1); demandCount++; }
  if (demandCount > 0) {
    demandN /= demandCount;
    pts += 20 * demandN;
    if (row.county_pop_growth != null) reasons.push(`Talep: nüfus ${(row.county_pop_growth * 100).toFixed(1)}%/5y`);
  } else {
    reasons.push("Talep/likidite verisi sınırlı");
  }

  // 3) Access (15) — landlocked is a hard fail.
  if (row.road_access === "direct") pts += 15;
  else if (row.road_access === "near") pts += 15 * 0.75;
  else if (row.road_access === "landlocked") { hardFail = true; reasons.push("LANDLOCKED — yol erişimi yok, değer kırıcı"); }
  else pts += 15 * 0.5; // unknown → neutral

  // 4) Flood (10)
  if (row.flood_score != null) {
    pts += 10 * clamp(1 - row.flood_score / 100, 0, 1);
    if (row.flood_score >= 80) reasons.push("Yüksek sel riski");
  } else {
    pts += 10 * 0.5;
  }

  // 5) Discount bonus (10) — independent of margin so a steep discount still counts.
  if (row.discount_pct != null) pts += 10 * clamp(row.discount_pct / 100, 0, 1);

  // 6) Realized savings signal (10)
  if (row.savings != null && row.savings > 0) pts += 10 * clamp(row.savings / 50000, 0, 1);

  let score = Math.round(clamp(pts));
  if (hardFail) score = Math.min(score, 44);
  const verdict = verdictOf(score);

  const confidence: BuyBox["confidence"] = usedComp ? "high" : (row.discount_pct != null ? "medium" : "low");

  return { verdict, score, margin, reasons: reasons.slice(0, 4), hardFail, confidence };
}
