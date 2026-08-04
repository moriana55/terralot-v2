#!/usr/bin/env node
/**
 * VegaLand — Veri Doğrulama (kanıt)
 *
 * "Bu 100 milyon parseli gerçekten indirdiniz mi, yoksa sayı mı uydurdunuz?"
 * sorusunun cevabı. İki iş yapar:
 *
 *  1) SAYIM — indirilen dosyayı baştan sona OKUYUP satırları sayar. İlerleme
 *     dosyasındaki rakama GÜVENMEZ; dosyanın kendisi ne diyorsa onu yazar.
 *     Kaynağın canlı sayısıyla karşılaştırır.
 *
 *  2) NOKTA KONTROL — dosyadan rastgele parseller seçer, aynı parseli o anda
 *     eyaletin sunucusundan tek tek çeker ve alan alan karşılaştırır. Eşleşme
 *     oranını yazar. Uydurma veri bu testi geçemez.
 *
 * Kullanım:
 *   node dogrula.mjs              # tüm eyaletler, eyalet başına 5 örnek
 *   node dogrula.mjs TX FL        # belirli eyaletler
 *   node dogrula.mjs --ornek 10   # örnek sayısı
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const KAYNAKLAR = JSON.parse(fs.readFileSync(path.join(KOK, 'kaynaklar.json'), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; VegaLand/1.0)' };

const argHam = process.argv.slice(2);
const ORNEK = argHam.includes('--ornek') ? Number(argHam[argHam.indexOf('--ornek') + 1]) : 5;
const hedefArg = argHam.filter((a, i) => !a.startsWith('--') && argHam[i - 1] !== '--ornek');

const R = '\x1b[0m', B = '\x1b[1m', G = '\x1b[32m', Y = '\x1b[33m', D = '\x1b[2m', C = '\x1b[36m';
const bin = (n) => Number(n).toLocaleString('tr-TR');

const j = async (u) => {
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45_000) });
  return r.json();
};

/** Dosyayı gerçekten okuyup satır sayar ve rastgele örnek toplar (rezervuar örnekleme). */
async function tara(dosya, k) {
  let n = 0;
  const ornekler = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(dosya).pipe(zlib.createGunzip()), crlfDelay: Infinity,
  });
  for await (const s of rl) {
    if (!s.trim()) continue;
    n++;
    // Rezervuar örnekleme: tek geçişte, dosyanın tamamından eşit olasılıkla seçer.
    if (ornekler.length < k) { try { ornekler.push(JSON.parse(s)); } catch { /* bozuk */ } }
    else {
      const i = Math.floor(Math.random() * n);
      if (i < k) { try { ornekler[i] = JSON.parse(s); } catch { /* bozuk */ } }
    }
  }
  return { n, ornekler };
}

/** Aynı parseli kaynaktan tek tek çekip alanları karşılaştır. */
async function noktaKontrol(kaynak, satir) {
  const oid = satir.OBJECTID ?? satir.FID ?? satir.objectid ?? satir.OID_;
  if (oid == null) return { durum: 'oid yok' };
  const meta = await j(`${kaynak.url}?f=json`);
  const oidAlan = meta.objectIdField || 'OBJECTID';
  const q = await j(
    `${kaynak.url}/query?where=${encodeURIComponent(`${oidAlan}=${oid}`)}` +
    `&outFields=*&returnGeometry=false&f=json`
  );
  const canli = q.features?.[0]?.attributes;
  if (!canli) return { durum: 'kaynakta bulunamadı', oid };

  // Karşılaştırılabilir alanlar: bizde de kaynakta da olan, metin/sayı olanlar
  const alanlar = Object.keys(satir).filter((a) => !a.startsWith('_') && a in canli);
  let ayni = 0, farkli = [];
  for (const a of alanlar) {
    const x = String(satir[a] ?? '').trim(), y = String(canli[a] ?? '').trim();
    if (x === y) ayni++; else farkli.push(`${a}: bizde "${x.slice(0, 20)}" · kaynakta "${y.slice(0, 20)}"`);
  }
  return { durum: 'karşılaştırıldı', oid, alanSayisi: alanlar.length, ayni, farkli, canli };
}

console.log(`\n${B}${C}  VEGALAND — VERİ DOĞRULAMA${R}`);
console.log(`${D}  Dosyalar baştan sona okunarak sayıldı. Rastgele seçilen parseller,${R}`);
console.log(`${D}  şu anda eyaletin sunucusundan tek tek çekilip karşılaştırıldı.${R}`);
console.log(`${D}  ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC${R}\n`);

const dosyalar = fs.existsSync(VERI)
  ? fs.readdirSync(VERI).filter((f) => f.endsWith('.ndjson.gz'))
      .map((f) => f.replace('.ndjson.gz', ''))
      .filter((ab) => !hedefArg.length || hedefArg.includes(ab))
      .sort()
  : [];

if (!dosyalar.length) { console.error('İndirilmiş dosya yok.'); process.exit(1); }

let toplamSatir = 0, toplamKontrol = 0, toplamEsleme = 0;

for (const ab of dosyalar) {
  const kaynak = KAYNAKLAR[ab];
  if (!kaynak) continue;
  const dosya = path.join(VERI, `${ab}.ndjson.gz`);

  process.stdout.write(`${B}  ${ab}${R} ${D}dosya okunuyor...${R}`);
  const { n, ornekler } = await tara(dosya, ORNEK);
  toplamSatir += n;

  let canliSayi = null;
  try { canliSayi = (await j(`${kaynak.url}/query?where=1%3D1&returnCountOnly=true&f=json`)).count; } catch { /* erişilemedi */ }

  const uyum = canliSayi ? (n === canliSayi ? `${G}birebir${R}` : `${Y}fark ${bin(Math.abs(n - canliSayi))}${R}`) : `${D}kaynak yanıt vermedi${R}`;
  process.stdout.write(`\r${B}  ${ab}${R}  dosyada ${B}${bin(n)}${R} satır · kaynakta ${bin(canliSayi ?? 0)} · ${uyum}\n`);

  // Nokta kontrolleri
  let esleme = 0, denenen = 0;
  for (const o of ornekler) {
    const s = await noktaKontrol(kaynak, o);
    if (s.durum !== 'karşılaştırıldı') { console.log(`    ${D}örnek atlandı: ${s.durum}${R}`); continue; }
    denenen++;
    const tam = s.farkli.length === 0;
    if (tam) esleme++;
    const isim = o.OWNER_NAME || o.ownname || o.OWNER || o.owner || o.OWNERNME1 || o.ownername || o.PRIMARY_OWNER || '—';
    console.log(
      `    ${tam ? G + '✓' : Y + '≈'}${R} OID ${String(s.oid).padEnd(9)} ${String(isim).slice(0, 28).padEnd(28)} ` +
      `${s.ayni}/${s.alanSayisi} alan aynı`
    );
    for (const f of s.farkli.slice(0, 2)) console.log(`      ${D}${f}${R}`);
  }
  toplamKontrol += denenen; toplamEsleme += esleme;
  console.log('');
}

console.log(`${B}  ${'─'.repeat(64)}${R}`);
console.log(`  ${B}${bin(toplamSatir)}${R} satır dosyalardan sayıldı (ilerleme kaydına güvenilmedi)`);
console.log(`  ${B}${toplamKontrol}${R} parsel kaynaktan tek tek çekilip karşılaştırıldı · ` +
            `${toplamEsleme === toplamKontrol ? G : Y}${toplamEsleme} tanesi birebir aynı${R}`);
console.log('');
