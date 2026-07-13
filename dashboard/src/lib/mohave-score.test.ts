import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCORE_WEIGHTS,
  computeOwnerParcelCounts,
  computeRegionMedians,
  scoreAllRows,
  scoreRow,
  scoreRowBreakdown,
  type ScoreRow,
} from "./mohave-score";

const row = (o: Partial<ScoreRow>): ScoreRow => ({
  apn: "1", owner: "OWNER", mailing_address: "1 MAIN ST", mailing_city: "LAS VEGAS",
  mailing_state: "NV", mailing_zip: "89117", acres: 1.5, land_value: 500,
  region: "Meadview / Lake Mead", ...o,
});

test("medyan hesabı: bölge medyanı veri setinden çıkarılır, hard-code edilmez", () => {
  const rows = [
    row({ apn: "a", region: "R1", acres: 1, land_value: 100 }),  // 100 $/acre
    row({ apn: "b", region: "R1", acres: 1, land_value: 300 }),  // 300 $/acre
    row({ apn: "c", region: "R1", acres: 1, land_value: 500 }),  // 500 $/acre → medyan 300
    row({ apn: "d", region: "R2", acres: 2, land_value: 1000 }), // 500 $/acre, ayrı bölge
  ];
  const medians = computeRegionMedians(rows);
  assert.equal(medians.R1, 300);
  assert.equal(medians.R2, 500);
});

test("medyan: acres<=0 veya land_value eksik satırlar hesaba katılmaz", () => {
  const rows = [
    row({ apn: "a", region: "R1", acres: 1, land_value: 200 }),
    row({ apn: "b", region: "R1", acres: 0, land_value: 999 }),   // acres<=0 → dışlanır
    row({ apn: "c", region: "R1", acres: 1, land_value: null }),  // land_value yok → dışlanır
  ];
  const medians = computeRegionMedians(rows);
  assert.equal(medians.R1, 200);
});

test("marj bileşeni: medyanın altındaki $/acre yüksek puan alır, üstündeki 0 alır", () => {
  const rows = [
    row({ apn: "cheap", region: "R", acres: 1, land_value: 100 }),   // 100 $/acre
    row({ apn: "mid", region: "R", acres: 1, land_value: 300 }),     // 300 $/acre (medyan)
    row({ apn: "pricey", region: "R", acres: 1, land_value: 600 }),  // 600 $/acre — medyandan pahalı
  ];
  const medians = computeRegionMedians(rows);
  const counts = computeOwnerParcelCounts(rows);
  const cheap = scoreRowBreakdown(rows[0], medians, counts);
  const mid = scoreRowBreakdown(rows[1], medians, counts);
  const pricey = scoreRowBreakdown(rows[2], medians, counts);
  assert.ok(cheap.margin > mid.margin, "medyanın çok altındaki lot daha yüksek marj puanı almalı");
  assert.equal(mid.margin, 0, "tam medyanda indirim yok → 0 puan");
  assert.equal(pricey.margin, 0, "medyandan pahalı lot 0 puan alır (negatif indirim clamp)");
  assert.ok(cheap.margin <= SCORE_WEIGHTS.MARGIN_MAX);
});

test("boyut tatlı noktası: 1.0-2.5 acre tam puan, sınırların dışında kademeli/sıfır", () => {
  const medians = {};
  const counts = new Map<string, number>();
  const at = (acres: number) => scoreRowBreakdown(row({ acres, region: "" }), medians, counts).size;
  assert.equal(at(1.5), SCORE_WEIGHTS.SIZE_MAX);
  assert.equal(at(1.0), SCORE_WEIGHTS.SIZE_MAX);
  assert.equal(at(2.5), SCORE_WEIGHTS.SIZE_MAX);
  assert.equal(at(0.7), 0);
  assert.equal(at(6), 0);
  assert.ok(at(0.9) > 0 && at(0.9) < SCORE_WEIGHTS.SIZE_MAX, "0.8-1.0 arası kademeli düşüş");
  assert.ok(at(3.5) > 0 && at(3.5) < SCORE_WEIGHTS.SIZE_MAX, "2.5-5.0 arası kademeli düşüş");
  assert.ok(at(0.9) < at(1.0));
  assert.ok(at(3.5) > at(4.5));
});

