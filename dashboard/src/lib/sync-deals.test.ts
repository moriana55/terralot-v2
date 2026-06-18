// Scraper → dashboard ETL tests: dedup idempotency, bad-row rejection, zod coercion.
// Pure (no DB/network). Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRows, dedupKey, RawScraperRowSchema } from "./sync-deals.ts";

test("dedupKey: APN'den stabil anahtar (case/biçim farkı normalize)", () => {
  const a = dedupKey({ apn: "12-345-678" });
  const b = dedupKey({ apn: "12 345 678" }); // farklı ayraç, aynı parsel
  assert.equal(a, "apn:12-345-678");
  assert.equal(a, b); // slug aynı → idempotent upsert
  // parcel_id / parcelId / zpid fallback sırası
  assert.equal(dedupKey({ parcel_id: "P9" }), "apn:p9");
  assert.equal(dedupKey({ zpid: "Z1" }), "apn:z1");
});

test("dedupKey: identity yoksa konum+kaynak fallback, hiçbiri yoksa null", () => {
  const k = dedupKey({ property_address: "10 Main St", state: "TX", county: "Harris", source: "scraper" });
  assert.ok(k && k.startsWith("loc:"));
  // adres var ama state yok → null (yetersiz identity)
  assert.equal(dedupKey({ property_address: "10 Main St" }), null);
  // tamamen boş → null
  assert.equal(dedupKey({}), null);
});

test("APN idempotency: aynı parsel iki kez → tek satır, son yazan kazanır", () => {
  const { rows, skipped } = normalizeRows([
    { apn: "A1", minimum_bid: 1000, county: "Old" },
    { apn: "A1", minimum_bid: 2000, county: "New" }, // aynı dedup key
  ]);
  assert.equal(rows.length, 1, "tek dedup anahtarı tek satır olmalı");
  assert.equal(skipped, 0);
  assert.equal(rows[0].minimum_bid, 2000); // last-write-wins
  assert.equal(rows[0].county, "New");
  assert.equal(rows[0].dedup_key, "apn:a1");
});

test("bad-row rejection: identity'siz ve geçersiz şekilli satırlar atlanır + sayılır", () => {
  const { rows, skipped, reasons } = normalizeRows([
    { apn: "GOOD", state: "TX" }, // geçerli
    { state: "TX", county: "X" }, // identity yok (adres/apn yok) → atla
    42, // ilkel değer → invalid_shape
    null, // → invalid_shape
    "garbage", // string → invalid_shape (obje değil)
  ]);
  assert.equal(rows.length, 1);
  assert.equal(skipped, 4);
  assert.equal(reasons.no_identity, 1);
  assert.equal(reasons.invalid_shape, 3);
});

test("zod: aşırı uzun string reddedilir (invalid_shape), sayısal coercion çalışır", () => {
  // apn max 120 karakter; aşıyorsa parse fail → satır atlanır
  const tooLong = { apn: "x".repeat(121), state: "TX" };
  const { rows, skipped, reasons } = normalizeRows([tooLong]);
  assert.equal(rows.length, 0);
  assert.equal(skipped, 1);
  assert.equal(reasons.invalid_shape, 1);

  // string sayılar coerce edilir
  const parsed = RawScraperRowSchema.safeParse({ apn: "A", acres: "5.5", minimum_bid: "1000" });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.acres, 5.5);
    assert.equal(parsed.data.minimum_bid, 1000);
  }
});

test("sanitization: garbage acreage/bid null'lanır, lat/lng sınır dışı atılır", () => {
  const { rows } = normalizeRows([
    {
      apn: "S1",
      acres: 80000, // saneAcres tavanı üstü → null
      minimum_bid: 99_000_000, // saneBid tavanı üstü → null
      lat: 999, // geçersiz koordinat → null
      lng: -200,
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].acres, null);
  assert.equal(rows[0].minimum_bid, null);
  assert.equal(rows[0].lat, null);
  assert.equal(rows[0].lng, null);
});

test("comp/discount türetimi: $/acre × acres → comp, indirim & savings hesaplanır", () => {
  const { rows } = normalizeRows([
    {
      apn: "C1",
      acres: 10,
      zillow_comp_rate: 10000, // $/acre → comp = 100000
      minimum_bid: 25000,
    },
  ]);
  assert.equal(rows[0].discount_pct, 75); // (100000-25000)/100000
  assert.equal(rows[0].savings, 75000);
});
