#!/usr/bin/env node
/**
 * KOORDİNAT BACKFILL — lat/lng'i olmayan offmarket_leads kayıtlarına county
 * ArcGIS'inden APN eşleşmesiyle parsel merkezi (centroid) yazar.
 *
 * Neden: NM/CO/TX kayıtları %100, FL %49 koordinatsız → harita çizilemiyor.
 * Kaynaklar scraper'daki mevcut servislerin aynısı; koordinat ÜRETİLMEZ,
 * eşleşmeyen kayıt null kalır (dürüstlük) ve log'a düşer.
 *
 * Çalıştır: node scraper/backfill-coords.mjs            (tam geçiş, saatler)
 *           STATE=CO node scraper/backfill-coords.mjs   (tek eyalet)
 *           TEST=1  node scraper/backfill-coords.mjs    (eyalet başına 2 sayfa)
 * Tekrar çalıştırılabilir: yalnızca lat IS NULL kayıtlar hedeflenir.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const TEST = process.env.TEST === "1";
const ONLY_STATE = process.env.STATE || null;
const APN_CHUNK = 70;
const PAGE = 1000;
const SLEEP = 200;

// ── TX county → layer kayıt defteri (mevcut scraper dosyalarından parse) ─────
function txRegistry() {
  const reg = {};
  for (const f of ["offmarket-tx-batch.mjs", "offmarket-tx-batch2.mjs"]) {
    const txt = readFileSync(resolve(HERE, f), "utf8");
    for (const m of txt.matchAll(/\["([^"]+)",\s*"(https:\/\/[^"]+)"\]/g)) reg[m[1]] = m[2];
  }
  // tekil dosyalar (orijinal 4)
  for (const f of ["offmarket-tx-brewster.mjs", "offmarket-tx-hudspeth.mjs", "offmarket-tx-presidio.mjs", "offmarket-tx-terrell.mjs"]) {
    try {
      const txt = readFileSync(resolve(HERE, f), "utf8");
      const layer = (txt.match(/"(https:\/\/[^"]+FeatureServer\/0)"/) || [])[1];
      const county = (txt.match(/county:\s*"([^"]+)"/) || txt.match(/\/([A-Za-z]+)CADWebService/) || [])[1];
      if (layer && county) reg[county] = layer;
    } catch { /* dosya yoksa geç */ }
  }
  return reg;
}

