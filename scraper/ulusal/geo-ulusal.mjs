#!/usr/bin/env node
/**
 * VegaLand — Ulusal Geo Zenginleştirme
 *
 * Puanlanmış arsalara OSM'den GERÇEK mesafe verisi ekler: yol / elektrik hattı /
 * su / kasaba. Yol erişimi olmayan parsel pratikte satılamaz; bu yüzden en iyi
 * adayların geo doğrulaması yapılmadan liste güvenilir sayılmaz.
 *
 * MOTOR YENİDEN YAZILMADI: mesafe semantiği, süper hücre sorgusu, ayna havuzu
 * ve önbellek `../geo-enrich-offmarket.mjs`'ten İÇE AKTARILIYOR. Böylece bu
 * çıktı, veritabanındaki 34.000 zenginleştirilmiş satırla kıyaslanabilir kalıyor
 * ve oradaki düzeltmeler (özellikle 'out center bb' way tuzağı) burada da geçerli.
 *
 * Fark: girdi/çıktı veritabanı değil, ulusal boru hattının NDJSON dosyaları.
 *
 * ⚠️ ÖLÇEK: Overpass ücretsiz ayna hızıyla ~1.000-1.400 kayıt/dk. 11,9M adayın
 * tamamı bu pencerede mümkün DEĞİL — bu yüzden sınıf süzgeci var.
 *
 * Kullanım:
 *   node geo-ulusal.mjs --sinif A+           # sadece A+ (hızlı kanıt turu)
 *   node geo-ulusal.mjs --sinif A+,A         # birinci sınıfın tamamı
 *   node geo-ulusal.mjs --sinif A+ --eyalet TX,FL
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  HUCRE, OVERPASS_MIRRORS, R_ROAD, R_POWER, R_WATER, R_TOWN,
  parseDistances, superSorgu, aynaYokla, superHucreler,
} from '../geo-enrich-offmarket.mjs';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const GIRIS = path.join(VERI, 'puanli');
const CIKTI = path.join(VERI, 'geo');
const ONBELLEK = path.join(VERI, 'geo-hucre-onbellek.ndjson');

const arg = process.argv.slice(2);
const bayrak = (ad, varsayilan) => {
  const i = arg.indexOf(ad);
  return i >= 0 && arg[i + 1] ? arg[i + 1] : varsayilan;
};
const SINIFLAR = bayrak('--sinif', 'A+').split(',').map((s) => s.trim());
const EYALETLER = bayrak('--eyalet', '').split(',').map((s) => s.trim()).filter(Boolean);
const PER_MIRROR = Number(process.env.GEO_PER_MIRROR || 3);

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
const bin = (n) => Number(n).toLocaleString('tr-TR');

// ── 1) Adayları oku ─────────────────────────────────────────────────────────
if (!fs.existsSync(GIRIS)) { console.error(`${GIRIS} yok — önce puanla.mjs koş.`); process.exit(1); }
fs.mkdirSync(CIKTI, { recursive: true });

const kayitlar = [];
const dosyalar = fs.readdirSync(GIRIS).filter((f) => f.endsWith('.ndjson.gz'))
  .filter((f) => !EYALETLER.length || EYALETLER.includes(f.replace('.ndjson.gz', '')));

for (const f of dosyalar) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(GIRIS, f)).pipe(zlib.createGunzip()), crlfDelay: Infinity,
  });
  for await (const s of rl) {
    if (!s.trim()) continue;
    let o; try { o = JSON.parse(s); } catch { continue; }
    if (!SINIFLAR.includes(o.sinif)) continue;
    if (o.lat == null || o.lng == null) continue;   // koordinatsız kayıt geo'lanamaz
    kayitlar.push(o);
  }
}
console.error(`${bin(kayitlar.length)} kayıt seçildi (sınıf: ${SINIFLAR.join(',')}${EYALETLER.length ? ' · eyalet: ' + EYALETLER.join(',') : ''})`);
if (!kayitlar.length) { console.error('Seçili sınıfta koordinatlı kayıt yok.'); process.exit(0); }

// ── 2) Hücrelere indirge — aynı hücredeki parseller tek sorguyla çözülür ────
const hucreler = new Map();   // anahtar → {lat,lng}
for (const k of kayitlar) {
  const lat = Math.round(k.lat / HUCRE) * HUCRE;
  const lng = Math.round(k.lng / HUCRE) * HUCRE;
  const a = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  k._hucre = a;
  if (!hucreler.has(a)) hucreler.set(a, { lat, lng });
}
console.error(`${bin(hucreler.size)} benzersiz hücre (${(kayitlar.length / hucreler.size).toFixed(1)} kayıt/hücre)`);

// ── 3) Önbellek ─────────────────────────────────────────────────────────────
const onbellek = new Map();
if (fs.existsSync(ONBELLEK)) {
  for (const s of fs.readFileSync(ONBELLEK, 'utf8').split('\n')) {
    if (!s.trim()) continue;
    try { const o = JSON.parse(s); onbellek.set(o.h, o.d); } catch { /* bozuk satır */ }
  }
  console.error(`önbellekte ${bin(onbellek.size)} hücre var`);
}
// superHucreler bir Map bekliyor ([anahtar, {lat,lng}]) ve gruplarken her
// hücreye `key` alanını koyuyor — aşağıda o alan okunuyor.
const kalan = new Map([...hucreler.entries()].filter(([a]) => !onbellek.has(a)));
console.error(`${bin(kalan.size)} hücre sorgulanacak`);

