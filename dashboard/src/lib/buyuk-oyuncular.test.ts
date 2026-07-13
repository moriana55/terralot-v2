import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultSecim,
  expandBuyukOyuncuRows,
  filterBuyukOyuncuPoints,
  oyuncuRenk,
  type BuyukOyuncularData,
} from "./buyuk-oyuncular";

const sample: BuyukOyuncularData = {
  generatedAt: "2026-07-13T00:00:00.000Z",
  source: "test",
  oyuncular: [
    { id: "gizli", ad: "Gizli ağ", kisaAd: "Gizli ağ", tip: "gizli_ag", parselSayisi: 2, not: "" },
    { id: "dev", ad: "Aileron", kisaAd: "Aileron", tip: "gelistirici", parselSayisi: 1, not: "" },
    { id: "yat", ad: "1D LLC", kisaAd: "1D LLC", tip: "yatirimci", parselSayisi: 1, not: "" },
  ],
  rows: [
    [0, "111-11-111", 35.5, -114.1, 2.3, 500, 8000, "2024/05/03"],
    [0, "111-11-112", 35.6, -114.2, null, null, null, null],
    [1, "222-22-222", 35.7, -114.3, 1.1, 900, null, null],
    [2, "333-33-333", 35.8, -114.4, 4.7, 1200, 15000, "2022/01/10"],
    [9, "999-99-999", 35.9, -114.5, null, null, null, null], // geçersiz oyuncuIdx -> elenir
    [0, "000-00-000", NaN, -114.6, null, null, null, null],  // koordinatsız -> elenir
  ],
};

test("expandBuyukOyuncuRows: kompakt satırları açar, geçersiz index/koordinatı eler", () => {
  const points = expandBuyukOyuncuRows(sample);
  assert.equal(points.length, 4); // 6 satırdan 2'si elendi
  assert.deepEqual(points[0], {
    oyuncuIdx: 0, apn: "111-11-111", lat: 35.5, lng: -114.1,
    acres: 2.3, landValue: 500, salep: 8000, saledt: "2024/05/03",
  });
  assert.deepEqual(expandBuyukOyuncuRows(null), []);
  assert.deepEqual(expandBuyukOyuncuRows({} as BuyukOyuncularData), []);
});

test("filterBuyukOyuncuPoints + defaultSecim: geliştirici varsayılan KAPALI, diğerleri açık", () => {
  const points = expandBuyukOyuncuRows(sample);
  const secim = defaultSecim(sample.oyuncular);
  assert.equal(secim.has(0), true);  // gizli_ag açık
  assert.equal(secim.has(1), false); // gelistirici kapalı
  assert.equal(secim.has(2), true);  // yatirimci açık
  const gorunur = filterBuyukOyuncuPoints(points, secim);
  assert.equal(gorunur.length, 3); // Aileron'un 1 noktası gizli
  assert.ok(gorunur.every((p) => p.oyuncuIdx !== 1));
});

test("oyuncuRenk: palet stabil, gizli ağ turkuaz, index taşarsa mod ile döner", () => {
  assert.equal(oyuncuRenk(0), "#06b6d4");
  assert.equal(oyuncuRenk(8), oyuncuRenk(0));
  assert.notEqual(oyuncuRenk(1), oyuncuRenk(2));
});
