import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListingCopy } from "@/lib/listing-copy";
import { regionPlaybook } from "@/lib/region-playbook";

const wordCount = (s: string) => s.trim().split(/\s+/).length;
// Her ilan dürüst zoning/teyit şerhi taşımalı (KIRMIZI ÇİZGİ — region-playbook ile aynı).
const CONFIRM = /confirm zoning|permitted use|county/i;

test("AZ Mohave (off-grid/RV) → off-grid açısı + dürüst teyit şerhi, finans yokken finans satırı YOK", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave", region: "Golden Valley" });
  const copy = buildListingCopy({ acres: 1.25, county: "Mohave", state: "AZ", nearestCity: "Golden Valley" }, pb);
  assert.match(copy.title, /Golden Valley, AZ/);
  assert.match(copy.title, /Land for Sale/); // finans yok → owner-financing başlığı yok
  assert.match(copy.description, /off-grid/i);
  assert.ok(CONFIRM.test(copy.description), "dürüst teyit şerhi yok");
  // finans yokken UYDURMA finans satırı çıkmamalı
  assert.ok(!/down|\/month|\/mo|no credit check/i.test(copy.description), "finans yokken finans cümlesi sızdı");
  assert.ok(!copy.bullets.some((b) => /financing|down|\/mo/i.test(b)), "finans yokken finans bullet sızdı");
});

test("FL platted (mobile/modular) → RV-living kısıtı dürüstçe belirtilir", () => {
  const pb = regionPlaybook({ state: "FL", county: "Jackson", region: "Compass Lake" });
  const copy = buildListingCopy({ acres: 0.5, county: "Jackson", state: "FL", nearestCity: "Compass Lake" }, pb);
  assert.match(copy.description, /mobile, modular, or site-built/i);
  assert.match(copy.description, /RV living is restricted/i);
  assert.ok(CONFIRM.test(copy.description));
});

test("finans verisi VARSA $X down / $Y/mo / no credit check satırı çıkar", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave" });
  const copy = buildListingCopy(
    { acres: 2, county: "Mohave", state: "AZ", marketValue: 30000 },
    pb,
    { down: 3000, monthly: 546, termMonths: 60, cashPrice: 30000 },
  );
  assert.match(copy.title, /Owner Financing, \$3,000 Down/);
  assert.match(copy.description, /no credit check/i);
  assert.match(copy.description, /\$546\/month/);
  assert.ok(copy.bullets.some((b) => /Owner financing: \$3,000 down, \$546\/mo/.test(b)));
});

test("UYDURMA YOK: acres null ise 'X Acres' ifadesi kurulmaz", () => {
  const pb = regionPlaybook({ state: "TX", county: "Harris" });
  const copy = buildListingCopy({ acres: null, county: "Harris", state: "TX" }, pb);
  assert.ok(!/\bacre/i.test(copy.title), "acres yokken başlıkta acre var");
  assert.ok(!copy.bullets.some((b) => /\bacre/i.test(b)), "acres yokken bullet'ta acre var");
});

test("description hedef uzunluk bandında (~100-130 kelime esnek, 40-170 aralığı)", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave", region: "Golden Valley" });
  const copy = buildListingCopy(
    { acres: 1.25, county: "Mohave", state: "AZ", nearestCity: "Golden Valley", nearestRoad: "Oatman Hwy", marketValue: 12000 },
    pb,
    { down: 1200, monthly: 210, termMonths: 60, cashPrice: 12000 },
  );
  const wc = wordCount(copy.description);
  assert.ok(wc >= 40 && wc <= 170, `description kelime sayısı band dışı: ${wc}`);
});

test("deterministik: aynı girdi → aynı çıktı", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave" });
  const a = buildListingCopy({ acres: 5, county: "Mohave", state: "AZ" }, pb);
  const b = buildListingCopy({ acres: 5, county: "Mohave", state: "AZ" }, pb);
  assert.deepEqual(a, b);
});

test("default (bilinmeyen bölge) → güvenli 'not yet verified' şerhi", () => {
  const pb = regionPlaybook({});
  const copy = buildListingCopy({ acres: 3 }, pb);
  assert.match(copy.description, /not yet verified/i);
  assert.ok(CONFIRM.test(copy.description));
});

test("ÇEŞİTLİLİK: farklı parseller farklı açılış cümlesi/başlık son eki alabilir (şablon kokmaz)", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave" });
  // Farklı county/acres kombinasyonları → tohum değişir → varyant havuzu gezilir.
  const inputs = [
    { acres: 1.25, county: "Mohave", state: "AZ" },
    { acres: 5, county: "Apache", state: "AZ" },
    { acres: 0.5, county: "Cochise", state: "AZ" },
    { acres: 10, county: "Navajo", state: "AZ" },
    { acres: 2.5, county: "Yavapai", state: "AZ" },
    { acres: 40, county: "Gila", state: "AZ" },
  ];
  const openers = new Set(inputs.map((s) => buildListingCopy(s, pb).description.split(/(?<=\.)\s/)[0]));
  // En az iki farklı açılış cümlesi görülmeli (deterministik ama tek-kalıp değil).
  assert.ok(openers.size >= 2, `açılış çeşitliliği yok: ${openers.size}`);
});

test("ÇEŞİTLİLİK deterministik kalır: aynı parsel iki çağrıda birebir aynı", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave", region: "Golden Valley" });
  const s = { acres: 1.25, county: "Mohave", state: "AZ", nearestCity: "Golden Valley", situs: "123 Desert Rd" };
  assert.deepEqual(buildListingCopy(s, pb), buildListingCopy(s, pb));
});

test("başlık son eki hangi varyant olursa olsun 'Land for Sale' içerir (finans yokken)", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave" });
  for (const county of ["Mohave", "Apache", "Cochise", "Navajo", "Yavapai", "Gila", "Pima", "Pinal"]) {
    const copy = buildListingCopy({ acres: 3, county, state: "AZ" }, pb);
    assert.match(copy.title, /Land for Sale/, `başlık 'Land for Sale' içermiyor: ${copy.title}`);
  }
});

test("DÜRÜSTLÜK: değer bullet'ı 'assessed, not market' diyerek assessed'ı market gibi göstermez", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave" });
  const copy = buildListingCopy({ acres: 2, county: "Mohave", state: "AZ", marketValue: 30000 }, pb);
  const valueBullet = copy.bullets.find((b) => b.includes("30,000"));
  assert.ok(valueBullet, "değer bullet'ı yok");
  assert.match(valueBullet!, /assessed/i);
  assert.ok(!/^Assessed\/market value/.test(valueBullet!), "assessed hâlâ 'market value' diye etiketleniyor");
});
