#!/usr/bin/env node
/**
 * DEĞER BACKFILL — est_* değeri olmayan offmarket_leads kayıtlarına county
 * assessor ArcGIS katmanlarından APN eşleşmesiyle assessed/market land value yazar.
 * (Kalıp: backfill-coords.mjs — koordinat backfill'inin değer versiyonu.)
 *
 * KAYNAK DURUMU (2026-07-23 keşfi — her koşuda runtime'da yeniden doğrulanır):
 *  - OR / Lake   : AGOL kopyası "2020 Lake County Taxlots" (MKT_Land alanı VAR).
 *                  Resmî LakeCoTaxlots katmanında değer alanı yok; AGOL kopyası
 *                  2020 A&T snapshot'ı → land_value_source'a yıl açıkça yazılır.
 *  - MO / Camden : Integrity GIS Camden_Assessor_Data — TÜM katmanlar tarandı
 *                  (7 Parcel, 8 Parcel Public, 86 Tax Sale), assessed value alanı
 *                  YOK → "value layer yok" log'lanır, zorlanmaz.
 *  - SC / Colleton: AGOL org'daki tüm parsel katmanları (Public_Data,
 *                  Public_Data_Rev25, WebDataLayers, ColletonWebData) tarandı,
 *                  değer alanı YOK; SCDOT SC_Parcels erişilemedi (timeout).
 *                  → "value layer yok" log'lanır.
 *
 * DÜRÜSTLÜK: değer ÜRETİLMEZ; yalnız katmanda gerçekten bulunan assessed/market
 * değer yazılır ve land_value_source ile kaynağı+yılı kayda geçer. est_offer /
 * est_retail yalnız projenin mevcut ucuz-lot bandında (300..20000$ — Klamath
 * ingest'iyle aynı MIN_VAL/MAX_VAL + aynı NC-kuralı formül) hesaplanır; bandın
 * dışındaki parselde land_value yazılır ama est_* null kalır (model o banda göre).
 *
 * Çalıştır: node scraper/backfill-values.mjs                (tüm hedefler)
 *           STATE=OR COUNTY=Lake node scraper/backfill-values.mjs
 *           TEST=1 node scraper/backfill-values.mjs         (hedef başına 2 sayfa)
 * İdempotent: yalnız land_value IS NULL kayıtlar hedeflenir; nazik batch (sleep).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
// pg bağlantısı: PostgREST 565K tabloda statement timeout'a takılıyor →
// grade-offmarket.mjs ile aynı pooler yolu (aws-1, pgbouncer parametresiz).
const envTxt = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8");
const DB_URL = envTxt.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace("aws-0-", "aws-1-").replace(/\?pgbouncer=true.*$/, "");
const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const TEST = process.env.TEST === "1";
const ONLY_STATE = process.env.STATE || null;
const ONLY_COUNTY = process.env.COUNTY || null;
const PAGE = 1000;
const SLEEP = 400; // nazik: sunucuyu boğma
const MIN_VAL = 300, MAX_VAL = 20000; // ucuz-lot bandı (oregon-offmarket.mjs ile aynı)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ucuz-lot est formülleri — oregon-offmarket.mjs / NC kuralıyla birebir aynı.
const estOffer = (v) => Math.min(1500, Math.max(400, Math.round((v || 0) * 0.35)));
const estRetail = (acres) => (acres ? Math.round(2999 * Math.max(0.7, Math.min(3, acres))) : 2999);

// ── Hedef kayıt defteri ──────────────────────────────────────────────────────
// probe(): katmanda değer alanı var mı — yoksa "value layer yok" der ve geçer.
const TARGETS = [
  {
    state: "OR", county: "Lake",
    layer: "https://services5.arcgis.com/tOpyG9W13NDbUg12/arcgis/rest/services/2020_Lake_County_Taxlots/FeatureServer/0/query",
    layerInfo: "https://services5.arcgis.com/tOpyG9W13NDbUg12/arcgis/rest/services/2020_Lake_County_Taxlots/FeatureServer/0?f=json",
    valueField: "MKT_Land",
    apnField: "MapTaxlot", // lead apn = MapTaxlot formatı (ör. 25S14E160000200)
    source: "OR:AGOL_2020_LAKE_TAXLOTS MKT_Land (2020 A&T market land value)",
  },
  {
    state: "MO", county: "Camden",
    // Integrity GIS assessor servisi — tüm parsel katmanlarında değer alanı yok.
    valueMissing: "Camden_Assessor_Data katmanlarında (7/8/86) assessed value alanı yok",
  },
  {
    state: "SC", county: "Colleton",
    valueMissing: "Colleton AGOL parsel katmanlarında (Public_Data*/WebDataLayers/ColletonWebData) değer alanı yok; SCDOT SC_Parcels erişilemedi",
  },
];

