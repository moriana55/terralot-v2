#!/usr/bin/env node
/**
 * VegaLand — TEK ENVANTER (birleştirme)
 *
 * Üç kaynağı tek listede toplar ve AYNI puanlama motorundan geçirir:
 *   1) mevcut envanter  — offmarket_leads (921.343 satır)
 *   2) eyalet geneli    — veri/ayik/aday/
 *   3) county           — veri/county/ayik/aday/
 *
 * NEDEN AYNI MOTOR: mevcut envanterin kendi not sistemi (A-F, grade_score) ile
 * bizim sınıflarımız (A+/A/B/C/D) farklı ölçekler. Yan yana koymak yanıltıcı
 * olurdu; hepsi yeniden puanlanıyor ki tek bir tablo savunulabilsin.
 *
 * TEKİLLEŞTİRME: eyalet|county|APN. Aynı parsel birden çok kaynakta olabilir
 * (ör. NC'nin 64.323 satırı hem mevcut envanterde hem yeni hasatta). Öncelik
 * sırası: county > eyalet geneli > mevcut — sonraki kaynak daha yeni ve daha
 * çok alan taşıdığı için.
 *
 * Kullanım:  node birlestir.mjs [mevcut-envanter.ndjson.gz]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const MEVCUT = process.argv[2] || path.join(VERI, 'mevcut-envanter.ndjson.gz');
const CIKTI = path.join(VERI, 'birlesik');

const bin = (n) => Number(n || 0).toLocaleString('tr-TR');
const anahtar = (o) =>
  `${o.eyalet}|${String(o.county || '').toUpperCase().replace(/ COUNTY$/, '').trim()}|${o.apn || ''}`;

fs.mkdirSync(CIKTI, { recursive: true });

// Kaynaklar öncelik SIRASIYLA — sonra gelen öncekini ezer.
const kaynaklar = [
  { ad: 'mevcut', dosyalar: fs.existsSync(MEVCUT) ? [MEVCUT] : [] },
  {
    ad: 'eyalet',
    dosyalar: fs.existsSync(path.join(VERI, 'ayik', 'aday'))
      ? fs.readdirSync(path.join(VERI, 'ayik', 'aday')).filter((f) => f.endsWith('.ndjson.gz'))
          .map((f) => path.join(VERI, 'ayik', 'aday', f))
      : [],
  },
  {
    ad: 'county',
    dosyalar: fs.existsSync(path.join(VERI, 'county', 'ayik', 'aday'))
      ? fs.readdirSync(path.join(VERI, 'county', 'ayik', 'aday')).filter((f) => f.endsWith('.ndjson.gz'))
          .map((f) => path.join(VERI, 'county', 'ayik', 'aday', f))
      : [],
  },
];

// ── EYALET EYALET İŞLE ──────────────────────────────────────────────────────
// 13,4M kaydı tek Map'te tutmak sunucunun belleğini aştı (node OOM ile düştü).
// Tekilleştirme zaten eyalet İÇİNDE anlamlı olduğundan (anahtar eyalet|county|apn)
// eyalet başına işlemek hem doğru hem de bellekte rahat.
const GECICI = path.join(CIKTI, 'gecici');
fs.mkdirSync(GECICI, { recursive: true });

// 1) Dağıt: her satırı eyalet dosyasına yaz (kaynak etiketiyle)
const yazarlar = new Map();
const sayac = {};
function yazar(ey) {
  if (!yazarlar.has(ey)) {
    const g = zlib.createGzip({ level: 1 });   // geçici dosya, hız öncelikli
    g.pipe(fs.createWriteStream(path.join(GECICI, `${ey}.ndjson.gz`)));
    yazarlar.set(ey, g);
  }
  return yazarlar.get(ey);
}

for (const k of kaynaklar) {
  sayac[k.ad] = { okunan: 0, anahtarsiz: 0 };
  if (!k.dosyalar.length) { console.error(`${k.ad}: dosya yok, atlandı`); continue; }
  for (const dosya of k.dosyalar) {
    const rl = readline.createInterface({
      input: fs.createReadStream(dosya).pipe(zlib.createGunzip()), crlfDelay: Infinity,
    });
    for await (const s of rl) {
      if (!s.trim()) continue;
      let o; try { o = JSON.parse(s); } catch { continue; }
      if (!o.eyalet) continue;
      sayac[k.ad].okunan++;
      if (!o.apn) sayac[k.ad].anahtarsiz++;
      o._kaynak = k.ad;
      const g = yazar(o.eyalet);
      if (!g.write(JSON.stringify(o) + '\n')) await new Promise((r) => g.once('drain', r));
    }
  }
  console.error(`${k.ad.padEnd(8)} okunan ${bin(sayac[k.ad].okunan).padStart(11)} · APN'siz ${bin(sayac[k.ad].anahtarsiz)}`);
}
await Promise.all([...yazarlar.values()].map((g) => new Promise((r) => g.end(r))));

// 2) Eyalet başına tekilleştir ve nihai dosyaya yaz
const ONCELIK = { mevcut: 0, eyalet: 1, county: 2 };
const gz = zlib.createGzip({ level: 6 });
gz.pipe(fs.createWriteStream(path.join(CIKTI, 'aday.ndjson.gz')));
const ey = {}, kaynakDagilim = {};
let ezilen = 0;

for (const f of fs.readdirSync(GECICI).filter((x) => x.endsWith('.ndjson.gz')).sort()) {
  const havuz = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(GECICI, f)).pipe(zlib.createGunzip()), crlfDelay: Infinity,
  });
  let i = 0;
  for await (const s of rl) {
    if (!s.trim()) continue;
    let o; try { o = JSON.parse(s); } catch { continue; }
    const a = o.apn ? anahtar(o) : `#${o._kaynak}#${o.lead_id || ++i}`;
    const eski = havuz.get(a);
    // Daha yüksek öncelikli kaynak öncekini ezer; eşitse sonrakini tut.
    if (eski) { ezilen++; if ((ONCELIK[eski._kaynak] ?? 0) > (ONCELIK[o._kaynak] ?? 0)) continue; }
    havuz.set(a, o);
  }
  for (const o of havuz.values()) {
    ey[o.eyalet] = (ey[o.eyalet] || 0) + 1;
    kaynakDagilim[o._kaynak] = (kaynakDagilim[o._kaynak] || 0) + 1;
    if (!gz.write(JSON.stringify(o) + '\n')) await new Promise((r) => gz.once('drain', r));
  }
  process.stderr.write(`\r  tekilleştirildi: ${f.replace('.ndjson.gz', '')} (${bin(havuz.size)})          `);
}
await new Promise((r) => { gz.end(r); });
fs.rmSync(GECICI, { recursive: true, force: true });
console.error('');
const havuz = { size: Object.values(ey).reduce((a, b) => a + b, 0) };

const rapor = {
  tarih: new Date().toISOString(),
  toplam: havuz.size,
  ezilenMukerrer: ezilen,
  kaynakDagilim,
  eyaletSayisi: Object.keys(ey).length,
  eyaletler: Object.entries(ey).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ eyalet: k, adet: v })),
  sayac,
};
fs.writeFileSync(path.join(CIKTI, 'rapor.json'), JSON.stringify(rapor, null, 1));

console.error(`\nTEK ENVANTER: ${bin(havuz.size)} arsa · ${rapor.eyaletSayisi} eyalet`);
console.error(`  kaynak dağılımı: ${Object.entries(kaynakDagilim).map(([k, v]) => `${k} ${bin(v)}`).join(' · ')}`);
console.error(`→ ${path.join(CIKTI, 'aday.ndjson.gz')}`);
console.error('\nŞimdi puanla:  node puanla.mjs --birlesik --hepsi');
