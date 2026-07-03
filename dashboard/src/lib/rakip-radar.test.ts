// Rakip Radar diff motoru testleri (saf, DB/network yok). Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diffSnapshots,
  listingKey,
  isSyntheticApn,
  deriveSourceStatus,
  radarSummary,
  competitorStats,
  ppaHistogram,
  regridPath,
  type CompListing,
  type TrackedListing,
} from "./rakip-radar.ts";

const T0 = new Date("2026-07-01T00:00:00.000Z");
const T1 = new Date("2026-07-02T00:00:00.000Z");
const T30 = new Date("2026-07-31T00:00:00.000Z");

function listing(over: Partial<CompListing> = {}): CompListing {
  const base: CompListing = {
    key: "",
    competitor: "Discount Lots",
    title: "1.2 Acres in Golden Valley",
    apn: "306-25-114",
    url: "https://discountlots.com/x",
    price: 8999,
    acres: 1.2,
    state: "Arizona",
    county: "Mohave",
    status: "ACTIVE",
  };
  const l = { ...base, ...over };
  if (!over.key) l.key = listingKey(l);
  return l;
}

function tracked(over: Partial<TrackedListing> = {}): TrackedListing {
  const l = listing();
  return {
    listing_key: l.key,
    competitor: l.competitor,
    title: l.title,
    apn: l.apn,
    url: l.url,
    state: l.state,
    county: l.county,
    acres: l.acres,
    first_seen: T0.toISOString(),
    last_seen: T0.toISOString(),
    initial_price: 8999,
    current_price: 8999,
    price_history: [{ at: T0.toISOString(), price: 8999 }],
    price_cuts: 0,
    status: "ACTIVE",
    disappeared_at: null,
    dom_days: null,
    sold_price: null,
    verification: null,
    ...over,
  };
}

// ── Kimlik ───────────────────────────────────────────────────────────────────
test("listingKey: gerçek APN öncelikli, sentetik APN (FL_Orange_00001) atlanır", () => {
  assert.equal(isSyntheticApn("FL_Orange_00001"), true);
  assert.equal(isSyntheticApn("306-25-114"), false);
  const real = listingKey({ competitor: "X", apn: "306-25-114", url: "https://a" });
  assert.equal(real, "x|apn:306-25-114");
  const synth = listingKey({ competitor: "Landio", apn: "FL_Orange_00001", url: "https://a/b" });
  assert.equal(synth, "landio|url:https://a/b");
  const noUrl = listingKey({ competitor: "Landio", apn: "FL_Orange_00001", title: "T", state: "FL", county: "Orange" });
  assert.equal(noUrl, "landio|t:t|fl|orange");
});

test("deriveSourceStatus: başlıkta pending/under contract → PENDING", () => {
  assert.equal(deriveSourceStatus("5 Acres — SALE PENDING"), "PENDING");
  assert.equal(deriveSourceStatus("5 Acres", "Under Contract"), "PENDING");
  assert.equal(deriveSourceStatus("5 Acres in Mohave"), "ACTIVE");
});

// ── NEW ──────────────────────────────────────────────────────────────────────
test("NEW: ilk snapshot'ta tüm ilanlar NEW olur, tracked ACTIVE açılır", () => {
  const c = listing();
  const { events, upserts } = diffSnapshots([], [c], T0);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "NEW");
  assert.equal(events[0].listing_key, c.key);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].status, "ACTIVE");
  assert.equal(upserts[0].first_seen, T0.toISOString());
  assert.equal(upserts[0].initial_price, 8999);
  assert.deepEqual(upserts[0].price_history, [{ at: T0.toISOString(), price: 8999 }]);
});

// ── PRICE_CHANGED ────────────────────────────────────────────────────────────
test("PRICE_CHANGED: indirim → delta negatif, price_cuts artar, geçmişe eklenir", () => {
  const t = tracked();
  const c = listing({ price: 7999 });
  const { events, upserts } = diffSnapshots([t], [c], T1);
  const pc = events.filter((e) => e.type === "PRICE_CHANGED");
  assert.equal(pc.length, 1);
  assert.equal(pc[0].delta, -1000);
  assert.deepEqual(pc[0].old_value, { price: 8999 });
  assert.deepEqual(pc[0].new_value, { price: 7999 });
  const u = upserts.find((x) => x.listing_key === t.listing_key)!;
  assert.equal(u.current_price, 7999);
  assert.equal(u.price_cuts, 1);
  assert.equal(u.initial_price, 8999); // ilk fiyat korunur
  assert.equal(u.price_history.length, 2);
  assert.equal(u.last_seen, T1.toISOString());
});

test("PRICE_CHANGED: zam → delta pozitif, price_cuts ARTMAZ", () => {
  const { events, upserts } = diffSnapshots([tracked()], [listing({ price: 9999 })], T1);
  const pc = events.find((e) => e.type === "PRICE_CHANGED")!;
  assert.equal(pc.delta, 1000);
  assert.equal(upserts[0].price_cuts, 0);
});

test("fiyat aynı → PRICE_CHANGED yok, sadece last_seen güncellenir", () => {
  const { events, upserts } = diffSnapshots([tracked()], [listing()], T1);
  assert.equal(events.length, 0);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].last_seen, T1.toISOString());
  assert.equal(upserts[0].price_history.length, 1);
});

