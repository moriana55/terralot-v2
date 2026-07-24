import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFilter, normCounty, rankMatches, sweepLeads, type LeadRow } from "@/lib/saved-search";

const row = (o: Partial<LeadRow>): LeadRow => ({
  id: o.id ?? "x",
  state: o.state ?? null,
  county: o.county ?? null,
  source: o.source ?? null,
  acres: o.acres ?? null,
  minimum_bid: o.minimum_bid ?? null,
  final_score: o.final_score ?? null,
  owner_name: o.owner_name ?? null,
  property_address: o.property_address ?? null,
  scraped_at: o.scraped_at ?? null,
});

test("normCounty: 'Harris County' / 'harris' → 'HARRIS' (case + suffix normalize)", () => {
  assert.equal(normCounty("Harris County"), "HARRIS");
  assert.equal(normCounty("harris"), "HARRIS");
  assert.equal(normCounty(null), "");
  assert.equal(normCounty("  Mohave  "), "MOHAVE");
});

test("matchesFilter: state filtresi büyük/küçük harf duyarsız, eşleşmeyeni eler", () => {
  assert.equal(matchesFilter(row({ state: "tx" }), { states: ["TX", "FL"] }), true);
  assert.equal(matchesFilter(row({ state: "AZ" }), { states: ["TX"] }), false);
  assert.equal(matchesFilter(row({ state: null }), { states: ["TX"] }), false);
});

test("matchesFilter: srcContains / county / min-max sınırları", () => {
  assert.equal(matchesFilter(row({ source: "tax-delinquent" }), { srcContains: "TAX" }), true);
  assert.equal(matchesFilter(row({ county: "Harris County" }), { county: "harris" }), true);
  assert.equal(matchesFilter(row({ acres: 5 }), { minAcres: 2, maxAcres: 10 }), true);
  assert.equal(matchesFilter(row({ acres: 1 }), { minAcres: 2 }), false);
  assert.equal(matchesFilter(row({ minimum_bid: 500 }), { maxBid: 400 }), false);
  assert.equal(matchesFilter(row({ final_score: 60 }), { minScore: 70 }), false);
});

test("matchesFilter: null sayısal alanlar güvenli — min'de 0, max'te Infinity varsayılır", () => {
  // acres null + minAcres set → 0 < min → elenir
  assert.equal(matchesFilter(row({ acres: null }), { minAcres: 1 }), false);
  // acres null + maxAcres set → Infinity > max → elenir
  assert.equal(matchesFilter(row({ acres: null }), { maxAcres: 10 }), false);
  // hiç sayısal filtre yoksa null satır geçer
  assert.equal(matchesFilter(row({ acres: null }), {}), true);
});

test("matchesFilter: hasOwner 'unknown/no owner/county tax' sahiplerini eler", () => {
  assert.equal(matchesFilter(row({ owner_name: "JOHN DOE" }), { hasOwner: true }), true);
  assert.equal(matchesFilter(row({ owner_name: "UNKNOWN" }), { hasOwner: true }), false);
  assert.equal(matchesFilter(row({ owner_name: "COUNTY TAX OFFICE" }), { hasOwner: true }), false);
  assert.equal(matchesFilter(row({ owner_name: null }), { hasOwner: true }), false);
});

test("rankMatches: skora göre sıralar, limit uygular, yeni eşleşmeleri türetir", () => {
  const rows = [
    row({ id: "a", final_score: 50 }),
    row({ id: "b", final_score: 90 }),
    row({ id: "c", final_score: 70 }),
  ];
  const r = rankMatches(rows, {}, new Set(["b"]));
  assert.equal(r.total, 3);
  assert.deepEqual(r.capped.map((x) => x.id), ["b", "c", "a"]); // skor sıralı
  assert.deepEqual(r.newMatches.map((x) => x.id), ["c", "a"]); // b baseline'da → yeni değil
});

test("rankMatches: limit filtreden sonra ve 500 tavanında uygulanır", () => {
  const rows = Array.from({ length: 10 }, (_, i) => row({ id: `id${i}`, final_score: i }));
  const r = rankMatches(rows, { limit: 3 }, new Set());
  assert.equal(r.total, 10);
  assert.equal(r.capped.length, 3);
  assert.deepEqual(r.capped.map((x) => x.id), ["id9", "id8", "id7"]);
});

test("sweepLeads: tablo hatasında fırlatmaz — { rows:[], ok:false } döner", async () => {
  const failing = {
    from: () => ({ select: () => ({ range: async () => ({ data: null, error: { message: "no table" } }) }) }),
  };
  const out = await sweepLeads(failing);
  assert.deepEqual(out, { rows: [], ok: false });
});

test("sweepLeads: 1000'lik sayfalama — kısa sayfada durur", async () => {
  const page = Array.from({ length: 5 }, (_, i) => row({ id: `p${i}` }));
  let calls = 0;
  const s = {
    from: () => ({
      select: () => ({
        range: async () => { calls++; return { data: page, error: null }; },
      }),
    }),
  };
  const out = await sweepLeads(s);
  assert.equal(out.ok, true);
  assert.equal(out.rows.length, 5);
  assert.equal(calls, 1); // 5 < 1000 → tek sayfa
});
