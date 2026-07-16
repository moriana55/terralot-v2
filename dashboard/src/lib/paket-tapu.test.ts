import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deedParcelCount,
  estimateUnitPrice,
  isPaketTapu,
  formatUsd,
  formatPaketAlimAciklama,
  effectivePriceForStats,
} from "./paket-tapu";

// Doğrulanmış örnek: APN 308-22-040 (SIMPLE FOODS LLC), RECPTNO 2020059875,
// SALEP $35.000 — aynı RECPTNO'ya bağlı 6 parsel var → birim ~$5.833.
const RECPTNO_PAKET = "2020059875";
const RECPTNO_TEKIL = "2021000111";

function countsFrom(pairs: [string, number][]): Map<string, number> {
  return new Map(pairs);
}

test("deedParcelCount: aynı RECPTNO'ya bağlı 6 parsel → count=6 her parselde", () => {
  const counts = countsFrom([[RECPTNO_PAKET, 6]]);
  assert.equal(deedParcelCount(RECPTNO_PAKET, counts), 6);
  // Aynı deed'e bağlı farklı APN'ler de aynı count'u alır (RECPTNO paylaşılıyor).
  assert.equal(deedParcelCount(RECPTNO_PAKET, counts), 6);
});

test("deedParcelCount: tekil parsel (RECPTNO'ya bağlı tek kayıt) → count=1", () => {
  const counts = countsFrom([[RECPTNO_PAKET, 6], [RECPTNO_TEKIL, 1]]);
  assert.equal(deedParcelCount(RECPTNO_TEKIL, counts), 1);
});

test("deedParcelCount: RECPTNO boş/null/undefined → tekil kabul (count=1)", () => {
  const counts = countsFrom([[RECPTNO_PAKET, 6]]);
  assert.equal(deedParcelCount(null, counts), 1);
  assert.equal(deedParcelCount(undefined, counts), 1);
  assert.equal(deedParcelCount("", counts), 1);
  assert.equal(deedParcelCount("   ", counts), 1);
  // Haritada hiç görülmemiş bir RECPTNO da güvenli şekilde 1'e düşer.
  assert.equal(deedParcelCount("9999999999", counts), 1);
});

test("estimateUnitPrice: SALEP / deedParcelCount — doğrulanmış örnek $35.000/6=$5.833,33", () => {
  const counts = countsFrom([[RECPTNO_PAKET, 6]]);
  const count = deedParcelCount(RECPTNO_PAKET, counts);
  assert.equal(estimateUnitPrice(35000, count), 5833.33);
  // Tekil kayıtta (count=1) birim fiyat = SALEP'in kendisi.
  const tekilCount = deedParcelCount(RECPTNO_TEKIL, counts);
  assert.equal(estimateUnitPrice(8900, tekilCount), 8900);
  // Geçersiz SALEP -> null (uydurma yok).
  assert.equal(estimateUnitPrice(null, 6), null);
  assert.equal(estimateUnitPrice(0, 6), null);
  assert.equal(estimateUnitPrice(-100, 1), null);
});

test("isPaketTapu: count>1 paket, count<=1 tekil", () => {
  assert.equal(isPaketTapu(6), true);
  assert.equal(isPaketTapu(1), false);
  assert.equal(isPaketTapu(0), false);
  assert.equal(isPaketTapu(null), false);
  assert.equal(isPaketTapu(undefined), false);
});

test("formatPaketAlimAciklama: toplam fiyatı gizlemez, tek parselin fiyatıymış gibi sunmaz", () => {
  const text = formatPaketAlimAciklama(35000, "2020/10/15", 6, 5833.33);
  assert.equal(text, "Alım: $35,000 · 2020/10/15 — 6 parsellik paket tapusu (parsel başına ~$5,833)");
  assert.match(text, /\$35,000/); // toplam GİZLENMEDİ
  assert.match(text, /~\$5,833/); // parsel-başı tahmin de gösterildi
  assert.match(text, /6 parsellik paket/);
});

test("formatUsd: tam sayıya yuvarlar + binlik ayraç", () => {
  assert.equal(formatUsd(5833.33), "$5,833");
  assert.equal(formatUsd(35000), "$35,000");
  assert.equal(formatUsd(500), "$500");
});

test("effectivePriceForStats: istatistik fonksiyonu paket kayıtlarda birim fiyat tahminini kullanır", () => {
  // Paket kayıt (count=6): istatistikte SALEP değil, birim fiyat tahmini kullanılmalı.
  assert.equal(effectivePriceForStats(35000, 6, 5833.33), 5833.33);
  // Tekil kayıt (count=1): SALEP'in kendisi kullanılır (değişmez).
  assert.equal(effectivePriceForStats(8900, 1, 8900), 8900);
  // count belirtilmemiş (undefined/null) -> tekil kabul, SALEP kullanılır.
  assert.equal(effectivePriceForStats(8900, null, null), 8900);
  assert.equal(effectivePriceForStats(8900, undefined, undefined), 8900);
  // Paket ama birim fiyat hesaplanamamışsa (SALEP geçersizdi) -> null, uydurma yok.
  assert.equal(effectivePriceForStats(0, 6, null), null);
});
