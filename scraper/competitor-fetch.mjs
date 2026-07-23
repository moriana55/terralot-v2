#!/usr/bin/env node
/**
 * COMPETITOR-FETCH — puppeteer'siz (düz fetch) rakip ilan tazeleyici.
 *
 * competitor-scraper.js puppeteer/Chrome ister ve retail siteleri Cloudflare +
 * datacenter/TR IP engeline takılır. Bu script SADECE plain fetch kullanır →
 * herhangi bir makineden/IP'den güvenle çalışır.
 *
 *  • Discount Lots: /property-map-table Inertia payload'ında TAM envanter JSON
 *    olarak gömülü (props.points). Puppeteer'la table kazımaktan hem daha
 *    güvenilir hem daha zengin (gerçek county/state/acres/cash fiyat/APN/koordinat).
 *
 * GÜVENLİK: bir kaynağın satırları YALNIZ taze tarama makul sayıda ilan
 * döndürürse (MIN_ROWS) silinip yeniden yazılır → kısmi/boş tarama mevcut
 * veriyi SİLMEZ (idempotent, veri-kaybı korumalı). competitor_listings'e
 * pg pooler üzerinden yazar (grade-offmarket.mjs dbUrl kalıbı).
 *
 * Not: Rina Land (WordPress kategori sayfaları) ve Landio (SPA) buradan
 * tazelenmez — Rina düz-fetch'lenebilir ama Elementor markup'ı gürültülü,
 * Landio Chrome ister; ikisi de competitor-scraper.js ile Yiğit'in
 * makinesinde (Chrome kurulu) tazelenir. Bu script onların satırlarına DOKUNMAZ.
 *
 * Çalıştır: node scraper/competitor-fetch.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const envTxt = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8");
const DB_URL = envTxt.match(/^DATABASE_URL=(.+)$/m)[1].trim()
  .replace("aws-0-", "aws-1-").replace(/\?pgbouncer=true.*$/, "");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// ── Discount Lots: Inertia data-page payload'ından tam envanteri çıkar. ───────
async function fetchDiscountLots() {
  const res = await fetch("https://discountlots.com/property-map-table", {
    headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/data-page="([^"]+)"/);
  if (!m) throw new Error("data-page payload bulunamadı (site markup değişmiş olabilir)");
  const json = m[1]
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const points = JSON.parse(json)?.props?.points;
  if (!Array.isArray(points)) throw new Error("props.points dizisi yok");

  const now = new Date().toISOString();
  const rows = [];
  for (const p of points) {
    // Gerçek nakit satış fiyatı (retail comp) — teaser list price DEĞİL.
    const price = num(p.cash_price_current) ?? num(p.original_cash_price) ?? num(p.cash_total);
    const acres = num(p.acreage);
    if (!price || price <= 0) continue; // fiyatsız = comp değeri yok, atla
    rows.push({
      competitor: "Discount Lots",
      title: p.title || p.name || null,
      state: p.state || null,
      county: p.county || null,
      acres,
      price,
      down_payment: num(p.down_payment),
      monthly_payment: num(p.payment_1),
      term_months: p.term_1 != null ? Math.round(Number(p.term_1)) : null,
      doc_fee: num(p.document_fee),
      apn: p.apn || null,
      notes: [p.road_access ? `Road: ${p.road_access}` : null,
              p.hoa_poa_annual_fee ? `HOA $${p.hoa_poa_annual_fee}/yr` : "No HOA",
              p.zoning || null].filter(Boolean).join(" · ") || null,
      our_source_cost: null,
      raw_url: p.name ? `https://discountlots.com/property/${p.name}` : null,
      scraped_at: now,
      lat: num(p.latitude),
      lng: num(p.longitude),
    });
  }
  return rows;
}

const COLS = ["competitor", "title", "state", "county", "acres", "price",
  "down_payment", "monthly_payment", "term_months", "doc_fee", "apn", "notes",
  "our_source_cost", "raw_url", "scraped_at", "lat", "lng"];

async function safeReplace(db, competitor, rows, MIN_ROWS) {
  if (rows.length < MIN_ROWS) {
    console.log(`⚠ ${competitor}: sadece ${rows.length} ilan (< ${MIN_ROWS}) — güvenlik gereği mevcut satırlar KORUNDU, yazılmadı`);
    return { replaced: false, n: 0 };
  }
  await db.query("begin");
  try {
    const before = await db.query("select count(*) c from competitor_listings where competitor=$1", [competitor]);
    await db.query("delete from competitor_listings where competitor=$1", [competitor]);
    const B = 500;
    for (let i = 0; i < rows.length; i += B) {
      const part = rows.slice(i, i + B);
      const vals = [];
      const params = [];
      part.forEach((r, j) => {
        const o = j * COLS.length;
        vals.push(`(${COLS.map((_, k) => `$${o + k + 1}`).join(",")})`);
        params.push(...COLS.map((c) => r[c] ?? null));
      });
      await db.query(`insert into competitor_listings (${COLS.join(",")}) values ${vals.join(",")}`, params);
    }
    await db.query("commit");
    console.log(`✓ ${competitor}: ${before.rows[0].c} → ${rows.length} ilan (taze)`);
    return { replaced: true, n: rows.length };
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

async function main() {
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  try {
    let rows = [];
    try { rows = await fetchDiscountLots(); }
    catch (e) { console.error(`Discount Lots FETCH hata: ${e.message}`); }
    console.log(`Discount Lots: ${rows.length} ilan parse edildi`);
    if (rows.length) await safeReplace(db, "Discount Lots", rows, 50);

    // Eyalet kırılımı özeti
    const dist = await db.query(
      "select state, count(*) n from competitor_listings group by state order by n desc limit 40");
    console.log("\ncompetitor_listings eyalet dağılımı (tüm kaynaklar):");
    for (const r of dist.rows) console.log(`  ${r.state ?? "(boş)"}: ${r.n}`);
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
