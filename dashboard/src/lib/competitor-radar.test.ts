// Rakip Satış Radarı saf hesap/CSV testleri (DB/network yok). Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  median,
  competitorLandscape,
  competitorSignals,
  likelySold,
  salesStats,
  parseCsv,
  matchSalesHeaders,
  csvToSales,
  saleKey,
  parseDateFlexible,
  type RawListing,
  type TrackedRow,
  type SaleRow,
} from "./competitor-radar.ts";

const NOW = new Date("2026-07-08T00:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

test("median: tek ve çift eleman", () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 3]), 2);
  assert.equal(median([9, 1, 5]), 5);
});

test("competitorLandscape: rakip başına aktif sayı + medyan fiyat/$acre + dönüm aralığı", () => {
  const listings: RawListing[] = [
    { competitor: "Rina Land", title: "a", state: "Arizona", county: "Mohave", acres: 1, price: 5000 },
    { competitor: "Rina Land", title: "b", state: "Arizona", county: "Mohave", acres: 2, price: 10000 },
    { competitor: "Rina Land", title: "c", state: "Texas", county: "Hudspeth", acres: 4, price: 20000 },
    { competitor: "Landio", title: "d", state: "Colorado", county: "Costilla", acres: 5, price: 15000 },
  ];
  const ls = competitorLandscape(listings);
  const rina = ls.find((x) => x.competitor === "Rina Land")!;
  assert.equal(rina.activeCount, 3);
  assert.equal(rina.medianPrice, 10000);
  assert.equal(rina.medianPpa, 5000); // her ilan $5000/acre → medyan 5000
  assert.equal(rina.acresMin, 1);
  assert.equal(rina.acresMax, 4);
  assert.equal(rina.states[0].key, "Arizona");
  assert.equal(rina.states[0].n, 2);
  // en çok ilanı olan rakip başta
  assert.equal(ls[0].competitor, "Rina Land");
});

test("competitorLandscape: 0/negatif fiyat ve acre'ı $/acre'dan dışlar", () => {
  const ls = competitorLandscape([
    { competitor: "X", title: "a", state: "AZ", county: "c", acres: 0, price: 5000 },
    { competitor: "X", title: "b", state: "AZ", county: "c", acres: 2, price: 0 },
  ]);
  assert.equal(ls[0].medianPpa, null);
  assert.equal(ls[0].medianPrice, 5000); // sadece pozitif fiyat sayılır
});

test("competitorSignals: bu hafta yeni / kaybolan + hız", () => {
  const tracked: TrackedRow[] = [
    { listing_key: "k1", competitor: "Rina Land", title: "a", state: "AZ", county: "c", acres: 1, first_seen: iso(2), last_seen: iso(0), current_price: 5000, status: "ACTIVE", disappeared_at: null, dom_days: null },
    { listing_key: "k2", competitor: "Rina Land", title: "b", state: "AZ", county: "c", acres: 1, first_seen: iso(40), last_seen: iso(3), current_price: 6000, status: "SUSPECTED_SOLD", disappeared_at: iso(3), dom_days: 37 },
    { listing_key: "k3", competitor: "Rina Land", title: "d", state: "AZ", county: "c", acres: 1, first_seen: iso(60), last_seen: iso(20), current_price: 7000, status: "SUSPECTED_SOLD", disappeared_at: iso(20), dom_days: 40 },
  ];
  const sig = competitorSignals(tracked, NOW)[0];
  assert.equal(sig.tracked, 3);
  assert.equal(sig.newThisWeek, 1); // k1 (2 gün önce)
  assert.equal(sig.lostThisWeek, 1); // k2 (3 gün önce kayboldu); k3 20 gün önce
  assert.equal(sig.suspectedTotal, 2);
  assert.ok(sig.velocityPerWeek != null && sig.velocityPerWeek > 0);
});

test("likelySold: sadece SUSPECTED_SOLD, kaybolma tarihine göre sıralı", () => {
  const tracked: TrackedRow[] = [
    { listing_key: "a", competitor: "X", title: "old", state: "AZ", county: "c", acres: 1, first_seen: iso(50), last_seen: iso(30), current_price: 5000, status: "SUSPECTED_SOLD", disappeared_at: iso(30), dom_days: 20 },
    { listing_key: "b", competitor: "X", title: "new", state: "AZ", county: "c", acres: 1, first_seen: iso(10), last_seen: iso(2), current_price: 6000, status: "SUSPECTED_SOLD", disappeared_at: iso(2), dom_days: 8 },
    { listing_key: "c", competitor: "X", title: "active", state: "AZ", county: "c", acres: 1, first_seen: iso(5), last_seen: iso(0), current_price: 7000, status: "ACTIVE", disappeared_at: null, dom_days: null },
  ];
  const sold = likelySold(tracked);
  assert.equal(sold.length, 2);
  assert.equal(sold[0].title, "new"); // en yeni kaybolan başta
});

