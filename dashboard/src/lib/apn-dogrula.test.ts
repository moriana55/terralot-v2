import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeApnCandidates,
  normalizeTrs,
  detectQueryKind,
  findRakipSatisRecord,
  findMohaveOffmarketRow,
  buildOurRecordSummary,
  compareWithCounty,
  findTrsOzet,
  type RakipSatisLike,
  type MohaveOffmarketLike,
  type TrsOzetData,
} from "./apn-dogrula";

test("normalizeApnCandidates: tireli/tiresiz/harf-ekli varyasyonları üretir", () => {
  assert.deepEqual(normalizeApnCandidates("209-09-019"), ["209-09-019", "20909019"]);
  assert.deepEqual(normalizeApnCandidates("20906171"), ["20906171", "209-06-171"]);
  assert.ok(normalizeApnCandidates("319-17-184B").includes("319-17-184B"));
  assert.deepEqual(normalizeApnCandidates("  "), []);
});

test("normalizeTrs + detectQueryKind: TRS ve APN girdisini ayırt eder", () => {
  assert.equal(normalizeTrs(" 26n   19w  31 "), "26N 19W 31");
  assert.equal(detectQueryKind("26N 19W 31"), "trs");
  assert.equal(detectQueryKind("26n 19w 31"), "trs");
  assert.equal(detectQueryKind("209-09-019"), "apn");
  assert.equal(detectQueryKind(""), "empty");
});

test("findRakipSatisRecord / findMohaveOffmarketRow: eşleşen, eşleşmeyen, bulunamayan", () => {
  const rakip: RakipSatisLike[] = [
    { apn: "313-46-122", kayitTipi: "dogrulanmis_satis", fiyat: 2000, tarih: "2025/11/12", recordingNo: "2025054690", karsiTaraf: "JASS BIG SKY PROPERTY LLC (PO BOX 128, BASALT, CO)", sirketLlc: "Discount Lots", acres: 1.02 },
  ];
  const mohave: MohaveOffmarketLike[] = [
    { apn: "329-07-086", owner: "REDPOINT HOLDINGS LLC", acres: 2.49, land_value: 500 },
  ];

  // eşleşen — tireli girilse de tiresiz kayıtla eşleşir
  assert.equal(findRakipSatisRecord(rakip, ["31346122", "313-46-122"])?.apn, "313-46-122");
  assert.equal(findMohaveOffmarketRow(mohave, ["329-07-086"])?.owner, "REDPOINT HOLDINGS LLC");

  // bulunamayan
  assert.equal(findRakipSatisRecord(rakip, ["999-99-999"]), null);
  assert.equal(findMohaveOffmarketRow(mohave, ["999-99-999"]), null);
  assert.equal(findRakipSatisRecord(null, ["313-46-122"]), null);
});

test("buildOurRecordSummary + compareWithCounty: eşleşen/uyuşmayan/bilinmeyen alanlar", () => {
  const rakip: RakipSatisLike = {
    apn: "313-46-122", kayitTipi: "dogrulanmis_satis", fiyat: 2000, tarih: "2025/11/12",
    recordingNo: "2025054690", karsiTaraf: "JASS BIG SKY PROPERTY LLC (PO BOX 128, BASALT, CO)",
    sirketLlc: "Discount Lots", acres: 1.02,
  };
  const summary = buildOurRecordSummary("313-46-122", rakip, null, null);
  assert.equal(summary.found, true);
  assert.equal(summary.ownerName, "JASS BIG SKY PROPERTY LLC");
  assert.equal(summary.lastSalePrice, 2000);
  assert.deepEqual(summary.sources, ["rakip-satislar.json (tapu kaydı)"]);

  // Tam eşleşen county kaydı
  const rows1 = compareWithCounty(summary, {
    owner: "JASS BIG SKY PROPERTY LLC", salep: 2000, saledt: "2025/11/12", parcelSize: 1.02, landValue: null,
  });
  const byLabel = Object.fromEntries(rows1.map((r) => [r.label, r.status]));
  assert.equal(byLabel["Sahip adı"], "match");
  assert.equal(byLabel["Son satış fiyatı"], "match");
  assert.equal(byLabel["Son satış tarihi"], "match");
  assert.equal(byLabel["Dönüm (acre)"], "match");
  assert.equal(byLabel["Arazi değeri"], "unknown"); // ikisi de yok/biri yok

  // Uyuşmayan county kaydı (farklı sahip + farklı fiyat)
  const rows2 = compareWithCounty(summary, {
    owner: "SMITH JOHN", salep: 9999, saledt: "2025/11/12", parcelSize: 1.02, landValue: null,
  });
  const byLabel2 = Object.fromEntries(rows2.map((r) => [r.label, r.status]));
  assert.equal(byLabel2["Sahip adı"], "mismatch");
  assert.equal(byLabel2["Son satış fiyatı"], "mismatch");

  // Bulunamayan (bizim kayıt yok) → hepsi unknown
  const emptySummary = buildOurRecordSummary("000-00-000", null, null, null);
  assert.equal(emptySummary.found, false);
  const rows3 = compareWithCounty(emptySummary, { owner: "X", salep: 100, saledt: "2020/01/01", parcelSize: 1, landValue: 100 });
  assert.ok(rows3.every((r) => r.status === "unknown"));
});

test("findTrsOzet: bulunan/bulunamayan bölge özeti", () => {
  const data: TrsOzetData = {
    generatedAt: "2026-07-13T00:00:00.000Z",
    source: "test",
    trsCount: 1,
    trs: {
      "26N 19W 31": {
        trs: "26N 19W 31", total: 543, vacant: 539, absentee: 388, absenteePct: 71.5,
        medianAcres: 1.07, medianLandValue: 6301.03,
        topOwners: [{ owner: "THORNOCK STEVEN P", count: 15 }],
        recentSales: [{ apn: "319-17-292", owner: "ITURRIRIA TANIA AGUILERA", salep: 13500, saledt: "2026/05/21" }],
        leadPoolCount: 2,
      },
    },
  };
  assert.equal(findTrsOzet(data, "26n   19w  31")?.total, 543);
  assert.equal(findTrsOzet(data, "1N 1W 1"), null);
  assert.equal(findTrsOzet(null, "26N 19W 31"), null);
});
