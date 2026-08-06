#!/usr/bin/env node
/**
 * VegaLand — Geo Zenginleştirme (Census TIGERweb)
 *
 * Puanlanmış arsalara EN YAKIN YOL mesafesini ekler. Yola erişimi olmayan parsel
 * pratikte satılamaz; liste bu kontrol yapılmadan güvenilir sayılmaz.
 *
 * NEDEN OVERPASS DEĞİL: ücretsiz OpenStreetMap aynaları bu hacmi kaldırmadı —
 * ölçüldü, 130 başarılı sorguya 404 hata düşüyordu ve sayfa başına 2.000 kayıt
 * sınırı vardı. TIGERweb (Census) aynı işi 100.000 kayıt sınırı ve ~500 ms
 * yanıtla yapıyor. Kaynak da resmî: parsel county listelerini de oradan aldık.
 *
 * YÖNTEM: adaylar 0,05°'lik (~5,5 km) kutulara toplanır, kutu başına TEK sorgu
 * atılır, dönen yol çizgilerinin TÜM noktalarına olan en kısa mesafe hesaplanır.
 * Kutu kenarına R kadar pay eklenir ki kenardaki parsel komşu kutudaki yolu da
 * görsün.
 *
 * Kullanım:
 *   node geo-tiger.mjs --sinif A+                 # hızlı tur
 *   node geo-tiger.mjs --sinif A+,A               # birinci sınıfın tamamı
 *   node geo-tiger.mjs --sinif A+ --birlesik      # birleşik havuzdan oku
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const arg = process.argv.slice(2);
const bayrak = (a, v) => { const i = arg.indexOf(a); return i >= 0 && arg[i + 1] ? arg[i + 1] : v; };
const SINIFLAR = bayrak('--sinif', 'A+').split(',').map((s) => s.trim());
const BIRLESIK = arg.includes('--birlesik');
const GIRIS = BIRLESIK ? path.join(VERI, 'birlesik', 'puanli') : path.join(VERI, 'puanli');
const CIKTI = path.join(VERI, 'geo');
const ONBELLEK = path.join(VERI, 'geo-tiger-onbellek.ndjson');

const TIGER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer';
const KATMANLAR = [2, 8];          // 2 = Primary Roads, 8 = Local Roads
const HUCRE = 0.001;               // ~110 m — mesafe çözünürlüğü
const KUTU = 0.05;                 // ~5,5 km — toplu sorgu penceresi
const R_YOL = 1600;                // yarıçap (m) — grade-core yol bandıyla uyumlu
const ES_ZAMAN = Number(process.env.GEO_ES_ZAMAN || 6);
const UA = { 'User-Agent': 'terralot-geo/1.0 (land grading; contact sales@nocturndev.com)' };

const bin = (n) => Number(n || 0).toLocaleString('tr-TR');
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLng = (bLng - aLng) * d;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function j(url, deneme = 0) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.error) throw new Error(`Esri ${d.error.code}`);
    return d;
  } catch (e) {
    if (deneme >= 3) throw e;
    await uyu(1200 * 2 ** deneme);
    return j(url, deneme + 1);
  }
}

// ── 1) Adayları oku ─────────────────────────────────────────────────────────
if (!fs.existsSync(GIRIS)) { console.error(`${GIRIS} yok — önce puanla.mjs koş.`); process.exit(1); }
fs.mkdirSync(CIKTI, { recursive: true });

const kayitlar = [];
for (const f of fs.readdirSync(GIRIS).filter((x) => x.endsWith('.ndjson.gz'))) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(GIRIS, f)).pipe(zlib.createGunzip()), crlfDelay: Infinity,
  });
  for await (const s of rl) {
    if (!s.trim()) continue;
    let o; try { o = JSON.parse(s); } catch { continue; }
    if (!SINIFLAR.includes(o.sinif)) continue;
    if (o.lat == null || o.lng == null) continue;   // koordinatsız kayıt ölçülemez
    kayitlar.push(o);
  }
}
console.error(`${bin(kayitlar.length)} kayıt seçildi (sınıf: ${SINIFLAR.join(',')})`);
if (!kayitlar.length) process.exit(0);

// ── 2) Hücre → kutu ─────────────────────────────────────────────────────────
const hucreler = new Map();
for (const k of kayitlar) {
  const lat = Math.round(k.lat / HUCRE) * HUCRE, lng = Math.round(k.lng / HUCRE) * HUCRE;
  const a = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  k._h = a;
  if (!hucreler.has(a)) hucreler.set(a, { lat, lng });
}
const onbellek = new Map();
if (fs.existsSync(ONBELLEK)) {
  for (const s of fs.readFileSync(ONBELLEK, 'utf8').split('\n')) {
    if (!s.trim()) continue;
    try { const o = JSON.parse(s); onbellek.set(o.h, o.m); } catch { /* bozuk */ }
  }
}
const kalan = [...hucreler.entries()].filter(([a]) => !onbellek.has(a));
console.error(`${bin(hucreler.size)} hücre · önbellekte ${bin(onbellek.size)} · sorgulanacak ${bin(kalan.length)}`);

