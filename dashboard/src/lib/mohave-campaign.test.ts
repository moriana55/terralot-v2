import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCampaign, buildLetterBody, buildTop750Campaign, campaignToCsv, excludeMailed, filterRows, ownerKey,
  type MohaveRow,
} from "./mohave-campaign";

const row = (o: Partial<MohaveRow>): MohaveRow => ({
  apn: "1", owner: "OWNER", mailing_address: "1 MAIN ST", mailing_city: "LAS VEGAS",
  mailing_state: "NV", mailing_zip: "89117", acres: 1, land_value: 500,
  region: "Dolan Springs / Meadview", est_offer: 300, score: 100, ...o,
});

test("adres/zip/sahip eksik satırlar atlanır ve sayılır", () => {
  const r = filterRows([row({}), row({ mailing_address: "" }), row({ mailing_zip: " " }), row({ owner: "" })], {});
  assert.equal(r.kept.length, 1);
  assert.equal(r.skippedNoAddress, 3);
});

test("segment filtreleri: bölge, acre aralığı, land value, skor, absentee", () => {
  const rows = [
    row({ apn: "a", region: "Golden Valley" }),
    row({ apn: "b", acres: 40 }),
    row({ apn: "c", land_value: 9000 }),
    row({ apn: "d", score: 10 }),
    row({ apn: "e", mailing_state: "AZ" }),
    row({ apn: "keep" }),
  ];
  const { kept } = filterRows(rows, {
    region: "Dolan Springs / Meadview", minAcres: 0.5, maxAcres: 10,
    maxLandValue: 5000, minScore: 50, ownerScope: "absentee",
  });
  assert.deepEqual(kept.map((r) => r.apn), ["keep"]);
});

test("aynı sahip + aynı adres TEK mektupta birleşir (dedupe)", () => {
  const rows = [
    row({ apn: "1" }), row({ apn: "2", acres: 2.5 }),
    row({ apn: "3", owner: "owner", mailing_address: "1 main st" }), // case-insensitive aynı
    row({ apn: "4", owner: "BAŞKA LLC" }),
  ];
  const c = buildCampaign(rows, {});
  assert.equal(c.letters.length, 2);
  assert.equal(c.parcels, 4);
  const big = c.letters[0]; // çok parselli üstte
  assert.equal(big.parcelCount, 3);
  assert.deepEqual(big.apns, ["1", "2", "3"]);
  assert.equal(big.totalAcres, 4.5);
  assert.equal(big.totalOffer, 900);
});

test("minParcels=2 tek parselli sahipleri eler", () => {
  const rows = [row({ apn: "1" }), row({ apn: "2" }), row({ apn: "3", owner: "TEKLI" })];
  const c = buildCampaign(rows, { minParcels: 2 });
  assert.equal(c.letters.length, 1);
  assert.equal(c.parcels, 2);
});

test("CSV: Lob kolon başlıkları + virgül/tırnak escape", () => {
  const c = buildCampaign([row({ owner: 'SMITH, JOHN "JJ"' })], {});
  const csv = campaignToCsv(c.letters);
  const [head, line] = csv.trim().split("\n");
  assert.equal(head.split(",")[0], "recipient_name");
  assert.ok(head.includes("address_line1") && head.includes("address_zip"));
  assert.ok(line.startsWith('"SMITH, JOHN ""JJ"""'));
});

test("devlet/kamu sahipleri mektup listesine girmez", () => {
  const rows = [
    row({ owner: "UNITED STATES OF AMERICA", apn: "g1" }),
    row({ owner: "STATE OF ARIZONA", apn: "g2" }),
    row({ owner: "MOHAVE COUNTY", apn: "g3" }),
    row({ owner: "BOURN THOMAS L", apn: "keep" }),
  ];
  const r = buildCampaign(rows, {});
  assert.equal(r.letters.length, 1);
  assert.equal(r.letters[0].owner, "BOURN THOMAS L");
  assert.equal(r.skippedGovOwner, 3);
});