// ── 4) Canlı aynaları yokla ─────────────────────────────────────────────────
// aynaYokla {url, ok, mesgul, not, ms} nesneleri döndürüyor — url'yi çıkar.
const yoklama = await aynaYokla(OVERPASS_MIRRORS);
const canli = yoklama.filter((m) => m.ok).map((m) => m.url);
for (const m of yoklama) {
  console.error(`  ${m.ok ? '✓' : '✗'} ${String(m.url).replace(/^https?:\/\//, '').split('/')[0].padEnd(28)} ${m.not} (${m.ms} ms)`);
}
if (!canli.length) { console.error('Hiçbir Overpass aynası canlı değil — sonra dene.'); process.exit(1); }
console.error(`canlı ayna: ${canli.length}`);
const isciSayisi = canli.length * PER_MIRROR;

// ── 5) Süper hücre kuyruğu ──────────────────────────────────────────────────
const kuyruk = superHucreler(kalan);
console.error(`${bin(kuyruk.length)} süper hücre sorgusu (${(kalan.size / Math.max(kuyruk.length, 1)).toFixed(1)} hücre/sorgu) · ${isciSayisi} işçi`);

const onbellekAkis = fs.createWriteStream(ONBELLEK, { flags: 'a' });
let bitti = 0, hata = 0, cozulen = 0;
const t0 = Date.now();
let sira = 0;

async function isci(wid) {
  const ayna = canli[wid % canli.length];
  while (sira < kuyruk.length) {
    const is = kuyruk[sira++];
    try {
      const r = await fetch(ayna, {
        method: 'POST', body: superSorgu(is.kutu),
        headers: { 'User-Agent': 'terralot-geo/1.0 (land grading; contact sales@nocturndev.com)' },
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      for (const h of (is.hucreler ?? [])) {
        const d = parseDistances(j, h.lat, h.lng);
        onbellek.set(h.key, d);
        onbellekAkis.write(JSON.stringify({ h: h.key, d }) + '\n');
        cozulen++;
      }
      bitti++;
    } catch (e) {
      hata++;
      await uyu(2000);
    }
    if (bitti % 10 === 0) {
      const dk = (Date.now() - t0) / 60000;
      process.stderr.write(`\r  ${bitti}/${kuyruk.length} sorgu · ${bin(cozulen)} hücre · ${Math.round(cozulen / Math.max(dk, 0.01))} hücre/dk · ${hata} hata   `);
    }
  }
}
await Promise.all(Array.from({ length: isciSayisi }, (_, i) => isci(i)));
onbellekAkis.end();
console.error('');

// ── 6) Kayıtlara işle ve yaz ────────────────────────────────────────────────
const bandlar = { yol_var: 0, yol_yok: 0, olculemedi: 0 };
const gz = zlib.createGzip({ level: 6 });
gz.pipe(fs.createWriteStream(path.join(CIKTI, `${SINIFLAR.join('_').replace('+', 'plus')}.ndjson.gz`)));

for (const k of kayitlar) {
  const d = onbellek.get(k._hucre);
  delete k._hucre;
  if (!d) { bandlar.olculemedi++; k.geo = null; }
  else {
    k.geo = { yol_m: d.road, elektrik_m: d.power, su_m: d.water, kasaba_m: d.town };
    // -1 = tarandı, yarıçap içinde bulunamadı. null/undefined = ölçülemedi.
    if (d.road != null && d.road >= 0) bandlar.yol_var++;
    else if (d.road === -1) bandlar.yol_yok++;
    else bandlar.olculemedi++;
  }
  if (!gz.write(JSON.stringify(k) + '\n')) await new Promise((r) => gz.once('drain', r));
}
await new Promise((r) => { gz.end(r); });

const dk = (Date.now() - t0) / 60000;
console.error(`\n${bin(kayitlar.length)} kayıt yazıldı → ${path.join(CIKTI, SINIFLAR.join('_').replace('+', 'plus') + '.ndjson.gz')}`);
console.error(`  yol bulundu: ${bin(bandlar.yol_var)} · ${R_ROAD} m içinde yol YOK: ${bin(bandlar.yol_yok)} · ölçülemedi: ${bin(bandlar.olculemedi)}`);
console.error(`  süre ${dk.toFixed(1)} dk · ${hata} sorgu hatası`);
console.error(`  yarıçaplar: yol ${R_ROAD} m · elektrik ${R_POWER} m · su ${R_WATER} m · kasaba ${R_TOWN} m`);
