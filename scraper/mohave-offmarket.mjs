#!/usr/bin/env node
/**
 * MOHAVE COUNTY (AZ) OFF-MARKET PULL — açık artırma DEĞİL, doğrudan absentee sahip.
 *
 * Mohave County ParcelQueryLayer (HALKA AÇIK ArcGIS REST) → boş arsa (IMPVALUE=0) +
 * absentee (sahip eyalet dışı) + küçük parsel (0.8-5 acre) + ucuz → gerçek sahip ADI +
 * POSTA ADRESİ ile mektup-atılır lead. Rina/LandModo modelinin kaynağı tam burası.
 *
 * Çıktı: dashboard/src/data/mohave-offmarket.json (uygulama) + mohave-offmarket.csv (mektup).
 *
 * Kullanım:
 *   node scraper/mohave-offmarket.mjs            # varsayılan: cheap subset
 *   MAX=20000 MAXVAL=8000 node scraper/mohave-offmarket.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query";
const PAGE = 1000;
const MAX = Number(process.env.MAX || 20000);        // toplam üst sınır
const MAXVAL = Number(process.env.MAXVAL || 8000);   // max arazi değeri (ucuz tut)
const MINAC = Number(process.env.MINAC || 0.8);
const MAXAC = Number(process.env.MAXAC || 5);

// Boş arsa + absentee (eyalet dışı) + küçük + ucuz. Açık artırma değil — doğrudan sahip.
const WHERE = `IMPVALUE=0 AND LANDVALUE>0 AND LANDVALUE<=${MAXVAL} AND STATE<>'AZ' AND STATE<>'' AND PARCEL_SIZE>=${MINAC} AND PARCEL_SIZE<=${MAXAC}`;
const FIELDS = [
  "PARCEL", "OWNER", "OWNER_2", "MAILING_ADDRESS", "CITY", "STATE", "ZIP",
  "SITE_ADDRESS", "PROPUSE", "USE_CODE", "PARCEL_SIZE", "UNIT_TYPE",
  "LANDVALUE", "FULL_CASH_VALUE", "SALEP", "LEGAL_DESCRIPTION", "TWN_RNG_SEC",
  "LATITUDE", "LONGITUDE",
].join(",");

// Meadview/Golden Valley/Dolan Springs/Yucca yakınlığı (lat/lng kabaca) → "flip bölgesi" etiketi.
function regionTag(lat, lng) {
  if (lat == null || lng == null) return "Mohave (diğer)";
  if (lat > 35.8 && lng < -114.0) return "Meadview / Lake Mead";
  if (lat > 35.5 && lat <= 35.9 && lng > -114.5 && lng < -113.8) return "Dolan Springs / Meadview";
  if (lat > 35.0 && lat <= 35.5 && lng > -114.4 && lng < -113.9) return "Golden Valley / Kingman";
  if (lat >= 34.7 && lat <= 35.1 && lng > -114.4) return "Yucca / Kingman G.";
  return "Mohave (kırsal)";
}

// Mektup teklifi (blind offer) — absentee ucuz çöl lotu için gerçekçi alış aralığı.
// Assessed çok düşük; piyasa retail ~$2.999. Teklif konservatif: $300-900 bandı.
function estOffer(landValue) {
  const base = Math.max(300, Math.round(landValue * 0.6));
  return Math.min(900, base);
}

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: WHERE,
    outFields: FIELDS,
    returnGeometry: "false",
    orderByFields: "LANDVALUE ASC, PARCEL_SIZE DESC",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: "json",
  });
  const res = await fetch(`${LAYER}?${params}`, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} @offset ${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 200)}`);
  return j;
}

async function main() {
  console.log("Mohave off-market pull başlıyor…");
  console.log("filtre:", WHERE);

  const rows = [];
  const seen = new Set();
  for (let offset = 0; offset < MAX; offset += PAGE) {
    let j;
    try {
      j = await fetchPage(offset);
    } catch (e) {
      console.warn(`  uyarı @${offset}: ${e.message} — 2sn bekle, tekrar`);
      await new Promise((r) => setTimeout(r, 2000));
      try { j = await fetchPage(offset); } catch (e2) { console.error("  atlandı:", e2.message); continue; }
    }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.PARCEL || "").trim();
      if (!apn || seen.has(apn)) continue;
      seen.add(apn);
      const owner = [a.OWNER, a.OWNER_2].filter(Boolean).join(" & ").trim();
      const mail = [a.MAILING_ADDRESS, a.CITY, a.STATE, a.ZIP].filter(Boolean).join(", ");
      // Mektup atılamayan (sahip/adres yok) ele.
      if (!owner || !a.MAILING_ADDRESS || !a.CITY) continue;
      const lv = Number(a.LANDVALUE) || 0;
      rows.push({
        apn,
        owner,
        mailing_address: a.MAILING_ADDRESS,
        mailing_city: a.CITY,
        mailing_state: a.STATE,
        mailing_zip: a.ZIP,
        situs: a.SITE_ADDRESS || "",
        use: a.PROPUSE || a.USE_CODE || "",
        acres: Number(a.PARCEL_SIZE) || null,
        land_value: lv,
        full_cash_value: Number(a.FULL_CASH_VALUE) || null,
        last_sale_price: Number(a.SALEP) || null,
        legal: a.LEGAL_DESCRIPTION || "",
        twn_rng_sec: a.TWN_RNG_SEC || "",
        lat: a.LATITUDE ?? null,
        lng: a.LONGITUDE ?? null,
        region: regionTag(a.LATITUDE, a.LONGITUDE),
        est_offer: estOffer(lv),
        est_retail: 2999,           // Rina benchmark (1 acre)
      });
    }
    console.log(`  offset ${offset}: +${feats.length} (toplam ${rows.length})`);
    if (feats.length < PAGE) break; // son sayfa
  }

  // est. marj hesapla + skor (ucuz alış + iyi dönüm + bilinen flip bölgesi)
  for (const r of rows) {
    const retail = r.acres ? Math.round(2999 * Math.max(0.7, Math.min(2, r.acres))) : 2999;
    r.est_retail = retail;
    r.est_margin = retail - r.est_offer;
    r.score = Math.round(
      (r.est_margin / 30) +
      (r.region.includes("Meadview") || r.region.includes("Golden") ? 25 : 0) +
      (r.acres >= 1 && r.acres <= 2.5 ? 15 : 0)
    );
  }
  rows.sort((a, b) => b.score - a.score);

  // Yaz
  const outJson = resolve(ROOT, "dashboard/src/data/mohave-offmarket.json");
  const outCsv = resolve(ROOT, "scraper/mohave-offmarket.csv");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, source: "Mohave County ParcelQueryLayer (public ArcGIS)", filter: WHERE, rows }, null, 2));

  const csvHead = "apn,owner,mailing_address,mailing_city,mailing_state,mailing_zip,acres,land_value,est_offer,est_retail,est_margin,region,lat,lng";
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [csvHead, ...rows.map((r) => [r.apn, r.owner, r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip, r.acres, r.land_value, r.est_offer, r.est_retail, r.est_margin, r.region, r.lat, r.lng].map(esc).join(","))].join("\n");
  writeFileSync(outCsv, csv);

  // Özet
  const byRegion = {};
  for (const r of rows) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  const outState = new Set(rows.map((r) => r.mailing_state));
  console.log(`\n✅ ${rows.length} mektup-atılır absentee boş arsa çekildi.`);
  console.log("bölge dağılımı:", byRegion);
  console.log("sahip eyaletleri (absentee):", [...outState].slice(0, 15).join(", "), outState.size > 15 ? `… (+${outState.size - 15})` : "");
  console.log("ort. est. alış:", Math.round(rows.reduce((a, r) => a + r.est_offer, 0) / rows.length), "$ | ort. est. marj:", Math.round(rows.reduce((a, r) => a + r.est_margin, 0) / rows.length), "$");
  console.log("çıktı:", outJson, "+", outCsv);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
