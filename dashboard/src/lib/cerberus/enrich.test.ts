// Pure parsing/normalization tests for each enrichment adapter (mocked JSON).
// No network — every test feeds a hand-built API payload to the parser.
// Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCensusGeocode } from "./sources/census-geocoder.ts";
import { parseFemaFlood, scoreFloodZone } from "./sources/fema-flood.ts";
import { parseUsgsElevation } from "./sources/usgs-elevation.ts";
import { parseOverpassNearestRoad, classifyAccess } from "./sources/osm-overpass.ts";
import { parseAcsRow, computeGrowth } from "./sources/census-acs.ts";
import { parseRegridParcel, parseAttomProperty } from "./sources/paid.ts";

// ── Census Geocoder ──────────────────────────────────────────────────────────
test("census geocoder: lat/lng + FIPS + tract çıkar", () => {
  const json = {
    result: {
      addressMatches: [
        {
          matchedAddress: "1 MAIN ST, RIO GRANDE CITY, TX, 78582",
          coordinates: { x: -98.82, y: 26.38 },
          geographies: {
            "Census Tracts": [{ STATE: "48", COUNTY: "427", TRACT: "950100" }],
          },
        },
      ],
    },
  };
  const g = parseCensusGeocode(json);
  assert.ok(g);
  assert.equal(g!.lat, 26.38);
  assert.equal(g!.lng, -98.82);
  assert.equal(g!.stateFips, "48");
  assert.equal(g!.countyFips, "427");
  assert.equal(g!.tract, "950100");
});

test("census geocoder: eşleşme yoksa null", () => {
  assert.equal(parseCensusGeocode({ result: { addressMatches: [] } }), null);
  assert.equal(parseCensusGeocode({}), null);
  assert.equal(parseCensusGeocode(null), null);
});

test("census geocoder: FIPS sıfır-doldurma (1-2-3 hane)", () => {
  const g = parseCensusGeocode({
    result: { addressMatches: [{ coordinates: { x: -100, y: 40 }, geographies: { "Census Tracts": [{ STATE: "6", COUNTY: "7", TRACT: "100" }] } }] },
  });
  assert.equal(g!.stateFips, "06");
  assert.equal(g!.countyFips, "007");
  assert.equal(g!.tract, "000100");
});

// ── FEMA flood ───────────────────────────────────────────────────────────────
test("fema: AE bölgesi → SFHA + yüksek skor", () => {
  const info = parseFemaFlood({ features: [{ attributes: { FLD_ZONE: "AE" } }] });
  assert.ok(info);
  assert.equal(info!.zone, "AE");
  assert.equal(info!.sfha, true);
  assert.equal(info!.floodScore, 85);
});

test("fema: kesişen poligon yok → ≈X (düşük risk)", () => {
  const info = parseFemaFlood({ features: [] });
  assert.equal(info!.zone, "X");
  assert.equal(info!.sfha, false);
  assert.equal(info!.floodScore, 10);
});

test("fema: V/VE en yüksek, X minimal, D belirsiz", () => {
  assert.equal(scoreFloodZone("VE").floodScore, 95);
  assert.equal(scoreFloodZone("X").floodScore, 10);
  assert.equal(scoreFloodZone("D").floodScore, null); // belirsiz → null
  assert.equal(parseFemaFlood({}), null); // malformed
});

// ── USGS elevation ───────────────────────────────────────────────────────────
test("usgs: v1 value → feet + meters", () => {
  const e = parseUsgsElevation({ value: 1000 });
  assert.equal(e!.feet, 1000);
  assert.equal(e!.meters, 305); // 1000 * 0.3048 ≈ 304.8
});

test("usgs: legacy şekil + no-data sentinel", () => {
  const legacy = parseUsgsElevation({ USGS_Elevation_Point_Query_Service: { Elevation_Query: { Elevation: 50 } } });
  assert.equal(legacy!.feet, 50);
  assert.equal(parseUsgsElevation({ value: -1000000 }), null);
  assert.equal(parseUsgsElevation({}), null);
});

