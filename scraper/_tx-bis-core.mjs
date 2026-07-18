/**
 * TEXAS "BIS" CAD web-service ortak çekirdeği.
 * Hudspeth / Presidio / Brewster / Terrell CAD'leri AYNI şemalı ArcGIS
 * FeatureServer yayınlar (owner=file_as_name, posta=addr_line1..3/addr_city/
 * addr_state/zip, land_val, imprv_val, legal_acreage). Bu modül tek county'yi
 * çeker, filtreler, JSON snapshot yazar ve Supabase offmarket_leads'e upsert eder.
 *
 * Sayısal alanlar Double olduğundan filtreyi SUNUCUDA uygularız; yine de değer
 * eşiğini istemcide de doğrularız. Absentee = posta eyaleti <> TX.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PAGE = 2000;
const MAXVAL = Number(process.env.MAXVAL || 20000);
const MINAC = Number(process.env.MINAC || 0.3);
const MAXAC = Number(process.env.MAXAC || 40);

const FIELDS = [
  "prop_id_text", "geo_id", "file_as_name",
  "addr_line1", "addr_line2", "addr_line3", "addr_city", "addr_state", "zip",
  "situs_num", "situs_street_prefx", "situs_street", "situs_street_sufix", "situs_city", "situs_state", "situs_zip",
  "legal_acreage", "land_val", "imprv_val", "market", "abs_subdv_cd", "legal_desc", "county",
].join(",");

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
const clean = (v) => (v == null ? "" : String(v).trim());
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

async function fetchPage(layer, where, offset) {
  const p = new URLSearchParams({
    where, outFields: FIELDS, returnGeometry: "false",
    orderByFields: "legal_acreage ASC", resultOffset: String(offset),
    resultRecordCount: String(PAGE), f: "json",
  });
  const res = await fetch(`${layer}/query?${p}`, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} @${offset}`);
  const j = await res.json();
  if (j.error) throw new Error(`ArcGIS: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
}

/**
 * @param {{ county: string, slug: string, layer: string }} cfg
 */
export async function runCounty(cfg) {
  const { county, slug, layer } = cfg;
  const WHERE = `imprv_val=0 AND land_val>0 AND land_val<=${MAXVAL} AND legal_acreage>=${MINAC} AND legal_acreage<=${MAXAC}`;
  console.log(`\nTX ${county} off-market pull…\nfiltre (server):`, WHERE);

  const rows = []; const seen = new Set();
  for (let off = 0; ; off += PAGE) {
    let j;
    try { j = await fetchPage(layer, WHERE, off); }
    catch (e) {
      console.warn(`uyarı @${off}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2500));
      try { j = await fetchPage(layer, WHERE, off); }
      catch (e2) { console.error("atlandı:", e2.message); break; }
    }
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = clean(a.prop_id_text) || clean(a.geo_id);
      if (!apn || seen.has(apn)) continue; seen.add(apn);
      const owner = clean(a.file_as_name);
      const mailing_address = [a.addr_line1, a.addr_line2, a.addr_line3].map(clean).filter(Boolean).join(" ");
      const mailing_city = clean(a.addr_city);
      const mailing_state = clean(a.addr_state);
      if (!owner || !mailing_address || !mailing_city) continue;   // posta adresi ZORUNLU
      const v = num(a.land_val);
      if (!(v > 0 && v <= MAXVAL)) continue;                       // değer eşiği (istemci doğrulama)
      const acres = Number(a.legal_acreage) || null;
      const situs = [a.situs_num, a.situs_street_prefx, a.situs_street, a.situs_street_sufix].map(clean).filter(Boolean).join(" ");
      const retail = acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999;
      const offer = estOffer(v);
      rows.push({
        apn, owner,
        mailing_address, mailing_city, mailing_state, mailing_zip: clean(a.zip),
        situs, use: clean(a.abs_subdv_cd) || "VACANT LAND",
        acres, land_value: v, market: num(a.market) || null,
        legal: clean(a.legal_desc), county, region: `${county} County`,
        absentee: !!(mailing_state && mailing_state !== "TX"),
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
      });
    }
    console.log(`offset ${off}: +${feats.length} (tutulan ${rows.length})`);
    if (feats.length < PAGE) break;
  }

  for (const r of rows) {
    r.score = Math.round((r.est_margin / 30) + (r.absentee ? 20 : 0) + (r.acres >= 5 && r.acres <= 20 ? 12 : 0));
  }
  rows.sort((a, b) => b.score - a.score);

  const outJson = resolve(ROOT, `dashboard/src/data/tx-${slug}-offmarket.json`);
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify({
    generatedAt: new Date().toISOString(), count: rows.length, state: "TX",
    county, source: `${county} CAD (ArcGIS FeatureServer)`, filter: WHERE, rows,
  }, null, 2));

  const absN = rows.filter((r) => r.absentee).length;
  console.log(`\n✅ ${rows.length} TX ${county} vacant lot (${absN} absentee / non-TX).`);

  // ---- Supabase upsert ----
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: Supabase env yok — sadece JSON yazıldı."); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });
  const recs = rows.map((r) => ({
    lead_id: `TX-${slug}-${r.apn}`,
    state: "TX", county: r.county, region: r.region, apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city, mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
    est_offer: r.est_offer, est_retail: r.est_retail, est_margin: r.est_margin,
    absentee: r.absentee, lat: null, lng: null,
    source: `ARCGIS:TX-${slug}`,
  }));
  const CHUNK = 500;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const part = recs.slice(i, i + CHUNK);
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) { console.error("upsert hatası:", error.message); process.exit(1); }
    process.stdout.write(`\r  upsert ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "TX");
  const { count: all } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ Supabase TX=${count} | tablo toplam=${all}`);
}
