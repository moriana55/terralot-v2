import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRakipDefteriRows,
  computeRakipDefteriOzet,
  computeNeOgreniyoruz,
  sortRakipDefteriRows,
  filterRakipDefteriRows,
  type RakipDefteriData,
  type RakipDefteriKayit,
} from "./rakip-defteri";

function kayit(overrides: Partial<RakipDefteriKayit>): RakipDefteriKayit {
  return {
    apn: "000-00-000",
    kayitTipi: "belirsiz",
    bolge: null,
    acres: null,
    alimFiyati: null,
    alimTarihi: null,
    recordingNo: null,
    deedType: null,
    satici: null,
    legal: null,
    deedParcelCount: 1,
    birimFiyatTahmini: null,
    satisFiyati: null,
    pesinat: null,
    aylik: null,
    vade: null,
    statu: null,
    ilanBaslik: null,
    ilanUrl: null,
    snapshotTarihi: null,
    ...overrides,
  };
}

test("paket bölme: deedParcelCount > 1 ise etkinAlim = birimFiyatTahmini, TOPLAM DEĞİL", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 1,
    digerOyuncular: [],
    kayitlar: [
      kayit({
        apn: "PAKET-1", kayitTipi: "satis_taksitte",
        alimFiyati: 17510, deedParcelCount: 3, birimFiyatTahmini: 5836.67,
        satisFiyati: 7999,
      }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paket, true);
  assert.equal(rows[0].etkinAlim, 5836.67);
  // Kâr/çarpan birim fiyat üzerinden hesaplanmalı, toplam 17510 üzerinden DEĞİL.
  assert.ok(rows[0].karMarji! > 0, "birim bazlı kâr pozitif olmalı (5836 alıp 7999'a satmış)");
  assert.equal(Math.round((rows[0].carpan ?? 0) * 100) / 100, Math.round((7999 / 5836.67) * 100) / 100);
});

test("tekil (paket olmayan) kayıtta etkinAlim = alimFiyati aynen kullanılır", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 1, digerOyuncular: [],
    kayitlar: [kayit({ apn: "TEKIL-1", alimFiyati: 8900, deedParcelCount: 1, satisFiyati: 11999 })],
  };
  const rows = buildRakipDefteriRows(data);
  assert.equal(rows[0].paket, false);
  assert.equal(rows[0].etkinAlim, 8900);
  assert.equal(rows[0].karMarji, 11999 - 8900);
  assert.equal(rows[0].carpan, Math.round((11999 / 8900) * 100) / 100);
});

