import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toBuyerParcel, installmentPlan, BUYER_SAFE_FIELDS, BUYER_FORBIDDEN_FIELDS,
} from "@/lib/buyer-parcel";
import type { UnifiedDeal } from "@/lib/unified-deals";

const FULL_DEAL: UnifiedDeal = {
  id: "mohave-123-45-678",
  source: "mohave",
  sourceLabel: "Mohave Off-Market",
  state: "AZ",
  county: "Mohave",
  region: "Golden Valley",
  owner: "JOHN SECRET OWNER",
  ownerState: "CA",
  absentee: true,
  address: "123 Desert Rd",
  acres: 5.21,
  landValue: 3100,
  estOffer: 2200,      // internal blind-offer — must not leak
  estResale: 9900,     // buyer price source
  spread: 7700,        // internal margin — must not leak
  score: 87,
  apn: "123-45-678",
  lat: 35.21,
  lng: -114.22,
  mapUrl: "https://www.google.com/maps?q=35.21,-114.22",
  marketValue: 15300,  // internal comp valuation — must not leak
  comps: 12,
  mailSafe: true,
  valBasis: "attom_region",
  dealGrade: "A",
  // MH sinyali İÇ alandır — buyer whitelist testleri sızmadığını da doğrular.
  useCode: "VACANT LAND",
  mh: "likely",
  mhReason: "AZ ROAD Act — county teyidi şart",
};

test("toBuyerParcel: sadece whitelist alanları döner", () => {
  const p = toBuyerParcel(FULL_DEAL);
  assert.deepEqual(Object.keys(p).sort(), [...BUYER_SAFE_FIELDS].sort());
});

test("toBuyerParcel: iç ekonomi/owner alanlarının HİÇBİRİ sızmaz", () => {
  const p = toBuyerParcel(FULL_DEAL) as unknown as Record<string, unknown>;
  for (const f of BUYER_FORBIDDEN_FIELDS) {
    assert.equal(f in p, false, `forbidden field leaked: ${f}`);
  }
  // Değer düzeyinde de sızıntı yok: serialize edilen çıktıda iç sayılar geçmiyor.
  const json = JSON.stringify(p);
  assert.ok(!json.includes("SECRET OWNER"));
  assert.ok(!json.includes("2200"), "estOffer value leaked");
  assert.ok(!json.includes("7700"), "spread value leaked");
  assert.ok(!json.includes("15300"), "marketValue leaked");
});

test("toBuyerParcel: fiyat = estResale (nakit satış fiyatı), yuvarlanmış", () => {
  const p = toBuyerParcel(FULL_DEAL);
  assert.equal(p.price, 9900);
  assert.equal(p.acres, 5.21);
  assert.equal(p.lat, 35.21);
});

test("toBuyerParcel: comp yoksa fiyat 0 (uydurma yok) ve lat/lng null kalır", () => {
  const p = toBuyerParcel({ ...FULL_DEAL, estResale: 0, lat: null, lng: null });
  assert.equal(p.price, 0);
  assert.equal(p.lat, null);
  assert.equal(p.lng, null);
});

test("BUYER_SAFE_FIELDS ∩ BUYER_FORBIDDEN_FIELDS = boş küme", () => {
  const safe = new Set<string>(BUYER_SAFE_FIELDS);
  for (const f of BUYER_FORBIDDEN_FIELDS) assert.ok(!safe.has(f), f);
});

test("installmentPlan: $9,900 fiyat, $500 peşinat, $199/ay → 48 ay", () => {
  const r = installmentPlan(9900, 500, 199);
  assert.equal(r.financed, 9400);
  assert.equal(r.months, Math.ceil(9400 / 199)); // 48
  assert.equal(r.total, 9900); // %0 faiz düz plan — toplam = fiyat
  assert.equal(r.lastPayment, 9400 - (r.months - 1) * 199);
});

test("installmentPlan: peşinat fiyatı aşarsa fiyata kıstırılır, ay=0", () => {
  const r = installmentPlan(1000, 5000, 199);
  assert.equal(r.down, 1000);
  assert.equal(r.financed, 0);
  assert.equal(r.months, 0);
  assert.equal(r.total, 1000);
});

test("installmentPlan: aylık min $1'e sabitlenir (sıfıra bölme yok)", () => {
  const r = installmentPlan(1000, 0, 0);
  assert.equal(r.monthly, 1);
  assert.ok(Number.isFinite(r.months));
});
