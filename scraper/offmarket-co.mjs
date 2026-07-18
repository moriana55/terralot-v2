#!/usr/bin/env node
/**
 * COLORADO OFF-MARKET PULL (v2) — statewide, absentee boş arsa, doğrudan sahip.
 * Kaynak: Colorado Public Parcels (HALKA AÇIK statewide ArcGIS FeatureServer).
 *
 * ÖNEMLİ: apprValTot/salePrice/asedValTot bu serviste STRING tipinde → sayısal
 * karşılaştırma (>0, <=15000) sunucuda 400 verir. Bu yüzden sunucuda yalnız
 * güvenli alanlarla (landUseDsc, ownAddStt, landAcres) filtreleriz; değer eşiğini
 * istemci tarafında (JS) uygularız.
 *
 * Çıktı: dashboard/src/data/colorado-offmarket.json + Supabase offmarket_leads upsert + count doğrula.
 * Kullanım: node scraper/offmarket-co.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LAYER = "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query";
const PAGE = 2000;
const MAX = Number(process.env.MAX || 40000);
const MAXVAL = Number(process.env.MAXVAL || 15000);
const MINAC = Number(process.env.MINAC || 0.3);
const MAXAC = Number(process.env.MAXAC || 40);

// Sunucu tarafı: yalnız güvenli (sayısal olmayan) alanlar.
const WHERE = `landUseDsc LIKE '%VACANT%' AND ownAddStt<>'CO' AND ownAddStt<>'' AND landAcres>=${MINAC} AND landAcres<=${MAXAC}`;
const FIELDS = "parcel_id,account,owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,situsAdd,sitAddCty,landAcres,landUseDsc,apprValTot,asedValTot,salePrice,countyName,legalDesc";

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
  const p = new URLSearchParams({ where: WHERE, outFields: FIELDS, returnGeometry: "false", orderByFields: "landAcres ASC", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
  const res = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

async function main() {
  console.log("Colorado off-market pull (v2)…\nfiltre (server):", WHERE, `| değer<=${MAXVAL} (client)`);
  const rows = []; const seen = new Set();
  for (let off = 0; off < MAX; off += PAGE) {
    let j;
    try { j = await fetchPage(off); }
    catch (e) { console.warn(`uyarı @${off}: ${e.message}`); await new Promise(r => setTimeout(r, 2500)); try { j = await fetchPage(off); } catch (e2) { console.error("atlandı:", e2.message); continue; } }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a.parcel_id || a.account || "").trim();
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = [a.owner, a.owner2].filter(Boolean).join(" & ").trim();
      if (!owner || !a.ownerAdd || !a.ownAddCty) continue;
      const v = num(a.apprValTot);
      if (!(v > 0 && v <= MAXVAL)) continue;   // değer eşiği (istemci)
      const acres = Number(a.landAcres) || null;
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = estOffer(v);
      rows.push({
        apn, owner,
        mailing_address: a.ownerAdd, mailing_city: a.ownAddCty, mailing_state: a.ownAddStt, mailing_zip: a.ownAddZip,
        situs: a.situsAdd || "", use: a.landUseDsc || "", acres, land_value: v,
        full_cash_value: num(a.asedValTot) || null, last_sale_price: num(a.salePrice) || null,
        legal: a.legalDesc || "", county: a.countyName || "CO", region: (a.countyName || "CO") + " County",
        lat: null, lng: null, est_offer: offer, est_retail: retail, est_margin: retail - offer,
      });
    }
    console.log(`offset ${off}: +${feats.length} (tutulan ${rows.length})`);
    if (feats.length < PAGE) break;
  }
  for (const r of rows) r.score = Math.round((r.est_margin / 30) + (String(r.county).toLowerCase().includes("costilla") ? 25 : 0) + (r.acres >= 5 && r.acres <= 10 ? 12 : 0));
  rows.sort((a, b) => b.score - a.score);

  const outJson = resolve(ROOT, "dashboard/src/data/colorado-offmarket.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, state: "CO", source: "Colorado Public Parcels (statewide ArcGIS)", filter: WHERE, rows }, null, 2));

  const byCounty = {}; for (const r of rows) byCounty[r.county] = (byCounty[r.county] || 0) + 1;
  console.log(`\n✅ ${rows.length} CO absentee vacant lot.`);
  console.log("en çok county:", Object.entries(byCounty).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}:${n}`).join(", "));

  // ---- Supabase upsert ----
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `CO-${(r.county || "").replace(/\s+/g, "")}-${r.apn}`,
    state: "CO", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: !!(r.mailing_state && r.mailing_state !== "CO"), lat: null, lng: null,
    source: "ARCGIS:CO-statewide",
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
main().catch(e => { console.error("HATA:", e); process.exit(1); });