test("ownerKey: deterministik, boşluk/büyük-küçük normalize, farklı adrese farklı anahtar", () => {
  const a = { owner: "Smith John", address: "1 Main  St", city: "Vegas", state: "NV", zip: "89117" };
  const b = { owner: "SMITH JOHN", address: "1 MAIN ST", city: "vegas", state: "nv", zip: "89117" };
  const c = { owner: "SMITH JOHN", address: "2 MAIN ST", city: "VEGAS", state: "NV", zip: "89117" };
  assert.equal(ownerKey(a), ownerKey(b));
  assert.notEqual(ownerKey(a), ownerKey(c));
  assert.match(ownerKey(a), /^[0-9a-f]{8}-[0-9a-z]+$/);
});

test("excludeMailed: log'daki sahipler düşer, boş set no-op", () => {
  const c = buildCampaign([row({}), row({ owner: "YENI SAHIP" })], {});
  assert.equal(c.letters.length, 2);
  const noop = excludeMailed(c.letters, new Set());
  assert.equal(noop.kept.length, 2);
  assert.equal(noop.excluded, 0);
  const mailed = new Set([ownerKey(c.letters[0])]);
  const r = excludeMailed(c.letters, mailed);
  assert.equal(r.kept.length, 1);
  assert.equal(r.excluded, 1);
  assert.notEqual(ownerKey(r.kept[0]), ownerKey(c.letters[0]));
});

test("buildLetterBody: sahip + APN + acre + iletişim VAR, est_offer/dolar tutarı YOK", () => {
  const c = buildCampaign([row({ apn: "306-01-001" }), row({ apn: "306-01-002", acres: 2.5, est_offer: 4500 })], {});
  const body = buildLetterBody(c.letters[0], { company: "TerraLot Acquisitions", phone: "555-0100", email: "land@terralot.com" });
  assert.ok(body.includes("Dear OWNER,"));
  assert.ok(body.includes("306-01-001, 306-01-002"));
  assert.ok(body.includes("3.5 acres"));
  assert.ok(body.includes("2 parcels"));
  assert.ok(body.includes("555-0100") && body.includes("land@terralot.com"));
  // İç teklif rakamı mektuba SIZMAZ: gövdede hiç $ tutarı yok.
  assert.ok(!/\$\s*\d/.test(body));
  assert.ok(!body.includes("4800") && !body.includes("est_offer"));
});

test("CSV: avg_offmarket_score kolonu son sırada, skor yoksa 0", () => {
  const c = buildCampaign([row({})], {});
  const csv = campaignToCsv(c.letters);
  const [head, line] = csv.trim().split("\n");
  const cols = head.split(",");
  assert.equal(cols[cols.length - 1], "avg_offmarket_score");
  assert.ok(line.endsWith(",0"));
});

// ─── ⭐ "En İyi 750" reçetesi ──────────────────────────────────────────────

const scoredRow = (apn: string, opts: Partial<MohaveRow> = {}): MohaveRow => row({
  apn,
  owner: `OWNER-${apn}`,
  mailing_address: `${apn} MAIN ST`,
  ...opts,
});

test("En İyi 750: yalnız ilk N parsel (skora göre azalan) seçilir", () => {
  // 10 satır, farklı acres/land_value ile farklı offmarket_score üretir (score alanı boş bırakılır,
  // gerçek fonksiyon kendi offmarket_score'unu hesaplar — girdideki 'score' alanı kullanılmaz).
  const rows: MohaveRow[] = Array.from({ length: 10 }, (_, i) =>
    scoredRow(String(i + 1), { acres: 1.5, land_value: (i + 1) * 100, region: "Meadview / Lake Mead", mailing_state: "NJ" })
  );
  const c = buildTop750Campaign(rows, 3);
  assert.equal(c.requestedTopN, 3);
  assert.equal(c.consideredParcels, 3);
  // Düşük land_value = düşük $/acre = yüksek marj puanı → en ucuz 3 parsel seçilmeli (apn 1,2,3).
  const selectedApns = c.letters.flatMap((l) => l.apns).sort();
  assert.deepEqual(selectedApns, ["1", "2", "3"]);
});

