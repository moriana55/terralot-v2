#!/usr/bin/env node
/**
 * GEORGIA OFF-MARKET — 10-eyalet genişlemesi (GA aktivasyonu). 2 county:
 *
 * 1) BIBB (Macon) — resmi ArcGIS CAMA parsel katmanı (2022 CAMA yayını):
 *    https://services2.arcgis.com/zPFLSOZ5HzUzzTQb/arcgis/rest/services/Parcel_CAMA2022/FeatureServer/0
 * 2) CHATHAM (Savannah) — SAGIS Parcel Digest (owner + posta + FMV + acres):
 *    https://pub.sagis.org/arcgis/rest/services/Pictometry/ParcelDigest/MapServer/0
 *
 * Filtre (ikisi de): vacant (improvement değeri 0) + land 300–15.000$ +
 * sahip adı + posta adresi dolu (proje kuralı: mektup atılabilir olmalı).
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - absentee: mailing_state != GA VEYA GA içi ama county dışı posta şehri.
 *  - est_offer NC kuralı (land*0.35, 400–1500), est_retail acres tabanlı NC
 *    kuralı. Koordinat parsel poligon merkezi (servis geometrisinden).
 *  - Kaynakta olmayan hiçbir alan uydurulmaz.
 *
 * Çalıştır: node scraper/georgia-offmarket.mjs   (TEST=1 → county başına 2 sayfa)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const MIN_VAL = 300, MAX_VAL = 15000, PAGE = 1000;
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

// mailing GA içindeyse county-dışı şehir kontrolüyle absentee üret
function absenteeOf(mstate, mcity, inCountyCities) {
  if (!mstate) return null;
  return mstate !== "GA" || !inCountyCities.has(mcity);
}

const SOURCES = [
  {
    county: "Bibb",
    layer: "https://services2.arcgis.com/zPFLSOZ5HzUzzTQb/arcgis/rest/services/Parcel_CAMA2022/FeatureServer/0/query",
    where: `LANDVAL>=${MIN_VAL} AND LANDVAL<=${MAX_VAL} AND FMVRES=0 AND FMVCOM=0 AND FMVACC=0 AND LASTNAME IS NOT NULL AND ADDRESS1 IS NOT NULL`,
    outFields: "PARCEL_NO,LASTNAME,ADDRESS1,ADDRESS2,ADDRESS3,CITY,STATE,ZIP,SITEADDRES,LANDVAL,TOTALACRES,CALC_ACRE,SUBD_NAME,LEGAL_DESC",
    orderBy: "OBJECTID_1 ASC",
    source: "GA:ARCGIS_BIBB_CAMA2022",
    inCountyCities: new Set(["MACON", "PAYNE CITY", "PAYNE"]),
    map(a) {
      return {
        apn: clean(a.PARCEL_NO), owner: clean(a.LASTNAME),
        mail: [clean(a.ADDRESS1), clean(a.ADDRESS2), clean(a.ADDRESS3)].filter(Boolean).join(", "),
        mcity: clean(a.CITY), mstate: clean(a.STATE).toUpperCase(), mzip: clean(a.ZIP).slice(0, 5),
        situs: clean(a.SITEADDRES) ? `${clean(a.SITEADDRES)}, Macon` : null,
        use: clean(a.SUBD_NAME) ? `Subdivision: ${clean(a.SUBD_NAME)}` : (clean(a.LEGAL_DESC) || "Vacant"),
        acres: Number(a.TOTALACRES) || Number(a.CALC_ACRE) || null,
        value: Number(a.LANDVAL) || 0,
      };
    },
  },
  {
    county: "Chatham",
    layer: "https://pub.sagis.org/arcgis/rest/services/Pictometry/ParcelDigest/MapServer/0/query",
    where: `FMV_Building=0 AND FMV_Land>=${MIN_VAL} AND FMV_Land<=${MAX_VAL} AND Owner IS NOT NULL AND Mailing_Address IS NOT NULL`,
    outFields: "PIN,Owner,Owner2,Mailing_Address,Mailing_City,Mailing_State,Mailing_Zip,PropAddress_Full,PropAddress_City,FMV_Land,Acres,Property_Use,Legal_Description",
    orderBy: "OBJECTID ASC",
    source: "GA:ARCGIS_SAGIS_CHATHAM",
    inCountyCities: new Set(["SAVANNAH", "TYBEE ISLAND", "POOLER", "GARDEN CITY", "PORT WENTWORTH", "THUNDERBOLT", "BLOOMINGDALE", "VERNONBURG", "GEORGETOWN", "WILMINGTON ISLAND"]),
    map(a) {
      return {
        apn: clean(a.PIN).replace(/\s+/g, "-"), owner: [clean(a.Owner), clean(a.Owner2)].filter(Boolean).join(" & "),
        mail: clean(a.Mailing_Address),
        mcity: clean(a.Mailing_City), mstate: clean(a.Mailing_State).toUpperCase(), mzip: clean(a.Mailing_Zip).slice(0, 5),
        situs: [clean(a.PropAddress_Full), clean(a.PropAddress_City)].filter(Boolean).join(", ") || null,
        use: clean(a.Property_Use) ? `Use ${clean(a.Property_Use)}${clean(a.Legal_Description) ? " · " + clean(a.Legal_Description) : ""}` : (clean(a.Legal_Description) || "Vacant"),
        acres: Number(a.Acres) || null,
        value: Number(a.FMV_Land) || 0,
      };
    },
  },
];

async function fetchPage(src, offset) {
  const p = new URLSearchParams({
    where: src.where, outFields: src.outFields,
    returnGeometry: "true", outSR: "4326",
    orderByFields: src.orderBy, resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
  });
  const res = await fetch(src.layer, { method: "POST", body: p, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(90000) });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "arcgis error");
  return j;
}

let grand = 0;
for (const src of SOURCES) {
  const seen = new Set();
  const recs = [];
  for (let off = 0, page = 0; ; page++) {
    let j;
    try { j = await fetchPage(src, off); }
    catch (e) { await sleep(2500); try { j = await fetchPage(src, off); } catch { console.log(`${src.county}: sayfa ${page} hata — durduruldu`); break; } }
    const feats = j.features ?? [];
    if (!feats.length) break;
    off += feats.length;
    for (const f of feats) {
      const m = src.map(f.attributes);
      if (!m.apn || !m.owner || !m.mail || seen.has(m.apn)) continue; // sahip+posta zorunlu
      seen.add(m.apn);
      const retail = m.acres ? Math.round(2999 * Math.max(0.7, Math.min(3, m.acres))) : 2999;
      const offer = estOffer(m.value);
      const c = centroid(f.geometry);
      recs.push({
        lead_id: `GA-${src.county}-${m.apn}`,
        state: "GA", county: src.county, region: `${src.county} County, GA`,
        apn: m.apn, owner: m.owner,
        mailing_address: m.mail, mailing_city: m.mcity || null, mailing_state: m.mstate || null, mailing_zip: m.mzip || null,
        situs: m.situs,
        use: m.use,
        acres: m.acres, land_value: m.value,
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
        absentee: absenteeOf(m.mstate, (m.mcity || "").toUpperCase(), src.inCountyCities),
        lat: c ? c[1] : null, lng: c ? c[0] : null,
        source: src.source,
      });
    }
    console.log(`${src.county}: sayfa ${page + 1} → toplam ${recs.length}`);
    if (TEST && page >= 1) break;
    await sleep(300);
  }
  const absN = recs.filter((r) => r.absentee).length;
  const outN = recs.filter((r) => r.mailing_state && r.mailing_state !== "GA").length;
  console.log(`${src.county}: ${recs.length} vacant lot · absentee ${absN} (eyalet dışı ${outN})`);
  for (let i = 0; i < recs.length; i += 500) {
    const part = recs.slice(i, i + 500);
    const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error(`${src.county}: upsert hatası (${i}): ${error.message}`); process.exit(1); }
  }
  console.log(`✔ ${src.county}: ${recs.length} kayıt yazıldı`);
  grand += recs.length;
}

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "GA");
console.log(`\n✔ BİTTİ: bu koşuda ${grand} kayıt · Supabase GA toplam ${count}`);
