// Buy-box verdict tests (pure, no DB/network).
// Çalıştırma: npm test  (kökten: node --import ./test/resolve-alias.mjs --test "src/**/*.test.ts")
import { test } from "node:test";
import assert from "node:assert/strict";
import { buyBox, verdictOf, dealMargin, VERDICT_TR } from "./buy-box.ts";

test("verdictOf: AL/BEKLE/GEÇ eşikleri (65 / 45)", () => {
  assert.equal(verdictOf(65), "BUY");
  assert.equal(verdictOf(64), "WATCH");
  assert.equal(verdictOf(45), "WATCH");
  assert.equal(verdictOf(44), "PASS");
  assert.equal(verdictOf(0), "PASS");
  assert.equal(verdictOf(100), "BUY");
  // Türkçe etiketler doğru maplenir
  assert.equal(VERDICT_TR.BUY, "AL");
  assert.equal(VERDICT_TR.WATCH, "BEKLE");
  assert.equal(VERDICT_TR.PASS, "GEÇ");
});

test("dealMargin: comp & sane bid varsa 0..1 marj, yoksa null", () => {
  assert.equal(dealMargin({ compValue: 100000, minimum_bid: 25000 }), 0.75);
  // comp yok → null (sahte sayı üretme)
  assert.equal(dealMargin({ minimum_bid: 25000 }), null);
  // comp <= 0 → null
  assert.equal(dealMargin({ compValue: 0, minimum_bid: 10 }), null);
  // bid garbage (saneBid sınırı dışı) → null
  assert.equal(dealMargin({ compValue: 100000, minimum_bid: 999_999_999 }), null);
});

test("happy path: yüksek marj + direct erişim + talep → AL (BUY)", () => {
  const bb = buyBox({
    compValue: 100000,
    minimum_bid: 20000, // %80 marj
    acres: 5,
    road_access: "direct",
    county_pop_growth: 0.08,
    liquidity_score: 80,
    flood_score: 5,
    discount_pct: 80,
    savings: 40000,
  });
  assert.equal(bb.verdict, "BUY");
  assert.ok(bb.score >= 65, `score ${bb.score} >= 65 olmalı`);
  assert.equal(bb.hardFail, false);
  assert.equal(bb.confidence, "high"); // comp kullanıldı
  assert.ok(bb.margin !== null && bb.margin > 0.7);
});

test("HARD FAIL: landlocked verdict'i PASS'e kapar (skor <= 44)", () => {
  // Her şey mükemmel ama yol erişimi yok → değer kırıcı
  const bb = buyBox({
    compValue: 100000,
    minimum_bid: 10000,
    acres: 4,
    road_access: "landlocked",
    county_pop_growth: 0.1,
    liquidity_score: 95,
    flood_score: 0,
    discount_pct: 90,
    savings: 50000,
  });
  assert.equal(bb.hardFail, true);
  assert.ok(bb.score <= 44, `landlocked skoru ${bb.score} <= 44 olmalı`);
  assert.equal(bb.verdict, "PASS");
  assert.ok(bb.reasons.some((r) => /LANDLOCKED/.test(r)));
});

test("HARD FAIL: min teklif comp değerin üstünde → değer açığı yok", () => {
  const bb = buyBox({
    compValue: 50000,
    minimum_bid: 80000, // teklif comp'tan büyük
    acres: 3,
    road_access: "direct",
  });
  assert.equal(bb.hardFail, true);
  assert.equal(bb.verdict, "PASS");
  assert.ok(bb.score <= 44);
  assert.ok(bb.reasons.some((r) => /comp değerin üstünde/.test(r)));
});

test("düşük güven: comp/indirim yok, sadece skor proxy → confidence low", () => {
  const bb = buyBox({ final_score: 70, road_access: "unknown" });
  assert.equal(bb.confidence, "low");
  assert.equal(bb.margin, null);
  assert.equal(bb.hardFail, false);
});

test("boş satır: hiç sinyal yok → çökmeyip düşük güvenli PASS döner", () => {
  const bb = buyBox({});
  assert.ok(["BUY", "WATCH", "PASS"].includes(bb.verdict));
  assert.equal(bb.confidence, "low");
  assert.equal(bb.hardFail, false);
  assert.ok(bb.score >= 0 && bb.score <= 100);
  assert.ok(bb.reasons.length <= 4); // reasons en fazla 4
});
