#!/usr/bin/env node
/**
 * COSTILLA COUNTY, CO OFF-MARKET PULL — absentee ucuz arsa, doğrudan sahip.
 * CO statewide layer bu county'yi ATLAR (San Luis Valley / Forbes Park ucuz lotlar).
 * Kaynak: Costilla County ArcGIS (HALKA AÇIK FeatureServer, "FGDB May Update" / CostillaParcels).
 *   https://services7.arcgis.com/qznFlX1g8SfaPebZ/arcgis/rest/services/Costilla_County_FGDB_May_Update/FeatureServer/8
 *
 * Alanlar: Owner_Name, Additional_Owners, Mailing_Address, Mailing_City, Mailing_State,
 *   Mailing_Zip, Total_Value ($ actual), Total_Assessed_Value, Total_Area (acre; çoğu 0),
 *   ParcelNum, Location_Street. Total_Area güvenilmez → acreage filtresi uygulanmaz.
 *
 * Filtre (server): Mailing_State<>'CO' (absentee) AND Total_Value 1..20000 (ucuz).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://services7.arcgis.com/qznFlX1g8SfaPebZ/arcgis/rest/services/Costilla_County_FGDB_May_Update/FeatureServer/8/query";
const PAGE = 2000;
const MAX = Number(process.env.MAX || 80000);
const MAXVAL = Number(process.env.MAXVAL || 20000);

const WHERE = `Mailing_State<>'CO' AND Mailing_State IS NOT NULL AND Mailing_State<>'' AND Total_Value>0 AND Total_Value<=${MAXVAL}`;
const FIELDS = "ParcelNum,Parcel,Owner_Name,Additional_Owners,Mailing_Address,Mailing_City,Mailing_State,Mailing_Zip,Total_Value,Total_Assessed_Value,Total_Area,Location_Street_Number,Location_Street";

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
  const p = new URLSearchParams({ where: WHERE, outFields: FIELDS, returnGeometry: "true", outSR: "4326", orderByFields: "ParcelNum ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

// Alan ağırlıklı poligon merkezi (WGS84 derece) → [lat, lng].
// ⚠ Koordinat ŞART: lat/lng olmayan kayıt haritada çıkmaz ve geo-enrich (yol/
// elektrik/su) ona dokunamaz → not motorunda B tavanında kalır, A+/A olamaz.
function centroid(rings) {
  const ring = rings?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i];
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) return null;
  a *= 0.5;
  const lat = cy / (6 * a), lng = cx / (6 * a);
  // Costilla County kaba sınır kontrolü — bozuk geometri koordinat uydurmasın.
  if (lat < 36.5 || lat > 38.2 || lng < -106.5 || lng > -104.5) return null;
  return [lat, lng];
}

async function main() {

  console.log("Costilla CO off-market pull…\nfiltre (server):", WHERE);
  const rows = []; const seen = new Set();
  for (let off = 0; off < MAX; off += PAGE) {
    let j;
    try { j = await fetchPage(off); }
    catch (e) { console.warn(`uyarı @${off}: ${e.message}`); await new Promise((r) => setTimeout(r, 2500)); try { j = await fetchPage(off); } catch (e2) { console.error("atlandı:", e2.message); continue; } }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.ParcelNum || a.Parcel || "").trim();
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = [a.Owner_Name, a.Additional_Owners].filter(Boolean).join(" & ").replace(/\s+/g, " ").trim();
      if (!owner || !a.Mailing_Address || !a.Mailing_City) continue;
      const v = Number(a.Total_Value) || 0;
      if (!(v > 0 && v <= MAXVAL)) continue;
      const acres = Number(a.Total_Area) > 0 ? Math.round(Number(a.Total_Area) * 100) / 100 : null;
      const situs = [a.Location_Street_Number, a.Location_Street].filter((x) => x && String(x).trim() && String(x).trim().toUpperCase() !== "N/A").join(" ").trim();
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = estOffer(v);
      const c = centroid(f.geometry?.rings);
      rows.push({
        lat: c?.[0] ?? null, lng: c?.[1] ?? null,
        apn, owner,
        mailing_address: String(a.Mailing_Address).trim(), mailing_city: String(a.Mailing_City).trim(),
        mailing_state: String(a.Mailing_State || "").trim(), mailing_zip: String(a.Mailing_Zip || "").trim(),
        situs, use: "VACANT", acres, land_value: v,
        county: "Costilla", region: "Costilla County",
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
        absentee: !!(a.Mailing_State && String(a.Mailing_State).trim().toUpperCase() !== "CO"),
      });
    }
    console.log(`offset ${off}: +${feats.length} (tutulan ${rows.length})`);
    if (feats.length < PAGE) break;
  }
  rows.sort((a, b) => b.est_margin - a.est_margin);

  const outJson = resolve(ROOT, "dashboard/src/data/co-costilla-offmarket.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "CO", county: "Costilla", source: "Costilla County ArcGIS (FGDB May Update)", filter: WHERE, rows }, null, 2));
  console.log(`\n✅ ${rows.length} Costilla absentee ucuz arsa.`);

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `CO-Costilla-${r.apn}`,
    state: "CO", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: r.absentee, lat: r.lat, lng: r.lng, source: "ARCGIS:CO-costilla",
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
