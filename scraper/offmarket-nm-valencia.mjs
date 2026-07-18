#!/usr/bin/env node
/**
 * VALENCIA COUNTY, NM OFF-MARKET PULL — absentee boş arsa, doğrudan sahip.
 * Kaynak: Valencia County Assessor ArcGIS (HALKA AÇIK MapServer).
 *   https://arcgisce2.co.valencia.nm.us/arcgis/rest/services/GIS_OnlineMap/MapServer/14 (Parcels)
 *
 * Alanlar: Owner, OwnerAddre (tek string: "STREET \nCITY, ST ZIP"), Situs,
 *   LANDACT (land actual value $), IMPASD (improvement assessed → 0 = boş arsa),
 *   Shape_Area (sq ft → acres = /43560). Ayrı mailing city/state yok → OwnerAddre parse.
 *
 * Filtre (server): IMPASD=0 (boş) AND LANDACT>0 AND LANDACT<=20000 AND
 *   Shape_Area 13068..1742400 (0.3–40 acre). Absentee (mailing state<>NM) client parse.
 * Çıktı: dashboard/src/data/nm-valencia-offmarket.json + Supabase upsert + count.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://arcgisce2.co.valencia.nm.us/arcgis/rest/services/GIS_OnlineMap/MapServer/14/query";
const PAGE = 1000;
const MAX = Number(process.env.MAX || 120000);
const MAXVAL = Number(process.env.MAXVAL || 20000);
const MINAC = Number(process.env.MINAC || 0.3);
const MAXAC = Number(process.env.MAXAC || 40);
const MIN_SQFT = Math.round(MINAC * 43560);
const MAX_SQFT = Math.round(MAXAC * 43560);

const WHERE = `IMPASD=0 AND LANDACT>0 AND LANDACT<=${MAXVAL} AND Shape_Area>=${MIN_SQFT} AND Shape_Area<=${MAX_SQFT}`;
const FIELDS = "UPC,AccountNum,Owner,OwnerAddre,Situs,LANDACT,ActualValu,LANDASD,Shape_Area";

const estOffer = (v) => Math.min(1200, Math.max(400, Math.round((v || 0) * 0.5)));

function parseAddr(s) {
  const raw = String(s ?? "").replace(/\r/g, "").trim();
  const parts = raw.split("\n").map((x) => x.trim()).filter(Boolean);
  let street = "", city = "", st = "", zip = "";
  if (parts.length === 0) return { street, city, st, zip };
  const last = parts[parts.length - 1];
  street = parts.slice(0, -1).join(" ").trim();
  const m = last.match(/^(.*?),\s*([A-Za-z]{2})\b\s*(\d{5}(?:-\d{4})?)?/);
  if (m) { city = m[1].trim(); st = m[2].toUpperCase(); zip = (m[3] || "").trim(); }
  else { city = last; }
  if (!street) { street = last; } // tek satırlı adres → sokak boşsa son satırı kullan
  return { street, city, st, zip };
}

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
  const p = new URLSearchParams({ where: WHERE, outFields: FIELDS, returnGeometry: "false", orderByFields: "UPC ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

async function main() {
  console.log("Valencia NM off-market pull…\nfiltre (server):", WHERE, "| absentee (client parse)");
  const rows = []; const seen = new Set();
  for (let off = 0; off < MAX; off += PAGE) {
    let j;
    try { j = await fetchPage(off); }
    catch (e) { console.warn(`uyarı @${off}: ${e.message}`); await new Promise((r) => setTimeout(r, 2500)); try { j = await fetchPage(off); } catch (e2) { console.error("atlandı:", e2.message); continue; } }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.UPC || a.AccountNum || "").trim();
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = String(a.Owner || "").trim();
      if (!owner) continue;
      const ad = parseAddr(a.OwnerAddre);
      if (!ad.street || !ad.city) continue;               // owner name + mailing address + city zorunlu
      const absentee = !!(ad.st && ad.st !== "NM");
      if (!absentee) continue;                             // sadece absentee
      const v = Number(a.LANDACT) || 0;
      if (!(v > 0 && v <= MAXVAL)) continue;
      const acres = a.Shape_Area ? Math.round((a.Shape_Area / 43560) * 100) / 100 : null;
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = estOffer(v);
      rows.push({
        apn, owner,
        mailing_address: ad.street, mailing_city: ad.city, mailing_state: ad.st, mailing_zip: ad.zip,
        situs: String(a.Situs || "").trim(), use: "VACANT", acres, land_value: v,
        county: "Valencia", region: "Valencia County",
        est_offer: offer, est_retail: retail, est_margin: retail - offer, absentee,
      });
    }
    console.log(`offset ${off}: +${feats.length} (tutulan ${rows.length})`);
    if (feats.length < PAGE) break;
  }
  rows.sort((a, b) => b.est_margin - a.est_margin);

  const outJson = resolve(ROOT, "dashboard/src/data/nm-valencia-offmarket.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "NM", county: "Valencia", source: "Valencia County Assessor ArcGIS", filter: WHERE, rows }, null, 2));
  console.log(`\n✅ ${rows.length} Valencia absentee vacant lot.`);

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `NM-Valencia-${r.apn}`,
    state: "NM", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: r.absentee, lat: null, lng: null, source: "ARCGIS:NM-valencia",
  }));
  const CHUNK = 500;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const part = recs.slice(i, i + CHUNK);
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error("upsert hatası:", error.message); process.exit(1); }
    process.stdout.write(`\r  upsert ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "NM");
  const { count: all } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ Supabase NM=${count} | tablo toplam=${all}`);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
