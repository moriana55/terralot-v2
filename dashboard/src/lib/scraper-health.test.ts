// Scraper sağlığı yardımcıları testleri (saf, DB/fs yok). Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { scraperHealth, scrapeAgeLabel, SCRAPE_STALE_DAYS } from "./scraper-health.ts";

const NOW = new Date("2026-07-04T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

test("taze tarama: yaş doğru, stale değil", () => {
  const h = scraperHealth(daysAgo(1), null, NOW);
  assert.equal(h.ageDays, 1);
  assert.equal(h.stale, false);
  assert.equal(h.runnerWarning, null);
});

test("bugünkü tarama: ageDays 0", () => {
  const h = scraperHealth(new Date(NOW.getTime() - 3600000).toISOString(), null, NOW);
  assert.equal(h.ageDays, 0);
  assert.equal(h.stale, false);
});

test(`eşik: ${SCRAPE_STALE_DAYS} gün stale DEĞİL, ${SCRAPE_STALE_DAYS + 1} gün stale`, () => {
  assert.equal(scraperHealth(daysAgo(SCRAPE_STALE_DAYS), null, NOW).stale, false);
  assert.equal(scraperHealth(daysAgo(SCRAPE_STALE_DAYS + 1), null, NOW).stale, true);
});

test("hiç veri yok: ageDays null + stale", () => {
  const h = scraperHealth(null, null, NOW);
  assert.equal(h.ageDays, null);
  assert.equal(h.stale, true);
});

test("bozuk timestamp: crash yok, stale sayılır", () => {
  const h = scraperHealth("not-a-date", null, NOW);
  assert.equal(h.ageDays, null);
  assert.equal(h.stale, true);
});

test("runner: 2 üst üste başarısızlık uyarı üretir, 1 üretmez", () => {
  const base = { lastRunAt: daysAgo(0.1), lastError: "run-all.sh başarısız" };
  const warn = scraperHealth(daysAgo(1), { ...base, consecutiveFailures: 2 }, NOW);
  assert.ok(warn.runnerWarning && warn.runnerWarning.includes("2 kez"));
  assert.ok(warn.runnerWarning.includes("run-all.sh"));
  const ok = scraperHealth(daysAgo(1), { ...base, consecutiveFailures: 1 }, NOW);
  assert.equal(ok.runnerWarning, null);
});

test("runner: 48 saatten uzun sessizlik uyarı üretir", () => {
  const h = scraperHealth(daysAgo(1), { lastRunAt: daysAgo(3), consecutiveFailures: 0 }, NOW);
  assert.ok(h.runnerWarning && h.runnerWarning.includes("48 saat"));
});

test("runner: status dosyası yoksa (null) uyarı yok — Vercel senaryosu", () => {
  assert.equal(scraperHealth(daysAgo(10), null, NOW).runnerWarning, null);
});

test("scrapeAgeLabel: bugün / 1 gün önce / hiç", () => {
  assert.equal(scrapeAgeLabel(0), "bugün");
  assert.equal(scrapeAgeLabel(1), "1 gün önce");
  assert.equal(scrapeAgeLabel(17), "17 gün önce");
  assert.equal(scrapeAgeLabel(null), "hiç");
});
