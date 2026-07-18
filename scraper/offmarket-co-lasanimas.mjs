#!/usr/bin/env node
/**
 * LAS ANIMAS COUNTY, CO OFF-MARKET PULL — absentee boş arsa, doğrudan sahip.
 * CO statewide layer bu county'yi ATLAR (Trinidad / güney CO ucuz arsa).
 * Kaynak: Las Animas County ArcGIS (HALKA AÇIK FeatureServer, LasAnimasParcels).
 *   https://services7.arcgis.com/NWWOCaXnjdetEWUz/arcgis/rest/services/LasAnimasParcels/FeatureServer/2
 *
 * Alanlar: NAME (owner), ADDRESS1/ADDRESS2, CITY, STATE, ZIPCODEM (mailing),
 *   SitusWhole/FullAddres (situs), ACRES, ACCTTYPE (VACANT_LAND vb.), ACCOUNTNO/ParcelNum.
 *   ⚠ Değer alanı YOK → land_value null; ucuzluk boş-arsa+absentee ile sağlanır.
 *
 * Filtre (server): ACCTTYPE LIKE '%VACANT%' AND STATE<>'CO' (absentee) AND ACRES 0.3..40.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://services7.arcgis.com/NWWOCaXnjdetEWUz/arcgis/rest/services/LasAnimasParcels/FeatureServer/2/query";
const PAGE = 2000;
const MAX = Number(process.env.MAX || 40000);
const MINAC = Number(process.env.MINAC || 0.3);
const MAXAC = Number(process.env.MAXAC || 40);

const WHERE = `ACCTTYPE LIKE '%VACANT%' AND STATE<>'CO' AND STATE IS NOT NULL AND STATE<>'' AND ACRES>=${MINAC} AND ACRES<=${MAXAC}`;
const FIELDS = "ACCOUNTNO,ParcelNum,NAME,CAREOF,ADDRESS1,ADDRESS2,CITY,STATE,ZIPCODEM,SitusWhole,FullAddres,ACRES,ACCTTYPE";

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
  const p = new URLSearchParams({ where: WHERE, outFields: FIELDS, returnGeometry: "false", orderByFields: "OBJECTID ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

async function main() {
  console.log("Las Animas CO off-market pull…\nfiltre (server):", WHERE);
  const rows = []; const seen = new Set();
  for (let off = 0; off < MAX; off += PAGE) {
    let j;
    try { j = await fetchPage(off); }
    catch (e) { console.warn(`uyarı @${off}: ${e.message}`); await new Promise((r) => setTimeout(r, 2500)); try { j = await fetchPage(off); } catch (e2) { console.error("atlandı:", e2.message); continue; } }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.ACCOUNTNO || a.ParcelNum || "").trim();
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = String(a.NAME || "").trim();
      const street = [a.ADDRESS1, a.ADDRESS2].filter(Boolean).join(" ").trim();
      const city = String(a.CITY || "").trim();
      if (!owner || !street || !city) continue;
      const st = String(a.STATE || "").trim().toUpperCase();
      const acres = Number(a.ACRES) > 0 ? Math.round(Number(a.ACRES) * 100) / 100 : null;
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = Math.min(1200, Math.max(400, Math.round(retail * 0.35)));
      rows.push({
        apn, owner,
        mailing_address: street, mailing_city: city, mailing_state: st, mailing_zip: String(a.ZIPCODEM || "").trim(),
        situs: String(a.SitusWhole || a.FullAddres || "").trim(), use: String(a.ACCTTYPE || "VACANT_LAND").trim(),
        acres, land_value: null,
        county: "Las Animas", region: "Las Animas County",
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
        absentee: !!(st && st !== "CO"),
      });
    }
    console.log(`offset ${off}: +${feats.length} (tutulan ${rows.length})`);
    if (feats.length < PAGE) break;
  }
  rows.sort((a, b) => b.est_margin - a.est_margin);

  const outJson = resolve(ROOT, "dashboard/src/data/co-lasanimas-offmarket.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "CO", county: "Las Animas", source: "Las Animas County ArcGIS (LasAnimasParcels)", filter: WHERE, rows }, null, 2));
  console.log(`\n✅ ${rows.length} Las Animas absentee vacant lot.`);

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `CO-LasAnimas-${r.apn}`,
    state: "CO", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: r.absentee, lat: null, lng: null, source: "ARCGIS:CO-lasanimas",
  }));
  const CHUNK = 500;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const part = recs.slice(i, i + CHUNK);
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error("upsert hatası:", error.message); process.exit(1); }
    process.stdout.write(`\r  upsert ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "CO");
  const { count: all } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ Supabase CO=${count} | tablo toplam=${all}`);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
