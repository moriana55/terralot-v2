#!/usr/bin/env node
/**
 * NORTH CAROLINA OFF-MARKET — 7. eyalet (10-eyalet genişlemesi).
 * Kaynak: NC OneMap statewide parcels (resmî, ücretsiz) — nadir zenginlikte:
 * sahip adı + TAM POSTA ADRESİ + land/imp değerleri + gisacres + subdivision.
 *   https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1
 *
 * Kapsam (kontrollü): Brunswick (sahil/Boiling Spring Lakes), Rutherford
 * (Lake Lure), Northampton. Filtre: imp=0 + land 500–15.000$ + ≥0.15 acre.
 * Posta adresi TAM → absentee hesaplanır; hem mektup hem arama akışına uygun.
 * Koordinat: parsel poligonunun merkezi (servis geometrisinden, üretilmez).
 *
 * Çalıştır: node scraper/nc-offmarket.mjs   (TEST=1 → county başına 2 sayfa)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const LAYER = "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1/query";
const COUNTIES = ["Brunswick", "Rutherford", "Northampton"];
const MIN_VAL = 500, MAX_VAL = 15000, MIN_AC = 0.15, PAGE = 1000;
const TEST = process.env.TEST === "1";

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function estOffer(v) { return Math.min(1500, Math.max(400, Math.round((v || 0) * 0.35))); }

function centroid(geom) {
  const ring = geom?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const lng = sx / ring.length, lat = sy / ring.length;
  return Number.isFinite(lat) && Math.abs(lat) <= 90 ? [lng, lat] : null;
}

async function fetchPage(county, offset) {
  const p = new URLSearchParams({
    where: `cntyname='${county}' AND improvval=0 AND landval>=${MIN_VAL} AND landval<=${MAX_VAL} AND gisacres>=${MIN_AC}`,
    outFields: "parno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,gisacres,landval,parval,subdivisio,parusedesc,saledatetx",
    returnGeometry: "true", outSR: "4326",
    orderByFields: "objectid ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
  });
  const res = await fetch(LAYER, { method: "POST", body: p, signal: AbortSignal.timeout(90000) });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "arcgis error");
  return j;
}

let grand = 0;
for (const county of COUNTIES) {
  const seen = new Set();
  const recs = [];
  for (let off = 0, page = 0; ; page++) {
    let j;
    try { j = await fetchPage(county, off); }
    catch (e) { await sleep(2500); try { j = await fetchPage(county, off); } catch { console.log(`${county}: sayfa ${page} hata — durduruldu`); break; } }
    const feats = j.features ?? [];
    if (!feats.length) break;
    off += feats.length;
    for (const f of feats) {
      const a = f.attributes;
      const apn = clean(a.parno);
      const owner = clean(a.ownname);
      const mail = clean(a.mailadd);
      if (!apn || !owner || !mail || seen.has(apn)) continue; // sahip+posta zorunlu (proje kuralı)
      seen.add(apn);
      const v = Number(a.landval) || 0;
      const acres = Number(a.gisacres) || null;
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = estOffer(v);
      const c = centroid(f.geometry);
      const mstate = clean(a.mstate).toUpperCase();
      recs.push({
        lead_id: `NC-${county}-${apn}`,
        state: "NC", county, region: `${county} County, NC`,
        apn, owner,
        mailing_address: mail, mailing_city: clean(a.mcity) || null, mailing_state: mstate || null, mailing_zip: clean(a.mzip) || null,
        situs: [clean(a.siteadd), clean(a.scity)].filter(Boolean).join(", ") || null,
        use: clean(a.subdivisio) ? `Subdivision: ${clean(a.subdivisio)}` : (clean(a.parusedesc) || "Vacant"),
        acres, land_value: v,
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
        absentee: mstate ? mstate !== "NC" : null,
        lat: c ? c[1] : null, lng: c ? c[0] : null,
        source: "NC:OneMap_Parcels",
      });
    }
    console.log(`${county}: sayfa ${page + 1} → toplam ${recs.length}`);
    if (TEST && page >= 1) break;
    await sleep(300);
  }
  for (let i = 0; i < recs.length; i += 500) {
    const part = recs.slice(i, i + 500);
    const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error(`${county}: upsert hatası: ${error.message}`); process.exit(1); }
  }
  console.log(`✔ ${county}: ${recs.length} kayıt yazıldı`);
  grand += recs.length;
}

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "NC");
const { count: all } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true });
console.log(`\n✔ BİTTİ: bu koşuda ${grand} kayıt · Supabase NC toplam ${count} · tablo toplam ${all}`);
