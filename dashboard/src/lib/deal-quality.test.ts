import { test } from "node:test";
import assert from "node:assert/strict";
import { valuationMismatch, dealGrade } from "@/lib/deal-quality";

test("valuationMismatch: assessed >>4x comp → true (urban lot, rural comp)", () => {
  // Dallas $431,640 assessed vs $6,424 rural comp → mismatch
  assert.equal(valuationMismatch(6424, 431640), true);
});

test("valuationMismatch: comp in line with assessed → false", () => {
  assert.equal(valuationMismatch(5000, 4000), false);
  assert.equal(valuationMismatch(12000, 4000), false); // exactly 3x, allowed
});

test("valuationMismatch: no comp → false (handled elsewhere)", () => {
  assert.equal(valuationMismatch(null, 50000), false);
});

test("dealGrade: null when no comp or mismatch (no fabrication)", () => {
  assert.equal(dealGrade({ marketValue: null, mismatch: false, absentee: true, acres: 2, mailSafe: true, assessed: 1000 }), null);
  assert.equal(dealGrade({ marketValue: 9000, mismatch: true, absentee: true, acres: 2, mailSafe: true, assessed: 1000 }), null);
});

test("dealGrade: A for strong absentee + ideal size + comp>assessed + mailSafe", () => {
  assert.equal(dealGrade({ marketValue: 9000, mismatch: false, absentee: true, acres: 2, mailSafe: true, assessed: 5000 }), "A");
});

test("dealGrade: C for weak signals", () => {
  // not absentee, big parcel, low comp confidence, comp<assessed → 0 pts → C
  assert.equal(dealGrade({ marketValue: 4000, mismatch: false, absentee: false, acres: 40, mailSafe: false, assessed: 9000 }), "C");
});

test("dealGrade: B mid-band (absentee + mailSafe = 3 pts)", () => {
  assert.equal(dealGrade({ marketValue: 4000, mismatch: false, absentee: true, acres: 40, mailSafe: true, assessed: 9000 }), "B");
});

test("dealGrade: absentee alone (2 pts) → C", () => {
  assert.equal(dealGrade({ marketValue: 4000, mismatch: false, absentee: true, acres: 40, mailSafe: false, assessed: 9000 }), "C");
});
