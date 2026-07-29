// Filtreli hasat SÜZGECİ — saf mantık testleri (ağ/DB yok).
// Koşu: node --test scraper/filtreli-hasat.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  suzgec, halkaMerkezi, degerBandi, absenteeMi,
  ACRE_MIN, ACRE_MAX, DEGER_MIN, DEGER_MAX, UCUZ_BANT_MAX,
} from "./filtreli-hasat.mjs";

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

// 2026-07-29: absentee ARTIK ELEME KURALI DEĞİL. Motivasyon sinyali olarak
// grade-core'da zaten puanlanıyor; kapıda ikinci kez uygulamak havuzu 231.327
// aday kadar boşuna daraltıyordu. İçeri alınır, skor sıralar.
test("posta eyaleti parselin eyaletiyle aynı olsa da ELENMEZ (absentee şart değil)", () => {
  const r = saglam();
  r.mailing_state = "MS";
  assert.equal(suzgec(r, "MS"), null);
});

test("absenteeMi: eyalet içi false, eyalet dışı true, büyük/küçük harfe duyarsız", () => {
  assert.equal(absenteeMi({ mailing_state: "MS" }, "MS"), false);
  assert.equal(absenteeMi({ mailing_state: "ms" }, "MS"), false);
  assert.equal(absenteeMi({ mailing_state: "LA" }, "MS"), true);
  assert.equal(absenteeMi({ mailing_state: "" }, "MS"), false);
  assert.equal(absenteeMi(null, "MS"), false);
});

test("değer bandı ETİKETİ: ucuz / buyuk-bilet / bilinmiyor", () => {
  assert.equal(degerBandi(DEGER_MIN), "ucuz");
  assert.equal(degerBandi(UCUZ_BANT_MAX), "ucuz");
  assert.equal(degerBandi(UCUZ_BANT_MAX + 1), "buyuk-bilet");
  assert.equal(degerBandi(DEGER_MAX), "buyuk-bilet");
  assert.equal(degerBandi(null), "bilinmiyor");
  assert.equal(degerBandi("abc"), "bilinmiyor");
});

test("20.000 $ üstü ama 75.000 $ altı parsel artık GEÇER (büyük bilet)", () => {
  const r = saglam();
  r.land_value = 45000;
  assert.equal(suzgec(r, "MS"), null);
  assert.equal(degerBandi(r.land_value), "buyuk-bilet");
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
