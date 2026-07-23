#!/usr/bin/env node
/**
 * OREGON OFF-MARKET — 15-eyalet genişlemesi 2. dalga (OR aktivasyonu). 2 county:
 *
 * 1) KLAMATH — resmi Klamath County AGOL taxlot yayını (assessor join'li, taze):
 *    https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/KC_Taxlots/FeatureServer/1
 *    Filtre: vacant (IMP_APPR=0) + land appraised 300–20.000$ + sahip + posta.
 *    Koordinat: servisin INSIDE_X/INSIDE_Y alanları (parsel içi nokta, WGS84).
 * 2) LAKE (Christmas Valley) — aynı org'daki LakeCoTaxlots (ORMAP tabanlı,
 *    owner+mailing dolu): vacant sınıflar (OR prop class 100/109/400/409 =
 *    unimproved residential/tract) + sahip + posta. Assessed value YOK →
 *    est_offer/est_retail null bırakılır (proje kuralı: değer yoksa uydurma).
 *
 * Neden bu ikili: Christmas Valley (Lake) 1960'ların posta-yoluyla-satılmış
 * çöl subdivision'ı; Klamath (Sprague River/Bonanza/Beatty/Chiloquin çevresi)
 * benzer uzaktan-satılmış kurak parsellerin havzası — absentee yoğun.
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - absentee: mailing_state != OR VEYA OR içi ama county-dışı posta şehri.
 *  - Kaynakta olmayan hiçbir alan uydurulmaz.
 *
 * Çalıştır: node scraper/oregon-offmarket.mjs   (TEST=1 → county başına 2 sayfa)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const MIN_VAL = 300, MAX_VAL = 20000, PAGE = 1000;
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

function absenteeOf(mstate, mcity, inCountyCities) {
  if (!mstate) return null;
  return mstate !== "OR" || !inCountyCities.has(mcity);
}

const SOURCES = [
  {
    county: "Klamath",
    layer: "https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/KC_Taxlots/FeatureServer/1/query",
    where: `IMP_APPR=0 AND LND_APPR>=${MIN_VAL} AND LND_APPR<=${MAX_VAL} AND OWNER_NAME IS NOT NULL AND MAIL1 IS NOT NULL`,
    outFields: "PROP_ID,MAP_TAXLOT,ORTaxlot,OWNER_NAME,MAIL1,MAIL2,MAILCITY,MAILST,ZIP,ACREAGE,GIS_Acres,LND_APPR,PROP_CLASS,SUBDIVISION,SITUS_ADDRESS,SITUSCITY,Community_Name,INSIDE_X,INSIDE_Y",
    orderBy: "OBJECTID ASC",
    returnGeometry: false, // INSIDE_X/Y hazır WGS84 parsel-içi nokta
    source: "OR:ARCGIS_KLAMATH_TAXLOTS",
    inCountyCities: new Set(["KLAMATH FALLS", "CHILOQUIN", "BONANZA", "MALIN", "MERRILL", "SPRAGUE RIVER", "BEATTY", "BLY", "DAIRY", "KENO", "MIDLAND", "FORT KLAMATH", "CRESCENT", "GILCHRIST", "CHEMULT", "ROCKY POINT", "LA PINE"]),
    map(a, geom) {
      const apn = clean(a.MAP_TAXLOT) || clean(a.ORTaxlot) || (a.PROP_ID != null ? `P${a.PROP_ID}` : "");
      const lat = Number(a.INSIDE_Y), lng = Number(a.INSIDE_X);
      return {
        apn, owner: clean(a.OWNER_NAME),
        mail: [clean(a.MAIL1), clean(a.MAIL2)].filter(Boolean).join(", "),
        mcity: clean(a.MAILCITY), mstate: clean(a.MAILST).toUpperCase().slice(0, 2), mzip: clean(a.ZIP).slice(0, 5),
        situs: [clean(a.SITUS_ADDRESS), clean(a.SITUSCITY)].filter(Boolean).join(", ") || null,
        use: [clean(a.SUBDIVISION) ? `Subdivision: ${clean(a.SUBDIVISION)}` : "", `Class ${clean(a.PROP_CLASS)}`, clean(a.Community_Name)].filter(Boolean).join(" · ") || "Vacant",
        acres: Number(a.ACREAGE) || Number(a.GIS_Acres) || null,
        value: Number(a.LND_APPR) || 0,
        lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
        lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
      };
    },
  },
  {
    county: "Lake",
    layer: "https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/LakeCoTaxlots/FeatureServer/0/query",
    where: `PrpClass IN ('100','109','400','409') AND OwnerLine1 IS NOT NULL AND MailAdd1 IS NOT NULL`,
    outFields: "MapTaxlot,ORTaxlot,OwnerLine1,OwnerLine2,MailAdd1,MailAdd2,MailCity,MailState,MailZip,TaxlotAcre,PrpClass,SiteAddNam,SiteAddCty",
    orderBy: "OBJECTID ASC",
    returnGeometry: true,
    source: "OR:ARCGIS_LAKE_TAXLOTS",
    inCountyCities: new Set(["LAKEVIEW", "PAISLEY", "CHRISTMAS VALLEY", "SILVER LAKE", "SUMMER LAKE", "FORT ROCK", "NEW PINE CREEK", "PLUSH", "ADEL", "WESTSIDE"]),
    map(a, geom) {
      const situsName = clean(a.SiteAddNam);
      const c = centroid(geom);
      return {
        apn: clean(a.MapTaxlot) || clean(a.ORTaxlot),
        owner: [clean(a.OwnerLine1), clean(a.OwnerLine2)].filter(Boolean).join(" & "),
        mail: [clean(a.MailAdd1), clean(a.MailAdd2)].filter(Boolean).join(", "),
        mcity: clean(a.MailCity), mstate: clean(a.MailState).toUpperCase().slice(0, 2), mzip: clean(a.MailZip).slice(0, 5),
        situs: situsName && !/UNDETERMINED/i.test(situsName) ? [situsName, clean(a.SiteAddCty)].filter(Boolean).join(", ") : null,
        use: `Class ${clean(a.PrpClass)} (vacant)`,
        acres: Number(a.TaxlotAcre) || null,
        value: 0, // katmanda assessed value yok — est hesaplanmaz
        lat: c ? c[1] : null,
        lng: c ? c[0] : null,
      };
    },
  },
];

async function fetchPage(src, offset) {
  const p = new URLSearchParams({
    where: src.where, outFields: src.outFields,
    returnGeometry: String(src.returnGeometry), outSR: "4326",
    orderByFields: src.orderBy, resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
  });
  const res = await fetch(src.layer, { method: "POST", body: p, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(120000) });
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
    catch (e) { await sleep(3000); try { j = await fetchPage(src, off); } catch { console.log(`${src.county}: sayfa ${page} hata — durduruldu`); break; } }
    const feats = j.features ?? [];
    if (!feats.length) break;
    off += feats.length;
    for (const f of feats) {
      const m = src.map(f.attributes, f.geometry);
      if (!m.apn || !m.owner || !m.mail || seen.has(m.apn)) continue; // sahip+posta zorunlu
      seen.add(m.apn);
      const hasVal = m.value > 0;
      const offer = hasVal ? estOffer(m.value) : null;
      const retail = hasVal ? (m.acres ? Math.round(2999 * Math.max(0.7, Math.min(3, m.acres))) : 2999) : null;
      recs.push({
        lead_id: `OR-${src.county}-${m.apn}`,
        state: "OR", county: src.county, region: src.county === "Lake" ? "Lake County, OR (Christmas Valley)" : "Klamath County, OR",
        apn: m.apn, owner: m.owner,
        mailing_address: m.mail, mailing_city: m.mcity || null, mailing_state: m.mstate || null, mailing_zip: m.mzip || null,
        situs: m.situs,
        use: m.use,
        acres: m.acres, land_value: hasVal ? m.value : null,
        est_offer: offer, est_retail: retail, est_margin: offer != null && retail != null ? retail - offer : null,
        absentee: absenteeOf(m.mstate, m.mcity.toUpperCase(), src.inCountyCities),
        lat: m.lat, lng: m.lng,
        source: src.source,
      });
    }
    console.log(`${src.county}: sayfa ${page + 1} → toplam ${recs.length}`);
    if (TEST && page >= 1) break;
    await sleep(300);
  }
  const absN = recs.filter((r) => r.absentee).length;
  const outN = recs.filter((r) => r.mailing_state && r.mailing_state !== "OR").length;
  console.log(`${src.county}: ${recs.length} vacant lot · absentee ${absN} (eyalet dışı ${outN})`);
  for (let i = 0; i < recs.length; i += 500) {
    const part = recs.slice(i, i + 500);
    const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error(`${src.county}: upsert hatası (${i}): ${error.message}`); process.exit(1); }
  }
  console.log(`✔ ${src.county}: ${recs.length} kayıt yazıldı`);
  grand += recs.length;
}

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "OR");
console.log(`\n✔ BİTTİ: bu koşuda ${grand} kayıt · Supabase OR toplam ${count}`);
