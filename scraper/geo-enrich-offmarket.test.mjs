// Geo-zenginleştirme SAF mantık testleri (ağ/DB yok).
// Koşu: node --test scraper/geo-enrich-offmarket.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDistances, bbMesafe, kategori, superHucreler, dorteBol, superSorgu,
  aynaYokla, R_ROAD, R_TOWN, SUPER,
} from "./geo-enrich-offmarket.mjs";

const LAT = 32.5, LNG = -89.5;
// 0.001° enlem ≈ 111 m — testlerde mesafeyi bu birimle kuruyoruz.
const DERECE_M = 111320;

test("kategori: etiketten kategoriye eşleme", () => {
  assert.equal(kategori({ tags: { highway: "residential" } }), "road");
  assert.equal(kategori({ tags: { highway: "footway" } }), null); // yaya yolu yol sayılmaz
  assert.equal(kategori({ tags: { power: "line" } }), "power");
  assert.equal(kategori({ tags: { power: "pole" } }), "power");
  assert.equal(kategori({ tags: { natural: "water" } }), "water");
  assert.equal(kategori({ tags: { waterway: "stream" } }), "water");
  assert.equal(kategori({ tags: { place: "town" } }), "town");
  assert.equal(kategori({ tags: {} }), null);
  assert.equal(kategori(null), null);
});

test("bbMesafe: sınır kutusu içindeki nokta 0, dışındaki kutuya olan uzaklık", () => {
  const el = { bounds: { minlat: 32.4, minlon: -89.6, maxlat: 32.6, maxlon: -89.4 } };
  assert.equal(Math.round(bbMesafe(LAT, LNG, el)), 0); // içeride
  const d = bbMesafe(32.7, LNG, el); // kutunun 0.1° kuzeyinde
  assert.ok(d > 10000 && d < 12000, `beklenen ~11 km, gelen ${d}`);
});

test("bbMesafe: sınır kutusu yoksa düğüm/merkez koordinatı kullanılır", () => {
  assert.equal(Math.round(bbMesafe(LAT, LNG, { lat: LAT, lon: LNG })), 0);
  assert.equal(bbMesafe(LAT, LNG, { }), Infinity);
});

test("parseDistances: yarıçap İÇİNDEKİ eleman merkez mesafesiyle raporlanır", () => {
  const dy = 500 / DERECE_M;
  const json = { elements: [{
    type: "way", tags: { highway: "residential" },
    center: { lat: LAT + dy, lon: LNG },
    bounds: { minlat: LAT + dy, minlon: LNG, maxlat: LAT + dy, maxlon: LNG },
  }] };
  const d = parseDistances(json, LAT, LNG);
  assert.ok(Math.abs(d.road - 500) < 20, `road=${d.road}`);
  assert.equal(d.power, -1);
  assert.equal(d.water, -1);
  assert.equal(d.town, -1);
});

test("parseDistances: yarıçap DIŞINDAKİ eleman elenir → -1 (landlocked mantığı korunur)", () => {
  const dy = (R_ROAD + 500) / DERECE_M;
  const json = { elements: [{
    type: "way", tags: { highway: "track" },
    center: { lat: LAT + dy, lon: LNG },
    bounds: { minlat: LAT + dy, minlon: LNG, maxlat: LAT + dy, maxlon: LNG },
  }] };
  assert.equal(parseDistances(json, LAT, LNG).road, -1);
});

test("parseDistances: uzun yolun bir ucu yakınsa yarıçapa GİRER (around: davranışı)", () => {
  // Sınır kutusu bizi kapsıyor ama ağırlık merkezi 1,6 km'den uzakta:
  // eski `around:` filtresi de bu yolu döndürürdü, merkez mesafesini yazardı.
  const uzak = 3000 / DERECE_M;
  const json = { elements: [{
    type: "way", tags: { highway: "primary" },
    center: { lat: LAT + uzak, lon: LNG },
    bounds: { minlat: LAT - 0.01, minlon: LNG - 0.01, maxlat: LAT + 0.05, maxlon: LNG + 0.01 },
  }] };
  const d = parseDistances(json, LAT, LNG);
  assert.ok(d.road > 2900 && d.road < 3100, `road=${d.road}`);
});

test("parseDistances: kategori başına EN YAKIN eleman kazanır", () => {
  const el = (m, tags) => ({
    tags, center: { lat: LAT + m / DERECE_M, lon: LNG },
    bounds: { minlat: LAT + m / DERECE_M, minlon: LNG, maxlat: LAT + m / DERECE_M, maxlon: LNG },
  });
  const d = parseDistances({ elements: [
    el(900, { highway: "track" }), el(120, { highway: "residential" }),
    el(1000, { power: "line" }), el(200, { power: "pole" }),
    el(10000, { place: "city" }), el(4000, { place: "town" }),
  ] }, LAT, LNG);
  assert.ok(Math.abs(d.road - 120) < 15);
  assert.ok(Math.abs(d.power - 200) < 15);
  assert.ok(Math.abs(d.town - 4000) < 40);
  assert.equal(d.water, -1);
});

