#!/usr/bin/env node
/**
 * NEVADA OFF-MARKET — 15-eyalet genişlemesi 2. dalga (NV aktivasyonu).
 *
 * NYE COUNTY (Pahrump/Calvada + Tonopah/Beatty/Amargosa) — resmi Nye County
 * Planning Department AGOL parsel katmanı (assessor join'li):
 *   https://services7.arcgis.com/AvZJsNr6HZ4v00zd/arcgis/rest/services/Nye_County_Planning_Department_WFL1/FeatureServer/4
 *
 * Neden Nye: Pahrump/Calvada 1960-70'lerin posta-yoluyla-satılmış scam
 * subdivision lotlarının merkezi — sahiplerin ezici kısmı eyalet dışı absentee.
 *
 * Filtre: vacant (improv_val=0) + land 300–20.000$ + sahip adı (assess_nam) +
 * posta adresi (address1) dolu — proje kuralı: mektup atılabilir olmalı.
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - absentee: mailing eyaleti != NV VEYA NV içi ama Nye dışı posta şehri.
 *  - Katmanda ayrı mailing-state alanı yok; mcity "CITY, ST" formatında —
 *    virgül sonrası 2 harf eyalet olarak ayrıştırılır, ayrışamayan absentee=null.
 *  - est_offer NC kuralı (land*0.35, 400–1500), est_retail acres tabanlı NC
 *    kuralı — land_value (assessed) mevcut olduğu için hesaplanır.
 *  - Koordinat parsel poligon merkezi (servis geometrisinden, outSR 4326).
 *  - Kaynakta olmayan hiçbir alan uydurulmaz.
 *
 * Çalıştır: node scraper/nevada-offmarket.mjs   (TEST=1 → 2 sayfa)
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

// "269.1 a" → 269.1 (yalnız 'a'/acre son ekli değerler kabul; belirsizse null)
function parseAcres(s) {
  const m = clean(s).match(/^([\d.]+)\s*a\b/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// "WOODLAND, CA" → { city: "WOODLAND", st: "CA" }
function splitCityState(mcity) {
  const t = clean(mcity).toUpperCase();
  const m = t.match(/^(.*?),?\s+([A-Z]{2})$/);
  return m ? { city: clean(m[1]).replace(/,$/, ""), st: m[2] } : { city: t, st: null };
}

// Nye içi posta şehirleri (county-içi = absentee değil)
const NYE_CITIES = new Set(["PAHRUMP", "TONOPAH", "BEATTY", "AMARGOSA VALLEY", "AMARGOSA", "GABBS", "ROUND MOUNTAIN", "MANHATTAN", "SMOKY VALLEY", "HADLEY", "DUCKWATER", "CRYSTAL", "MERCURY"]);

const LAYER = "https://services7.arcgis.com/AvZJsNr6HZ4v00zd/arcgis/rest/services/Nye_County_Planning_Department_WFL1/FeatureServer/4/query";
const WHERE = `improv_val=0 AND land_value>=${MIN_VAL} AND land_value<=${MAX_VAL} AND assess_nam <> ' ' AND address1 <> ' '`;
const OUT_FIELDS = "PARCELID,parcel_num,assess_nam,legal_name,address1,address2,mcity,mzip,SITEADDRES,phys_addr,USEDSCRP,py_use_cod,sub,STATEDAREA,land_value";
const SOURCE = "NV:ARCGIS_NYE_PLANNING";

async function fetchPage(offset) {
  const p = new URLSearchParams({
    where: WHERE, outFields: OUT_FIELDS,
    returnGeometry: "true", outSR: "4326",
    orderByFields: "FID ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
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
  catch (e) { await sleep(3000); try { j = await fetchPage(off); } catch { console.log(`Nye: sayfa ${page} hata — durduruldu`); break; } }
  const feats = j.features ?? [];
  if (!feats.length) break;
  off += feats.length;
  for (const f of feats) {
    const a = f.attributes;
    const apn = clean(a.PARCELID) || clean(a.parcel_num);
    const owner = clean(a.assess_nam);
    const mail = [clean(a.address1), clean(a.address2)].filter(Boolean).join(", ");
    if (!apn || !owner || !mail || seen.has(apn)) continue; // sahip+posta zorunlu
    seen.add(apn);
    const { city: mcity, st: mstate } = splitCityState(a.mcity);
    const acres = parseAcres(a.STATEDAREA);
    const value = Number(a.land_value) || 0;
    const c = centroid(f.geometry);
    const situs = clean(a.phys_addr) || clean(a.SITEADDRES) || null;
    recs.push({
      lead_id: `NV-Nye-${apn}`,
      state: "NV", county: "Nye", region: "Nye County, NV (Pahrump/Calvada)",
      apn, owner,
      mailing_address: mail, mailing_city: mcity || null, mailing_state: mstate, mailing_zip: clean(a.mzip).slice(0, 5) || null,
      situs,
      use: clean(a.sub) ? `Subdivision: ${clean(a.sub)}` : (clean(a.USEDSCRP) || "Vacant"),
      acres, land_value: value,
      est_offer: estOffer(value),
      est_retail: acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999,
      absentee: mstate ? (mstate !== "NV" || !NYE_CITIES.has(mcity)) : null,
      lat: c ? c[1] : null, lng: c ? c[0] : null,
      source: SOURCE,
    });
  }
  recs.filter((r) => r.est_retail != null && r.est_offer != null).forEach((r) => { r.est_margin = r.est_retail - r.est_offer; });
  console.log(`Nye: sayfa ${page + 1} → toplam ${recs.length}`);
  if (TEST && page >= 1) break;
  await sleep(300);
}

const absN = recs.filter((r) => r.absentee).length;
const outN = recs.filter((r) => r.mailing_state && r.mailing_state !== "NV").length;
console.log(`Nye: ${recs.length} vacant lot · absentee ${absN} (eyalet dışı ${outN})`);
for (let i = 0; i < recs.length; i += 500) {
  const part = recs.slice(i, i + 500);
  const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
  if (error) { console.error(`Nye: upsert hatası (${i}): ${error.message}`); process.exit(1); }
}
console.log(`✔ Nye: ${recs.length} kayıt yazıldı`);

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "NV");
console.log(`\n✔ BİTTİ: Supabase NV toplam ${count}`);