test("salesStats: adet, medyan fiyat, tarih aralığı, aylık hız", () => {
  const sales: SaleRow[] = [
    { competitor_name: "Rina Land LLC", price: 10000, acres: 2, sale_date: "2026-01-01", state: "AZ", county: "Mohave" },
    { competitor_name: "Rina Land LLC", price: 20000, acres: 2, sale_date: "2026-03-01", state: "AZ", county: "Mohave" },
    { competitor_name: "Rina Land LLC", price: 30000, acres: 2, sale_date: "2026-05-01", state: "AZ", county: "Mohave" },
  ];
  const st = salesStats(sales)[0];
  assert.equal(st.count, 3);
  assert.equal(st.medianPrice, 20000);
  assert.equal(st.firstSale, "2026-01-01");
  assert.equal(st.lastSale, "2026-05-01");
  assert.ok(st.salesPerMonth != null && st.salesPerMonth > 0);
});

test("parseCsv: tırnaklı virgül + kaçış + BOM", () => {
  const rows = parseCsv('﻿a,b,c\n"x,1","y""z",3\n');
  assert.deepEqual(rows[0], ["a", "b", "c"]);
  assert.deepEqual(rows[1], ["x,1", 'y"z', "3"]);
});

test("matchSalesHeaders: PropStream başlık varyantlarını yakalar", () => {
  const m = matchSalesHeaders(["Grantor Name", "Sale Date", "Sale Amount", "APN", "Acreage", "County", "Deed Type"]);
  assert.equal(m.grantor, 0);
  assert.equal(m.sale_date, 1);
  assert.equal(m.price, 2);
  assert.equal(m.apn, 3);
  assert.equal(m.acres, 4);
  assert.equal(m.county, 5);
  assert.equal(m.deed_type, 6);
});

test("parseDateFlexible: US ve ISO formatları", () => {
  assert.equal(parseDateFlexible("2026-01-15"), "2026-01-15");
  assert.equal(parseDateFlexible("1/15/2026"), "2026-01-15");
  assert.equal(parseDateFlexible(""), null);
  assert.equal(parseDateFlexible("garbage"), null);
});

test("saleKey: deterministik ve içerik-duyarlı", () => {
  const a = saleKey(["Rina", "123-45", "2026-01-01", 5000]);
  const b = saleKey(["Rina", "123-45", "2026-01-01", 5000]);
  const c = saleKey(["Rina", "123-45", "2026-01-01", 6000]);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^sale_/);
});

test("csvToSales: eşleme + override + dedup + skip", () => {
  const csv = [
    "Grantor,Grantee,APN,Sale Date,Sale Price,Acreage,County,State,Deed Type",
    "RINA LAND LLC,John Doe,123-45,1/15/2026,\"$12,500\",2.5,Mohave,AZ,Warranty Deed",
    "RINA LAND LLC,John Doe,123-45,1/15/2026,\"$12,500\",2.5,Mohave,AZ,Warranty Deed", // dupe
    ",,,,,,,,", // boş → skip
    "RINA LAND LLC,Jane,999,,,,,,", // no date/price → skip
  ].join("\n");
  const res = csvToSales(csv, "Rina Land");
  assert.equal(res.records.length, 1);
  assert.equal(res.records[0].competitor_name, "Rina Land"); // override
  assert.equal(res.records[0].grantor_llc, "RINA LAND LLC");
  assert.equal(res.records[0].price, 12500);
  assert.equal(res.records[0].sale_date, "2026-01-15");
  assert.equal(res.records[0].state, "AZ");
  assert.ok(res.skipped >= 2);
  assert.deepEqual(res.missing, []);
});

test("csvToSales: kritik kolon yoksa missing raporlar", () => {
  const res = csvToSales("Foo,Bar\n1,2\n");
  assert.ok(res.missing.includes("grantor/apn"));
  assert.equal(res.records.length, 0);
});
