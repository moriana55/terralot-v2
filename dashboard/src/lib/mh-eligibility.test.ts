import { test } from "node:test";
import assert from "node:assert/strict";
import { mhEligibility, mhMailLine, MH_MAIL_LINE } from "@/lib/mh-eligibility";

// ── 1) Kod doğrudan MH diyor → likely (bölgeden bağımsız) ─────────────────────
test("MH kullanım kodu → likely (Mohave 0083-VL-MH)", () => {
  const r = mhEligibility({ useCode: "0083-VL-MH-RURAL-SUBDIVI", acres: 1.1, state: "AZ", county: "Mohave" });
  assert.equal(r.status, "likely");
  assert.match(r.reason, /teyit/); // dürüstlük şerhi her zaman var
});

test("MOBILE HOME kodu (Dallas DCAD) → likely", () => {
  const r = mhEligibility({ useCode: "MOBILE HOME ON OWNERS LAND", acres: 0.3, state: "TX", county: "Dallas" });
  assert.equal(r.status, "likely");
});

// ── 2) Konut-dışı sınıflar → unlikely ─────────────────────────────────────────
test("commercial/industrial/ortak alan → unlikely", () => {
  for (const code of [
    "COMMERCIAL - VACANT PLOTTED LOTS/TRACTS",
    "INDUSTRIAL - VACANT PLOTTED LOTS/TRACTS",
    "0251-PUD CA PRIV ROAD, Q",
    "0261-PUD CA OPEN SPACE,",
    "9500-STATE VACANT LAND",
    "9400-FEDERAL VACANT LAND",
    "8800-LTD USE WELL/TWR/PR",
    "6600-NON-PRODUC MINE CO",
  ]) {
    assert.equal(mhEligibility({ useCode: code, acres: 2, state: "AZ", county: "Mohave" }).status, "unlikely", code);
  }
});

// ── 3) MH-dostu bölge (Mohave city/county eşleşmesi) ──────────────────────────
test("Mohave kırsal VL-UNDET + yeterli acre → likely", () => {
  const r = mhEligibility({
    useCode: "0003-VL-UNDET-RURAL-SUBD", acres: 2.49,
    state: "AZ", county: "Mohave", region: "Dolan Springs / Meadview",
  });
  assert.equal(r.status, "likely");
  assert.match(r.reason, /teyit/);
});

test("Mohave ranch property → likely", () => {
  const r = mhEligibility({ useCode: "4710-RANCH PROPERTY", acres: 38, state: "AZ", county: "Mohave" });
  assert.equal(r.status, "likely");
});

test("küçük lot (<0.5 acre) likely'yi verify'a düşürür", () => {
  const r = mhEligibility({ useCode: "0013-VL-RES-RURAL-SUBDIV", acres: 0.2, state: "AZ", county: "Mohave" });
  assert.equal(r.status, "verify");
  assert.match(r.reason, /küçük/);
});

test("şehir-içi subdivision (URB) MH-dostu bölgede bile verify", () => {
  const r = mhEligibility({ useCode: "0011-VL-RES-URBAN SUBDIV", acres: 1, state: "AZ", county: "Mohave" });
  assert.equal(r.status, "verify");
});

// ── 4) Eyalet-geneli genelleme → asla likely değil ────────────────────────────
test("FL state fallback (mobile-home listede ama genelleme) → verify", () => {
  const r = mhEligibility({ useCode: "", acres: 1, state: "FL", county: "Bilinmeyen" });
  assert.equal(r.status, "verify");
});

test("FL platted (Jackson county eşleşmesi) → likely", () => {
  const r = mhEligibility({ useCode: "", acres: 1, state: "FL", county: "Jackson", region: "Compass Lake" });
  assert.equal(r.status, "likely");
});

// ── 5) MH-dostu olmayan / bilinmeyen bölgeler ─────────────────────────────────
test("Coconino (playbook'ta mobile-home yok) → verify", () => {
  const r = mhEligibility({ useCode: "", acres: 2, state: "AZ", county: "Coconino", region: "Williams" });
  assert.equal(r.status, "verify");
});

test("hiç sinyal yok (kod yok + bölge tanınmıyor) → null", () => {
  const r = mhEligibility({ useCode: "", acres: 1, state: "", county: "", region: "" });
  assert.equal(r.status, null);
});

test("Dallas SFR vacant (TX state fallback, MH listede yok) → verify", () => {
  const r = mhEligibility({ useCode: "SFR - VACANT LOTS/TRACTS", acres: 0.17, state: "TX", county: "Dallas" });
  assert.equal(r.status, "verify");
});

// ── 6) Vaat güvenliği: hiçbir gerekçe blanket "yasaldır" demez ────────────────
test("likely gerekçeleri bile teyit şerhi taşır", () => {
  const cases = [
    mhEligibility({ useCode: "0083-VL-MH-RURAL-SUBDIVI", acres: 1, state: "AZ", county: "Mohave" }),
    mhEligibility({ useCode: "0003-VL-UNDET-RURAL-SUBD", acres: 2, state: "AZ", county: "Mohave" }),
    mhEligibility({ useCode: "", acres: 1, state: "FL", county: "Jackson", region: "Alford" }),
  ];
  for (const r of cases) {
    assert.equal(r.status, "likely");
    assert.match(r.reason, /teyit/i);
  }
});

// ── 7) mhMailLine — mektup/deal-sheet satış kozu satırı ───────────────────────
test("mhMailLine: SADECE likely satır üretir; verify/unlikely/null → null", () => {
  assert.equal(mhMailLine("likely"), MH_MAIL_LINE);
  assert.equal(mhMailLine("verify"), null);
  assert.equal(mhMailLine("unlikely"), null);
  assert.equal(mhMailLine(null), null);
  assert.equal(mhMailLine(undefined), null);
});

test("mhMailLine: satır county teyit şerhini İÇİNDE taşır, blanket vaat yok", () => {
  const line = mhMailLine("likely")!;
  assert.match(line, /buyer to verify .* with the county/i);
  assert.match(line, /may accommodate/i); // "may" — kesinlik iddiası değil
  assert.doesNotMatch(line, /\bguaranteed\b|\bis legal\b|\bis zoned\b/i);
  // Lob merge var şeması value'yu 500 karakterle sınırlar — satır sığmalı.
  assert.ok(line.length <= 500);
});

test("mhMailLine: gerçek uçtan uca — Mohave likely → satır, Coconino verify → yok", () => {
  const likely = mhEligibility({ useCode: "0003-VL-UNDET-RURAL-SUBD", acres: 2, state: "AZ", county: "Mohave" });
  assert.equal(typeof mhMailLine(likely.status), "string");
  const verify = mhEligibility({ useCode: "", acres: 2, state: "AZ", county: "Coconino" });
  assert.equal(mhMailLine(verify.status), null);
});