test("bölge talebi: Meadview > Dolan Springs/Meadview > Yucca > diğer", () => {
  const medians = {};
  const counts = new Map<string, number>();
  const at = (region: string) => scoreRowBreakdown(row({ region, acres: 0 }), medians, counts).demand;
  const meadview = at("Meadview / Lake Mead");
  const dolan = at("Dolan Springs / Meadview");
  const yucca = at("Yucca / Kingman G.");
  const other = at("Mohave (diğer)");
  assert.ok(meadview > dolan && dolan > yucca && yucca > other);
  assert.ok(meadview <= SCORE_WEIGHTS.DEMAND_MAX);
});

test("sahip motivasyonu: AZ içi < komşu eyalet < uzak eyalet < doğu yakası", () => {
  const rows = [row({ mailing_state: "AZ" })];
  const medians = computeRegionMedians(rows);
  const counts = computeOwnerParcelCounts(rows);
  const at = (state: string) => scoreRowBreakdown(row({ mailing_state: state, region: "" }), medians, new Map()).motivation;
  const az = at("AZ");
  const neighbor = at("NV");
  const far = at("TX");
  const east = at("NJ");
  assert.ok(az < neighbor && neighbor < far && far < east);
  assert.ok(east <= SCORE_WEIGHTS.MOTIVATION_MAX);
});

test("sahip motivasyonu: çok parselli sahibe +3 bonus (15 tavanını aşmaz)", () => {
  const rows = [
    row({ apn: "1", owner: "PORTFOLIO LLC", mailing_state: "NJ" }),
    row({ apn: "2", owner: "PORTFOLIO LLC", mailing_state: "NJ" }),
    row({ apn: "3", owner: "SOLO OWNER", mailing_state: "NJ" }),
  ];
  const medians = computeRegionMedians(rows);
  const counts = computeOwnerParcelCounts(rows);
  const portfolio = scoreRowBreakdown(rows[0], medians, counts).motivation;
  const solo = scoreRowBreakdown(rows[2], medians, counts).motivation;
  assert.equal(portfolio, SCORE_WEIGHTS.MOTIVATION_MAX); // NJ=doğu yakası 12 + 3 bonus = 15 (tavan)
  assert.equal(solo, 12); // bonus yok
});

test("eksik alanlar: hiçbir bileşen NaN sızdırmaz, toplam yine 0-100 arasında sayı", () => {
  const bare: ScoreRow = {};
  const total = scoreRow(bare, {}, new Map());
  assert.equal(typeof total, "number");
  assert.ok(Number.isFinite(total));
  assert.ok(total >= 0 && total <= 100);
  assert.equal(total, 0); // hiçbir alan yok → hiçbir bileşen puan üretemez

  const partial: ScoreRow = { acres: 1.5, region: "Meadview / Lake Mead" }; // sahip/land_value yok
  const p = scoreRowBreakdown(partial, {}, new Map());
  assert.equal(p.margin, 0); // land_value yok
  assert.ok(Number.isFinite(p.total));
});

test("toplam skor 4 bileşenin tavanını (100) hiçbir zaman aşmaz", () => {
  const rows = [
    row({ apn: "1", owner: "BIG LLC", acres: 1.5, land_value: 1, region: "Meadview / Lake Mead", mailing_state: "NJ" }),
    row({ apn: "2", owner: "BIG LLC", acres: 1.5, land_value: 1, region: "Meadview / Lake Mead", mailing_state: "NJ" }),
  ];
  const medians = computeRegionMedians(rows);
  const counts = computeOwnerParcelCounts(rows);
  const b = scoreRowBreakdown(rows[0], medians, counts);
  assert.ok(b.total <= 100);
  assert.equal(b.total, b.margin + b.size + b.demand + b.motivation);
});

test("scoreAllRows: her satıra offmarket_score ekler, orijinal alanları korur", () => {
  // land_value acres ile orantılı tutulur (aynı $/acre) → marj bileşeni eşit kalır,
  // farkı yalnız boyut tatlı noktası (1.5 acre tam puan, 40 acre sıfır) yaratır.
  const rows = [
    row({ apn: "1", acres: 1.5, land_value: 750 }),
    row({ apn: "2", acres: 40, land_value: 20000 }),
  ];
  const scored = scoreAllRows(rows);
  assert.equal(scored.length, 2);
  assert.equal(scored[0].apn, "1");
  assert.ok(typeof scored[0].offmarket_score === "number");
  assert.ok(scored[0].offmarket_score > scored[1].offmarket_score, "1.5 acre 40 acreden daha yüksek boyut puanı almalı");
});