// state → { tekLayer? , apnField, fallbackApnField?, countyLayers? }
const CONF = {
  FL: { layer: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0", apn: "PARCEL_ID" },
  CO: {
    layer: "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0", apn: "account", fallbackApn: "parcel_id",
    countyOverrides: { Costilla: { layer: "https://services7.arcgis.com/qznFlX1g8SfaPebZ/arcgis/rest/services/Costilla_County_FGDB_May_Update/FeatureServer/8", apn: "ParcelNum", fallbackApn: "Parcel" } },
  },
  NM: { layer: "https://arcgisce2.co.valencia.nm.us/arcgis/rest/services/GIS_OnlineMap/MapServer/14", apn: "UPC", onlyCounty: "Valencia" },
  TX: { countyLayers: txRegistry(), apn: "prop_id_text", fallbackApn: "geo_id" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/'/g, "''");

function centroid(geom) {
  if (!geom) return null;
  if (typeof geom.x === "number" && typeof geom.y === "number") return [geom.x, geom.y];
  const ring = geom.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const lng = sx / ring.length, lat = sy / ring.length;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90) return null;
  return [lng, lat];
}

async function queryLayer(layer, apnField, apns) {
  const where = `${apnField} IN (${apns.map((a) => `'${esc(a)}'`).join(",")})`;
  const body = new URLSearchParams({ where, outFields: apnField, returnGeometry: "true", outSR: "4326", f: "json" });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${layer}/query`, { method: "POST", body, signal: AbortSignal.timeout(60000) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || "arcgis error");
      const out = new Map();
      for (const f of j.features ?? []) {
        const apn = String(f.attributes?.[apnField] ?? "").trim();
        const c = centroid(f.geometry);
        if (apn && c) out.set(apn, c);
      }
      return out;
    } catch (e) {
      if (attempt === 1) { console.error(`  ! sorgu hatası (${layer.slice(0, 60)}…): ${e.message}`); return new Map(); }
      await sleep(1500);
    }
  }
  return new Map();
}

async function pageLeads(state, county, afterId) {
  let q = supa.from("offmarket_leads").select("lead_id, apn, county").eq("state", state).is("lat", null).order("lead_id").limit(PAGE);
  if (county) q = q.eq("county", county);
  if (afterId) q = q.gt("lead_id", afterId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function upsertCoords(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) throw new Error(error.message);
  }
}

async function processGroup(state, county, layer, apnField, fallbackApn) {
  let after = null, pages = 0, matched = 0, missed = 0;
  for (;;) {
    const leads = await pageLeads(state, county, after);
    if (!leads.length) break;
    after = leads[leads.length - 1].lead_id;
    pages++;

    for (let i = 0; i < leads.length; i += APN_CHUNK) {
      const chunk = leads.slice(i, i + APN_CHUNK);
      let found = await queryLayer(layer, apnField, chunk.map((l) => l.apn));
      // TX: prop_id_text tutmayanlar için geo_id ile ikinci deneme
      if (fallbackApn) {
        const missing = chunk.filter((l) => !found.has(l.apn));
        if (missing.length) {
          const fb = await queryLayer(layer, fallbackApn, missing.map((l) => l.apn));
          for (const [k, v] of fb) found.set(k, v);
        }
      }
      const ups = [];
      for (const l of chunk) {
        const c = found.get(l.apn);
        if (c) ups.push({ lead_id: l.lead_id, lng: c[0], lat: c[1] });
        else missed++;
      }
      if (ups.length) { await upsertCoords(ups); matched += ups.length; }
      await sleep(SLEEP);
    }
    console.log(`${state}${county ? "/" + county : ""}: sayfa ${pages} → toplam eşleşen ${matched}, eşleşmeyen ${missed}`);
    if (TEST && pages >= 2) break;
  }
  return { matched, missed };
}

const t0 = Date.now();
let grand = { matched: 0, missed: 0 };
for (const [state, conf] of Object.entries(CONF)) {
  if (ONLY_STATE && state !== ONLY_STATE) continue;
  console.log(`\n══ ${state} başlıyor ══`);
  if (conf.countyLayers) {
    // TX: county bazlı — kayıt defterinde olmayan county'ler atlanır (log'a düşer)
    const { data: cRows } = await supa.from("offmarket_leads").select("county").eq("state", state).is("lat", null).limit(50000);
    const counties = [...new Set((cRows ?? []).map((r) => r.county))];
    for (const county of counties) {
      const layer = conf.countyLayers[county];
      if (!layer) { console.log(`${state}/${county}: kayıt defterinde layer yok — atlandı`); continue; }
      const r = await processGroup(state, county, layer, conf.apn, conf.fallbackApn);
      grand.matched += r.matched; grand.missed += r.missed;
    }
  } else {
    // county-özel servis varsa önce onlar, sonra kalan county'ler eyalet katmanından
    for (const [county, o] of Object.entries(conf.countyOverrides ?? {})) {
      const r = await processGroup(state, county, o.layer, o.apn, o.fallbackApn ?? null);
      grand.matched += r.matched; grand.missed += r.missed;
    }
    const { data: cRows } = await supa.from("offmarket_leads").select("county").eq("state", state).is("lat", null).limit(50000);
    const rest = [...new Set((cRows ?? []).map((r) => r.county))].filter((c) => !(conf.countyOverrides ?? {})[c] && (!conf.onlyCounty || c === conf.onlyCounty));
    for (const county of rest) {
      const r = await processGroup(state, county, conf.layer, conf.apn, conf.fallbackApn ?? null);
      grand.matched += r.matched; grand.missed += r.missed;
    }
  }
}
console.log(`\n✔ BİTTİ (${Math.round((Date.now() - t0) / 60000)} dk): ${grand.matched} koordinat yazıldı, ${grand.missed} eşleşmedi.`);
