#!/usr/bin/env node
/**
 * MICHIGAN OFF-MARKET — MI aktivasyonu (2. dalga tamamlayıcı: 15/15 dolu).
 *
 * ROSCOMMON COUNTY (Houghton Lake / Prudenville / St. Helen / Higgins Lake) —
 * resmi Roscommon County GIS (Roscomapper2) "GeoParcelMaster" AGOL katmanı:
 *   https://services3.arcgis.com/rAGekBpQuVeYptc1/arcgis/rest/services/Parcel62923_2/FeatureServer/146
 *
 * Neden Roscommon (UP değil): UP county'leri kapalı sistem (BS&A/FetchGIS) —
 * ama alt Michigan'ın göl/rekreasyon kuşağı AÇIK. Houghton Lake, Michigan'ın
 * en büyük iç gölü; 1950-70'lerde Detroit metrosuna parsel parsel satılmış
 * hafta-sonu lot pazarı → sahiplerin büyük kısmı downstate (Detroit/Macomb/
 * Oakland) absentee. Klasik NV-Nye/MO-Camden deseni.
 *
 * Filtre: vacant (MI propclass x02: 102 ag / 202 ticari / 302 sanayi / 402
 * konut vacant) + SEV 300–20.000$ + sahip adı + posta adresi dolu — proje
 * kuralı: mektup atılabilir olmalı.
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - land_value alanına Michigan SEV yazılır (State Equalized Value ≈ piyasa
 *    değerinin %50'si). Ayrı land/improvement kırılımı yok; vacant sınıf
 *    filtresi (x02) yapısız parseli garantiler, SEV pratikte arazi değeridir.
 *  - absentee: mailing eyaleti != MI VEYA MI içi ama Roscommon-county-dışı
 *    posta şehri. Şehir adı yazım varyantları normalize edilir.
 *  - est_offer NC kuralı (SEV*0.35, 400–1500), est_retail acres tabanlı NC
 *    kuralı — SEV mevcut olduğu için hesaplanır.
 *  - Koordinat parsel poligon merkezi (servis geometrisinden, outSR 4326).
 *  - Kaynakta olmayan hiçbir alan uydurulmaz.
 *
 * Çalıştır: node scraper/michigan-offmarket.mjs   (TEST=1 → 2 sayfa)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const MIN_VAL = 300, MAX_VAL = 20000, PAGE = 2000;
const TEST = process.env.TEST === "1";

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function estOffer(v) { return Math.min(1500, Math.max(400, Math.round((v || 0) * 0.35))); } // NC kuralı

function centroid(geom) {
  const ring = geom?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const lng = sx / ring.length, lat = sy / ring.length;
  return Number.isFinite(lat) && Math.abs(lat) <= 90 ? [lng, lat] : null;
}

// MI propclass → insan-okur kullanım etiketi (x02 = vacant alt sınıfı)
const CLASS_LABEL = { 102: "Agricultural vacant", 202: "Commercial vacant", 302: "Industrial vacant", 402: "Residential vacant" };

// Roscommon county içi posta şehirleri (yazım varyantlarıyla) — county-içi = absentee değil
const ROSCOMMON_CITIES = new Set([
  "HOUGHTON LAKE", "HOUGHTON LAKE HEIGHTS", "HOUGHTON LAKE HTS", "HOUGHTON LK",
  "HOUGHTON LK HTS", "HOUGHTON LK HGTS", "HOUGTON LAKE", "HOUHTON LAKE",
  "PRUDENVILLE", "PRUDENILLE", "ROSCOMMON", "ROSCOMMMON",
  "SAINT HELEN", "ST HELEN", "ST. HELEN", "HIGGINS LAKE", "MERRITT",
]);

const LAYER = "https://services3.arcgis.com/rAGekBpQuVeYptc1/arcgis/rest/services/Parcel62923_2/FeatureServer/146/query";
const WHERE = `propclass IN (102,202,302,402) AND mborsev>=${MIN_VAL} AND mborsev<=${MAX_VAL} AND ownername1 IS NOT NULL AND ownerstreetaddr IS NOT NULL`;
const OUT_FIELDS = "OBJECTID,PIN,ownername1,ownername2,ownercareof,ownerstreetaddr,ownercity,ownerstate,ownerzip,propclass,mborsev,mborass,Acres,legal,propstreetcombined";
const SOURCE = "MI:ARCGIS_ROSCOMMON";

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
  catch (e) { await sleep(3000); try { j = await fetchPage(off); } catch { console.log(`Roscommon: sayfa ${page} hata — durduruldu`); break; } }
  const feats = j.features ?? [];
  if (!feats.length) break;
  off += feats.length;
  for (const f of feats) {
    const a = f.attributes;
    const apn = clean(a.PIN);
    const owner = [clean(a.ownername1), clean(a.ownername2) !== "0" ? clean(a.ownername2) : ""].filter(Boolean).join(" & ");
    const careOf = clean(a.ownercareof);
    const mail = [careOf && careOf !== "0" ? careOf : "", clean(a.ownerstreetaddr)].filter(Boolean).join(", ");
    const mcity = clean(a.ownercity).toUpperCase();
    const mstate = clean(a.ownerstate).toUpperCase().slice(0, 2) || null;
    if (!apn || !owner || !mail || seen.has(apn)) continue; // sahip+posta zorunlu
    seen.add(apn);
    const acresRaw = Number(a.Acres);
    const acres = Number.isFinite(acresRaw) && acresRaw > 0 ? acresRaw : null;
    const value = Number(a.mborsev) || 0; // MI SEV ≈ piyasa değerinin %50'si
    const c = centroid(f.geometry);
    const situs = clean(a.propstreetcombined) || null;
    recs.push({
      lead_id: `MI-Roscommon-${apn}`,
      state: "MI", county: "Roscommon", region: "Roscommon County, MI (Houghton Lake)",
      apn, owner,
      mailing_address: mail, mailing_city: mcity || null, mailing_state: mstate, mailing_zip: clean(a.ownerzip).slice(0, 5) || null,
      situs,
      use: CLASS_LABEL[a.propclass] || "Vacant",
      acres, land_value: value,
      est_offer: estOffer(value),
      est_retail: acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999,
      absentee: mstate ? (mstate !== "MI" || !ROSCOMMON_CITIES.has(mcity)) : null,
      lat: c ? c[1] : null, lng: c ? c[0] : null,
      source: SOURCE,
    });
  }
  recs.filter((r) => r.est_retail != null && r.est_offer != null).forEach((r) => { r.est_margin = r.est_retail - r.est_offer; });
  console.log(`Roscommon: sayfa ${page + 1} → toplam ${recs.length}`);
  if (TEST && page >= 1) break;
  await sleep(300);
}

const absN = recs.filter((r) => r.absentee).length;
const outN = recs.filter((r) => r.mailing_state && r.mailing_state !== "MI").length;
console.log(`Roscommon: ${recs.length} vacant lot · absentee ${absN} (eyalet dışı ${outN})`);
for (let i = 0; i < recs.length; i += 500) {
  const part = recs.slice(i, i + 500);
  const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
  if (error) { console.error(`Roscommon: upsert hatası (${i}): ${error.message}`); process.exit(1); }
}
console.log(`✔ Roscommon: ${recs.length} kayıt yazıldı`);

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "MI");
console.log(`\n✔ BİTTİ: Supabase MI toplam ${count}`);
