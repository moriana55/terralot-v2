import { test } from "node:test";
import assert from "node:assert/strict";
import { regionPlaybook, ALL_PLAYBOOK_ENTRIES, formatPlaybookLine } from "@/lib/region-playbook";

// ─────────────────────────────────────────────────────────────────────────────
// KIRMIZI ÇİZGİ — her zoningNote "teyit alıcıda / county'den doğrula" şerhi
// taşımalı; ASLA blanket hukuki vaat ("RV yasaldır" gibi) vermemeli.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIRM = /teyit|doğrula|doğrulan|county/i;

test("KIRMIZI ÇİZGİ: her tanımlı entry'nin zoningNote'u teyit şerhi taşır", () => {
  for (const e of ALL_PLAYBOOK_ENTRIES) {
    assert.ok(
      CONFIRM.test(e.zoningNote),
      `zoningNote teyit şerhi taşımıyor: ${e.region} → "${e.zoningNote}"`
    );
  }
});

test("KIRMIZI ÇİZGİ: hiçbir entry blanket 'RV yasaldır' vaadi vermez", () => {
  const BLANKET = /\bRV('?[a-zçğıöşü]*)?\s+yasal(dır|dir)?\b/i;
  for (const e of ALL_PLAYBOOK_ENTRIES) {
    assert.ok(!BLANKET.test(e.zoningNote), `blanket vaat: ${e.region}`);
    assert.ok(!BLANKET.test(e.salesAngle), `blanket vaat (pitch): ${e.region}`);
  }
});

test("default (bilinmeyen): güvenli uyarı + low confidence + matchBasis default", () => {
  const pb = regionPlaybook({});
  assert.equal(pb.matchBasis, "default");
  assert.equal(pb.confidence, "low");
  assert.ok(CONFIRM.test(pb.zoningNote));
});

test("AZ Mohave şehir (Golden Valley) → off-grid/RV açısı, city match, high confidence", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave", region: "Golden Valley" });
  assert.equal(pb.matchBasis, "city");
  assert.equal(pb.confidence, "high");
  assert.ok(pb.allowedUses.includes("off-grid"));
  assert.ok(pb.allowedUses.includes("rv"));
  // RV süresi teyide bağlı — blanket vaat değil
  assert.ok(/RV/i.test(pb.zoningNote) && CONFIRM.test(pb.zoningNote));
});

test("AZ Mohave şehir adresten (situs) çıkarılır (region boş olsa bile)", () => {
  const pb = regionPlaybook({ address: "123 N DESERT RD, MEADVIEW, AZ 86444" });
  assert.equal(pb.matchBasis, "city");
  assert.ok(pb.allowedUses.includes("off-grid"));
});

test("AZ Mohave county (şehir yok) → county match, medium confidence", () => {
  const pb = regionPlaybook({ state: "AZ", county: "Mohave County" });
  assert.equal(pb.matchBasis, "county");
  assert.equal(pb.confidence, "medium");
  assert.ok(pb.allowedUses.includes("off-grid"));
});

test("FL platted (Compass Lake / Jackson) → ev-lotu açısı + RV-oturma yasağı uyarısı", () => {
  const pb = regionPlaybook({ state: "FL", county: "Jackson", region: "Compass Lake" });
  assert.equal(pb.matchBasis, "city");
  assert.ok(pb.allowedUses.includes("site-built") || pb.allowedUses.includes("mobile-home"));
  // RV'de sürekli oturma yasağı + POA/deed restriction uyarısı
  assert.ok(/RV/i.test(pb.zoningNote));
  assert.ok(/POA|deed|restrict|kısıt/i.test(pb.zoningNote));
  assert.ok(CONFIRM.test(pb.zoningNote));
});

test("FL genel (county/şehir bilinmiyor) → state fallback, RV uyarısı taşır", () => {
  const pb = regionPlaybook({ state: "FL" });
  assert.ok(["state"].includes(pb.matchBasis));
  assert.ok(CONFIRM.test(pb.zoningNote));
});

test("installment-friendly eyaletler fallback verir (TX/NM/CO/AZ/FL)", () => {
  for (const st of ["TX", "NM", "CO", "AZ", "FL"]) {
    const pb = regionPlaybook({ state: st });
    assert.notEqual(pb.matchBasis, "default", `${st} için fallback bekleniyordu`);
    assert.ok(CONFIRM.test(pb.zoningNote), `${st} zoningNote teyit taşımıyor`);
  }
});

test("NY → taksitli satış UYARISI (installment önerilmez)", () => {
  const pb = regionPlaybook({ state: "New York" });
  assert.ok(/NY|installment|taksit/i.test(pb.zoningNote + " " + (pb.installmentNote ?? "")));
  assert.ok(/yapma|önerilmez|kaçın|risk/i.test((pb.installmentNote ?? "") + pb.zoningNote));
});

test("eyalet tam ad → kısaltmaya normalize (Arizona → AZ eşleşir)", () => {
  const pb = regionPlaybook({ state: "Arizona", county: "Mohave" });
  assert.equal(pb.matchBasis, "county");
});

test("şehir state uyumsuzsa yanlış eşleşmez (Williams ama state TX → AZ Williams'a düşmez)", () => {
  const pb = regionPlaybook({ state: "TX", region: "Williams" });
  // TX state fallback'e düşmeli, AZ-city 'williams' eşleşmesine DEĞİL
  assert.notEqual(pb.matchBasis, "city");
});

test("formatPlaybookLine: tek satır pitch + ⚠ zoning üretir, boş değil", () => {
  const pb = regionPlaybook({ state: "AZ", region: "Topock" });
  const line = formatPlaybookLine(pb);
  assert.ok(line.includes("⚠"));
  assert.ok(line.length > 10);
});

test("saf/deterministik: aynı girdi → aynı çıktı", () => {
  const a = regionPlaybook({ state: "AZ", county: "Mohave", region: "Dolan Springs" });
  const b = regionPlaybook({ state: "AZ", county: "Mohave", region: "Dolan Springs" });
  assert.deepEqual(a, b);
});
