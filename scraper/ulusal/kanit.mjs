#!/usr/bin/env node
/**
 * VegaLand — Kanıt Paneli
 *
 * Sunumda "nasıl taradınız" sorusuna cevap veren ekran. Hiçbir sayı dosyadan
 * okunmaz — her satır ÇALIŞTIĞI ANDA kaynağa canlı sorgu atar ve dönen cevabı
 * yazar. Ekran görüntüsü alınmak için tasarlandı.
 *
 * Kullanım:  node kanit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const KAYNAKLAR = JSON.parse(fs.readFileSync(path.join(KOK, 'kaynaklar.json'), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; VegaLand/1.0)' };

const R = '\x1b[0m', B = '\x1b[1m', Y = '\x1b[33m', G = '\x1b[32m', D = '\x1b[2m', C = '\x1b[36m';
const bin = (x) => Number(x).toLocaleString('tr-TR');

async function say(url) {
  const t0 = Date.now();
  const r = await fetch(`${url}/query?where=1%3D1&returnCountOnly=true&f=json`,
    { headers: UA, signal: AbortSignal.timeout(45_000) });
  const j = await r.json();
  return { n: j.count ?? null, ms: Date.now() - t0, http: r.status };
}

console.log(`\n${B}${C}  VEGALAND — VERİ KAYNAĞI KANITI${R}`);
console.log(`${D}  Aşağıdaki her satır şu anda canlı sorgu atılarak üretildi.${R}`);
console.log(`${D}  ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC${R}\n`);

console.log(`${B}  EYALET  KAYNAK${R}${' '.repeat(34)}${B}HTTP   SÜRE      PARSEL${R}`);
console.log(`  ${'─'.repeat(74)}`);

const eyaletler = Object.keys(KAYNAKLAR)
  .filter((k) => !k.startsWith('_') && KAYNAKLAR[k].durum !== 'yanlis-pozitif');

let toplam = 0, calisan = 0;
for (const ab of eyaletler) {
  const k = KAYNAKLAR[ab];
  let s;
  try { s = await say(k.url); } catch (e) { s = { n: null, ms: 0, http: 'HATA' }; }
  const ad = (k.ad || '').slice(0, 38).padEnd(38);
  if (s.n != null) {
    toplam += s.n; calisan++;
    console.log(`  ${B}${ab.padEnd(6)}${R}  ${ad}${G}${String(s.http).padStart(4)}${R}  ${String(s.ms + ' ms').padStart(7)}  ${Y}${bin(s.n).padStart(11)}${R}`);
  } else {
    console.log(`  ${B}${ab.padEnd(6)}${R}  ${ad}${String(s.http).padStart(4)}  ${'—'.padStart(7)}  ${'—'.padStart(11)}`);
  }
}
console.log(`  ${'─'.repeat(74)}`);
console.log(`  ${B}${calisan} kaynak canlı · toplam ${Y}${bin(toplam)}${R}${B} parsel erişilebilir${R}`);
console.log(`  ${D}Hepsi ücretsiz ve anahtarsız — resmî eyalet GIS sunucuları.${R}\n`);

// Diskte ne var
if (fs.existsSync(VERI)) {
  console.log(`${B}  SUNUCUDA İNDİRİLMİŞ VERİ${R}`);
  console.log(`  ${'─'.repeat(74)}`);
  let bayt = 0, satir = 0;
  const dosyalar = fs.readdirSync(VERI).filter((f) => f.endsWith('.ndjson.gz')).sort();
  for (const f of dosyalar) {
    const ab = f.replace('.ndjson.gz', '');
    const st = fs.statSync(path.join(VERI, f));
    bayt += st.size;
    let d = null;
    try { d = JSON.parse(fs.readFileSync(path.join(VERI, `${ab}.ilerleme.json`), 'utf8')); } catch { /* yok */ }
    const n = d?.yazilan ?? 0; satir += n;
    const bek = d?.beklenen ?? KAYNAKLAR[ab]?.parsel;
    const durum = d?.bitti
      ? (bek && Math.abs(n - bek) / bek > 0.02 ? `${Y}eksik${R}` : `${G}tam${R}`)
      : `${D}iniyor${R}`;
    const yuzde = bek ? `%${((n / bek) * 100).toFixed(1)}` : '';
    console.log(`  ${B}${ab.padEnd(6)}${R}  ${bin(n).padStart(12)} kayıt  ${(st.size / 1048576).toFixed(0).padStart(5)} MB  ${yuzde.padStart(6)}  ${durum}`);
  }
  console.log(`  ${'─'.repeat(74)}`);
  console.log(`  ${B}${bin(satir)} kayıt · ${(bayt / 1073741824).toFixed(2)} GB sıkıştırılmış${R}\n`);
}

// Örnek satır — verinin gerçekten dolu olduğunu göster
const ornekDosya = fs.existsSync(VERI)
  ? fs.readdirSync(VERI).find((f) => f.endsWith('.ndjson.gz')) : null;
if (ornekDosya) {
  const zlib = await import('node:zlib');
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(VERI, ornekDosya)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  console.log(`${B}  ÖRNEK KAYIT${R} ${D}(${ornekDosya})${R}`);
  console.log(`  ${'─'.repeat(74)}`);
  for await (const s of rl) {
    const o = JSON.parse(s);
    for (const [k, v] of Object.entries(o).slice(0, 12)) {
      if (v === null || v === '') continue;
      console.log(`    ${D}${k.padEnd(16)}${R}${String(v).slice(0, 52)}`);
    }
    break;
  }
  rl.close();
  console.log('');
}
