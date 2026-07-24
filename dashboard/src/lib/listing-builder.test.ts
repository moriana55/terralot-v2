import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBuyerListing, buildLocationSummary, financeHeadline } from "@/lib/listing-builder";
import { toBuyerParcel } from "@/lib/buyer-parcel";
import type { BuyerParcel } from "@/lib/buyer-parcel";
import type { UnifiedDeal } from "@/lib/unified-deals";

const AZ: BuyerParcel = {
  id: "deal-1",
  apn: "123-45-678",
  state: "AZ",
  county: "Mohave",
  region: "Golden Valley",
  address: "0 Desert Rd, Golden Valley, AZ 86413",
  acres: 1.25,
  lat: 35.2,
  lng: -114.2,
  price: 12000,
};

test("composer: BuyerParcel → tam ilan objesi (başlık + açıklama + bullets + konum + finans)", () => {
  const l = buildBuyerListing(AZ);
  assert.match(l.title, /Golden Valley, AZ/);
  assert.ok(l.description.length > 40, "açıklama boş/çok kısa");
  assert.ok(l.bullets.length >= 3, "bullets eksik");
  assert.ok(l.locationSummary.includes("Mohave County, AZ"), "konum özeti county/state taşımıyor");
  assert.ok(l.financing.length >= 1, "owner-finance senaryosu yok");
  // Fiyatlı → manşet finans satırı (Compass down) başlıkta.
  assert.match(l.title, /Owner Financing/);
});

test("composer: finans senaryoları KANONİK owner-finance presetlerinden gelir (uydurma yok)", () => {
  const l = buildBuyerListing(AZ);
  // buildFinancingOptions preset seti: 3 LANDiO tier + Compass = 4 plan.
  assert.equal(l.financing.length, 4);
  for (const plan of l.financing) {
    // Amortisman tutarlı: down + finance = salePrice, toplam ödeme ≥ salePrice.
    assert.ok(plan.downPayment + plan.financedAmount === plan.salePrice || Math.abs(plan.downPayment + plan.financedAmount - plan.salePrice) < 0.02);
    assert.ok(plan.totalPaid >= plan.salePrice, "toplam ödeme anaparanın altında");
    assert.ok(plan.monthlyPayment > 0, "aylık taksit 0");
    assert.ok(plan.salePrice === 12000, "salePrice = buyer cash price olmalı");
  }
});

test("composer: fiyatsız parsel → finans yok, 'Land for Sale' başlığı, finans cümlesi sızmaz", () => {
  const l = buildBuyerListing({ ...AZ, price: 0 });
  assert.equal(l.financing.length, 0);
  assert.equal(l.cashPrice, null);
  assert.match(l.title, /Land for Sale/);
  assert.ok(!/no credit check/i.test(l.description), "fiyatsızken finans cümlesi sızdı");
});

test("composer: deterministik — aynı parsel iki çağrıda birebir aynı", () => {
  assert.deepEqual(buildBuyerListing(AZ), buildBuyerListing(AZ));
});

test("konum özeti: uydurma yok — acres/koordinat verilmeyince o cümleler kurulmaz", () => {
  const s = buildLocationSummary({ ...AZ, acres: 0, lat: null, lng: null });
  assert.ok(!/\bacre/i.test(s), "acres yokken konum özetinde acre var");
  assert.match(s, /coordinates.*available on request/i);
});

test("financeHeadline: en düşük aylığı seçer, fiyatsızda null", () => {
  const l = buildBuyerListing(AZ);
  const h = financeHeadline(l.financing);
  assert.ok(h && /from \$\d/.test(h), "manşet finans etiketi yok");
  assert.equal(financeHeadline([]), null);
});

// ── SPREAD SIZINTISI İNVARYANTI (KIRMIZI ÇİZGİ) ──────────────────────────────
// Bir deal'in İÇ ekonomisini (blind-offer, spread/marj, comp market value,
// land/assessed value, grade) verip → toBuyerParcel süzgecinden geçir →
// composer'a sok → üretilen ilanın HİÇBİR yerinde bu iç sayılar/etiketler
// görünmemeli. Composer girdisi BuyerParcel olduğu için bu YAPISAL garantidir;
// test bu invaryantı kilitler (gelecekte biri composer'a UnifiedDeal geçirirse kırılır).
test("SIZINTI YOK: iç deal-ekonomisi (offer/spread/marj/comp/assessed) üretilen ilana ASLA sızmaz", () => {
  const internal = {
    id: "leak-1",
    apn: "999-00-111",
    state: "AZ",
    county: "Mohave",
    region: "Dolan Springs",
    address: "0 Pierce Ferry Rd, AZ 86441",
    acres: 2,
    lat: 35.6,
    lng: -114.27,
    // Buyer-facing sale price:
    estResale: 18000,
    // İÇ ALANLAR — bunların HİÇBİRİ ilana sızmamalı:
    estOffer: 3200, // gizli teklif
    landValue: 4100, // comp/land value
    marketValue: 21000, // assessed
    spread: 14800, // marj/kâr
    score: 87,
    dealGrade: "A",
    owner: "SECRET OWNER LLC",
    ownerState: "CA",
    absentee: true,
  } as unknown as UnifiedDeal;

  const buyer = toBuyerParcel(internal);
  const listing = buildBuyerListing(buyer);
  const blob = JSON.stringify(listing);

  // İç sayıların hiçbiri metinde geçmemeli.
  for (const secret of ["3200", "3,200", "4100", "4,100", "21000", "21,000", "14800", "14,800", "87"]) {
    assert.ok(!blob.includes(secret), `iç sayı sızdı: ${secret}`);
  }
  // İç etiketler/kimlikler de geçmemeli.
  for (const secret of ["SECRET OWNER", "spread", "marj", "estOffer", "assessed", "grade", "absentee"]) {
    assert.ok(!new RegExp(secret, "i").test(blob), `iç etiket sızdı: ${secret}`);
  }
  // Buyer-facing satış fiyatı (18000) ise görünebilir (bu sızıntı DEĞİL).
  assert.equal(listing.cashPrice, 18000);
});
