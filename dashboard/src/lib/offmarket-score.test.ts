// ─────────────────────────────────────────────────────────────────────────────
// GENELLEŞTİRİLMİŞ OFF-MARKET SKORU — county'den bağımsızlık testleri.
// `mohave-score.test.ts` motorun Mohave davranışını koruduğunu doğrular;
// burada AYNI motorun başka county'lerde de doğru çalıştığı doğrulanır.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTY_BOLGE_TALEBI,
  DEFAULT_REGION_DEMAND,
  SCORE_WEIGHTS,
  computeOwnerParcelCounts,
  computeRegionMedians,
  countyKey,
  scoreAllRows,
  scoreAllRowsBreakdown,
  scoreRowBreakdown,
  type ScoreRow,
} from "./offmarket-score";

const satir = (o: Partial<ScoreRow>): ScoreRow => ({
  apn: "1", owner: "OWNER", mailing_address: "1 MAIN ST", mailing_city: "DENVER",
  mailing_state: "CO", mailing_zip: "80202", acres: 1.5, land_value: 500,
  region: "Bir Bölge", ...o,
});

test("county anahtarı: 'County' son eki ve büyük/küçük harf normalize edilir", () => {
  assert.equal(countyKey("az", "Mohave County"), "AZ|MOHAVE");
  assert.equal(countyKey("NM", " luna "), "NM|LUNA");
  assert.equal(countyKey(null, null), "|");
});

test("Mohave bölge katsayıları KAYBOLMADI — county ayar tablosunda duruyor", () => {
  const t = COUNTY_BOLGE_TALEBI["AZ|MOHAVE"];
  assert.ok(t, "AZ|MOHAVE tablosu var olmalı");
  assert.equal(t["Meadview / Lake Mead"], 20);
  assert.equal(t["Dolan Springs / Meadview"], 16);
  assert.equal(t["Yucca / Kingman G."], 12);
  assert.equal(t["Golden Valley / Kingman"], 10);
  assert.equal(t["Mohave (kırsal)"], 6);
  assert.equal(t["Mohave (diğer)"], 4);
});

test("ayar tablosu OLMAYAN county: bölge talebi nötr-düşük varsayılır (uydurma katsayı yok)", () => {
  const rows = [satir({})];
  const m = computeRegionMedians(rows);
  const c = computeOwnerParcelCounts(rows);
  const k = scoreRowBreakdown(rows[0], m, c, { state: "NM", county: "Luna" });
  assert.equal(k.demand, DEFAULT_REGION_DEMAND);
  assert.ok(k.demand <= SCORE_WEIGHTS.DEMAND_MAX);
});

test("bölge bilgisi hiç yoksa talep bileşeni sıfırdır", () => {
  const rows = [satir({ region: "" })];
  const m = computeRegionMedians(rows);
  const c = computeOwnerParcelCounts(rows);
  assert.equal(scoreRowBreakdown(rows[0], m, c, { state: "TX", county: "Hudspeth" }).demand, 0);
});

test("sahip motivasyonu artık parselin eyaletine göre — eyalet-içi sahip 0 alır", () => {
  const rows = [satir({})];
  const m = computeRegionMedians(rows);
  const c = new Map<string, number>();
  // Parsel CO'da, sahip CO'da → eyalet-içi, motivasyon katkısı yok.
  const icerde = scoreRowBreakdown(satir({ mailing_state: "CO" }), m, c, { state: "CO", county: "Costilla" });
  assert.equal(icerde.motivation, 0);
  // Aynı sahip eyaleti, parsel AZ'de → artık eyalet-DIŞI sayılır.
  const disarda = scoreRowBreakdown(satir({ mailing_state: "CO" }), m, c, { state: "AZ", county: "Mohave" });
  assert.ok(disarda.motivation > 0, "eyalet dışı sahip motivasyon puanı almalı");
});

test("komşu eyalet < uzak eyalet < doğu yakası (mesafe kademesi county'den bağımsız)", () => {
  const m = computeRegionMedians([satir({})]);
  const c = new Map<string, number>();
  const puan = (ownerState: string, parcelState: string) =>
    scoreRowBreakdown(satir({ mailing_state: ownerState, region: "" }), m, c, { state: parcelState, county: "X" }).motivation;

  // Parsel Texas'ta: NM komşu, WA uzak, NY doğu yakası.
  assert.ok(puan("NM", "TX") < puan("WA", "TX"), "komşu eyalet < uzak eyalet");
  assert.ok(puan("WA", "TX") < puan("NY", "TX"), "uzak eyalet < doğu yakası");
  assert.ok(puan("NY", "TX") <= SCORE_WEIGHTS.MOTIVATION_MAX);
});

test("marj bileşeni county'den bağımsız: bölge medyanına göre ucuz olan yüksek puan alır", () => {
  const rows: ScoreRow[] = [
    satir({ apn: "ucuz", land_value: 100, acres: 1 }),
    satir({ apn: "orta", land_value: 500, acres: 1 }),
    satir({ apn: "pahali", land_value: 2000, acres: 1 }),
  ];
  const m = computeRegionMedians(rows);
  const c = computeOwnerParcelCounts(rows);
  const baglam = { state: "AR", county: "Sharp" };
  const ucuz = scoreRowBreakdown(rows[0], m, c, baglam).margin;
  const pahali = scoreRowBreakdown(rows[2], m, c, baglam).margin;
  assert.ok(ucuz > pahali, "ucuz parsel daha yüksek marj puanı almalı");
  assert.ok(ucuz <= SCORE_WEIGHTS.MARGIN_MAX);
});

test("satırdaki state/county alanları bağlam verilmediğinde kullanılır", () => {
  const rows = [satir({ state: "AZ", county: "Mohave", region: "Meadview / Lake Mead" })];
  const m = computeRegionMedians(rows);
  const c = computeOwnerParcelCounts(rows);
  // Bağlam VERİLMEDİ — satırın kendi alanlarından Mohave tablosu bulunmalı.
  assert.equal(scoreRowBreakdown(rows[0], m, c).demand, 20);
});

test("scoreAllRowsBreakdown her satıra hem toplam hem kırılım ekler ve 0-100 sınırını korur", () => {
  const rows = [
    satir({ apn: "a", state: "AZ", county: "Mohave", region: "Meadview / Lake Mead", mailing_state: "NY" }),
    satir({ apn: "b", state: "NM", county: "Luna", acres: null, land_value: null }),
  ];
  const cikti = scoreAllRowsBreakdown(rows);
  for (const r of cikti) {
    assert.ok(Number.isFinite(r.offmarket_score), "NaN sızmamalı");
    assert.ok(r.offmarket_score >= 0 && r.offmarket_score <= 100);
    const k = r.skor_kirilim;
    assert.equal(k.total, r.offmarket_score);
    assert.equal(k.margin + k.size + k.demand + k.motivation, k.total);
  }
});

test("scoreAllRows bağlamı tüm satırlara uygular (Mohave snapshot'ında state/county alanı yok)", () => {
  // Mohave anlık görüntüsündeki satırlarda state/county alanı YOKTUR.
  const rows = [satir({ region: "Meadview / Lake Mead", state: undefined, county: undefined })];
  const bagalamsiz = scoreAllRows(rows)[0].offmarket_score;
  const bagalamli = scoreAllRows(rows, { state: "AZ", county: "Mohave" })[0].offmarket_score;
  assert.ok(bagalamli > bagalamsiz, "Mohave bağlamı bölge talep katsayısını devreye sokmalı");
});
