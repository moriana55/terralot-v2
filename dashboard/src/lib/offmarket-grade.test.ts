// Arsa not motoru testleri (saf, DB/ağ yok).
// Motor: scraper/lib/grade-core.mjs (dashboard dışı — relatif import, node --test çalıştırır).
// Görüntü yardımcıları: ./offmarket-grade.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGovOwner, isEstateOwner, detectPoa, acresPoints, geoPoints,
  scoreLead, gradeThresholds, assignGrade,
} from "../../../scraper/lib/grade-core.mjs";
import { gradeColor, parseFlags, splitFlags, GRADE_COLORS } from "./offmarket-grade.ts";

const CTX = {
  liquidity: new Map([["AZ|MOHAVE", { n: 5, medPpa: 4000 }]]),
  stateLiq: new Map([["AZ", { n: 12, medPpa: 4000 }], ["MO", { n: 4, medPpa: 8000 }]]),
  growth: new Map([["AZ|MOHAVE", { g5: 0.06, g1: 0.01, pop: 220000 }]]),
  ownerCluster: new Map([["SMITH JOHN|PO BOX 1", 7]]),
  taxDelinq: new Set(["TX|APN|12345"]),
};

test("isGovOwner: kamu kalıpları yakalanır, normal sahip yakalanmaz", () => {
  assert.equal(isGovOwner("UNITED STATES OF AMERICA"), true);
  assert.equal(isGovOwner("State of Arizona"), true);
  assert.equal(isGovOwner("MOHAVE COUNTY OF"), true);
  assert.equal(isGovOwner("BUREAU OF LAND MANAGEMENT"), true);
  assert.equal(isGovOwner("SMITH JOHN"), false);
  assert.equal(isGovOwner(null), false);
});

test("isEstateOwner: miras/trust kalıpları", () => {
  assert.equal(isEstateOwner("DOE JANE EST OF"), true);
  assert.equal(isEstateOwner("SMITH FAMILY TRUST"), true);
  assert.equal(isEstateOwner("JOHNSON HEIRS"), true);
  assert.equal(isEstateOwner("SMITH JOHN"), false);
});

test("detectPoa: situs=GÜÇLÜ, region=bölgesel risk, yoksa null", () => {
  assert.deepEqual(
    detectPoa({ state: "NV", county: "Nye", region: "x", situs: "123 CALVADA BLVD" }),
    { level: "strong", name: "CALVADA" }
  );
  assert.deepEqual(
    detectPoa({ state: "NV", county: "Nye", region: "Nye County, NV (Pahrump/Calvada)", situs: "" }),
    { level: "region", name: "CALVADA" }
  );
  assert.equal(detectPoa({ state: "TX", county: "Bosque", region: "Bosque County", situs: "CR 100" }), null);
  // AR POA üçlüsü region'dan
  assert.equal(detectPoa({ state: "AR", county: "Izard", region: "HORSESHOE BEND AREA", situs: "" })?.name, "HORSESHOE BEND");
});

test("acresPoints: 1-10 sweet spot tam puan, mikro parsel sert ceza", () => {
  assert.equal(acresPoints(5).pts, 10);
  assert.equal(acresPoints(0.1).pts, 0);
  assert.match(acresPoints(0.1).flag ?? "", /mikro/);
  assert.equal(acresPoints(80).pts, 3);
  assert.equal(acresPoints(null).pts, 0);
});

test("geoPoints: yol yoksa landlocked, yakın mesafeler puanlar", () => {
  const g = geoPoints({ dist_road_m: 50, dist_power_m: 100, dist_water_m: 200, dist_town_m: 5000 });
  assert.equal(g.pts, 12 + 8 + 6 + 4); // tam cazibe
  assert.equal(g.landlocked, false);
  const ll = geoPoints({ dist_road_m: -1, dist_power_m: -1, dist_water_m: -1, dist_town_m: -1 });
  assert.equal(ll.landlocked, true);
  // taranmamış (null) → puan yok ama landlocked de değil
  const un = geoPoints({});
  assert.equal(un.pts, 0);
  assert.equal(un.landlocked, false);
});

test("scoreLead: kamu sahibi doğrudan F", () => {
  const r = scoreLead({ owner: "STATE OF NEVADA", state: "NV" }, CTX);
  assert.equal(r.grade_cap, "F");
});

