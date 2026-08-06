#!/usr/bin/env node
/**
 * VegaLand — Geo mesafelerini veritabanına işler
 *
 * geo-tiger.mjs'in ürettiği yol mesafesini `offmarket_leads.dist_road_m`
 * alanına yazar. Sütun zaten şemada var (geo-enrich-offmarket.mjs de oraya
 * yazıyor), yani panelin mevcut geo göstergeleri bu kayıtlar için de çalışır.
 *
 * Anlamlar (mevcut boru hattıyla aynı):
 *   >= 0  → o kadar metrede yol var
 *   -1    → tarandı, 1.600 m içinde yol YOK  (erişim sorunlu)
 *   null  → hiç ölçülmedi
 *
 * Kullanım:  node geo-yukle.mjs [dosya.ndjson.gz]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const GIRIS = process.argv[2] || path.join(VERI, 'geo', 'Aplus.ndjson.gz');
const PARTI = Number(process.env.PARTI || 2000);

const bin = (n) => Number(n || 0).toLocaleString('tr-TR');
if (!fs.existsSync(GIRIS)) { console.error(`${GIRIS} yok — önce geo-tiger.mjs koş.`); process.exit(1); }

const ENV_DOSYA = process.env.VEGALAND_ENV || path.join(KOK, '..', '..', 'dashboard', '.env.local');
if (!fs.existsSync(ENV_DOSYA)) { console.error(`Veritabanı ayarları yok: ${ENV_DOSYA}`); process.exit(1); }
const env = Object.fromEntries(
  fs.readFileSync(ENV_DOSYA, 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const c = new pg.Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query('set statement_timeout = 0');

const rl = readline.createInterface({ input: fs.createReadStream(GIRIS).pipe(zlib.createGunzip()), crlfDelay: Infinity });
let okunan = 0, guncellenen = 0, eslesmeyen = 0, hata = 0;
let parti = [];

async function partiYaz() {
  if (!parti.length) return;
  const idler = parti.map((p) => p[0]);
  const mesafeler = parti.map((p) => p[1]);
  try {
    // Tek sorguda toplu güncelleme: (id, mesafe) çiftleri geçici tablo gibi
    // unnest ile açılıp lead_id üzerinden bağlanıyor.
    const r = await c.query(
      `update offmarket_leads o
          set dist_road_m = v.m, geo_enriched_at = now()
         from (select unnest($1::text[]) as id, unnest($2::int[]) as m) v
        where o.lead_id = v.id`, [idler, mesafeler]);
    guncellenen += r.rowCount;
    eslesmeyen += parti.length - r.rowCount;
  } catch (e) {
    hata++;
    console.error(`\n  parti hatası: ${e.message.slice(0, 140)}`);
  }
  parti = [];
}

for await (const s of rl) {
  if (!s.trim()) continue;
  let o; try { o = JSON.parse(s); } catch { continue; }
  okunan++;
  if (o.yol_m == null || !o.lead_id) continue;
  parti.push([o.lead_id, o.yol_m]);
  if (parti.length >= PARTI) {
    await partiYaz();
    process.stderr.write(`\r  okunan ${bin(okunan)} · güncellenen ${bin(guncellenen)} · eşleşmeyen ${bin(eslesmeyen)}   `);
  }
}
await partiYaz();
console.error('');

const oz = await c.query(`
  select count(*) filter (where dist_road_m >= 0)::int yol_var,
         count(*) filter (where dist_road_m = -1)::int yol_yok,
         count(*) filter (where dist_road_m is null)::int olculmemis
    from offmarket_leads where source = 'ulusal-2026-08'`);
const o = oz.rows[0];
console.error(`\nokunan ${bin(okunan)} · güncellenen ${bin(guncellenen)} · eşleşmeyen ${bin(eslesmeyen)} · hata ${hata}`);
console.error(`ulusal kayıtlarda: yol var ${bin(o.yol_var)} · yol YOK ${bin(o.yol_yok)} · ölçülmemiş ${bin(o.olculmemis)}`);
await c.end();
