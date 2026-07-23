#!/usr/bin/env node
/**
 * TN + OK KOORDİNAT BACKFILL — offmarket_leads'te lat/lng'i boş TN (Sullivan,
 * Chester) ve OK (Atoka/Beckham/Bryan/Pittsburg) kayıtlarına GERÇEK parsel
 * merkezini (centroid) yazar. backfill-coords.mjs'in TN/OK uzantısı.
 *
 * Kaynaklar (hepsi kamuya açık ArcGIS parsel servisleri + Census geocoder):
 *  - TN Sullivan → Tennessee Property Boundaries Public Use (tnmap_oir, AGOL).
 *    Eşleşme: bizim APN "38-72.00" / "20D-A-41.00" → GISLINK =
 *    countyId(3) + cmap.padEnd(5) + group.padEnd(2) + parsel5 ("07200").
 *    (tnmap.tn.gov ABD dışından erişime kapalı; AGOL kopyası aynı verinin
 *    resmî yayını, 86 county içerir.)
 *  - TN Chester → eyalet katmanında YOK (86 county'ye dahil değil) →
 *    situs adresi Census Bureau geocoder ile denenir (yalnız kesin eşleşme).
 *  - OK Atoka → City of Atoka "County Parcels 2019" view (AGOL, parcel_id).
 *  - OK Beckham → Beckham County Assessor "Parcel" servisi (AGOL, parcelid).
 *  - OK Pittsburg → City of McAlester "Pittsburg Parcels" (AGOL, Parcel_ID,
 *    45.658 parsel = county geneli).
 *  - OK Bryan → kamuya açık parsel servisi BULUNAMADI (usassessor.com kapalı,
 *    AGOL/Hub'da yok; Regrid token'ı geçersiz) → boş kalır (koordinat UYDURULMAZ).
 *    OK situs alanı legal description olduğundan geocode da mümkün değil.
 *
 * Çalıştır: node scraper/backfill-coords-tn-ok.mjs
 * Tekrar çalıştırılabilir: yalnız lat IS NULL kayıtlar hedeflenir.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const CHUNK = 60;
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

async function arcQuery(layer, where, outFields) {
  const body = new URLSearchParams({ where, outFields, returnGeometry: "true", outSR: "4326", f: "json" });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${layer}/query`, { method: "POST", body, signal: AbortSignal.timeout(60000) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || "arcgis error");
      return j.features ?? [];
    } catch (e) {
      if (attempt === 2) { console.error(`  ! sorgu hatası: ${e.message}`); return []; }
      await sleep(2000);
    }
  }
  return [];
}

async function fetchNullLeads(state, county) {
  const out = [];
  let after = null;
  for (;;) {
    let q = supa.from("offmarket_leads").select("lead_id, apn, situs").eq("state", state).eq("county", county).is("lat", null).order("lead_id").limit(1000);
    if (after) q = q.gt("lead_id", after);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    after = data[data.length - 1].lead_id;
  }
  return out;
}

async function writeCoords(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supa.from("offmarket_leads").upsert(rows.slice(i, i + 500), { onConflict: "lead_id" });
    if (error) throw new Error(error.message);
  }
}

// ── TN Sullivan: APN → GISLINK ───────────────────────────────────────────────
// APN "38-72.00" → cmap "038", gp " ", parsel "072.00" → GISLINK "082038    07200"
function tnGislink(countyId, apn) {
  const parts = String(apn).trim().split("-");
  if (parts.length < 2 || parts.length > 3) return null;
  const rawMap = parts[0], gp = parts.length === 3 ? parts[1] : "", rawParcel = parts[parts.length - 1];
  const mm = rawMap.match(/^(\d+)([A-Z]*)$/i);
  const pm = rawParcel.match(/^(\d+)(?:\.(\d+))?$/);
  if (!mm || !pm) return null;
  const cmap = mm[1].padStart(3, "0") + (mm[2] || "").toUpperCase();
  const parcel5 = pm[1].padStart(3, "0") + (pm[2] || "0").padEnd(2, "0").slice(0, 2);
  if (cmap.length > 5 || gp.length > 2) return null;
  return countyId + cmap.padEnd(5, " ") + gp.toUpperCase().padEnd(2, " ") + parcel5;
}

const TN_LAYER = "https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0";

async function runTnSullivan(stats) {
  const leads = await fetchNullLeads("TN", "Sullivan");
  console.log(`\nTN/Sullivan: ${leads.length} koordinatsız kayıt`);
  const byLink = new Map();
  for (const l of leads) {
    const gl = tnGislink("082", l.apn);
    if (gl) byLink.set(gl, l);
    else stats.tn_apn_parse_fail++;
  }
  const links = [...byLink.keys()];
  for (let i = 0; i < links.length; i += CHUNK) {
    const chunk = links.slice(i, i + CHUNK);
    const feats = await arcQuery(TN_LAYER, `GISLINK IN (${chunk.map((a) => `'${esc(a)}'`).join(",")})`, "GISLINK");
    const ups = [];
    for (const f of feats) {
      const lead = byLink.get(String(f.attributes?.GISLINK ?? ""));
      const c = centroid(f.geometry);
      if (lead && c) { ups.push({ lead_id: lead.lead_id, lng: c[0], lat: c[1] }); byLink.delete(String(f.attributes.GISLINK)); }
    }
    if (ups.length) { await writeCoords(ups); stats.tn_parcel += ups.length; }
    if ((i / CHUNK) % 10 === 0) console.log(`  TN/Sullivan ${i + chunk.length}/${links.length} sorgulandı → ${stats.tn_parcel} eşleşti`);
    await sleep(150);
  }
  stats.tn_unmatched += byLink.size;
  console.log(`TN/Sullivan bitti: ${stats.tn_parcel} parsel eşleşmesi, ${byLink.size} eşleşmedi, ${stats.tn_apn_parse_fail} APN çözümlenemedi`);
}

// ── TN Chester: Census geocoder (situs "SOKAK NO" → "NO SOKAK, city, TN") ────
// Chester county yerleşimleri (posta yerleri) — deneme sırası; yalnız Exact kabul.
const CHESTER_CITIES = ["Henderson", "Enville", "Jacks Creek", "Luray", "Silerton", "Milledgeville", "Finger", "Pinson"];

function chesterAddressVariants(situs) {
  if (!situs) return [];
  const s = situs.trim().replace(/\s+/g, " ");
  const out = [];
  const tail = s.match(/^(.*?)\s+(\d+)$/); // "DUBERRY ROAD 255" → "255 DUBERRY ROAD"
  if (tail) out.push(`${tail[2]} ${tail[1]}`);
  if (/^\d+\s/.test(s)) out.push(s); // "5235 ROBY ROAD" zaten düz
  return out;
}

async function censusGeocode(oneLine) {
  // "geographies" ucu county FIPS döner → yalnız Chester (47023) içindeki eşleşme kabul
  const u = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(oneLine)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    const m = (j.result?.addressMatches ?? [])[0];
    if (!m) return null;
    const geoid = m.geographies?.Counties?.[0]?.GEOID ?? null;
    if (geoid !== "47023") return null; // Chester dışına düşen eşleşme reddedilir
    return { lng: m.coordinates.x, lat: m.coordinates.y, matched: m.matchedAddress };
  } catch { return null; }
}

async function runTnChester(stats) {
  const leads = await fetchNullLeads("TN", "Chester");
  console.log(`\nTN/Chester: ${leads.length} koordinatsız kayıt (eyalet parsel katmanında Chester yok → Census geocode)`);
  for (const l of leads) {
    let hit = null;
    for (const addr of chesterAddressVariants(l.situs)) {
      for (const city of CHESTER_CITIES) {
        const r = await censusGeocode(`${addr}, ${city}, TN`);
        await sleep(150);
        if (r) { hit = r; break; }
      }
      if (hit) break;
    }
    if (hit) {
      await writeCoords([{ lead_id: l.lead_id, lng: hit.lng, lat: hit.lat }]);
      stats.tn_geocode++;
      console.log(`  ✓ ${l.lead_id} → ${hit.matched}`);
    } else {
      stats.tn_unmatched++;
      console.log(`  ✗ ${l.lead_id} (${l.situs}) eşleşmedi — boş kaldı`);
    }
  }
}

// ── OK: county → { layer, apnField } ─────────────────────────────────────────
const OK_LAYERS = {
  Atoka: { layer: "https://services8.arcgis.com/nlZN4VPoCeta6ngK/arcgis/rest/services/County_Parcels_2019_view/FeatureServer/4", apn: "parcel_id" },
  Beckham: { layer: "https://services7.arcgis.com/2uPhy8KfHlaAyk3B/arcgis/rest/services/Parcel/FeatureServer/0", apn: "parcelid" },
  Pittsburg: { layer: "https://services3.arcgis.com/vS6jO1qrSVqdHIdf/arcgis/rest/services/Pittsburg_Parcels/FeatureServer/0", apn: "Parcel_ID" },
  // Bryan: kamuya açık parsel servisi yok (bkz. dosya başı) — bilerek boş.
};

async function runOk(stats) {
  for (const [county, conf] of Object.entries(OK_LAYERS)) {
    const leads = await fetchNullLeads("OK", county);
    console.log(`\nOK/${county}: ${leads.length} koordinatsız kayıt`);
    const byApn = new Map(leads.map((l) => [String(l.apn).trim(), l]));
    const apns = [...byApn.keys()];
    let matched = 0;
    for (let i = 0; i < apns.length; i += CHUNK) {
      const chunk = apns.slice(i, i + CHUNK);
      const feats = await arcQuery(conf.layer, `${conf.apn} IN (${chunk.map((a) => `'${esc(a)}'`).join(",")})`, conf.apn);
      const ups = [];
      for (const f of feats) {
        const key = String(f.attributes?.[conf.apn] ?? "").trim();
        const lead = byApn.get(key);
        const c = centroid(f.geometry);
        if (lead && c) { ups.push({ lead_id: lead.lead_id, lng: c[0], lat: c[1] }); byApn.delete(key); }
      }
      if (ups.length) { await writeCoords(ups); matched += ups.length; }
      await sleep(150);
    }
    stats.ok_parcel += matched;
    stats.ok_unmatched += byApn.size;
    console.log(`OK/${county} bitti: ${matched} eşleşti, ${byApn.size} eşleşmedi`);
  }
  const bryan = await fetchNullLeads("OK", "Bryan");
  stats.ok_no_source += bryan.length;
  console.log(`\nOK/Bryan: kamuya açık parsel servisi yok → ${bryan.length} kayıt bilerek boş bırakıldı`);
}

// ── main ─────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const stats = { tn_parcel: 0, tn_geocode: 0, tn_unmatched: 0, tn_apn_parse_fail: 0, ok_parcel: 0, ok_unmatched: 0, ok_no_source: 0 };
await runTnSullivan(stats);
await runTnChester(stats);
await runOk(stats);
console.log(`\n✔ BİTTİ (${Math.round((Date.now() - t0) / 60000)} dk)`);
console.log(`TN: parsel=${stats.tn_parcel}, geocode=${stats.tn_geocode}, eşleşmeyen=${stats.tn_unmatched + stats.tn_apn_parse_fail} (APN çözümlenemeyen ${stats.tn_apn_parse_fail})`);
console.log(`OK: parsel=${stats.ok_parcel}, eşleşmeyen=${stats.ok_unmatched}, kaynak-yok(Bryan)=${stats.ok_no_source}`);
