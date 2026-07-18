#!/usr/bin/env node
/**
 * FLORIDA — LEE COUNTY off-market pull. Absentee vacant lot, doğrudan sahip.
 * Kaynak: Lee County Property Appraiser parcels (HALKA AÇIK ArcGIS FeatureServer).
 *   https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/.../Lee_County_Parcels/FeatureServer/0
 * Owner MAILING alanları: O_NAME, O_ADDR1/2, O_CITY, O_STATE, O_ZIP.
 * Filtre: DORCODE '00%' (vacant residential) + O_STATE<>'FL' + LAND 1..15000.
 * Çıktı: dashboard/src/data/florida-lee-offmarket.json + Supabase offmarket_leads upsert.
 * Kullanım: node scraper/offmarket-fl-lee.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/arcgis/rest/services/Lee_County_Parcels/FeatureServer/0/query";
const COUNTY = "Lee";
const PAGE = 2000;
const MAX = Number(process.env.MAX || 40000);
const MAXVAL = Number(process.env.MAXVAL || 15000);

const WHERE = `DORCODE LIKE '00%' AND O_STATE<>'FL' AND O_STATE IS NOT NULL AND O_STATE<>'' AND LAND>0 AND LAND<=${MAXVAL}`;
const FIELDS = "STRAP,O_NAME,O_OTHERS,O_ADDR1,O_ADDR2,O_CITY,O_STATE,O_ZIP,LAND,JUST,GISACRES,SITEADDR,SITECITY,LANDUSEDES,DORCODE,LATITUDE,LONGITUDE";

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
const estOffer = (v) => Math.min(1200, Math.max(400, Math.round((v || 0) * 0.5)));

function loadEnvLocal() {
  const p = resolve(ROOT, "dashboard/.env.local");
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

async function fetchPage(offset) {
  const p = new URLSearchParams({ where: WHERE, outFields: FIELDS, returnGeometry: "false", orderByFields: "STRAP ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

async function main() {
  console.log("Florida — Lee County off-market pull…\nfiltre:", WHERE);
  const rows = []; const seen = new Set();
  for (let off = 0; off < MAX; off += PAGE) {
    let j;
    try { j = await fetchPage(off); }
    catch (e) { console.warn(`uyarı @${off}: ${e.message}`); await new Promise(r => setTimeout(r, 2500)); try { j = await fetchPage(off); } catch (e2) { console.error("atlandı:", e2.message); continue; } }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.STRAP || "").trim();
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = [a.O_NAME, a.O_OTHERS].filter(Boolean).join(" & ").trim();
      const mail = [a.O_ADDR1, a.O_ADDR2].filter(Boolean).join(" ").trim();
      if (!owner || !mail || !a.O_CITY) continue;
      const lv = num(a.LAND);
      if (!(lv > 0 && lv <= MAXVAL)) continue;
      const acres = Number(a.GISACRES) || null;
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = estOffer(lv);
      rows.push({
        apn, owner,
        mailing_address: mail, mailing_city: a.O_CITY, mailing_state: a.O_STATE, mailing_zip: String(a.O_ZIP ?? ""),
        situs: [a.SITEADDR, a.SITECITY].filter(Boolean).join(", "),
        use: a.LANDUSEDES || "Vacant", acres: acres ? +acres.toFixed(3) : null, land_value: lv,
        full_cash_value: num(a.JUST) || null,
        county: COUNTY, region: `${COUNTY} County`,
        lat: Number(a.LATITUDE) || null, lng: Number(a.LONGITUDE) || null,
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
      });
    }
    console.log(`offset ${off}: +${feats.length} (tutulan ${rows.length})`);
    if (feats.length < PAGE) break;
  }
  rows.sort((a, b) => a.land_value - b.land_value);

  const outJson = resolve(ROOT, "dashboard/src/data/florida-lee-offmarket.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "FL", county: COUNTY, source: "Lee County Property Appraiser (public ArcGIS)", filter: WHERE, rows }, null, 2));
  console.log(`\n✅ ${rows.length} FL/Lee absentee vacant lot.`);

  // ---- Supabase upsert ----
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `FL-${COUNTY}-${r.apn}`,
    state: "FL", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: !!(r.mailing_state && r.mailing_state !== "FL"), lat: r.lat, lng: r.lng,
    source: `ARCGIS:FL-${COUNTY}`,
  }));
  const CHUNK = 500;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const part = recs.slice(i, i + CHUNK);
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error("upsert hatası:", error.message); process.exit(1); }
    process.stdout.write(`\r  upsert ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "FL");
  const { count: all } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ Supabase FL=${count} | tablo toplam=${all}`);
}
main().catch(e => { console.error("HATA:", e); process.exit(1); });
