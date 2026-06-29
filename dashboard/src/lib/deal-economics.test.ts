// Deal ekonomisi testleri (pure, no DB/network).
// priceParcel çıktısından spread / ROI / marj + owner-finance toplam ROI.
// "Güvenli": eksik fiyat → ilgili alan null (sahte sayı yok).
// Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { dealEconomics } from "./deal-economics.ts";
import { priceParcel } from "./pricing.ts";

test("gerçek priceParcel çıktısıyla: spread/ROI/marj tutarlı ve pozitif", () => {
  // 5 acre × $20k/acre = $100k → offer 25k / cash 65k / finance 90k
  const p = priceParcel({ acres: 5, countyRate: 20_000, countyComps: 10 });
  const e = dealEconomics({ offer: p.offer, cashPrice: p.cashPrice, financePrice: p.financePrice });
  assert.equal(e.totalCost, 25_000); // offer, acquisitionCost yok
  assert.equal(e.cashSpread, 40_000); // 65k − 25k
  assert.equal(e.cashRoiPct, 160); // 40k/25k × 100
  // brüt marj = spread / satış fiyatı = 40k/65k ≈ %61.5
  assert.ok(Math.abs(e.grossMarginPct! - 61.54) < 0.1);
  // owner-finance toplam tahsilat > nakit spread senaryosu → daha yüksek ROI
  assert.ok(e.ownerFinanceTotalCollected! > e.cashSpread!);
  assert.ok(e.ownerFinanceTotalRoiPct! > e.cashRoiPct!);
  assert.ok(/spread/i.test(e.breakevenNote));
});

test("acquisitionCostUsd alış maliyetine eklenir → ROI düşer", () => {
  const base = dealEconomics({ offer: 20_000, cashPrice: 65_000, financePrice: 90_000 });
  const withCost = dealEconomics({ offer: 20_000, cashPrice: 65_000, financePrice: 90_000, acquisitionCostUsd: 1_500 });
  assert.equal(withCost.totalCost, 21_500);
  assert.equal(withCost.cashSpread, 43_500); // 65k − 21.5k
  assert.ok(withCost.cashRoiPct! < base.cashRoiPct!); // maliyet arttı, ROI düştü
});

test("offer null → totalCost ve spread/ROI null (uydurma yok)", () => {
  const e = dealEconomics({ offer: null, cashPrice: 65_000, financePrice: 90_000 });
  assert.equal(e.totalCost, null);
  assert.equal(e.cashSpread, null);
  assert.equal(e.cashRoiPct, null);
  assert.equal(e.grossMarginPct, null);
  assert.equal(e.ownerFinanceTotalRoiPct, null);
  assert.ok(/teklif|hesaplanamad/i.test(e.breakevenNote));
});

test("cashPrice null → nakit spread/marj null ama owner-finance tahsilat yine hesaplanır", () => {
  const e = dealEconomics({ offer: 20_000, cashPrice: null, financePrice: 90_000 });
  assert.equal(e.totalCost, 20_000);
  assert.equal(e.cashSpread, null);
  assert.equal(e.grossMarginPct, null);
  assert.ok(e.ownerFinanceTotalCollected! > 0); // financePrice var → tahsilat hesaplanır
  assert.ok(e.ownerFinanceTotalRoiPct! > 0);
});

test("comp yok (priceParcel tüm fiyatlar null) → ekonomi tamamen null-safe", () => {
  const p = priceParcel({ acres: null, countyRate: 20_000, countyComps: 10 });
  const e = dealEconomics({ offer: p.offer, cashPrice: p.cashPrice, financePrice: p.financePrice });
  assert.equal(e.totalCost, null);
  assert.equal(e.cashSpread, null);
  assert.equal(e.ownerFinanceTotalCollected, null);
  assert.ok(typeof e.breakevenNote === "string" && e.breakevenNote.length > 0);
});

test("zarar senaryosu: nakit satış alış maliyetinin altında → spread negatif + uyarı notu", () => {
  const e = dealEconomics({ offer: 80_000, cashPrice: 50_000, financePrice: 70_000 });
  assert.equal(e.cashSpread, -30_000);
  assert.ok(e.cashRoiPct! < 0);
  assert.ok(/zarar|başabaş/i.test(e.breakevenNote));
});
