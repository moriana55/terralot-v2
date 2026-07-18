import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketRegistry } from "./market-registry";

const MARKETS = buildMarketRegistry({
  mohave: { count: 20_000, source: "Mohave test", generatedAt: "2026-06-26T00:00:00Z" },
  luna: { count: 157, source: "Luna test", generatedAt: "2026-06-26T00:00:00Z" },
  colorado: { count: 0, source: "Colorado test", generatedAt: "2026-06-26T00:00:00Z" },
});

test("market kimlikleri benzersiz", () => {
  assert.equal(new Set(MARKETS.map((m) => m.id)).size, MARKETS.length);
});

test("yalnız veri ve operasyon bağlantısı olan market active", () => {
  const active = MARKETS.filter((m) => m.status === "active");
  assert.ok(active.length > 0);
  for (const market of active) {
    assert.ok(market.sourceRows > 0);
    assert.ok(market.inventoryHref);
    assert.equal(market.readiness.parcelData, "ready");
    assert.equal(market.readiness.ownerMailing, "ready");
  }
});

test("Luna pilotu hazır import sayısını taşır", () => {
  const luna = MARKETS.find((m) => m.id === "nm-luna");
  assert.equal(luna?.status, "pilot");
  assert.equal(luna?.sourceRows, 157);
});

test("sıfır satırlı market active olamaz", () => {
  assert.equal(MARKETS.some((m) => m.sourceRows === 0 && m.status === "active"), false);
});
