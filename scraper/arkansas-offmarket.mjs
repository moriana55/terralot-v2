#!/usr/bin/env node
/**
 * ARKANSAS OFF-MARKET — 6. eyalet (10-eyalet genişlemesi, kontrollü başlangıç).
 * Kaynak: AR GIS Office statewide PARCEL_CENTROID_CAMP (ücretsiz, resmi).
 *   https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/0
 *
 * Kapsam: 3 "arsa flip" county'si — Sharp (Cherokee Village), Izard (Horseshoe
 * Bend), Van Buren (Fairfield Bay). Filtre: imp=0 (yapı yok) + land 500–12.000$.
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - Bu katmanda POSTA ADRESİ YOK (yalnız sahip adı + parsel adresi). mailing_*
 *    boş bırakılır; sahiplere ulaşım skip-trace (ad + county) ile olur → mevcut
 *    Sıcak Arama akışına uygun. absentee bilinmiyor → null.
 *  - acres alanı yok → null; est_retail sabit taban (2999$) — CO ile aynı kural.
 *  - Koordinat servisten gelir (centroid), üretilmez.
 *
 * Çalıştır: node scraper/arkansas-offmarket.mjs   (TEST=1 → county başına 2 sayfa)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const LAYER = "https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/0/query";
const COUNTIES = { "05135": "Sharp", "05065": "Izard", "05141": "Van Buren" };
const MIN_VAL = 500, MAX_VAL = 12000, PAGE = 1000;
const TEST = process.env.TEST === "1";

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
function estOffer(v) { return Math.min(1200, Math.max(400, Math.round((v || 0) * 0.5))); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(fips, offset) {
  const p = new URLSearchParams({
    where: `countyfips='${fips}' AND impvalue=0 AND landvalue>=${MIN_VAL} AND landvalue<=${MAX_VAL}`,
    outFields: "parcelid,ownername,adrlabel,adrcity,landvalue,subdivision,parcellgl",
    returnGeometry: "true", outSR: "4326",
    orderByFields: "objectid ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
  });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000) });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "arcgis error");
  return j;
}

let grand = 0;
for (const [fips, county] of Object.entries(COUNTIES)) {
  const seen = new Set();
  const recs = [];
  for (let off = 0, page = 0; ; page++) {
    let j;
    try { j = await fetchPage(fips, off); }
    catch (e) { await sleep(2000); try { j = await fetchPage(fips, off); } catch { console.log(`${county}: sayfa ${page} hata — durduruldu`); break; } }
    const feats = j.features ?? [];
    if (!feats.length) break;
    off += feats.length; // servis maxRecordCount'u (200) bizim PAGE'den küçük olabilir
    for (const f of feats) {
      const a = f.attributes;
      const apn = clean(a.parcelid);
      const owner = clean(a.ownername);
      if (!apn || !owner || seen.has(apn)) continue;
      seen.add(apn);
      const v = Number(a.landvalue) || 0;
      const retail = 2999;
      const offer = estOffer(v);
      recs.push({
        lead_id: `AR-${county.replace(/\s+/g, "")}-${apn}`,
        state: "AR", county, region: `${county} County, AR`,
        apn, owner,
        mailing_address: null, mailing_city: null, mailing_state: null, mailing_zip: null,
        situs: [clean(a.adrlabel), clean(a.adrcity)].filter(Boolean).join(", ") || null,
        use: clean(a.subdivision) ? `Subdivision: ${clean(a.subdivision)}` : "Vacant",
        acres: null, land_value: v,
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
        absentee: null,
        lat: f.geometry?.y ?? null, lng: f.geometry?.x ?? null,
        source: "AR:PARCEL_CENTROID_CAMP",
      });
    }
    console.log(`${county}: sayfa ${page + 1} → toplam ${recs.length}`);
    if (TEST && page >= 1) break;
    await sleep(250);
  }
  for (let i = 0; i < recs.length; i += 500) {
    const part = recs.slice(i, i + 500);
    const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error(`${county}: upsert hatası: ${error.message}`); process.exit(1); }
  }
  console.log(`✔ ${county}: ${recs.length} kayıt yazıldı`);
  grand += recs.length;
}

const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "AR");
const { count: all } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true });
console.log(`\n✔ BİTTİ: bu koşuda ${grand} kayıt · Supabase AR toplam ${count} · tablo toplam ${all}`);