// ── STATUS_CHANGED ───────────────────────────────────────────────────────────
test("STATUS_CHANGED: ACTIVE → PENDING (başlıkta 'pending')", () => {
  const { events, upserts } = diffSnapshots([tracked()], [listing({ status: "PENDING" })], T1);
  const sc = events.find((e) => e.type === "STATUS_CHANGED")!;
  assert.deepEqual(sc.old_value, { status: "ACTIVE" });
  assert.deepEqual(sc.new_value, { status: "PENDING" });
  assert.equal(upserts[0].status, "PENDING");
});

// ── DISAPPEARED ──────────────────────────────────────────────────────────────
test("DISAPPEARED: aktif ilan snapshot'ta yok → SUSPECTED_SOLD + DOM hesabı", () => {
  const t = tracked(); // first_seen = T0
  const { events, upserts } = diffSnapshots([t], [], T30);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "DISAPPEARED");
  const u = upserts[0];
  assert.equal(u.status, "SUSPECTED_SOLD");
  assert.equal(u.disappeared_at, T30.toISOString());
  assert.equal(u.dom_days, 30);
});

test("DISAPPEARED: zaten kapalı (SOLD_VERIFIED/WITHDRAWN) satırlar tekrar tetiklenmez", () => {
  const sold = tracked({ status: "SOLD_VERIFIED", disappeared_at: T1.toISOString(), dom_days: 1 });
  const { events, upserts } = diffSnapshots([sold], [], T30);
  assert.equal(events.length, 0);
  assert.equal(upserts.length, 0);
});

// ── REAPPEARED ───────────────────────────────────────────────────────────────
test("REAPPEARED: satış şüphesindeki ilan geri geldi → şüphe düşer, ACTIVE olur", () => {
  const sus = tracked({ status: "SUSPECTED_SOLD", disappeared_at: T1.toISOString(), dom_days: 1 });
  const { events, upserts } = diffSnapshots([sus], [listing()], T30);
  const re = events.find((e) => e.type === "REAPPEARED")!;
  assert.deepEqual(re.old_value, { status: "SUSPECTED_SOLD" });
  const u = upserts[0];
  assert.equal(u.status, "ACTIVE");
  assert.equal(u.disappeared_at, null);
  assert.equal(u.dom_days, null);
});

// ── Dupe güvenliği ───────────────────────────────────────────────────────────
test("kaynak dupe'ları tek sayılır (aynı key iki kez → tek NEW)", () => {
  const c = listing();
  const { events, upserts } = diffSnapshots([], [c, { ...c }], T0);
  assert.equal(events.filter((e) => e.type === "NEW").length, 1);
  assert.equal(upserts.length, 1);
});

// ── Toplulaştırma ────────────────────────────────────────────────────────────
test("radarSummary: aktif sayısı, ort. DOM, 30 gün kayıp, doğrulanmış satış", () => {
  const a = tracked(); // ACTIVE, T0'dan beri → T30'da DOM 30
  const sold = tracked({
    listing_key: "k2",
    status: "SOLD_VERIFIED",
    disappeared_at: T1.toISOString(),
    dom_days: 1,
    sold_price: 7500,
  });
  const s = radarSummary([a, sold], T30);
  assert.equal(s.activeCount, 1);
  assert.equal(s.avgDomActive, 30);
  assert.equal(s.lost30d, 1); // T1'de kayboldu, 30 gün içinde
  assert.equal(s.verifiedSoldCount, 1);
});

test("competitorStats: satış DOM'u, $/acre ve indirim davranışı rakip bazında", () => {
  const sold = tracked({
    listing_key: "k2",
    status: "SOLD_VERIFIED",
    dom_days: 20,
    sold_price: 12000,
    acres: 2, // 6000 $/acre
  });
  const cutter = tracked({
    listing_key: "k3",
    price_cuts: 1,
    initial_price: 10000,
    current_price: 8000, // %20 indirim
  });
  const [perf] = competitorStats([sold, cutter]);
  assert.equal(perf.competitor, "Discount Lots");
  assert.equal(perf.verifiedSold, 1);
  assert.equal(perf.avgDomAtSale, 20);
  assert.equal(perf.avgSoldPpa, 6000);
  assert.equal(perf.cutShare, 0.5);
  assert.equal(perf.avgCutPct, 20);
});

test("ppaHistogram: satılan vs çürüyen (DOM≥60) doğru bucket'a düşer", () => {
  const sold = tracked({ listing_key: "k2", status: "SOLD_VERIFIED", sold_price: 6000, acres: 2 }); // 3000 → $2.5–5k
  const stale = tracked({ listing_key: "k3", current_price: 30000, acres: 1 }); // 30000 → $25–50k, first_seen T0
  const T90 = new Date("2026-09-29T00:00:00.000Z");
  // fresh: DOM 10 gün (< 60) → çürüyen SAYILMAZ
  const fresh = tracked({ listing_key: "k4", first_seen: "2026-09-19T00:00:00.000Z", current_price: 30000, acres: 1 });
  const h = ppaHistogram([sold, stale, fresh], T90);
  assert.equal(h.find((b) => b.min === 2500)!.sold, 1);
  assert.equal(h.find((b) => b.min === 25000)!.stale, 1);
  assert.equal(h.reduce((n, b) => n + b.stale, 0), 1);
  assert.equal(h.reduce((n, b) => n + b.sold, 0), 1);
});

test("regridPath: Arizona/Mohave → /us/az/mohave", () => {
  assert.equal(regridPath("Arizona", "Mohave"), "/us/az/mohave");
  assert.equal(regridPath("Arizona", "Mohave County"), "/us/az/mohave");
  assert.equal(regridPath(null, "Mohave"), null);
});
