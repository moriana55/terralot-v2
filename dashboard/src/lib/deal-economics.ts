// ─────────────────────────────────────────────────────────────────────────────
// DEAL EKONOMİSİ — pure, deterministic, null-safe.
//
// priceParcel() çıktısını (offer = alış / cashPrice / financePrice) alır ve
// "bu deal para kazandırıyor mu" sorusunu rakama döker:
//   • nakit spread + nakit ROI%  (hızlı çıkış senaryosu)
//   • brüt marj %                (cashPrice üzerinden)
//   • owner-finance toplam ROI%  (taksitli toplam tahsilat üzerinden, owner-finance.ts)
//
// Felsefe (pricing.ts ile aynı): girdi yoksa SAYI UYDURMA. offer veya cashPrice
// null ise ilgili alanlar null döner. pricing.ts / land-valuation.ts mantığına
// DOKUNMAZ — sadece çıktısını tüketir.
// ─────────────────────────────────────────────────────────────────────────────

import { COMPASS_DEFAULT, buildFinancePlan } from "@/lib/owner-finance";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface DealEconomicsInput {
  /** alış (blind-offer) tutarı — pricing.offer. */
  offer: number | null;
  /** nakit satış fiyatı — pricing.cashPrice. */
  cashPrice: number | null;
  /** owner-finance satış fiyatı — pricing.financePrice. */
  financePrice: number | null;
  /** opsiyonel kapanış/geri-vergi maliyeti ($) — toplam alış maliyetine eklenir. */
  acquisitionCostUsd?: number;
}

export interface DealEconomics {
  /** toplam alış maliyeti = offer + acquisitionCost. offer null → null. */
  totalCost: number | null;
  /** nakit spread = cashPrice − totalCost. */
  cashSpread: number | null;
  /** nakit ROI % = cashSpread / totalCost × 100. */
  cashRoiPct: number | null;
  /** brüt marj % = cashSpread / cashPrice × 100 (satış fiyatına oran). */
  grossMarginPct: number | null;
  /** owner-finance toplam tahsilat (Compass varsayılan: %7.9 / %10 / 60ay). */
  ownerFinanceTotalCollected: number | null;
  /** owner-finance toplam ROI % = (toplam tahsilat − totalCost) / totalCost × 100. */
  ownerFinanceTotalRoiPct: number | null;
  /** insan-okur özet / başabaş notu. */
  breakevenNote: string;
}

/**
 * Bir deal'ın ekonomisini hesaplar. Null-safe: eksik fiyat → ilgili alan null,
 * sahte sayı yok. Owner-finance toplamı Compass varsayılan presetiyle (referans
 * şablon) hesaplanır.
 */
export function dealEconomics(input: DealEconomicsInput): DealEconomics {
  const { offer, cashPrice, financePrice, acquisitionCostUsd = 0 } = input;

  const acq = Number.isFinite(acquisitionCostUsd) ? Math.max(0, acquisitionCostUsd) : 0;
  const totalCost = offer != null && Number.isFinite(offer) ? round2(offer + acq) : null;

  const cashSpread =
    cashPrice != null && totalCost != null ? round2(cashPrice - totalCost) : null;

  const cashRoiPct =
    cashSpread != null && totalCost != null && totalCost > 0
      ? round2((cashSpread / totalCost) * 100)
      : null;

  const grossMarginPct =
    cashSpread != null && cashPrice != null && cashPrice > 0
      ? round2((cashSpread / cashPrice) * 100)
      : null;

  // Owner-finance toplam tahsilat — Compass varsayılan şablonuyla (referans).
  const ofPlan = buildFinancePlan({
    salePrice: financePrice,
    annualRatePct: COMPASS_DEFAULT.ratePct,
    termMonths: COMPASS_DEFAULT.months,
    downPaymentPct: COMPASS_DEFAULT.downPaymentPct,
    cashPrice,
  });
  const ownerFinanceTotalCollected = ofPlan ? ofPlan.totalPaid : null;
  const ownerFinanceTotalRoiPct =
    ownerFinanceTotalCollected != null && totalCost != null && totalCost > 0
      ? round2(((ownerFinanceTotalCollected - totalCost) / totalCost) * 100)
      : null;

  // Başabaş / özet notu (Türkçe, şeffaf).
  let breakevenNote: string;
  if (totalCost == null) {
    breakevenNote = "Alış (teklif) yok — deal ekonomisi hesaplanamadı (uydurma yok)";
  } else if (cashSpread == null) {
    breakevenNote = `Alış maliyeti $${totalCost.toLocaleString()} · satış fiyatı yok — spread hesaplanamadı`;
  } else if (cashSpread <= 0) {
    breakevenNote = `Zarar/başabaş: nakit satış ($${cashPrice!.toLocaleString()}) alış maliyetini ($${totalCost.toLocaleString()}) karşılamıyor`;
  } else {
    const roi = cashRoiPct != null ? `${cashRoiPct.toFixed(0)}%` : "—";
    const ofRoi = ownerFinanceTotalRoiPct != null ? `${ownerFinanceTotalRoiPct.toFixed(0)}%` : "—";
    breakevenNote = `Nakit spread $${cashSpread.toLocaleString()} (ROI ${roi}) · owner-finance toplam ROI ${ofRoi}`;
  }

  return {
    totalCost,
    cashSpread,
    cashRoiPct,
    grossMarginPct,
    ownerFinanceTotalCollected,
    ownerFinanceTotalRoiPct,
    breakevenNote,
  };
}
