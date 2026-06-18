// Cerberus analysis pipeline tests (pure, no DB/network).
// Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeLead, analyzeBatch, parcelKeyOf, abbrState, normCounty, PIPELINE_VERSION } from "./analyze.ts";

const ctx = { stateRates: { TX: 20000 }, countyRates: { "TX/STARR": 25000 } };

test("kimliksiz satır → null (sahte kimlik üretme)", () => {
  assert.equal(analyzeLead({}), null);
  assert.equal(analyzeLead({ owner_name: "x" }), null);
});

test("parcelKeyOf: apn öncelikli, dedup_key varsa onu kullan, loc fallback", () => {
  assert.equal(parcelKeyOf({ apn: "12-345 A" } as any), "apn:12-345-a");
  assert.equal(parcelKeyOf({ dedup_key: "apn:abc" } as any), "apn:abc");
  assert.equal(parcelKeyOf({ state: "TX", property_address: "1 Main St" } as any), "loc:scraper:tx:::1-main-st".replace(":::", "::"));
  assert.equal(parcelKeyOf({ county: "X" } as any), null);
});

test("normalize helpers: state abbr + county sadeleştirme", () => {
  assert.equal(abbrState("Texas"), "TX");
  assert.equal(abbrState("tx"), "TX");
  assert.equal(abbrState("Nowhere"), null);
  assert.equal(normCounty("Starr County"), "STARR");
  assert.equal(normCounty(null), null);
});

test("happy path: yüksek marj + direct erişim → AL, comp county rate'ten", () => {
  const a = analyzeLead({
    apn: "A1",
    state: "Texas",
    county: "Starr",
    acres: 5,
    minimum_bid: 10000, // comp 5*25000=125000 → ~%92 marj
    road_access: "direct",
    county_pop_growth: 0.08,
    liquidity_score: 80,
    flood_score: 5,
    dd_checked: true,
    owner_name: "Jane Doe",
  }, ctx)!;
  assert.ok(a);
  assert.equal(a.verdict, "BUY");
  assert.equal(a.verdictTr, "AL");
  assert.ok(a.score >= 65);
  assert.equal(a.valueBasis, "county_comp");
  assert.ok(a.compValue && a.compValue > 0);
  assert.ok(a.margin != null && a.margin > 0.8);
  assert.equal(a.hardFail, false);
  assert.ok(a.components.length === 6);
  assert.ok(a.suggestedAction.startsWith("AL"));
  assert.equal(a.pipelineVersion, PIPELINE_VERSION);
});

test("landlocked → kritik red-flag + GEÇ + hardFail", () => {
  const a = analyzeLead({
    apn: "A2", state: "TX", county: "Hidalgo", acres: 4, minimum_bid: 5000,
    road_access: "landlocked", county_pop_growth: 0.1, liquidity_score: 95,
  }, ctx)!;
  assert.equal(a.verdict, "PASS");
  assert.equal(a.hardFail, true);
  assert.ok(a.riskFlags.some((f) => f.code === "landlocked" && f.level === "critical"));
  assert.ok(a.suggestedAction.startsWith("GEÇ"));
});

test("bid > comp → kritik red-flag bid_over_comp", () => {
  const a = analyzeLead({ apn: "A3", state: "TX", county: "Starr", acres: 5, minimum_bid: 9_000_000, road_access: "direct" }, ctx)!;
  // comp ~125k, bid 9M → bid over comp (saneBid sınırı içinde)
  assert.ok(a.riskFlags.some((f) => f.code === "bid_over_comp"));
  assert.equal(a.verdict, "PASS");
});

test("acreage yok → değer yok, düşük güven, dürüst boş (çökmez)", () => {
  const a = analyzeLead({ apn: "A4", state: "TX", county: "Starr", minimum_bid: 1000 }, ctx)!;
  assert.equal(a.compValue, null);
  assert.equal(a.margin, null);
  assert.ok(a.dataGaps.length > 0);
  assert.ok(["BUY", "WATCH", "PASS"].includes(a.verdict));
  assert.ok(a.riskFlags.some((f) => f.code === "no_acreage"));
});

test("comp yoksa skor proxy kullanılır (final_score)", () => {
  const a = analyzeLead({ apn: "A5", final_score: 72, road_access: "near" })!; // ctx yok → rate yok
  assert.equal(a.compValue, null);
  assert.equal(a.confidence, "low");
  assert.ok(a.components[0].note.includes("proxy"));
});

test("analyzeBatch: kimliksizler atlanır, geçerliler analiz edilir", () => {
  const { analyses, skipped } = analyzeBatch([
    { apn: "B1", state: "TX", county: "Starr", acres: 5, minimum_bid: 10000 },
    {}, // skip
    { owner_name: "no id" }, // skip
    { apn: "B2", state: "TX", county: "Starr", acres: 2, minimum_bid: 20000 },
  ], ctx);
  assert.equal(analyses.length, 2);
  assert.equal(skipped, 2);
});

test("idempotent kimlik: aynı parselden aynı parcelKey", () => {
  const a1 = analyzeLead({ apn: "SAME-1", state: "TX", county: "Starr", acres: 5, minimum_bid: 10000 }, ctx)!;
  const a2 = analyzeLead({ apn: "SAME-1", state: "TX", county: "Starr", acres: 6, minimum_bid: 9000 }, ctx)!;
  assert.equal(a1.parcelKey, a2.parcelKey);
});