const kutular = new Map();
for (const [a, c] of kalan) {
  const kx = Math.floor(c.lng / KUTU), ky = Math.floor(c.lat / KUTU);
  const kk = `${kx}|${ky}`;
  if (!kutular.has(kk)) kutular.set(kk, {
    xmin: kx * KUTU, ymin: ky * KUTU, xmax: (kx + 1) * KUTU, ymax: (ky + 1) * KUTU, hucreler: [],
  });
  kutular.get(kk).hucreler.push({ a, ...c });
}
const kuyruk = [...kutular.values()];
console.error(`${bin(kuyruk.length)} kutu sorgusu (${(kalan.length / Math.max(kuyruk.length, 1)).toFixed(1)} hücre/kutu) · ${ES_ZAMAN} işçi`);

// ── 3) Sorgula ──────────────────────────────────────────────────────────────
const akis = fs.createWriteStream(ONBELLEK, { flags: 'a' });
let bitti = 0, hata = 0, cozulen = 0;
const t0 = Date.now();
let sira = 0;

async function isci() {
  while (sira < kuyruk.length) {
    const k = kuyruk[sira++];
    // Kutu kenarındaki parsel komşu kutudaki yolu görebilsin diye pay ekle.
    const payLat = R_YOL / 111320;
    const payLng = R_YOL / (111320 * Math.max(0.15, Math.cos(((k.ymin + k.ymax) / 2) * Math.PI / 180)));
    const zarf = JSON.stringify({
      xmin: k.xmin - payLng, ymin: k.ymin - payLat, xmax: k.xmax + payLng, ymax: k.ymax + payLat,
    });
    const yollar = [];
    try {
      for (const kat of KATMANLAR) {
        const d = await j(`${TIGER}/${kat}/query?geometry=${encodeURIComponent(zarf)}` +
          '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
          '&outFields=MTFCC&returnGeometry=true&outSR=4326&f=json');
        for (const f of (d.features || [])) for (const yol of (f.geometry?.paths || [])) yollar.push(yol);
      }
      for (const h of k.hucreler) {
        let enYakin = -1;   // -1 = tarandı, yarıçap içinde yol YOK
        let min = Infinity;
        for (const yol of yollar) for (const [x, y] of yol) {
          const m = haversine(h.lat, h.lng, y, x);
          if (m < min) min = m;
        }
        if (min <= R_YOL) enYakin = Math.round(min);
        onbellek.set(h.a, enYakin);
        akis.write(JSON.stringify({ h: h.a, m: enYakin }) + '\n');
        cozulen++;
      }
      bitti++;
    } catch (e) {
      hata++;
      await uyu(1500);
    }
    if (bitti % 20 === 0) {
      const dk = (Date.now() - t0) / 60000;
      process.stderr.write(`\r  ${bitti}/${kuyruk.length} kutu · ${bin(cozulen)} hücre · ${Math.round(cozulen / Math.max(dk, 0.01))} hücre/dk · ${hata} hata   `);
    }
  }
}
await Promise.all(Array.from({ length: ES_ZAMAN }, isci));
akis.end();
console.error('');

// ── 4) Kayıtlara işle ───────────────────────────────────────────────────────
const say = { yolVar: 0, yolYok: 0, olculemedi: 0 };
const bant = { '0-100m': 0, '100-400m': 0, '400-800m': 0, '800-1600m': 0 };
const gz = zlib.createGzip({ level: 6 });
gz.pipe(fs.createWriteStream(path.join(CIKTI, `${SINIFLAR.join('_').replace(/\+/g, 'plus')}.ndjson.gz`)));

for (const k of kayitlar) {
  const m = onbellek.get(k._h);
  delete k._h;
  if (m === undefined) { say.olculemedi++; k.yol_m = null; }
  else if (m === -1) { say.yolYok++; k.yol_m = -1; }
  else {
    say.yolVar++; k.yol_m = m;
    bant[m < 100 ? '0-100m' : m < 400 ? '100-400m' : m < 800 ? '400-800m' : '800-1600m']++;
  }
  if (!gz.write(JSON.stringify(k) + '\n')) await new Promise((r) => gz.once('drain', r));
}
await new Promise((r) => { gz.end(r); });

const dk = (Date.now() - t0) / 60000;
console.error(`\n${bin(kayitlar.length)} kayıt yazıldı → ${path.join(CIKTI, SINIFLAR.join('_').replace(/\+/g, 'plus') + '.ndjson.gz')}`);
console.error(`  yol bulundu ${bin(say.yolVar)} · ${R_YOL} m içinde yol YOK ${bin(say.yolYok)} · ölçülemedi ${bin(say.olculemedi)}`);
console.error(`  mesafe bandı: ${Object.entries(bant).map(([k2, v]) => `${k2} ${bin(v)}`).join(' · ')}`);
console.error(`  süre ${dk.toFixed(1)} dk · ${hata} sorgu hatası · kaynak: Census TIGERweb`);
