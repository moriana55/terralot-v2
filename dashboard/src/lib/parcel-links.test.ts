import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParcelLinks } from "@/lib/parcel-links";

test("lat/lng → Google Maps uydu linki üretir", () => {
  const r = buildParcelLinks({ lat: 30.1, lng: -97.5 });
  assert.equal(r.hasData, true);
  const sat = r.links.find((l) => l.kind === "satellite");
  assert.ok(sat);
  assert.match(sat!.href, /google\.com\/maps\/@30\.1,-97\.5,800m\/data=!3m1!1e3/);
  assert.equal(sat!.label, "Uydu Haritada Gör");
});

test("string lat/lng de kabul edilir", () => {
  const r = buildParcelLinks({ lat: "26.38", lng: "-80.1" });
  assert.ok(r.links.some((l) => l.kind === "satellite"));
});

test("0,0 koordinatı geçersiz sayılır (uydu linki yok)", () => {
  const r = buildParcelLinks({ lat: 0, lng: 0, apn: "123" });
  assert.ok(!r.links.some((l) => l.kind === "satellite"));
});

test("raw_url → kaynak ilan linki, http dışı reddedilir", () => {
  const ok = buildParcelLinks({ raw_url: "https://auction.example.com/x" });
  assert.ok(ok.links.some((l) => l.kind === "source"));
  const bad = buildParcelLinks({ raw_url: "javascript:alert(1)" });
  assert.ok(!bad.links.some((l) => l.kind === "source"));
});

test("apn → Regrid + Google parcel linkleri", () => {
  const r = buildParcelLinks({ apn: "R-100-200", county: "Travis", state: "TX" });
  const regrid = r.links.find((l) => l.kind === "regrid");
  const gp = r.links.find((l) => l.kind === "google_parcel");
  assert.match(regrid!.href, /app\.regrid\.com\/search\?query=R-100-200/);
  assert.match(gp!.href, /Travis/);
  assert.match(gp!.href, /TX/);
});

test("adres → koordinat yoksa Google Maps adres araması", () => {
  const noGeo = buildParcelLinks({ property_address: "123 Main St", county: "Polk", state: "FL" });
  assert.ok(noGeo.links.some((l) => l.kind === "address"));
  // koordinat varsa adres linki üretilmez (uydu yeterli)
  const withGeo = buildParcelLinks({ property_address: "123 Main St", lat: 28, lng: -81 });
  assert.ok(!withGeo.links.some((l) => l.kind === "address"));
});

test("hiç veri yoksa hasData=false, link yok", () => {
  const r = buildParcelLinks({ lat: null, lng: null, apn: null, address: null, raw_url: null });
  assert.equal(r.hasData, false);
  assert.equal(r.links.length, 0);
});