test("scoreLead: geo taranmamış kayıt B tavanına takılır (A+/A yalnız geo-doğrulu)", () => {
  const r = scoreLead(
    { owner: "SMITH JOHN", state: "AZ", county: "Mohave (kırsal)", acres: 5, est_retail: 20000, est_offer: 5000, absentee: true },
    CTX
  );
  assert.equal(r.grade_cap, "B");
  assert.ok(r.flags.some((f: string) => /geo doğrulaması bekliyor/.test(f)));
});

test("scoreLead: net marj $5K altı (bilinen değer) C tavanı; landlocked F", () => {
  const low = scoreLead(
    { owner: "SMITH JOHN", state: "AZ", county: "Mohave", acres: 5, est_retail: 8000, est_offer: 3000, dist_road_m: 50 },
    CTX
  );
  // net = 8000-3000-2000 = 3000 < 5000 → C tavanı
  assert.equal(low.grade_cap, "C");
  const ll = scoreLead(
    { owner: "SMITH JOHN", state: "AZ", county: "Mohave", acres: 5, est_retail: 90000, est_offer: 3000, dist_road_m: -1 },
    CTX
  );
  assert.equal(ll.grade_cap, "F");
});

test("scoreLead: motivasyon bonusları bayraklanır (küme + vergi + miras)", () => {
  const r = scoreLead(
    { owner: "SMITH JOHN", mailing_address: "PO BOX 1", state: "TX", county: "Bosque", apn: "12345", acres: 5, est_retail: 30000, est_offer: 8000, dist_road_m: 80 },
    CTX
  );
  assert.ok(r.flags.some((f: string) => /toplu anlaşma: aynı sahipte 7 parsel/.test(f)));
  assert.ok(r.flags.some((f: string) => /vergi borçlusu/.test(f)));
});

test("scoreLead: değer verisi yoksa comp'tan TAHMİN bayraklanır, comp da yoksa nötr", () => {
  const est = scoreLead({ owner: "A B", state: "MO", county: "Camden", acres: 2, dist_road_m: 90 }, CTX);
  assert.ok(est.flags.some((f: string) => /değer TAHMİNİ/.test(f)));
  const none = scoreLead({ owner: "A B", state: "SC", county: "Colleton", acres: 2, dist_road_m: 90 }, CTX);
  assert.ok(none.flags.some((f: string) => /değer verisi eksik/.test(f)));
});

test("gradeThresholds + assignGrade: dağılım sabit (~%1 A+, ~%5 A+A), cap uygulanır", () => {
  const scores = Array.from({ length: 1000 }, (_, i) => i / 10); // 0..99.9 düzgün
  const th = gradeThresholds(scores)!;
  let aPlus = 0, aOrBetter = 0;
  for (const s of scores) {
    const g = assignGrade(s, th);
    if (g === "A+") aPlus++;
    if (g === "A+" || g === "A") aOrBetter++;
  }
  assert.ok(aPlus >= 5 && aPlus <= 15, `A+ ~%1 olmalı, çıkan: ${aPlus}`);
  assert.ok(aOrBetter >= 40 && aOrBetter <= 60, `A+A ~%5 olmalı, çıkan: ${aOrBetter}`);
  // tavanlar
  assert.equal(assignGrade(99, th, "F"), "F");
  assert.equal(assignGrade(99, th, "B"), "B");
  assert.equal(assignGrade(99, th, "C"), "C");
  assert.equal(assignGrade(1, th, "B"), "F"); // tavan yükseltmez, sadece sınırlar
});

test("görüntü yardımcıları: renk fallback + bayrak ayrıştırma", () => {
  assert.equal(gradeColor("A+"), GRADE_COLORS["A+"]);
  assert.equal(gradeColor(null), "#64748b");
  assert.deepEqual(parseFlags(["a", 3, "b"]), ["a", "b"]);
  assert.deepEqual(parseFlags("x"), []);
  const s = splitFlags(["🛣 yol ~50 m", "absentee sahip", "⚡ elektrik ~100 m"]);
  assert.deepEqual(s.appeal, ["🛣 yol ~50 m", "⚡ elektrik ~100 m"]);
  assert.deepEqual(s.other, ["absentee sahip"]);
});
