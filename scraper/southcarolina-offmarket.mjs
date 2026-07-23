#!/usr/bin/env node
/**
 * SOUTH CAROLINA OFF-MARKET — 15-eyalet genişlemesi 2. dalga (SC aktivasyonu).
 *
 * COLLETON COUNTY (Walterboro / Edisto / ACE Basin) — resmi county AGOL yayını:
 *   https://services1.arcgis.com/m0cnLGKdhwao8WvM/arcgis/rest/services/Public_Data/FeatureServer/2
 *
 * Neden Colleton: SC Lowcountry kırsal+kıyı lotları ve heirs' property
 * (bölünmemiş miras arazisi) yoğunluğunun bilinen havzası; Edisto çevresi
 * kıyı lotlarında eyalet-dışı absentee sahip oranı yüksek.
 *
 * Filtre: vacant sınıflar (VACANT RESIDENTIAL / VACANT AGRICULTURAL / Other
 * Vacant) + sahip adı + posta adresi dolu (mektup atılabilir olmalı).
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - Katmanda assessed value YOK → est_offer/est_retail null (değer yoksa
 *    uydurma); düşük-değer bandı filtresi de bu yüzden uygulanamadı.
 *  - absentee: mailing_state != SC VEYA SC içi ama county-dışı posta şehri.
 *  - Alan değerleri sabit-genişlikli (trailing space) — hepsi trim'lenir.
 *  - Kaynakta olmayan hiçbir alan uydurulmaz.
 *
 * Çalıştır: node scraper/southcarolina-offmarket.mjs   (TEST=1 → 2 sayfa)
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

const LAYER = "https://services1.arcgis.com/m0cnLGKdhwao8WvM/arcgis/rest/services/Public_Data/FeatureServer/2/query";
const WHERE = "(PropertyClass LIKE 'VACANT RESIDENTIAL%' OR PropertyClass LIKE 'VACANT AGRICULTURAL%' OR PropertyClass LIKE 'Other Vacant%') AND OwnerName1 IS NOT NULL AND OwnerAddress1 IS NOT NULL";
const OUT_FIELDS = "PIN,OwnerName1,OwnerName2,OwnerAddress1,OwnerCity,OwnerState,OwnerZip,PropertyClass,LegalAcres,Acreage,PropertyAddress,PropertyCity";
const SOURCE = "SC:ARCGIS_COLLETON_PUBLIC";

// Colleton içi posta şehirleri (county-içi = absentee değil)
const COLLETON_CITIES = new Set(["WALTERBORO", "COTTAGEVILLE", "EDISTO ISLAND", "EDISTO BEACH", "RUFFIN", "SMOAKS", "LODGE", "ROUND O", "GREEN POND", "JACKSONBORO", "ISLANDTON", "WILLIAMS", "CANADYS", "HENDERSONVILLE"]);

function centroid(geom) {
  const ring = geom?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const lng = sx / ring.length, lat = sy / ring.length;
  return Number.isFinite(lat) && Math.abs(lat) <= 90 ? [lng, lat] : null;
}

async function fetchPage(offset) {
  const p = new URLSearchParams({
    where: WHERE, outFields: OUT_FIELDS,
    returnGeometry: "true", outSR: "4326",
    orderByFields: "OBJECTID ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
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
  catch (e) { await sleep(3000); try { j = await fetchPage(off); } catch { console.log(`Colleton: sayfa ${page} hata — durduruldu`); break; } }
  const feats = j.features ?? [];
  if (!feats.length) break;
  off += feats.length;
  for (const f of feats) {
    const a = f.attributes;
    const apn = clean(a.PIN);
    const owner = [clean(a.OwnerName1), clean(a.OwnerName2)].filter(Boolean).join(" & ");
    const mail = clean(a.OwnerAddress1);
    if (!apn || !owner || !mail || seen.has(apn)) continue; // sahip+posta zorunlu
    seen.add(apn);
    const mstate = clean(a.OwnerState).toUpperCase().slice(0, 2);
    const mcity = clean(a.OwnerCity).toUpperCase();
    const acres = Number(a.LegalAcres) || Number(a.Acreage) || null;
    const c = centroid(f.geometry);
    const situs = [clean(a.PropertyAddress), clean(a.PropertyCity)].filter(Boolean).join(", ") || null;
    recs.push({
      lead_id: `SC-Colleton-${apn}`,
      state: "SC", county: "Colleton", region: "Colleton County, SC (Lowcountry/ACE Basin)",
      apn, owner,
      mailing_address: mail, mailing_city: mcity || null, mailing_state: mstate || null, mailing_zip: clean(a.OwnerZip).slice(0, 5) || null,
      situs,
      use: clean(a.PropertyClass) || "Vacant",
      acres,
      land_value: null, // assessed value katmanda yok
      est_offer: null, est_retail: null, est_margin: null,
      absentee: mstate ? (mstate !== "SC" || !COLLETON_CITIES.has(mcity)) : null,
      lat: c ? c[1] : null, lng: c ? c[0] : null,
      source: SOURCE,
    });
  }
  console.log(`Colleton: sayfa ${page + 1} → toplam ${recs.length}`);
  if (TEST && page >= 1) break;
  await sleep(300);
}

const absN = recs.filter((r) => r.absentee).length;
const outN = recs.filter((r) => r.mailing_state && r.mailing_state !== "SC").length;
console.log(`Colleton: ${recs.length} vacant lot · absentee ${absN} (eyalet dışı ${outN})`);
for (let i = 0; i < recs.length; i += 500) {
  const part = recs.slice(i, i + 500);
  const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
  if (error) { console.error(`Colleton: upsert hatası (${i}): ${error.message}`); process.exit(1); }
}
console.log(`✔ Colleton: ${recs.length} kayıt yazıldı`);

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "SC");
console.log(`\n✔ BİTTİ: Supabase SC toplam ${count}`);
