import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRakipSatislarLayer,
  computeRakipSatislarOzet,
  formatKisaFiyat,
  groupRakipSatisPoints,
  type RakipSatisPoint,
  type RakipSatislarData,
} from "./rakip-satislar";

const sampleData: RakipSatislarData = {
  generatedAt: "2026-07-13T00:00:00.000Z",
  source: "test",
  totalKayit: 4,
  haritadaGosterilen: 4,
  atlanan: 0,
  records: [
    {
      id: "1", apn: "111-11-111", kayitTipi: "dogrulanmis_satis",
      lat: 35.5, lng: -114.1, coordSource: "exact",
      fiyat: 8117, tarih: "2026/02/04", recordingNo: "2026005801", deedType: "WD",
      karsiTaraf: "TEST BUYER", sirketLlc: "Discount Lots", bolge: "20N 19W 27",
      acres: 2.23, legal: null, siteDurumu: null,
    },
    {
      id: "2", apn: "222-22-222", kayitTipi: "satis_taksitte",
      lat: 35.6, lng: -114.2, coordSource: "group",
      fiyat: 8900, tarih: "2024/06/10", recordingNo: "2024030644", deedType: "WD",
      karsiTaraf: "WP RE VENTURES 1 LLC", sirketLlc: "WP RE VENTURES 1 LLC", bolge: "19N 18W 1",
      acres: 2.35, legal: null, siteDurumu: "Servicing Retained",
    },
    {
      id: "3", apn: "333-33-333", kayitTipi: "envanter",
      lat: 35.7, lng: -114.3, coordSource: "exact",
      fiyat: null, tarih: null, recordingNo: null, deedType: null,
      karsiTaraf: null, sirketLlc: "WP RE VENTURES LLC", bolge: null,
      acres: 1.17, legal: null, siteDurumu: null,
    },
    {
      id: "4", apn: "444-44-444", kayitTipi: "belirsiz",
      lat: NaN, lng: -114.4, coordSource: null, // koordinatsız -> layer'dan elenmeli
      fiyat: null, tarih: null, recordingNo: null, deedType: null,
      karsiTaraf: null, sirketLlc: null, bolge: null, acres: null, legal: null, siteDurumu: null,
    },
  ],
};

test("buildRakipSatislarLayer: koordinatsız kayıtları eler, geçerli olanlara renk+etiket ekler", () => {
  const points = buildRakipSatislarLayer(sampleData);
  assert.equal(points.length, 3); // 4. kayıt NaN lat -> elendi
  const satis = points.find((p) => p.kayitTipi === "dogrulanmis_satis")!;
  assert.equal(satis.color, "#4c1d95");
  assert.equal(satis.priceLabel, "$8.1K");
  const taksit = points.find((p) => p.kayitTipi === "satis_taksitte")!;
  assert.equal(taksit.color, "#a78bfa");
  const stok = points.find((p) => p.kayitTipi === "envanter")!;
  assert.equal(stok.color, "#9ca3af");
  assert.equal(stok.priceLabel, null);
});

test("buildRakipSatislarLayer: boş/eksik veri güvenli şekilde boş dizi döner", () => {
  assert.deepEqual(buildRakipSatislarLayer(null), []);
  assert.deepEqual(buildRakipSatislarLayer(undefined), []);
  assert.deepEqual(buildRakipSatislarLayer({} as RakipSatislarData), []);
});

test("computeRakipSatislarOzet: medyan SADECE tamamlanmış satışlardan; taksitli alım fiyatı AYRI (ort. alış)", () => {
  const points = buildRakipSatislarLayer(sampleData);
  const ozet = computeRakipSatislarOzet(points);
  assert.equal(ozet.dogrulanmisSatis, 1);
  assert.equal(ozet.taksitli, 1);
  assert.equal(ozet.envanter, 1); // envanter + belirsiz (ama belirsiz elendi NaN yüzünden) -> sadece envanter
  // SEMANTİK: taksitli kayıttaki 8900 LLC'nin KENDİ ALIMI — satış medyanına KARIŞMAZ.
  assert.equal(ozet.medyanFiyat, 8117);
  assert.equal(ozet.ortalamaAlisFiyat, 8900);
  assert.match(ozet.rozetMetni, /1 tapulu satış/);
  assert.match(ozet.rozetMetni, /medyan satış \$8\.1K/);
  assert.match(ozet.rozetMetni, /rakip ort\. alış \$8\.9K/);
});

// ── Koordinat gruplama (etiket çakışması fix'i) ──────────────────────────────
const pt = (o: Partial<RakipSatisPoint>): RakipSatisPoint => ({
  id: "x", apn: "111-11-111", kayitTipi: "dogrulanmis_satis",
  lat: 35.5, lng: -114.1, coordSource: "group",
  fiyat: 8000, tarih: null, recordingNo: null, deedType: null,
  karsiTaraf: null, sirketLlc: null, bolge: null, acres: null, legal: null, siteDurumu: null,
  color: "#4c1d95", priceLabel: "$8K", ...o,
});

test("groupRakipSatisPoints: aynı koordinattaki 3 kayıt tek grup, rozet '2 satış · aralık' (taksitli alım fiyatı aralığa girmez)", () => {
  const groups = groupRakipSatisPoints([
    pt({ id: "a", fiyat: 8000, priceLabel: "$8K" }),
    pt({ id: "b", fiyat: 30000, priceLabel: "$30K" }),
    pt({ id: "c", kayitTipi: "satis_taksitte", fiyat: 999999, color: "#a78bfa", priceLabel: null }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].points.length, 3);
  assert.equal(groups[0].dominantTip, "dogrulanmis_satis");
  assert.equal(groups[0].label, "2 satış · $8K–$30K"); // 999999 (LLC alımı) aralıkta YOK
});

test("groupRakipSatisPoints: farklı koordinatlar ayrı grup; tek kayıt eski etiket davranışını korur", () => {
  const groups = groupRakipSatisPoints([
    pt({ id: "a", lat: 35.5 }),
    pt({ id: "b", lat: 35.6, kayitTipi: "envanter", fiyat: null, color: "#9ca3af", priceLabel: null }),
  ]);
  assert.equal(groups.length, 2);
  const satis = groups.find((g) => g.dominantTip === "dogrulanmis_satis")!;
  assert.equal(satis.label, "$8K"); // tek tamamlanmış satış -> fiyat etiketi
  const stok = groups.find((g) => g.dominantTip === "envanter")!;
  assert.equal(stok.label, null); // tek stok kaydı -> kalıcı etiket yok
});

test("formatKisaFiyat: kısaltma kuralları", () => {
  assert.equal(formatKisaFiyat(8117), "$8.1K");
  assert.equal(formatKisaFiyat(30000), "$30K");
  assert.equal(formatKisaFiyat(125000), "$125K");
  assert.equal(formatKisaFiyat(500), "$500");
  assert.equal(formatKisaFiyat(null), null);
  assert.equal(formatKisaFiyat(0), null);
});
