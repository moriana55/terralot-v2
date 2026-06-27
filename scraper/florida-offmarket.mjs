#!/usr/bin/env node
/**
 * FLORIDA STATEWIDE OFF-MARKET PULL — açık artırma DEĞİL, doğrudan absentee sahip.
 * Kaynak: Florida Statewide Cadastral (HALKA AÇIK ArcGIS, owner + MAILING adresi).
 * Filtre: vacant residential (DOR_UC='000') + absentee (OWN_STATE<>'FL') + ucuz.
 * Tüm FL county'lerini kapsar — efsane platted-lot flip eyaleti.
 * Çıktı: dashboard/src/data/florida-offmarket.json + scraper/florida-offmarket.csv
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query";
const PAGE = 2000;
const MAX = Number(process.env.MAX || 30000);
const MAXVAL = Number(process.env.MAXVAL || 15000);

const BASE = `DOR_UC='000' AND OWN_STATE<>'FL' AND OWN_STATE IS NOT NULL AND LND_VAL>=300 AND LND_VAL<=${MAXVAL} AND LND_SQFOOT>0`;
const FIELDS = "CO_NO,PARCEL_ID,OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,DOR_UC,LND_VAL,JV,LND_SQFOOT";

// FL DOR county kodları (11-77)
const CO = {11:"Alachua",12:"Baker",13:"Bay",14:"Bradford",15:"Brevard",16:"Broward",17:"Calhoun",18:"Charlotte",19:"Citrus",20:"Clay",21:"Collier",22:"Columbia",23:"Miami-Dade",24:"DeSoto",25:"Dixie",26:"Duval",27:"Escambia",28:"Flagler",29:"Franklin",30:"Gadsden",31:"Gilchrist",32:"Glades",33:"Gulf",34:"Hamilton",35:"Hardee",36:"Hendry",37:"Hernando",38:"Highlands",39:"Hillsborough",40:"Holmes",41:"Indian River",42:"Jackson",43:"Jefferson",44:"Lafayette",45:"Lake",46:"Lee",47:"Leon",48:"Levy",49:"Liberty",50:"Madison",51:"Manatee",52:"Marion",53:"Martin",54:"Monroe",55:"Nassau",56:"Okaloosa",57:"Okeechobee",58:"Orange",59:"Osceola",60:"Palm Beach",61:"Pasco",62:"Pinellas",63:"Polk",64:"Putnam",65:"St. Johns",66:"St. Lucie",67:"Santa Rosa",68:"Sarasota",69:"Seminole",70:"Sumter",71:"Suwannee",72:"Taylor",73:"Union",74:"Volusia",75:"Wakulla",76:"Walton",77:"Washington"};

const estOffer = (v) => Math.min(1200, Math.max(300, Math.round((v || 0) * 0.5)));

async function fetchPage(where, offset) {
  const p = new URLSearchParams({ where, outFields: FIELDS, returnGeometry: "false", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 120)}`);
  return j;
}

async function main() {
  console.log("Florida off-market pull (county-county)…\nfiltre:", BASE);
  const rows = []; const seen = new Set();
  // Her FL county'sini ayrı çek (statewide tek sorgu timeout yiyor; per-county dar+hızlı).
  for (const co of Object.keys(CO).map(Number)) {
    const where = `CO_NO=${co} AND ${BASE}`;
    let countyTotal = 0;
    for (let off = 0; off < MAX; off += PAGE) {
      let j; try { j = await fetchPage(where, off); }
      catch (e) { await new Promise(r => setTimeout(r, 1500)); try { j = await fetchPage(where, off); } catch { break; } }
      const feats = j.features || [];
      for (const f of feats) {
        const a = f.attributes;
        const apn = String(a.PARCEL_ID || "").trim();
        if (!apn || seen.has(apn)) continue; seen.add(apn);
        const owner = String(a.OWN_NAME || "").trim();
        if (!owner || !a.OWN_ADDR1 || !a.OWN_CITY) continue;
        const acres = (Number(a.LND_SQFOOT) || 0) / 43560;
        const lv = Number(a.LND_VAL) || 0;
        const offer = estOffer(lv);
        const retail = Math.round(2999 * Math.max(0.7, Math.min(3, acres || 1)));
        rows.push({
          apn, owner,
          mailing_address: [a.OWN_ADDR1, a.OWN_ADDR2].filter(Boolean).join(" ").trim(),
          mailing_city: a.OWN_CITY, mailing_state: a.OWN_STATE, mailing_zip: String(a.OWN_ZIPCD ?? ""),
          situs: [a.PHY_ADDR1, a.PHY_CITY].filter(Boolean).join(", "),
          use: "Vacant Residential", acres: acres ? +acres.toFixed(3) : null, land_value: lv,
          region: (CO[co] || `FL-${co}`) + " County", lat: null, lng: null,
          est_offer: offer, est_retail: retail, est_margin: retail - offer,
        });
        countyTotal++;
      }
      if (feats.length < PAGE) break;
    }
    if (countyTotal) console.log(`${CO[co]}: +${countyTotal} (toplam ${rows.length})`);
  }
  rows.sort((a, b) => a.land_value - b.land_value);

  const outJson = resolve(ROOT, "dashboard/src/data/florida-offmarket.json");
  const outCsv = resolve(ROOT, "scraper/florida-offmarket.csv");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "FL", source: "Florida Statewide Cadastral (public ArcGIS)", filter: WHERE, rows }, null, 2));
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  writeFileSync(outCsv, ["apn,owner,mailing_address,mailing_city,mailing_state,mailing_zip,acres,land_value,est_offer,est_retail,est_margin,region", ...rows.map(r => [r.apn, r.owner, r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip, r.acres, r.land_value, r.est_offer, r.est_retail, r.est_margin, r.region].map(esc).join(","))].join("\n"));

  const byCounty = {}; for (const r of rows) byCounty[r.region] = (byCounty[r.region] || 0) + 1;
  const byState = {}; for (const r of rows) byState[r.mailing_state] = (byState[r.mailing_state] || 0) + 1;
  console.log(`\n✅ ${rows.length} FL absentee vacant lot.`);
  console.log("en çok county:", Object.entries(byCounty).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k.replace(" County","")}:${n}`).join(", "));
  console.log("absentee eyaletleri:", Object.keys(byState).length, "| ort. alış:", Math.round(rows.reduce((a, r) => a + r.est_offer, 0) / (rows.length || 1)), "$");
}
main().catch(e => { console.error("HATA:", e); process.exit(1); });
