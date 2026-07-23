#!/usr/bin/env node
/**
 * MISSOURI OFF-MARKET — 15-eyalet genişlemesi 2. dalga (MO aktivasyonu).
 *
 * CAMDEN COUNTY (Lake of the Ozarks) — resmi county Integrity GIS assessor
 * katmanı (taze: 2026 satış tarihleri görüldü):
 *   https://services8.integritygis.com/arcgis/rest/services/MO/Camden_Assessor_Data/MapServer/7
 * Servis token'lı; token county'nin HERKESE AÇIK Geocortex viewer config'inden
 * runtime'da çekilir (H5 viewer'ın kullandığı public site haritası):
 *   https://camdengis.integritygis.com/Geocortex/Essentials/REST/sites/Camden_County_MO/map?f=json
 *
 * Neden Camden: Lake of the Ozarks göl/rekreasyon subdivision'larının merkezi —
 * lot sahiplerinin büyük kısmı KC/StL/eyalet-dışı absentee.
 *
 * Filtre: vacant (LAND_USE=0 VE MAIN_YEAR_BUILT boş) + '01 RESIDENTIAL' sınıfı +
 * sahip (DEEDHOLDER) + posta adresi dolu.
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - Katmanda assessed value YOK → est_offer/est_retail null (değer yoksa uydurma).
 *    (Bu yüzden düşük-değer bandı filtresi uygulanamadı; vacant+res sınırı yeterli.)
 *  - absentee: mailing_state != MO VEYA MO içi ama county-dışı posta şehri.
 *  - Denenen ve olmayan alternatifler: Stone County AGOL (2014 snapshot — bayat,
 *    reddedildi), Taney/Barry/Morgan (açık servis yok / owner alanı yok).
 *
 * Çalıştır: node scraper/missouri-offmarket.mjs   (TEST=1 → 2 sayfa)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const PAGE = 2000;
const TEST = process.env.TEST === "1";
const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LAYER = "https://services8.integritygis.com/arcgis/rest/services/MO/Camden_Assessor_Data/MapServer/7/query";
const WHERE = "LAND_USE=0 AND MAIN_YEAR_BUILT IS NULL AND PARCEL_CLASS='01 RESIDENTIAL' AND DEEDHOLDER IS NOT NULL AND MAILING_ADDRESS_LINE1 IS NOT NULL";
const OUT_FIELDS = "PID,PARCEL_NUMBER,DEEDHOLDER,DEEDHOLDER_NAME2,MAILING_ADDRESS_LINE1,MAILING_ADDRESS_CITY,MAILING_ADDRESS_STATE,MAILING_ADDRESS_POSTAL_CODE,GIS_ACRES,DEED_ACRES,LEGAL,PARCEL_LOCATION";
const SOURCE = "MO:ARCGIS_CAMDEN_ASSESSOR";

// Camden içi posta şehirleri (county-içi = absentee değil)
const CAMDEN_CITIES = new Set(["CAMDENTON", "LAKE OZARK", "OSAGE BEACH", "LINN CREEK", "SUNRISE BEACH", "ROACH", "MONTREAL", "MACKS CREEK", "CLIMAX SPRINGS", "FOUR SEASONS", "VILLAGE OF FOUR SEASONS", "STOUTLAND"]);

// Token'ı public Geocortex site config'inden çek (viewer'ın kendi yolu).
async function fetchToken() {
  const res = await fetch("https://camdengis.integritygis.com/Geocortex/Essentials/REST/sites/Camden_County_MO/map?f=json", { signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  const m = text.match(/Camden_Assessor_Data\/MapServer;(?:tokenUrl=;)?token=([^"';]+)/);
  if (!m) throw new Error("Camden Geocortex config'inden token çıkarılamadı");
  return m[1];
}

function centroid(geom) {
  const ring = geom?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const lng = sx / ring.length, lat = sy / ring.length;
  return Number.isFinite(lat) && Math.abs(lat) <= 90 ? [lng, lat] : null;
}

const token = await fetchToken();
console.log("Camden: viewer token alındı");

async function fetchPage(offset) {
  const p = new URLSearchParams({
    where: WHERE, outFields: OUT_FIELDS,
    returnGeometry: "true", outSR: "4326",
    orderByFields: "OBJECTID ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json", token,
  });
  const res = await fetch(LAYER, { method: "POST", body: p, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(120000) });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "arcgis error");
  return j;
}

const seen = new Set();
const recs = [];
for (let off = 0, page = 0; ; page++) {
  let j;
  try { j = await fetchPage(off); }
  catch (e) { await sleep(3000); try { j = await fetchPage(off); } catch { console.log(`Camden: sayfa ${page} hata — durduruldu`); break; } }
  const feats = j.features ?? [];
  if (!feats.length) break;
  off += feats.length;
  for (const f of feats) {
    const a = f.attributes;
    const apn = clean(a.PARCEL_NUMBER) || clean(a.PID);
    const owner = [clean(a.DEEDHOLDER), clean(a.DEEDHOLDER_NAME2)].filter(Boolean).join(" & ");
    const mail = clean(a.MAILING_ADDRESS_LINE1);
    if (!apn || !owner || !mail || seen.has(apn)) continue; // sahip+posta zorunlu
    seen.add(apn);
    const mstate = clean(a.MAILING_ADDRESS_STATE).toUpperCase();
    const mcity = clean(a.MAILING_ADDRESS_CITY).toUpperCase();
    const acres = Number(a.DEED_ACRES) || Number(a.GIS_ACRES) || null;
    const c = centroid(f.geometry);
    recs.push({
      lead_id: `MO-Camden-${apn}`,
      state: "MO", county: "Camden", region: "Camden County, MO (Lake of the Ozarks)",
      apn, owner,
      mailing_address: mail, mailing_city: mcity || null, mailing_state: mstate || null, mailing_zip: clean(a.MAILING_ADDRESS_POSTAL_CODE).slice(0, 5) || null,
      situs: null, // katmanda situs adresi yok; LEGAL use alanında taşınır
      use: [clean(a.LEGAL), clean(a.PARCEL_LOCATION)].filter(Boolean).join(" · ") || "Vacant residential",
      acres: acres ? Math.round(acres * 10000) / 10000 : null,
      land_value: null, // assessed value katmanda yok
      est_offer: null, est_retail: null, est_margin: null,
      absentee: mstate ? (mstate !== "MO" || !CAMDEN_CITIES.has(mcity)) : null,
      lat: c ? c[1] : null, lng: c ? c[0] : null,
      source: SOURCE,
    });
  }
  console.log(`Camden: sayfa ${page + 1} → toplam ${recs.length}`);
  if (TEST && page >= 1) break;
  await sleep(300);
}

const absN = recs.filter((r) => r.absentee).length;
const outN = recs.filter((r) => r.mailing_state && r.mailing_state !== "MO").length;
console.log(`Camden: ${recs.length} vacant lot · absentee ${absN} (eyalet dışı ${outN})`);
for (let i = 0; i < recs.length; i += 500) {
  const part = recs.slice(i, i + 500);
  const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
  if (error) { console.error(`Camden: upsert hatası (${i}): ${error.message}`); process.exit(1); }
}
console.log(`✔ Camden: ${recs.length} kayıt yazıldı`);

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "MO");
console.log(`\n✔ BİTTİ: Supabase MO toplam ${count}`);
