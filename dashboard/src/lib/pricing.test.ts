// Pricing engine tests (pure, no DB/network).
// Tek comp-tabanlı değerleme → hem MAIL teklifi (alış) hem SATIŞ fiyatı (nakit/owner-finance).
// "Güvenli fiyat": comp yoksa/zayıfsa fiyat ÜRETME ve mailSafe=false (otomatik teklif gitmesin).
// Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceParcel, PRICING } from "./pricing.ts";

test("comp-tabanlı değer → teklif/nakit/finansman aynı değerden türetilir (tutarlı)", () => {
  // 5 acre × $20k/acre county comp (10 örnek) = $100k piyasa değeri
  const p = priceParcel({ acres: 5, countyRate: 20000, countyComps: 10 });
  assert.equal(p.marketValue, 100_000);
  assert.equal(p.basis, "county_comp");
  assert.equal(p.confidence, "high");
  assert.equal(p.comps, 10);
  // teklif (mail) = %20, nakit satış = %65, owner-finance = %90 — hepsi AYNI piyasa değerinden
  assert.equal(p.offer, 20_000);
  assert.equal(p.cashPrice, 65_000);
  assert.equal(p.financePrice, 90_000);
  // sıralama tutarlı: teklif < nakit < finansman
  assert.ok(p.offer! < p.cashPrice! && p.cashPrice! < p.financePrice!);
  // güçlü comp → otomatik mail güvenli
  assert.equal(p.mailSafe, true);
});

test("comp YOKSA fiyat üretme — null + mailSafe=false (uydurma teklif gitmez)", () => {
  // acreage yok → land-valuation honest null döner
  const p = priceParcel({ acres: null, countyRate: 20000, countyComps: 10 });
  assert.equal(p.marketValue, null);
  assert.equal(p.offer, null);
  assert.equal(p.cashPrice, null);
  assert.equal(p.financePrice, null);
  assert.equal(p.mailSafe, false);
  assert.ok(p.reasons.some((r) => /comp|değer|veri/i.test(r)));
});

test("küçük parsel (≤$10k) → teklif %20 değil %15 ile sınırlanır (aşırı teklif yok)", () => {
  // 0.2 acre × $20k = $4k piyasa değeri (≤ $10k eşiği)
  const p = priceParcel({ acres: 0.2, countyRate: 20000, countyComps: 5 });
  assert.equal(p.marketValue, 4_000);
  assert.equal(p.offer, Math.round(4_000 * PRICING.OFFER_PCT_SMALL)); // 600, %15
});

test("sadece state comp + az örnek (<3) → mailSafe=false (DOĞRULA, otomatik mail atma)", () => {
  const p = priceParcel({ acres: 5, stateRate: 15000, stateComps: 2 });
  assert.equal(p.marketValue, 75_000);
  assert.equal(p.basis, "state_comp");
  assert.equal(p.confidence, "medium");
  assert.equal(p.comps, 2);
  assert.equal(p.mailSafe, false); // örnek sayısı yetersiz → güvenli değil
  assert.ok(p.reasons.some((r) => /doğrula|yetersiz|comp/i.test(r)));
});

test("büyük parsel (>50 acre) → düşük güven → mailSafe=false", () => {
  // 100 acre × state comp → land-valuation confidence "low" (büyük tract generic comp)
  const p = priceParcel({ acres: 100, countyRate: 10000, countyComps: 8 });
  assert.equal(p.confidence, "low");
  assert.equal(p.mailSafe, false); // düşük güven → otomatik mail güvenli değil
});
