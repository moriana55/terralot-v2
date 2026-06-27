// Owner-finance amortizasyon motoru testleri (pure, no DB/network).
// Standart amortisman formülü + kademeli preset'ler (LANDiO/Compass yol haritası).
// "Güvenli": salePrice null ise plan null (sahte taksit üretme).
// Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFinancePlan,
  buildFinancingOptions,
  FINANCE_PRESETS,
  FINANCE_TERMS,
  COMPASS_DEFAULT,
} from "./owner-finance.ts";

test("Compass referans örneği: $30K / %7.9 / %10 peşinat / 60ay → aylık ≈ $546", () => {
  const plan = buildFinancePlan({
    salePrice: 30_000,
    annualRatePct: 7.9,
    termMonths: 60,
    downPaymentPct: 10,
  });
  assert.ok(plan !== null);
  assert.equal(plan!.downPayment, 3_000); // %10 peşinat
  assert.equal(plan!.financedAmount, 27_000); // 30K − 3K
  // yol haritasındaki referans rakamla tutarlı (≈ $546/ay)
  assert.ok(Math.abs(plan!.monthlyPayment - 546) < 2, `aylık ${plan!.monthlyPayment} ≈ 546 olmalı`);
  // toplam ödenen = peşinat + aylık × vade; faiz = toplam − satış fiyatı
  assert.equal(plan!.totalPaid, Math.round((3_000 + plan!.monthlyPayment * 60) * 100) / 100);
  assert.equal(plan!.totalInterest, Math.round((plan!.totalPaid - 30_000) * 100) / 100);
  assert.ok(plan!.totalInterest > 0); // taksitte anapara üstü prim var
});

test("salePrice null → plan null (sahte taksit planı üretilmez)", () => {
  assert.equal(buildFinancePlan({ salePrice: null, annualRatePct: 7.9, termMonths: 60 }), null);
  // 0 / negatif / geçersiz vade de null
  assert.equal(buildFinancePlan({ salePrice: 0, annualRatePct: 7.9, termMonths: 60 }), null);
  assert.equal(buildFinancePlan({ salePrice: -5_000, annualRatePct: 7.9, termMonths: 60 }), null);
  assert.equal(buildFinancePlan({ salePrice: 30_000, annualRatePct: 7.9, termMonths: 0 }), null);
});

test("sabit peşinat ($) yüzdeyi EZER ve satış fiyatını aşamaz", () => {
  const plan = buildFinancePlan({
    salePrice: 30_000,
    annualRatePct: 7.9,
    termMonths: 60,
    downPaymentPct: 10, // bu yok sayılmalı
    downPaymentUsd: 499, // LANDiO sabit peşinat
  });
  assert.equal(plan!.downPayment, 499);
  assert.equal(plan!.financedAmount, 30_000 - 499);
  // peşinat satış fiyatından büyükse satış fiyatına sınırlanır
  const capped = buildFinancePlan({ salePrice: 10_000, annualRatePct: 7.9, termMonths: 60, downPaymentUsd: 99_999 });
  assert.equal(capped!.downPayment, 10_000);
  assert.equal(capped!.financedAmount, 0);
  assert.equal(capped!.monthlyPayment, 0); // finanse edilen yok → taksit yok
});

test("%0 faiz → düz anapara bölmesi (faiz primi yok)", () => {
  const plan = buildFinancePlan({ salePrice: 12_000, annualRatePct: 0, termMonths: 60, downPaymentPct: 0 });
  assert.equal(plan!.financedAmount, 12_000);
  assert.equal(plan!.monthlyPayment, 200); // 12000/60
  assert.equal(plan!.totalInterest, 0);
});

test("efektif prim: cashPrice verilirse nakite göre %, yoksa null", () => {
  const withCash = buildFinancePlan({ salePrice: 30_000, annualRatePct: 7.9, termMonths: 60, downPaymentPct: 10, cashPrice: 22_000 });
  // owner-finance toplam tahsilat nakitten yüksek → pozitif prim
  assert.ok(withCash!.effectivePremiumPct !== null && withCash!.effectivePremiumPct > 0);
  const noCash = buildFinancePlan({ salePrice: 30_000, annualRatePct: 7.9, termMonths: 60, downPaymentPct: 10 });
  assert.equal(noCash!.effectivePremiumPct, null); // nakit yok → uydurma yok
});

test("kademeli faiz: uzun vade → daha yüksek toplam faiz (LANDiO %5.9/6.9/7.9)", () => {
  const opts = buildFinancingOptions(30_000);
  // LANDiO 3 kademe + Compass varsayılan = 4 plan
  assert.equal(opts.length, FINANCE_PRESETS.length);
  const tiers = FINANCE_TERMS.map((t) => opts.find((o) => o.id === t.id)!);
  // 36ay < 60ay < 84ay vadede toplam faiz artar (uzun vade + yüksek faiz)
  assert.ok(tiers[0].totalInterest < tiers[1].totalInterest);
  assert.ok(tiers[1].totalInterest < tiers[2].totalInterest);
  // her plan id/label taşır (UI için)
  assert.ok(opts.every((o) => o.id && o.label));
});

test("buildFinancingOptions: financePrice null → boş dizi", () => {
  assert.deepEqual(buildFinancingOptions(null), []);
});

test("Compass varsayılan preset değerleri yol haritasıyla uyumlu", () => {
  assert.equal(COMPASS_DEFAULT.ratePct, 7.9);
  assert.equal(COMPASS_DEFAULT.downPaymentPct, 10);
  assert.equal(COMPASS_DEFAULT.months, 60);
});
