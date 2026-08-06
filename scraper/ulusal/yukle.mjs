#!/usr/bin/env node
/**
 * VegaLand — Birleşik envanteri Supabase'e yükler
 *
 * Sadece SEÇİLİ SINIFLARI yükler. 12,7M satırın tamamı veritabanını gereksiz
 * şişirir (2026-07-27'de Terralot'un Supabase'i disk dolup çökmüştü); haritada
 * ve panelde işe yarayan dilim A+ ve A.
 *
 * ÇAKIŞMA: lead_id üzerinden ON CONFLICT DO NOTHING — mevcut envanterden gelen
 * kayıtlar EZİLMEZ. Birleştirmede zaten tekilleştirme yapıldı; buradaki koruma
 * ikinci kez koşulursa satır ikizlenmesin diye.
 *
 * Kullanım:
 *   node yukle.mjs --sinif A+,A                 # varsayılan
 *   node yukle.mjs --sinif A+ --deneme          # yazmadan sadece say
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const GIRIS = path.join(VERI, 'birlesik', 'puanli', 'aday.ndjson.gz');

const arg = process.argv.slice(2);
const bayrak = (ad, v) => { const i = arg.indexOf(ad); return i >= 0 && arg[i + 1] ? arg[i + 1] : v; };
const SINIFLAR = bayrak('--sinif', 'A+,A').split(',').map((s) => s.trim());
const DENEME = arg.includes('--deneme');
const PARTI = Number(process.env.PARTI || 1000);
const KAYNAK = 'ulusal-2026-08';

const bin = (n) => Number(n || 0).toLocaleString('tr-TR');

if (!fs.existsSync(GIRIS)) { console.error(`${GIRIS} yok — önce puanla.mjs --birlesik koş.`); process.exit(1); }

// Env dosyası yolu ortama göre değişiyor (Mac'te repo içinde, sunucuda ayrı).
// VEGALAND_ENV ile gösterilebilir; verilmezse repo düzeni varsayılır.
const ENV_DOSYA = process.env.VEGALAND_ENV || path.join(KOK, '..', '..', 'dashboard', '.env.local');
if (!fs.existsSync(ENV_DOSYA)) {
  console.error(`Veritabanı ayarları bulunamadı: ${ENV_DOSYA}`);
  console.error('VEGALAND_ENV=/yol/.env.local ile göster.');
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(ENV_DOSYA, 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const SUTUNLAR = [
  'lead_id', 'state', 'county', 'apn', 'owner',
  'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
  'situs', 'acres', 'land_value', 'lat', 'lng',
  'source', 'absentee', 'grade', 'grade_score', 'grade_reason', 'do_not_call',
];

function satirDegerleri(o) {
  // Mevcut şemada 'A+' zaten kullanılıyor (10.084 kayıt) — olduğu gibi yazılır.
  const grade = o.sinif;
  return [
    o.lead_id, o.eyalet, o.county, o.apn, o.sahip,
    o.posta_adres, o.posta_sehir, o.posta_eyalet, o.posta_zip,
    o.situs, o.akr, o.deger, o.lat, o.lng,
    KAYNAK, !!o.eyalet_disi, grade, o.puan,
    Array.isArray(o.sebep) ? o.sebep.join(' · ') : null, false,
  ];
}

const c = new pg.Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query('set statement_timeout = 0');

const oncesi = await c.query('select count(*)::int n, pg_size_pretty(pg_database_size(current_database())) db from offmarket_leads');
console.error(`önce: ${bin(oncesi.rows[0].n)} satır · DB ${oncesi.rows[0].db}`);

const rl = readline.createInterface({ input: fs.createReadStream(GIRIS).pipe(zlib.createGunzip()), crlfDelay: Infinity });
let okunan = 0, secilen = 0, yazilan = 0, atlanan = 0, hata = 0;
let parti = [];

async function partiYaz() {
  if (!parti.length) return;
  if (DENEME) { yazilan += parti.length; parti = []; return; }
  const yerTutucu = parti.map((_, i) =>
    `(${SUTUNLAR.map((__, j) => `$${i * SUTUNLAR.length + j + 1}`).join(',')})`).join(',');
  const degerler = parti.flat();
  try {
    const r = await c.query(
      `insert into offmarket_leads (${SUTUNLAR.join(',')}) values ${yerTutucu}
       on conflict (lead_id) do nothing`, degerler);
    yazilan += r.rowCount;
    atlanan += parti.length - r.rowCount;
  } catch (e) {
    hata++;
    console.error(`\n  parti hatası (${parti.length} satır): ${e.message.slice(0, 120)}`);
  }
  parti = [];
}

for await (const s of rl) {
  if (!s.trim()) continue;
  okunan++;
  let o; try { o = JSON.parse(s); } catch { continue; }
  if (!SINIFLAR.includes(o.sinif)) continue;
  secilen++;
  parti.push(satirDegerleri(o));
  if (parti.length >= PARTI) {
    await partiYaz();
    process.stderr.write(`\r  okunan ${bin(okunan)} · seçilen ${bin(secilen)} · yazılan ${bin(yazilan)} · atlanan ${bin(atlanan)}   `);
  }
}
await partiYaz();
console.error('');

const sonrasi = await c.query('select count(*)::int n, pg_size_pretty(pg_database_size(current_database())) db from offmarket_leads');
console.error(`\nsonra: ${bin(sonrasi.rows[0].n)} satır · DB ${sonrasi.rows[0].db}`);
console.error(`  okunan ${bin(okunan)} · sınıf eşleşen ${bin(secilen)} · YAZILAN ${bin(yazilan)} · zaten vardı ${bin(atlanan)} · parti hatası ${hata}`);
if (DENEME) console.error('  (--deneme: hiçbir şey yazılmadı)');
await c.end();
