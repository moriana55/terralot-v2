// ─────────────────────────────────────────────────────────────────────────────
// OWNER-FINANCE AMORTİZASYON MOTORU — pure, deterministic, null-safe.
//
// Terralot satış ucunun ikinci yarısı: bir parsel pricing.financePrice ile
// owner-finance (taksitli) satışa konduğunda müşteriye "şu kadar peşinat,
// ayda şu kadar, toplam şu kadar" planını ÜRETİR. pricing.ts/land-valuation.ts
// mantığına DOKUNMAZ — sadece onların çıktısı olan financePrice'ı girdi alır.
//
// Felsefe (pricing.ts ile aynı): girdi yoksa SAYI UYDURMA. salePrice null ise
// plan null döner. Aksi halde standart amortisman formülü:
//     M = P · r / (1 − (1+r)^−n)   (r = aylık faiz, n = ay)
// Money math, kanıtlanabilir tek-kaynak olsun diye flip-calc.ts'ten import edilir
// (aynı yuvarlama, aynı formül — iki ayrı amortisman uygulaması tutmuyoruz).
//
// Preset rakamları AHMET-ARSA-YOL-HARITASI.md'den:
//   • LANDiO kademeli: %5.9 (3yıl/36ay) / %6.9 (5yıl/60ay) / %7.9 (7yıl/84ay), %10 peşinat
//   • Compass varsayılan: %7.9 faiz / %10 peşinat / 60 ay
//     (referans örnek: $30K → $3K peşinat → ≈ $546/ay)
// ─────────────────────────────────────────────────────────────────────────────

import { monthlyPayment } from "@/lib/flip-calc";

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPct = (p: number) => Math.max(0, Math.min(100, p));

/** Müşteriye sunulan bir owner-finance şartı (peşinat + faiz + vade). */
export interface FinanceTermPreset {
  /** stabil kimlik (UI key / seçim için). */
  id: string;
  /** kısa Türkçe etiket. */
  label: string;
  /** amortisman vadesi (ay). */
  months: number;
  /** yıllık faiz (% — 7.9 = %7.9). */
  ratePct: number;
  /** varsayılan peşinat yüzdesi (0..100). downUsd verilirse o öncelikli. */
  downPaymentPct: number;
}

/**
 * LANDiO kademeli faiz şablonu (yol haritası): uzun vade → yüksek faiz.
 * Hepsi %10 peşinat varsayar (LANDiO $499 sabit / %10 / %20 seçenekleri sunar;
 * burada %10'u baz alıyoruz, çağıran isterse downPaymentUsd ile ezebilir).
 */
export const FINANCE_TERMS: readonly FinanceTermPreset[] = [
  { id: "landio-3yr", label: "3 yıl · %5.9", months: 36, ratePct: 5.9, downPaymentPct: 10 },
  { id: "landio-5yr", label: "5 yıl · %6.9", months: 60, ratePct: 6.9, downPaymentPct: 10 },
  { id: "landio-7yr", label: "7 yıl · %7.9", months: 84, ratePct: 7.9, downPaymentPct: 10 },
] as const;

/** Compass tarzı varsayılan: %7.9 faiz / %10 peşinat / 60 ay (referans calculator). */
export const COMPASS_DEFAULT: FinanceTermPreset = {
  id: "compass-default",
  label: "Compass · %7.9 / 60ay",
  months: 60,
  ratePct: 7.9,
  downPaymentPct: 10,
};

/** Müşteriye sunulan tam preset seti: LANDiO kademeli + Compass varsayılan. */
export const FINANCE_PRESETS: readonly FinanceTermPreset[] = [...FINANCE_TERMS, COMPASS_DEFAULT];

export interface FinancePlanInput {
  /** owner-finance satış fiyatı (pricing.financePrice). null → plan null. */
  salePrice: number | null;
  /** yıllık faiz (% — 7.9 = %7.9). */
  annualRatePct: number;
  /** amortisman vadesi (ay). */
  termMonths: number;
  /** peşinat yüzdesi (0..100). downPaymentUsd verilmezse kullanılır. */
  downPaymentPct?: number;
  /** sabit peşinat ($). Verilirse downPaymentPct'i EZER (yol haritası: $499 gibi). */
  downPaymentUsd?: number;
  /** karşılaştırma için nakit fiyat (pricing.cashPrice) — efektif prim hesabı. */
  cashPrice?: number | null;
}

