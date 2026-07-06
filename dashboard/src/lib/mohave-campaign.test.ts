import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCampaign, campaignToCsv, filterRows, type MohaveRow } from "./mohave-campaign";

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
