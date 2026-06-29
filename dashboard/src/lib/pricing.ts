// Güvenli, tek-kaynak fiyatlama motoru.
//
// Terralot'un kaması: TEK comp-tabanlı piyasa değeri → hem MAIL teklifi (alış)
// hem SATIŞ fiyatı (nakit + owner-finance) AYNI değerden türetilir. Böylece iki uç
// tutarlı ve savunulabilir olur.
//
// "Güvenli": land-valuation motoru comp/acreage olmadan değer üretmez (null döner,
// sahte $0 değil). Comp yetersiz ya da güven düşükse fiyat üretilir ama mailSafe=false
// işaretlenir → otomatik blind-offer mektubu gitmez, insan DOĞRULAR.
//
// Yüzdeler AHMET-ARSA-YOL-HARITASI.md'den: teklif = piyasa değerinin %15–25'i
// (≤$10K parselde %15 ile sınırla), satış = piyasanın %50–80'i (nakit) / owner-finance daha yüksek.

import { intrinsicValue, type Basis, type Confidence } from "@/lib/land-valuation";

export const PRICING = {
  OFFER_PCT: 0.25, // blind-offer = piyasa değerinin %25'i (Yiğit kararı 2026-06-29: lowball çok kırıyordu, %25'e çıkıldı)
  OFFER_PCT_SMALL: 0.25, // küçük parselde de %25 (sahip kırılmasın; kabul şansı↑, spread hâlâ sağlıklı)
  SMALL_PARCEL_USD: 10_000, // (artık teklif yüzdesini düşürmüyor; eşik ileride başka kural için duruyor)
  CASH_SELL_PCT: 0.65, // nakit satış = piyasanın %65'i (indirimli-arazi modeli)
  FINANCE_SELL_PCT: 0.9, // owner-finance satış daha yüksek (taksitli prim)
  MIN_COMPS: 3, // güvenilir (mailSafe) değer için minimum comp örneği
} as const;

export interface ParcelPricingInput {
  acres: number | null;
  /** county comp $/acre medyanı (varsa tercih edilir). */
  countyRate?: number | null;
  /** state comp $/acre medyanı (county yoksa fallback). */
  stateRate?: number | null;
  /** county medyanına giren gerçek ilan sayısı. */
  countyComps?: number;
  /** state medyanına giren gerçek ilan sayısı. */
  stateComps?: number;
}

export interface ParcelPricing {
  /** comp-tabanlı piyasa değeri; comp/acreage yoksa null (uydurma yok). */
  marketValue: number | null;
  basis: Basis;
  confidence: Confidence;
  /** değeri besleyen gerçek comp sayısı (0 = yok). */
  comps: number;
  /** MAIL: blind-offer teklif tutarı. */
  offer: number | null;
  /** SATIŞ: nakit fiyat (düşük). */
  cashPrice: number | null;
  /** SATIŞ: owner-finance fiyatı (yüksek). */
  financePrice: number | null;
  /** true → comp güçlü, otomatik mail güvenli. false → DOĞRULA, otomatik mail atma. */
  mailSafe: boolean;
  /** şeffaflık: fiyatın neye dayandığı + uyarılar. */
  reasons: string[];
}

/**
 * Bir parseli tek comp-tabanlı değerden fiyatlar (mail teklifi + satış fiyatları).
 * Değer üretilemezse (comp/acreage yok) tüm fiyatlar null ve mailSafe=false döner.
 */
export function priceParcel(input: ParcelPricingInput): ParcelPricing {
  const { acres, countyRate = null, stateRate = null, countyComps = 0, stateComps = 0 } = input;
  const { value, basis, confidence } = intrinsicValue({ acres, countyRate, stateRate });
  const comps = basis === "county_comp" ? countyComps : basis === "state_comp" ? stateComps : 0;
  const reasons: string[] = [];

  if (value == null) {
    reasons.push("Güvenilir comp/değer yok — fiyat üretilmedi (uydurma yok)");
    return {
      marketValue: null, basis, confidence, comps,
      offer: null, cashPrice: null, financePrice: null,
      mailSafe: false, reasons,
    };
  }

  const offerPct = value <= PRICING.SMALL_PARCEL_USD ? PRICING.OFFER_PCT_SMALL : PRICING.OFFER_PCT;
  const offer = Math.round(value * offerPct);
  const cashPrice = Math.round(value * PRICING.CASH_SELL_PCT);
  const financePrice = Math.round(value * PRICING.FINANCE_SELL_PCT);
  const mailSafe = comps >= PRICING.MIN_COMPS && confidence !== "low";

  reasons.push(
    `Piyasa değeri $${value.toLocaleString()} (${basis === "county_comp" ? "county" : "state"} comp · ${comps} örnek · ${confidence} güven)`
  );
  reasons.push(
    `Teklif $${offer.toLocaleString()} (%${Math.round(offerPct * 100)}) · nakit $${cashPrice.toLocaleString()} · owner-finance $${financePrice.toLocaleString()}`
  );
  if (!mailSafe) {
    reasons.push(
      comps < PRICING.MIN_COMPS
        ? `Yetersiz comp (${comps}<${PRICING.MIN_COMPS}) — DOĞRULA, otomatik mail atma`
        : "Düşük güven — DOĞRULA, otomatik mail atma"
    );
  }

  return { marketValue: value, basis, confidence, comps, offer, cashPrice, financePrice, mailSafe, reasons };
}