export interface FinancePlan {
  /** preset kimliği/etiketi (preset üzerinden üretildiyse). */
  id?: string;
  label?: string;
  /** owner-finance satış fiyatı. */
  salePrice: number;
  /** peşinat tutarı ($). */
  downPayment: number;
  /** efektif peşinat yüzdesi (downUsd verildiyse türetilir). */
  downPaymentPct: number;
  /** finanse edilen anapara (salePrice − downPayment). */
  financedAmount: number;
  /** yıllık faiz (%). */
  annualRatePct: number;
  /** vade (ay). */
  termMonths: number;
  /** seviye (level) aylık taksit. */
  monthlyPayment: number;
  /** toplam ödenen = peşinat + aylık × vade. */
  totalPaid: number;
  /** toplam faiz = totalPaid − salePrice (anapara üstü prim). */
  totalInterest: number;
  /**
   * nakite göre efektif prim %: (totalPaid − cashPrice) / cashPrice × 100.
   * cashPrice yoksa null (uydurma yok).
   */
  effectivePremiumPct: number | null;
}

/**
 * Tek bir owner-finance planı kurar. salePrice null ise (pricing değer üretmediyse)
 * null döner — sahte taksit planı göstermeyiz. Pure & deterministik.
 */
export function buildFinancePlan(input: FinancePlanInput): FinancePlan | null {
  const { salePrice, annualRatePct, termMonths, cashPrice = null } = input;
  if (salePrice == null || !Number.isFinite(salePrice) || salePrice <= 0) return null;
  if (!Number.isFinite(termMonths) || termMonths <= 0) return null;

  // Peşinat: sabit $ önceliklidir, yoksa yüzde. Satış fiyatını aşamaz, negatif olamaz.
  let downPayment: number;
  if (input.downPaymentUsd != null && Number.isFinite(input.downPaymentUsd)) {
    downPayment = Math.max(0, Math.min(input.downPaymentUsd, salePrice));
  } else {
    const pct = clampPct(input.downPaymentPct ?? 0);
    downPayment = round2(salePrice * (pct / 100));
  }
  downPayment = round2(downPayment);

  const financedAmount = round2(salePrice - downPayment);
  const monthly = monthlyPayment(financedAmount, annualRatePct, termMonths);
  const totalPaid = round2(downPayment + monthly * termMonths);
  const totalInterest = round2(totalPaid - salePrice);
  const downPaymentPct = round2((downPayment / salePrice) * 100);

  const effectivePremiumPct =
    cashPrice != null && Number.isFinite(cashPrice) && cashPrice > 0
      ? round2(((totalPaid - cashPrice) / cashPrice) * 100)
      : null;

  return {
    salePrice,
    downPayment,
    downPaymentPct,
    financedAmount,
    annualRatePct,
    termMonths,
    monthlyPayment: monthly,
    totalPaid,
    totalInterest,
    effectivePremiumPct,
  };
}

/**
 * Bir financePrice için TÜM preset planlarını üretir (müşteriye sunulacak
 * "peşinat / aylık / toplam / faiz" tablosu). financePrice null ise boş dizi.
 * cashPrice verilirse her planda nakite göre efektif prim de hesaplanır.
 */
export function buildFinancingOptions(
  financePrice: number | null,
  opts: { cashPrice?: number | null; presets?: readonly FinanceTermPreset[] } = {}
): FinancePlan[] {
  if (financePrice == null) return [];
  const presets = opts.presets ?? FINANCE_PRESETS;
  const plans: FinancePlan[] = [];
  for (const p of presets) {
    const plan = buildFinancePlan({
      salePrice: financePrice,
      annualRatePct: p.ratePct,
      termMonths: p.months,
      downPaymentPct: p.downPaymentPct,
      cashPrice: opts.cashPrice,
    });
    if (plan) plans.push({ ...plan, id: p.id, label: p.label });
  }
  return plans;
}
