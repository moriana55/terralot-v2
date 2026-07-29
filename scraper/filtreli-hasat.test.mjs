// Filtreli hasat SÜZGECİ — saf mantık testleri (ağ/DB yok).
// Koşu: node --test scraper/filtreli-hasat.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { suzgec, halkaMerkezi, ACRE_MIN, ACRE_MAX, DEGER_MIN, DEGER_MAX } from "./filtreli-hasat.mjs";

/** Süzgeçten GEÇEN referans satır — testler bunun tek alanını bozar. */
const saglam = () => ({
  apn: "12-345",
  owner: "SMITH, JOHN",
  mailing_address: "100 MAIN ST",
  mailing_city: "BATON ROUGE",
  mailing_state: "LA",
  mailing_zip: "70801",
  acres: 5,
  land_value: 4000,
});

test("sağlam satır süzgeçten geçer", () => {
  assert.equal(suzgec(saglam(), "MS"), null);
});

test("normalize edilemeyen satır (null) mektup-eksik sayılır", () => {
  assert.equal(suzgec(null, "MS").kural, "mektup-eksik");
});

for (const alan of ["owner", "mailing_address", "mailing_city", "mailing_state", "mailing_zip"]) {
  test(`beş posta alanından ${alan} boşsa İNDİRİLMEZ`, () => {
    const r = saglam();
    r[alan] = "";
    assert.equal(suzgec(r, "MS").kural, "mektup-eksik");
  });
  test(`${alan} yalnızca boşluk içeriyorsa da İNDİRİLMEZ`, () => {
    const r = saglam();
    r[alan] = "   ";
    assert.equal(suzgec(r, "MS").kural, "mektup-eksik");
  });
}

test("posta eyaleti parselin eyaletiyle aynıysa (absentee değil) elenir", () => {
  const r = saglam();
  r.mailing_state = "MS";
  assert.equal(suzgec(r, "MS").kural, "absentee-degil");
});

test("absentee karşılaştırması büyük/küçük harfe duyarsız", () => {
  const r = saglam();
  r.mailing_state = "ms";
  assert.equal(suzgec(r, "MS").kural, "absentee-degil");
});

test("kamu/kurum sahipli parsel elenir (satın alınamaz)", () => {
  const r = saglam();
  r.owner = "STATE OF MISSISSIPPI";
  assert.equal(suzgec(r, "MS").kural, "kamu-sahipli");
});

test("template sahip adı mektup-eksik sayılır", () => {
  const r = saglam();
  r.owner = "UNKNOWN OWNER";
  assert.equal(suzgec(r, "MS").kural, "mektup-eksik");
});

test("acre bandı: alt sınır altı, üst sınır üstü ve veri yok elenir", () => {
  for (const a of [null, 0, -1, ACRE_MIN - 0.01, ACRE_MAX + 1]) {
    const r = saglam();
    r.acres = a;
    assert.equal(suzgec(r, "MS").kural, "acre-bandi", `acres=${a}`);
  }
});

test("acre bandı sınırları DAHİLDİR", () => {
  for (const a of [ACRE_MIN, ACRE_MAX]) {
    const r = saglam();
    r.acres = a;
    assert.equal(suzgec(r, "MS"), null, `acres=${a}`);
  }
});

test("değer bandı dışı elenir, sınırlar dahildir", () => {
  for (const [v, bek] of [[DEGER_MIN - 1, "deger-bandi"], [DEGER_MAX + 1, "deger-bandi"],
                          [DEGER_MIN, null], [DEGER_MAX, null]]) {
    const r = saglam();
    r.land_value = v;
    assert.equal(suzgec(r, "MS")?.kural ?? null, bek, `land_value=${v}`);
  }
});

test("değeri BİLİNMEYEN parsel değer bandıyla elenmez (WV/WY gibi değersiz kaynaklar)", () => {
  const r = saglam();
  r.land_value = null;
  assert.equal(suzgec(r, "WV"), null);
});

test("halkaMerkezi: poligon halkasından ağırlık merkezi", () => {
  const m = halkaMerkezi({ rings: [[[-90, 31], [-91, 31], [-91, 32], [-90, 32]]] });
  assert.deepEqual(m.map((n) => Math.round(n * 100) / 100), [-90.5, 31.5]);
});

test("halkaMerkezi: nokta geometrisi doğrudan döner, geçersiz girdi null", () => {
  assert.deepEqual(halkaMerkezi({ x: -90.5, y: 31.5 }), [-90.5, 31.5]);
  assert.equal(halkaMerkezi(null), null);
  assert.equal(halkaMerkezi({ rings: [[]] }), null);
  assert.equal(halkaMerkezi({ rings: [[[999, 999]]] }), null);
});
