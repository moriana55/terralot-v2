// geo-proximity testleri (pure, no DB/network). Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceMiles, nearestRef, geocodeApprox } from "./geo-proximity.ts";

test("distanceMiles: aynı nokta = 0", () => {
  assert.equal(Math.round(distanceMiles(36, -114, 36, -114)), 0);
});

test("distanceMiles: Kingman→Lake Havasu City ~ 45-60 mi aralığı", () => {
  const d = distanceMiles(35.189, -114.053, 34.484, -114.322);
  assert.ok(d > 40 && d < 60, `beklenen ~50mi, gelen ${d.toFixed(1)}`);
});

test("geocodeApprox: county=Meadview → Meadview, approx=true", () => {
  const g = geocodeApprox("Arizona", "Meadview", "1 acre in Meadview, AZ");
  assert.ok(g && g.matched === "Meadview" && g.approx === true);
});

test("geocodeApprox: title'dan Golden Valley yakalanır (county Mohave olsa da)", () => {
  const g = geocodeApprox("Arizona", "Mohave", "1.95 acres of land in Golden Valley, Arizona");
  assert.equal(g?.matched, "Golden Valley");
});

test("geocodeApprox: en uzun-isim önce — 'Lake Havasu City'", () => {
  const g = geocodeApprox("Arizona", "Lake Havasu City", "lot in lake havasu city");
  assert.equal(g?.matched, "Lake Havasu City");
});

test("geocodeApprox: county-only 'Mohave' → Kingman fallback", () => {
  const g = geocodeApprox("Arizona", "Mohave", "vacant land");
  assert.ok(g && /Mohave/.test(g.matched));
});

test("geocodeApprox: bilinmeyen bölge → null", () => {
  assert.equal(geocodeApprox("Ohio", "Franklin", "lot in columbus"), null);
});

test("nearestRef: Meadview yakınında en yakın su = Lake Mead", () => {
  const r = nearestRef(36.0, -114.07, "water");
  assert.equal(r?.name, "Lake Mead");
});

test("nearestRef: Golden Valley yakınında en yakın şehir = Golden Valley", () => {
  const r = nearestRef(35.213, -114.222, "city");
  assert.equal(r?.name, "Golden Valley");
});