test("çarpan hesabı: etkinAlim 0 ise çarpan null döner (0'a bölme yok); etkinAlim hiç yoksa kâr/çarpan ikisi de null", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 2, digerOyuncular: [],
    kayitlar: [
      kayit({ apn: "SIFIR-ALIM", alimFiyati: 0, satisFiyati: 5000 }),
      kayit({ apn: "ALIM-YOK", alimFiyati: null, satisFiyati: 5000 }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  // alım $0 → bölme hatası (Infinity/NaN) yok, çarpan hesaplanamaz ama kâr aritmetik olarak tanımlı.
  assert.equal(rows[0].carpan, null);
  assert.equal(rows[0].karMarji, 5000);
  // alım hiç bilinmiyor → hem kâr hem çarpan null (uydurma yok).
  assert.equal(rows[1].carpan, null);
  assert.equal(rows[1].karMarji, null);
});

test("aylık tahsilat toplamı: SADECE aktif taksitli (satis_taksitte) kayıtların aylık ödemesi toplanır", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 4, digerOyuncular: [],
    kayitlar: [
      kayit({ apn: "T1", kayitTipi: "satis_taksitte", aylik: 200 }),
      kayit({ apn: "T2", kayitTipi: "satis_taksitte", aylik: 300 }),
      // envanterde de "aylik" (ilan fiyatı taksit teklifi) olabilir ama aktif SÖZLEŞME değil — toplama girmemeli.
      kayit({ apn: "E1", kayitTipi: "envanter", aylik: 999 }),
      // tamamlanmış satışta da aylik alanı görülebilir (eski ilan verisi) — o da toplama girmemeli.
      kayit({ apn: "S1", kayitTipi: "dogrulanmis_satis", aylik: 500 }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  const ozet = computeRakipDefteriOzet(rows);
  assert.equal(ozet.aktifTaksitli, 2);
  assert.equal(ozet.tahminiAylikToplam, 500);
  assert.equal(ozet.aktifTaksitliOrtAylik, 250);
});

test("eksik veri davranışı: fiyat/tarih null olan kayıtlar crash etmez, medyan hesabından dışlanır", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 3, digerOyuncular: [],
    kayitlar: [
      kayit({ apn: "BOS-1", kayitTipi: "envanter" }), // her şey null
      kayit({ apn: "DOLU-1", kayitTipi: "envanter", alimFiyati: 8000, satisFiyati: 20000 }),
      kayit({ apn: "DOLU-2", kayitTipi: "envanter", alimFiyati: 10000, satisFiyati: 25000 }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  assert.equal(rows[0].etkinAlim, null);
  assert.equal(rows[0].carpan, null);
  assert.equal(rows[0].taksitOzeti, null);

  const ozet = computeRakipDefteriOzet(rows);
  // medyan sadece 2 geçerli değerden hesaplanmalı (8000, 10000 -> 9000), null'lar dahil edilmemeli.
  assert.equal(ozet.medyanAlim, 9000);
  assert.equal(ozet.toplamKayit, 3);
});

test("medyan: tek elemanlı ve çift elemanlı dizilerde doğru hesap", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 3, digerOyuncular: [],
    kayitlar: [
      kayit({ apn: "A", kayitTipi: "dogrulanmis_satis", alimFiyati: 1000, satisFiyati: 2000 }),
      kayit({ apn: "B", kayitTipi: "dogrulanmis_satis", alimFiyati: 3000, satisFiyati: 6000 }),
      kayit({ apn: "C", kayitTipi: "dogrulanmis_satis", alimFiyati: 5000, satisFiyati: 15000 }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  const ozet = computeRakipDefteriOzet(rows);
  assert.equal(ozet.medyanAlim, 3000); // tek ortanca (1000,3000,5000)
  assert.equal(ozet.medyanSatis, 6000);
});

test("boş veri (data null/undefined veya kayıtlar dizisi yok) çökmeden boş sonuç döner", () => {
  assert.deepEqual(buildRakipDefteriRows(null), []);
  assert.deepEqual(buildRakipDefteriRows(undefined), []);
  const ozet = computeRakipDefteriOzet([]);
  assert.equal(ozet.toplamKayit, 0);
  assert.equal(ozet.medyanAlim, null);
  assert.equal(ozet.tahminiAylikToplam, null);
  assert.deepEqual(computeNeOgreniyoruz(ozet, []), []);
});

test("sortRakipDefteriRows: çarpana göre desc sıralar, null'lar sona düşer", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 3, digerOyuncular: [],
    kayitlar: [
      kayit({ apn: "DUSUK", kayitTipi: "dogrulanmis_satis", alimFiyati: 1000, satisFiyati: 1200 }),
      kayit({ apn: "YUKSEK", kayitTipi: "dogrulanmis_satis", alimFiyati: 1000, satisFiyati: 5000 }),
      kayit({ apn: "NULL-CARPAN", kayitTipi: "envanter" }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  const sorted = sortRakipDefteriRows(rows, "carpan", "desc");
  assert.equal(sorted[0].apn, "YUKSEK");
  assert.equal(sorted[1].apn, "DUSUK");
  assert.equal(sorted[2].apn, "NULL-CARPAN");
});

test("filterRakipDefteriRows: statü ve APN/bölge arama filtresi", () => {
  const data: RakipDefteriData = {
    generatedAt: "t", source: "t", toplamKayit: 2, digerOyuncular: [],
    kayitlar: [
      kayit({ apn: "111-11-111", kayitTipi: "envanter", bolge: "20N 19W 27" }),
      kayit({ apn: "222-22-222", kayitTipi: "satis_taksitte", bolge: "19N 18W 1" }),
    ],
  };
  const rows = buildRakipDefteriRows(data);
  assert.equal(filterRakipDefteriRows(rows, { statu: "envanter" }).length, 1);
  assert.equal(filterRakipDefteriRows(rows, { arama: "222-22" }).length, 1);
  assert.equal(filterRakipDefteriRows(rows, { arama: "19W" }).length, 1);
  assert.equal(filterRakipDefteriRows(rows, {}).length, 2);
});