// ── OSM Overpass road access ─────────────────────────────────────────────────
test("overpass: en yakın yol mesafesi + access sınıfı", () => {
  // Two ways; nearest within ~50m → "direct".
  const json = {
    elements: [
      { type: "way", center: { lat: 26.3805, lon: -98.82 }, tags: { highway: "residential", name: "Main St" } },
      { type: "way", center: { lat: 26.39, lon: -98.83 }, tags: { highway: "track" } },
    ],
  };
  const info = parseOverpassNearestRoad(json, 26.38, -98.82);
  assert.ok(info.nearestRoadMeters != null && info.nearestRoadMeters < 100);
  assert.equal(info.access, "direct");
  assert.equal(info.roadName, "Main St");
});

test("overpass: hiç element yok → landlocked", () => {
  const info = parseOverpassNearestRoad({ elements: [] }, 26.38, -98.82);
  assert.equal(info.nearestRoadMeters, null);
  assert.equal(info.access, "landlocked");
});

test("overpass: classifyAccess bantları", () => {
  assert.equal(classifyAccess(null), "landlocked");
  assert.equal(classifyAccess(30), "direct");
  assert.equal(classifyAccess(400), "near");
  assert.equal(classifyAccess(5000), "landlocked");
});

// ── Census ACS demographics ──────────────────────────────────────────────────
test("acs: header eşleştir → population + income", () => {
  const json = [
    ["B01003_001E", "B19013_001E", "NAME", "state", "county"],
    ["64000", "48000", "Starr County, Texas", "48", "427"],
  ];
  const r = parseAcsRow(json);
  assert.equal(r!.population, 64000);
  assert.equal(r!.medianIncome, 48000);
});

test("acs: no-data sentinel → null, malformed → null", () => {
  const r = parseAcsRow([["B01003_001E", "B19013_001E"], ["64000", "-666666666"]]);
  assert.equal(r!.population, 64000);
  assert.equal(r!.medianIncome, null);
  assert.equal(parseAcsRow([["only-header"]]), null);
  assert.equal(parseAcsRow(null), null);
});

test("acs: computeGrowth fraction + clamp", () => {
  assert.equal(computeGrowth(110, 100)!.toFixed(2), "0.10");
  assert.equal(computeGrowth(90, 100)!.toFixed(2), "-0.10");
  assert.equal(computeGrowth(100, null), null);
  assert.equal(computeGrowth(100, 0), null);
  // clamp: absurd join can't poison the score
  assert.equal(computeGrowth(1000, 100), 2);
});

// ── Paid adapters (parsing only; live calls are env-gated) ───────────────────
test("regrid: parsel feature → apn/owner/acres", () => {
  const json = { parcels: { features: [{ properties: { fields: { parcelnumb: "12-345", owner: "JANE DOE", gisacre: 5.2, geoid: "48427950100" } } }] } };
  const p = parseRegridParcel(json);
  assert.equal(p!.apn, "12-345");
  assert.equal(p!.owner, "JANE DOE");
  assert.equal(p!.acres, 5.2);
  assert.equal(parseRegridParcel({}), null);
});

test("attom: property detail → assessed/market/sale", () => {
  const json = {
    property: [
      {
        assessment: { assessed: { assdttlvalue: 30000 }, market: { mktttlvalue: 42000 } },
        sale: { amount: { saleamt: 38000 }, salesearchdate: "2021-05-01" },
      },
    ],
  };
  const p = parseAttomProperty(json);
  assert.equal(p!.assessedValue, 30000);
  assert.equal(p!.marketValue, 42000);
  assert.equal(p!.lastSalePrice, 38000);
  assert.equal(p!.lastSaleDate, "2021-05-01");
  assert.equal(parseAttomProperty({}), null);
});