test("parseDistances: boş/bozuk cevapta hepsi -1 (tarandı, bulunamadı)", () => {
  assert.deepEqual(parseDistances({ elements: [] }, LAT, LNG), { road: -1, power: -1, water: -1, town: -1 });
  assert.deepEqual(parseDistances(null, LAT, LNG), { road: -1, power: -1, water: -1, town: -1 });
});

test("superHucreler: aynı 0,05° kutusundaki hücreler TEK sorguda toplanır", () => {
  const h = new Map([
    ["32.500,-89.500", { lat: 32.500, lng: -89.500, ids: ["a"] }],
    ["32.510,-89.495", { lat: 32.510, lng: -89.495, ids: ["b", "c"] }],
    ["32.700,-89.500", { lat: 32.700, lng: -89.500, ids: ["d"] }],
  ]);
  const s = superHucreler(h, 0.05);
  assert.equal(s.length, 2);
  const buyuk = s.find((x) => x.hucreler.length === 2);
  assert.ok(buyuk, "iki hücre aynı süper hücrede olmalı");
  assert.ok(buyuk.kutu.minLat <= 32.5 && buyuk.kutu.maxLat > 32.51);
});

test("superHucreler: her hücre TAM BİR süper hücreye düşer (kayıp/çift yok)", () => {
  const h = new Map();
  for (let i = 0; i < 200; i++) {
    const lat = 32 + i * 0.007, lng = -90 + i * 0.011;
    h.set(`${lat.toFixed(3)},${lng.toFixed(3)}`, { lat, lng, ids: [`x${i}`] });
  }
  const s = superHucreler(h, SUPER);
  const toplam = s.reduce((a, x) => a + x.hucreler.length, 0);
  assert.equal(toplam, h.size);
  assert.equal(new Set(s.flatMap((x) => x.hucreler.map((c) => c.key))).size, h.size);
});

test("dorteBol: süper hücre 4 çeyreğe bölünür, hücre kaybolmaz", () => {
  const is = {
    kutu: { minLat: 32.5, minLng: -89.5, maxLat: 32.55, maxLng: -89.45 },
    hucreler: [
      { key: "a", lat: 32.51, lng: -89.49, ids: ["1"] },
      { key: "b", lat: 32.54, lng: -89.46, ids: ["2"] },
      { key: "c", lat: 32.51, lng: -89.46, ids: ["3"] },
    ],
  };
  const p = dorteBol(is);
  assert.equal(p.reduce((a, x) => a + x.hucreler.length, 0), 3);
  assert.ok(p.length >= 2, "hücreler farklı çeyreklere dağılmalı");
});

test("superSorgu: bbox marjı yerel yarıçapı kapsar, kasaba yarıçapı 25 km'den büyük", () => {
  const q = superSorgu({ minLat: 32.5, minLng: -89.5, maxLat: 32.55, maxLng: -89.45 });
  const bbox = q.match(/way\(([-\d.,]+)\)\["highway"/)[1].split(",").map(Number);
  assert.ok(bbox[0] < 32.5 && bbox[2] > 32.55, "bbox kuzey-güney genişletilmeli");
  assert.ok(bbox[1] < -89.5 && bbox[3] > -89.45, "bbox doğu-batı genişletilmeli");
  // Marj en az 1,5 km (~0,0134°) olmalı — R_WATER/R_POWER/R_ROAD kapsansın.
  assert.ok(32.5 - bbox[0] > 0.013, `enlem marjı yetersiz: ${32.5 - bbox[0]}`);
  const rTown = Number(q.match(/node\(around:(\d+),/)[1]);
  assert.ok(rTown > R_TOWN, `kasaba yarıçapı ${rTown} > ${R_TOWN} olmalı`);
  assert.match(q, /out center bb \d+;/);
});

test("aynaYokla: 429/503/504 'meşgul' sayılır (ayakta), 200+0 eleman bölgesel ayna sayılır", async () => {
  const sahte = (durum, n) => async () => ({
    ok: durum === 200, status: durum, json: async () => ({ elements: Array.from({ length: n }, () => ({})) }),
  });
  const [a] = await aynaYokla(["u"], { fetchFn: sahte(429, 0), deneme: 1 });
  assert.equal(a.ok, true);
  assert.equal(a.mesgul, true);
  const [b] = await aynaYokla(["u"], { fetchFn: sahte(200, 0), deneme: 1 });
  assert.equal(b.ok, false); // ABD verisi yok → bölgesel ayna, listeden çıkar
  const [c] = await aynaYokla(["u"], { fetchFn: sahte(200, 5), deneme: 1 });
  assert.equal(c.ok, true);
  const [d] = await aynaYokla(["u"], { fetchFn: sahte(403, 0), deneme: 1 });
  assert.equal(d.ok, false);
});

test("aynaYokla: kalıcı bağlantı hatası TEKRAR DENENMEZ (boşa zaman yakılmaz)", async () => {
  let cagri = 0;
  const reddet = async () => { cagri++; const e = new Error("connect ECONNREFUSED"); e.cause = { code: "ECONNREFUSED" }; throw e; };
  const [r] = await aynaYokla(["u"], { fetchFn: reddet, deneme: 3 });
  assert.equal(r.ok, false);
  assert.equal(cagri, 1);
});