test("En İyi 750: havuz N'den küçükse hepsi seçilir (crash yok)", () => {
  const rows: MohaveRow[] = Array.from({ length: 5 }, (_, i) => scoredRow(String(i + 1)));
  const c = buildTop750Campaign(rows, 750);
  assert.equal(c.consideredParcels, 5);
});

test("En İyi 750: dedupe etkileşimi — aynı sahip birden çok parselle top-750'de olursa mektup < parsel", () => {
  const rows: MohaveRow[] = [
    // Aynı sahip + adres, 3 parsel — hepsi top-N'e girecek kadar yüksek skorlu (küçük acre, ucuz).
    scoredRow("1", { owner: "PORTFOLIO LLC", mailing_address: "1 MAIN ST", acres: 1.5, land_value: 100 }),
    scoredRow("2", { owner: "PORTFOLIO LLC", mailing_address: "1 MAIN ST", acres: 1.5, land_value: 100 }),
    scoredRow("3", { owner: "PORTFOLIO LLC", mailing_address: "1 MAIN ST", acres: 1.5, land_value: 100 }),
    scoredRow("4", { owner: "SOLO OWNER", mailing_address: "9 SOLO ST", acres: 1.5, land_value: 100 }),
  ];
  const c = buildTop750Campaign(rows, 4);
  assert.equal(c.consideredParcels, 4);
  assert.equal(c.parcels, 4); // tüm parseller kapsanıyor
  assert.equal(c.letters.length, 2); // ama PORTFOLIO LLC tek mektupta birleşiyor → 4 parsel, 2 mektup
});

test("En İyi 750: adres eksik parsel top-N'e girse bile mektup listesine düşmez, skippedNoAddress'te sayılır", () => {
  const rows: MohaveRow[] = [
    scoredRow("1", { mailing_address: "" }), // en ucuz/en yüksek skorlu ama adressiz
    scoredRow("2", { acres: 1.5, land_value: 5000 }), // daha pahalı, ama adresli
  ];
  const c = buildTop750Campaign(rows, 2);
  assert.equal(c.consideredParcels, 2);
  assert.equal(c.skippedNoAddress, 1);
  assert.equal(c.letters.length, 1);
  assert.deepEqual(c.letters[0].apns, ["2"]);
});

test("En İyi 750: avgScore ve regionBreakdown seçilen top-N'i (dedupe öncesi) yansıtır", () => {
  const rows: MohaveRow[] = [
    scoredRow("1", { region: "Meadview / Lake Mead", acres: 1.5, land_value: 100 }),
    scoredRow("2", { region: "Yucca / Kingman G.", acres: 1.5, land_value: 100 }),
  ];
  const c = buildTop750Campaign(rows, 2);
  assert.equal(c.regionBreakdown["Meadview / Lake Mead"], 1);
  assert.equal(c.regionBreakdown["Yucca / Kingman G."], 1);
  assert.ok(c.avgScore > 0 && c.avgScore <= 100);
});

test("buildLetterBody: 12+ APN kısaltılır (+N more), tek parselde tekil dil", () => {
  const rows = Array.from({ length: 15 }, (_, i) => row({ apn: `APN-${i + 1}` }));
  const c = buildCampaign(rows, {});
  const body = buildLetterBody(c.letters[0], { company: "TerraLot" });
  assert.ok(body.includes("(+3 more)"));
  assert.ok(!body.includes("APN-13,")); // 13. ve sonrası listelenmez
  const single = buildCampaign([row({})], {});
  const sbody = buildLetterBody(single.letters[0], { company: "TerraLot" });
  assert.ok(sbody.includes("1 parcel ")); // "parcels" değil
  assert.ok(sbody.includes("your parcel"));
});
