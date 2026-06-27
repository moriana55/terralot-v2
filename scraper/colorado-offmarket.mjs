#!/usr/bin/env node
/**
 * COLORADO OFF-MARKET PULL — statewide, açık artırma DEĞİL, doğrudan absentee sahip.
 * Kaynak: Colorado Public Parcels (HALKA AÇIK statewide ArcGIS FeatureServer, owner+mailing).
 * Filtre: vacant land + absentee (sahip eyalet dışı) + 1-40 acre + ucuz. Costilla/SLV dahil tüm CO.
 * Çıktı: dashboard/src/data/colorado-offmarket.json + scraper/colorado-offmarket.csv
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query";
const PAGE = 1000;
const MAX = Number(process.env.MAX || 20000);
const MAXVAL = Number(process.env.MAXVAL || 15000);
const MINAC = Number(process.env.MINAC || 1);
const MAXAC = Number(process.env.MAXAC || 40);

const WHERE = `landUseDsc LIKE '%VACANT%' AND ownAddStt<>'CO' AND ownAddStt<>'' AND landAcres>=${MINAC} AND landAcres<=${MAXAC} AND apprValTot>0 AND apprValTot<=${MAXVAL}`;
const FIELDS = "parcel_id,account,owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,situsAdd,sitAddCty,landAcres,landUseDsc,apprValTot,asedValTot,salePrice,countyName,legalDesc";

function estOffer(v) { return Math.min(1200, Math.max(400, Math.round((v || 0) * 0.5))); }

async function fetchPage(offset) {
  const p = new URLSearchParams({ where: WHERE, outFields: FIELDS, returnGeometry: "false", orderByFields: "apprValTot ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

async function main() {
  console.log("Colorado off-market pull…\nfiltre:", WHERE);
  const rows = []; const seen = new Set();
  for (let off = 0; off < MAX; off += PAGE) {
    let j; try { j = await fetchPage(off); } catch (e) { console.warn(`uyarı @${off}: ${e.message}`); await new Promise(r => setTimeout(r, 2000)); try { j = await fetchPage(off); } catch { continue; } }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.parcel_id || a.account || "").trim();
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = [a.owner, a.owner2].filter(Boolean).join(" & ").trim();
      if (!owner || !a.ownerAdd || !a.ownAddCty) continue;
      const v = Number(a.apprValTot) || 0;
      const acres = Number(a.landAcres) || null;
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres / 1))) : 2999;
      const offer = estOffer(v);
      rows.push({ apn, owner, mailing_address: a.ownerAdd, mailing_city: a.ownAddCty, mailing_state: a.ownAddStt, mailing_zip: a.ownAddZip, situs: a.situsAdd || "", use: a.landUseDsc || "", acres, land_value: v, full_cash_value: Number(a.asedValTot) || null, last_sale_price: Number(a.salePrice) || null, legal: a.legalDesc || "", twn_rng_sec: "", lat: null, lng: null, region: (a.countyName || "CO") + " County", est_offer: offer, est_retail: retail, est_margin: retail - offer });
    }
    console.log(`offset ${off}: +${feats.length} (toplam ${rows.length})`);
    if (feats.length < PAGE) break;
  }
  for (const r of rows) r.score = Math.round((r.est_margin / 30) + (r.region.toLowerCase().includes("costilla") ? 25 : 0) + (r.acres >= 5 && r.acres <= 10 ? 12 : 0));
  rows.sort((a, b) => b.score - a.score);

  const outJson = resolve(ROOT, "dashboard/src/data/colorado-offmarket.json");
  const outCsv = resolve(ROOT, "scraper/colorado-offmarket.csv");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "CO", source: "Colorado Public Parcels (statewide ArcGIS)", filter: WHERE, rows }, null, 2));
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  writeFileSync(outCsv, ["apn,owner,mailing_address,mailing_city,mailing_state,mailing_zip,acres,land_value,est_offer,est_retail,est_margin,region", ...rows.map(r => [r.apn, r.owner, r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip, r.acres, r.land_value, r.est_offer, r.est_retail, r.est_margin, r.region].map(esc).join(","))].join("\n"));

  const byCounty = {}; for (const r of rows) byCounty[r.region] = (byCounty[r.region] || 0) + 1;
  console.log(`\n✅ ${rows.length} CO absentee vacant lot.`);
  console.log("en çok county:", Object.entries(byCounty).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}:${n}`).join(", "));
  console.log("ort. alış:", Math.round(rows.reduce((a, r) => a + r.est_offer, 0) / (rows.length || 1)), "$ | ort. marj:", Math.round(rows.reduce((a, r) => a + r.est_margin, 0) / (rows.length || 1)), "$");
}
main().catch(e => { console.error("HATA:", e); process.exit(1); });
