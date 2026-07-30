// Not kalibrasyonu saf yorum kuralları testleri (DB/ağ yok).
import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_SATIS_ORNEKLEM, ornekYeterli, kanitGucu, spearmanYorum, ayrismaKontrol,
} from "./not-kalibrasyon";

test("ornekYeterli: eşik altındaki örneklem kanıt sayılmaz", () => {
  assert.equal(ornekYeterli(MIN_SATIS_ORNEKLEM), true);
  assert.equal(ornekYeterli(MIN_SATIS_ORNEKLEM - 1), false);
  assert.equal(ornekYeterli(null), false);
  assert.equal(ornekYeterli(undefined), false);
});

test("kanitGucu: yetersiz örneklem AÇIKÇA yetersiz yazar (uydurma yorum yok)", () => {
  assert.match(kanitGucu(2), /YETERSİZ/);
  assert.match(kanitGucu(500), /kıyaslanabilir/);
});

test("spearmanYorum: eşik altı 'zayıf', negatif korelasyon uyarı verir", () => {
  assert.equal(spearmanYorum(null), "ölçülmedi");
  assert.match(spearmanYorum(0.05), /zayıf/);
  assert.match(spearmanYorum(0.325), /pozitif/);
  assert.match(spearmanYorum(-0.4), /NEGATİF/);
});

test("ayrismaKontrol: örneklemi yetersiz bandlar kararın DIŞINDA bırakılır", () => {
  // A+ ve A örneklemi küçük (gerçek durum: FL'de n=10 / n=2) → atlanır.
  const r = ayrismaKontrol([
    { anahtar: "A+", n_lead: 505, n_satis: 10, med_satis: 24000, ort_skor: 63.8 },
    { anahtar: "A", n_lead: 122, n_satis: 2, med_satis: 13750, ort_skor: 57.3 },
    { anahtar: "B", n_lead: 22560, n_satis: 546, med_satis: 15000, ort_skor: 40.7 },
    { anahtar: "C", n_lead: 42179, n_satis: 698, med_satis: 13000, ort_skor: 35.0 },
    { anahtar: "D", n_lead: 13382, n_satis: 166, med_satis: 7900, ort_skor: 26.9 },
    { anahtar: "F", n_lead: 5391, n_satis: 76, med_satis: 6700, ort_skor: 23.5 },
  ]);
  assert.deepEqual(r.atlanan, ["A+", "A"]);
  assert.deepEqual(r.kullanilan, ["B", "C", "D", "F"]);
  assert.equal(r.tekduze, true); // 15.000 > 13.000 > 7.900 > 6.700
});

test("ayrismaKontrol: sıralama bozulursa tekdüze DEĞİL (bozuk geo turu senaryosu)", () => {
  // 2026-07-29 bozuk taramasında F medyanı $14.000'e fırlamıştı — B/C/D'yi aşıyordu.
  const r = ayrismaKontrol([
    { anahtar: "B", n_lead: 2014, n_satis: 72, med_satis: 15200, ort_skor: 37 },
    { anahtar: "C", n_lead: 24078, n_satis: 325, med_satis: 11800, ort_skor: 32.7 },
    { anahtar: "D", n_lead: 13382, n_satis: 166, med_satis: 7900, ort_skor: 28 },
    { anahtar: "F", n_lead: 44041, n_satis: 923, med_satis: 14000, ort_skor: 43.2 },
  ]);
  assert.equal(r.tekduze, false);
});

test("ayrismaKontrol: iki bandın altına düşünce karar verilmez (null)", () => {
  const r = ayrismaKontrol([{ anahtar: "B", n_lead: 10, n_satis: 40, med_satis: 100, ort_skor: 1 }]);
  assert.equal(r.tekduze, null);
});
