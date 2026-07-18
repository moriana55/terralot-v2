#!/usr/bin/env node
/**
 * FLORIDA MULTI-COUNTY off-market pull — absentee boş arsa, doğrudan sahip.
 * Kaynak: FL Statewide Parcel CENTROID layer (HALKA AÇIK ArcGIS, FloridaGIO).
 *   Polygon layer attribute-filter'ı 400 verir; CENTROID (nokta) sürümü kabul eder.
 *   Nokta geometrisi → outSR=4326 ile lat/lng.
 * Filtre: DOR_UC='000' (vacant residential) + OWN_STATE<>'FL' + LND_VAL 1..15000 + LND_SQFOOT>0.
 * Kapsam: Highlands, Charlotte, Citrus, Marion, Polk (Lee ayrı PA scraper'ında).
 * Çıktı: dashboard/src/data/florida-offmarket.json + Supabase offmarket_leads upsert + count.
 * Kullanım: node scraper/offmarket-fl.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0/query";
const PAGE = 2000;
const MAX = Number(process.env.MAX || 60000);
const MAXVAL = Number(process.env.MAXVAL || 15000);

// Hedef county'ler (FL DOR CO_NO kodu → isim). ONLY_CO env ile daraltılabilir (ör. "18,19,52,63").
const ALL_COUNTIES = { 38: "Highlands", 18: "Charlotte", 19: "Citrus", 52: "Marion", 63: "Polk" };
const only = (process.env.ONLY_CO || "").split(",").map(s => s.trim()).filter(Boolean);
const COUNTIES = only.length ? Object.fromEntries(only.filter(k => ALL_COUNTIES[k]).map(k => [k, ALL_COUNTIES[k]])) : ALL_COUNTIES;
const RETRIES = Number(process.env.RETRIES || 6);
const WANT_GEOM = process.env.GEOM !== "0"; // GEOM=0 → geometri istemez (daha hafif/güvenilir sorgu, lat/lng null)

const BASE = `DOR_UC='000' AND OWN_STATE<>'FL' AND OWN_STATE IS NOT NULL AND OWN_STATE<>'' AND LND_VAL>0 AND LND_VAL<=${MAXVAL} AND LND_SQFOOT>0`;
const FIELDS = "CO_NO,PARCEL_ID,OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,DOR_UC,LND_VAL,JV,LND_SQFOOT";

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
const estOffer = (v) => Math.min(1200, Math.max(400, Math.round((v || 0) * 0.5)));

function loadEnvLocal() {
  const p = resolve(ROOT, "dashboard/.env.local");
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

async function fetchPage(where, offset) {
  const params = { where, outFields: FIELDS, returnGeometry: WANT_GEOM ? "true" : "false", orderByFields: "PARCEL_ID ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" };
  if (WANT_GEOM) params.outSR = "4326";
  const p = new URLSearchParams(params);
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS ${JSON.stringify(j.error).slice(0, 100)}`);
  return j;
}

// intermittent 400/timeout'a karşı 3 denemeli sağlam çekim
async function fetchRetry(where, offset) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try { return await fetchPage(where, offset); }
    catch (e) {
      if (attempt === RETRIES) throw e;
      await new Promise(r => setTimeout(r, 3000 + 2000 * attempt));
    }
  }
}

async function main() {
  console.log("Florida multi-county off-market pull (centroid layer)…\nfiltre:", BASE);
  const rows = []; const seen = new Set();
  for (const [coNo, county] of Object.entries(COUNTIES)) {
    const where = `CO_NO=${coNo} AND ${BASE}`;
    let before = rows.length;
    for (let off = 0; off < MAX; off += PAGE) {
      let j;
      try { j = await fetchRetry(where, off); }
      catch (e) { console.warn(`  ${county} @${off} atlandı: ${e.message}`); break; }
      const feats = j.features || [];
      for (const f of feats) {
        const a = f.attributes;
        const apn = String(a.PARCEL_ID || "").trim();
        if (!apn || seen.has(apn)) continue; seen.add(apn);
        const owner = String(a.OWN_NAME || "").trim();
        const mail = [a.OWN_ADDR1, a.OWN_ADDR2].filter(Boolean).join(" ").trim();
        if (!owner || !mail || !a.OWN_CITY) continue;
        const lv = num(a.LND_VAL);
        if (!(lv > 0 && lv <= MAXVAL)) continue;
        const acres = (Number(a.LND_SQFOOT) || 0) / 43560;
        const g = f.geometry || {};
        const lng = Number.isFinite(g.x) ? +g.x.toFixed(6) : null;
        const lat = Number.isFinite(g.y) ? +g.y.toFixed(6) : null;
        const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
        const offer = estOffer(lv);
        rows.push({
          apn, owner,
          mailing_address: mail, mailing_city: a.OWN_CITY, mailing_state: a.OWN_STATE, mailing_zip: String(a.OWN_ZIPCD ?? "").replace(/\.0$/, ""),
          situs: [a.PHY_ADDR1, a.PHY_CITY].filter(Boolean).join(", "),
          use: "Vacant Residential", acres: acres ? +acres.toFixed(3) : null, land_value: lv,
          full_cash_value: num(a.JV) || null,
          county, region: `${county} County`,
          lat, lng, est_offer: offer, est_retail: retail, est_margin: retail - offer,
        });
      }
      if (feats.length < PAGE) break;
    }
    console.log(`${county}: +${rows.length - before} (toplam ${rows.length})`);
  }
  rows.sort((a, b) => a.land_value - b.land_value);

  const outJson = resolve(ROOT, "dashboard/src/data/florida-offmarket.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "FL", source: "FL Statewide Parcel Centroid (public ArcGIS, FloridaGIO)", filter: BASE, rows }, null, 2));

  const byCounty = {}; for (const r of rows) byCounty[r.county] = (byCounty[r.county] || 0) + 1;
  console.log(`\n✅ ${rows.length} FL absentee vacant lot.`);
  console.log("county dağılımı:", Object.entries(byCounty).map(([k, n]) => `${k}:${n}`).join(", "));

  // ---- Supabase upsert ----
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `FL-${r.county}-${r.apn}`,
    state: "FL", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: !!(r.mailing_state && r.mailing_state !== "FL"), lat: r.lat, lng: r.lng,
    source: `ARCGIS:FL-${r.county}`,
  }));
  const CHUNK = 500;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const part = recs.slice(i, i + CHUNK);
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error("upsert hatası:", error.message); process.exit(1); }
    process.stdout.write(`\r  upsert ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "FL");
  const { count: all } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ Supabase FL=${count} | tablo toplam=${all}`);
}
main().catch(e => { console.error("HATA:", e); process.exit(1); });