async function probeLayer(t) {
  const j = await (await fetch(t.layerInfo, { signal: AbortSignal.timeout(60000) })).json();
  const names = (j.fields || []).map((f) => f.name);
  if (!names.includes(t.valueField) || !names.includes(t.apnField)) {
    throw new Error(`beklenen alanlar katmanda yok (${t.valueField}/${t.apnField}) — mevcut: ${names.join(",")}`);
  }
}

async function fetchValuePage(t, offset) {
  const p = new URLSearchParams({
    where: `${t.valueField} IS NOT NULL`,
    outFields: `${t.apnField},${t.valueField}`,
    returnGeometry: "false",
    orderByFields: "OBJECTID ASC",
    resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json",
  });
  const res = await fetch(t.layer, { method: "POST", body: p, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(120000) });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "arcgis error");
  return j.features ?? [];
}

async function targetLeads(t) {
  // Yalnız değeri olmayan lead'ler (idempotent).
  const { rows } = await db.query(
    "select lead_id, apn, acres from offmarket_leads where state=$1 and county=$2 and land_value is null and apn is not null",
    [t.state, t.county],
  );
  const out = new Map(); // apn → { lead_id, acres }
  for (const r of rows) out.set(String(r.apn).trim().toUpperCase(), r);
  return out;
}

async function runTarget(t) {
  const tag = `${t.state}/${t.county}`;
  if (t.valueMissing) {
    console.log(`${tag}: value layer yok — ${t.valueMissing} (atlandı)`);
    return { matched: 0, updated: 0, skippedNoLayer: true };
  }
  try { await probeLayer(t); }
  catch (e) { console.log(`${tag}: value layer yok/erişilemedi — ${e.message} (atlandı)`); return { matched: 0, updated: 0, skippedNoLayer: true }; }

  const leads = await targetLeads(t);
  console.log(`${tag}: değeri olmayan ${leads.size} lead hedefte`);
  if (!leads.size) return { matched: 0, updated: 0 };

  let matched = 0, updated = 0, placeholder = 0;
  for (let off = 0, page = 0; ; page++) {
    let feats;
    try { feats = await fetchValuePage(t, off); }
    catch (e) { await sleep(5000); try { feats = await fetchValuePage(t, off); } catch { console.log(`${tag}: sayfa ${page} hata — durduruldu`); break; } }
    if (!feats.length) break;
    off += feats.length;

    const updates = [];
    for (const f of feats) {
      const a = f.attributes;
      const apn = String(a[t.apnField] ?? "").trim().toUpperCase();
      const lead = leads.get(apn);
      if (!lead) continue;
      matched++;
      const val = Number(a[t.valueField]);
      // Uç değer kırpma: $0/$1/$99 placeholder assessed → değer yazma (dürüstlük).
      if (!Number.isFinite(val) || val < 100) { placeholder++; continue; }
      const inBand = val >= MIN_VAL && val <= MAX_VAL;
      const offer = inBand ? estOffer(val) : null;
      const retail = inBand ? estRetail(Number(lead.acres) || null) : null;
      updates.push({
        lead_id: lead.lead_id,
        land_value: val,
        land_value_source: t.source,
        est_offer: offer,
        est_retail: retail,
        est_margin: offer != null && retail != null ? retail - offer : null,
      });
      leads.delete(apn); // aynı APN'e ikinci yazım olmasın
    }
    if (updates.length) {
      // Batch UPDATE (VALUES join) — tek istekte sayfa başı tüm eşleşmeler.
      const vals = [];
      const params = [];
      updates.forEach((u, j) => {
        const o = j * 6;
        vals.push(`($${o + 1}, $${o + 2}::numeric, $${o + 3}, $${o + 4}::numeric, $${o + 5}::numeric, $${o + 6}::numeric)`);
        params.push(u.lead_id, u.land_value, u.land_value_source, u.est_offer, u.est_retail, u.est_margin);
      });
      const res = await db.query(
        `update offmarket_leads l set land_value = v.lv, land_value_source = v.src,
           est_offer = v.eo, est_retail = v.er, est_margin = v.em
         from (values ${vals.join(",")}) as v(id, lv, src, eo, er, em) where l.lead_id = v.id`,
        params,
      );
      updated += res.rowCount ?? 0;
    }
    console.log(`${tag}: sayfa ${page + 1} → eşleşen ${matched}, yazılan ${updated}`);
    if (TEST && page >= 1) break;
    await sleep(SLEEP);
  }
  if (placeholder) console.log(`${tag}: ${placeholder} kayıt placeholder değer (<$100) — yazılmadı`);
  return { matched, updated };
}

const results = {};
for (const t of TARGETS) {
  if (ONLY_STATE && t.state !== ONLY_STATE) continue;
  if (ONLY_COUNTY && t.county !== ONLY_COUNTY) continue;
  results[`${t.state}/${t.county}`] = await runTarget(t);
}
console.log("\nÖZET (county → eşleşen/yazılan):");
for (const [k, v] of Object.entries(results)) {
  console.log(`  ${k}: ${v.skippedNoLayer ? "value layer yok" : `${v.matched} eşleşti, ${v.updated} yazıldı`}`);
}
await db.end();
