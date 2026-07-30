#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GEO-ZENGİNLEŞTİRME — Kademe-1'den geçen off-market lead'lere OSM Overpass ile
// GERÇEK mesafe verisi: yol / elektrik hattı / su-göl / kasaba.
//
//   node scraper/geo-enrich-offmarket.mjs             # top 25K skorlu kayıt
//   GEO_TOP=40000 node scraper/geo-enrich-offmarket.mjs
//   GEO_EYALET=MS,WV node scraper/geo-enrich-offmarket.mjs
//
// ── NEDEN B TAVANI VAR ──────────────────────────────────────────────────────
// grade-core, geo doğrulaması OLMAYAN kaydı A+/A yapmaz (B tavanı). Yani bu adım
// koşmadan yeni hasat edilen hiçbir satır deal havuzuna giremez. 551.000 kayıt
// `geo_enriched_at is null` durumundaydı; darboğaz buydu.
//
// ── HIZLANDIRMA (2026-07-29/30) ─────────────────────────────────────────────
// ÖLÇÜM (aynı ayna, aynı işçi sayısı, 5 dk bütçe, çakışmayan iki dilim):
//   eski (tekil hücre) :  7,7 hücre/dk · 66 istek · 25 hata
//   yeni (süper hücre) : 36,9 hücre/dk · 51 istek · 18 hata  → 4,8x
// GERÇEK TURDA (7 canlı ayna × 3 işçi = 21 işçi, hata 0):
//   2.600–4.100 hücre/dk · 3.200–5.000 lead/dk — eski akışın ~35 hücre/dk
//   tavanına kıyasla iki basamaklı kat. Kazancın kaynağı üç katmanlı:
//   (1) istek sayısı ~18-20x düşük, (2) ayna sağlık yoklaması ölü aynaya
//   zaman yakmıyor → paralellik gerçekten 21 işçi, (3) kalıcı önbellek.
//
// ESKİ AKIŞ: her 0.001° hücre (~110 m) için AYRI bir `around` sorgusu.
//   → 40.111 hücre = 40.111 istek. Ücretsiz aynada ~30-40 hücre/dk.
//
// YENİ AKIŞ — SÜPER HÜCRE TOPLU SORGUSU:
//   Hücreler 0.05° (~5,5 km) süper hücrelere gruplanır ve süper hücre başına
//   TEK bir bbox sorgusu atılır. Ölçüm: kuyrukta hücre/süper hücre = 18,5.
//   Yani istek sayısı ~18x düşer. Overpass tarafında da kazanç var: eski akışta
//   aynı 25 km yarıçaplı kasaba taraması komşu 18 hücre için 18 kez yapılıyordu.
//
//   Doğruluk KORUNDU (mevcut 34.000 zenginleştirilmiş satırla kıyaslanabilir
//   kalsın diye semantik bilerek değiştirilmedi):
//     • Mesafe hâlâ `out center` (way ağırlık merkezi) üzerinden — eskisi gibi
//       yaklaşık, kartlarda "~" ile gösteriliyor.
//     • "Yarıçap içinde var mı?" testi `out ... bb` ile gelen eleman sınır
//       kutusuna olan mesafeyle yapılır — eski `around:` filtresinin karşılığı.
//       Yarıçap dışıysa kategori -1 (tarandı, bulunamadı) yazılır; böylece
//       "landlocked" bayrağı eskisi gibi çalışır.
//
//   Ek hızlandırmalar:
//     • KALICI HÜCRE ÖNBELLEĞİ (scraper/data/geo-cell-cache.ndjson): aynı hücre
//       ikinci kez SORULMAZ. Koşu kesilip tekrar başlatılırsa ağ işi sıfırdan
//       yapılmaz — sadece DB güncellemesi.
//     • AYNA SAĞLIK YOKLAMASI: koşu başında aynalar ölçülür, ölü ayna listeye
//       alınmaz (ölü aynayı denemek her hatada 25-40 sn yakıyordu).
//     • SAYGILI GERİ ÇEKİLME: 429/504 alan ayna geçici olarak "soğutulur"
//       (üstel backoff, tavan 5 dk). Ayna yakılmaz, sırayla dönülür.
//     • BÖLME: sorgu eleman tavanına dayanırsa (kırpılma riski) süper hücre 4'e
//       bölünüp yeniden kuyruğa girer — sessiz veri kaybı olmaz.
//
// • RESUME EDİLEBİLİR: `geo_enriched_at IS NULL` filtresi + kalıcı önbellek.
// • Bitince notları tazele: node scraper/grade-offmarket.mjs
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { appendFileSync, createReadStream, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DOSYA = path.join(HERE, "data", "geo-cell-cache.ndjson");

const GEO_TOP = parseInt(process.env.GEO_TOP || "25000", 10);
// Yeni hasat edilen eyaletleri öne almak için isteğe bağlı kapsam daraltması.
// Huni global grade_score'a göre çalışır; geo puanı OLMAYAN yeni satırlar
// (dist_* boş → cazibeden ~30 puan eksik) global top listesine hiç giremez ve
// sonsuza dek B tavanında kalırdı. GEO_EYALET=MS,WV,… ile o eyaletlerin
// kuyruğu ayrıca koşturulur.
const GEO_EYALET = (process.env.GEO_EYALET || "")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

// Hücre (dedupe) ve süper hücre (toplu sorgu) çözünürlükleri — derece.
export const HUCRE = 0.001;        // ~110 m — DB'ye yazılan mesafenin çözünürlüğü
export const SUPER = Number(process.env.GEO_SUPER || 0.05); // ~5,5 km toplu sorgu penceresi

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 2026-07-29 ölçümü (bu makineden): overpass-api.de ve tüm *.overpass-api.de
// ECONNREFUSED, kumi.systems + private.coffee + monicz.dev TIMEOUT,
// osm.ch yalnızca İsviçre verisi (ABD sorgusuna 0 eleman döner → İŞE YARAMAZ).
// Ayakta olan: maps.mail.ru. Liste GENİŞ tutuluyor; `aynaYokla()` koşu başında
// hangisinin gerçekten ABD verisi döndürdüğünü ÖLÇER, ölüleri listeden atar.
// Yarın biri geri gelirse kod değişmeden paralellik kendiliğinden artar.
// 30 Tem 00:45 yeniden yoklama: Alman kümesi (z./lz4.overpass-api.de) GERİ GELDİ
// (504 = boğulmuş ama ayakta), overpass.monicz.dev de veri döndürüyor. Ölü/faydasız
// olanlar listede DURMAYA devam ediyor — yoklama ucuz, ayna geri gelirse
// paralellik kendiliğinden artar (kod değişmeden).
export const OVERPASS_MIRRORS = (process.env.GEO_MIRRORS || [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.monicz.dev/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
].join(",")).split(",").map((s) => s.trim()).filter(Boolean);

// Ayna başına eşzamanlı işçi. Toplam işçi = canlı ayna × bu sayı.
const PER_MIRROR = parseInt(process.env.GEO_PER_MIRROR || "3", 10);
// Süper hücre sorgusu tekil hücre sorgusundan ağır — tavan yüksek.
const FETCH_TIMEOUT = parseInt(process.env.GEO_TIMEOUT || "120000", 10);
// Eleman tavanı. Sorgu buna DAYANIRSA kırpılmış olabilir → süper hücre bölünür.
const ELEMAN_TAVANI = parseInt(process.env.GEO_ELEMAN_TAVANI || "4000", 10);
const UA = "terralot-geo/1.0 (land grading; contact sales@nocturndev.com)";
const ROAD_RE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street)$/;

// Arama yarıçapları (metre) — grade-core geo bantlarıyla uyumlu.
export const R_ROAD = 1600, R_POWER = 1500, R_WATER = 1500, R_TOWN = 25000;
const R_YEREL_MAX = Math.max(R_ROAD, R_POWER, R_WATER); // bbox marjı

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000, d2r = Math.PI / 180;
  const dLat = (bLat - aLat) * d2r, dLng = (bLng - aLng) * d2r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d2r) * Math.cos(bLat * d2r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Noktanın elemanın SINIR KUTUSUNA uzaklığı (m). Kutunun içindeyse 0.
 * `around:` filtresinin karşılığı: eski akışta "herhangi bir düğümü R içinde"
 * olan eleman dönüyordu; sınır kutusu bunun sıkı bir üst-yaklaşımıdır.
 */
export function bbMesafe(lat, lng, el) {
  const b = el?.bounds;
  if (!b) {
    const elat = Number(el?.center?.lat ?? el?.lat);
    const elng = Number(el?.center?.lon ?? el?.lon);
    if (!Number.isFinite(elat) || !Number.isFinite(elng)) return Infinity;
    return haversine(lat, lng, elat, elng);
  }
  const cLat = Math.min(Math.max(lat, b.minlat), b.maxlat);
  const cLng = Math.min(Math.max(lng, b.minlon), b.maxlon);
  return haversine(lat, lng, cLat, cLng);
}

/**
 * Elemanın MERKEZ koordinatı. Sıra: `center` (Overpass `out center`) → düğümün
 * kendi lat/lon → SINIR KUTUSU ORTASI.
 *
 * ⚠ 2026-07-30 KRİTİK DÜZELTME: süper hücre sorgusu `out center bb ...` yazıyor
 * ama Overpass bu kombinasyonda way'ler için `center` DÖNDÜRMÜYOR — yalnız
 * `bounds` geliyor. Eski kod `center` yoksa elemanı ATLIYORDU; yol/su/elektrik
 * hattı OSM'de WAY olduğu için 2026-07-29 turunda taranan 99.309 parselin
 * TAMAMI "yol yok (-1) + su yok (-1)" damgası yedi ve landlocked kuralıyla
 * doğrudan F'ye düştü. Doğrulama: 3 örnek parselin 1.600 m'sinde Overpass'a
 * göre 81 / 273 / 198 yol var.
 *
 * Sınır kutusu ortası, Overpass'ın `out center` tanımının BİREBİR aynısıdır
 * (way'in bbox merkezi) — yani uydurma değil, aynı değerin yerel hesabı.
 */
export function elMerkez(el) {
  const cLat = Number(el?.center?.lat ?? el?.lat);
  const cLng = Number(el?.center?.lon ?? el?.lon);
  if (Number.isFinite(cLat) && Number.isFinite(cLng)) return { lat: cLat, lng: cLng };
  const b = el?.bounds;
  if (b && Number.isFinite(Number(b.minlat)) && Number.isFinite(Number(b.minlon)))
    return { lat: (Number(b.minlat) + Number(b.maxlat)) / 2, lng: (Number(b.minlon) + Number(b.maxlon)) / 2 };
  return null;
}

/** Elemanın kategorisi — sırası eski parseDistances ile birebir aynı. */
export function kategori(el) {
  const t = el?.tags ?? {};
  if (typeof t.highway === "string" && ROAD_RE.test(t.highway)) return "road";
  if (t.power === "line" || t.power === "minor_line" || t.power === "tower" || t.power === "pole") return "power";
  if (t.natural === "water" || typeof t.waterway === "string") return "water";
  if (typeof t.place === "string") return "town";
  return null;
}

const YARICAP = { road: R_ROAD, power: R_POWER, water: R_WATER, town: R_TOWN };

/**
 * SAF: Overpass cevabı → BİR hücre için kategori başına min mesafe (m) veya -1.
 *
 * "Yarıçap içinde mi" testi elemanın sınır kutusuyla yapılır (eski `around:`
 * filtresinin yerine geçer); RAPORLANAN mesafe ise eskisi gibi elemanın
 * merkezine olan mesafedir — mevcut 34.000 satırla kıyaslanabilir kalsın diye.
 */
export function parseDistances(json, lat, lng) {
  const min = { road: Infinity, power: Infinity, water: Infinity, town: Infinity };
  for (const el of json?.elements ?? []) {
    const cat = kategori(el);
    if (!cat) continue;
    if (bbMesafe(lat, lng, el) > YARICAP[cat]) continue; // yarıçap dışı
    const m = elMerkez(el); // center yoksa bbox ortası (bkz. elMerkez notu)
    if (!m) continue;
    const d = haversine(lat, lng, m.lat, m.lng);
    if (d < min[cat]) min[cat] = d;
  }
  const out = {};
  for (const [k, v] of Object.entries(min)) out[k] = Number.isFinite(v) ? Math.round(v) : -1;
  return out;
}

/** Süper hücre kutusu → Overpass sorgusu (bbox + kasaba için around). */
export function superSorgu(kutu) {
  const { minLat, minLng, maxLat, maxLng } = kutu;
  const mLat = R_YEREL_MAX / 111320;
  const ortLat = (minLat + maxLat) / 2;
  const mLng = R_YEREL_MAX / (111320 * Math.max(0.1, Math.cos(ortLat * Math.PI / 180)));
  const bb = [
    (minLat - mLat).toFixed(5), (minLng - mLng).toFixed(5),
    (maxLat + mLat).toFixed(5), (maxLng + mLng).toFixed(5),
  ].join(",");
  const ortLng = (minLng + maxLng) / 2;
  // Kasaba yarıçapı: 25 km + kutunun yarı köşegeni (kutunun HER hücresi için
  // 25 km taranmış olsun; sonra hücre bazında yarıçap testi yapılıyor zaten).
  const yariKosegen = haversine(minLat, minLng, maxLat, maxLng) / 2;
  const rTown = Math.round(R_TOWN + yariKosegen);
  return `[out:json][timeout:180];(
  way(${bb})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street)$"];
  way(${bb})["power"~"^(line|minor_line)$"];
  node(${bb})["power"~"^(tower|pole)$"];
  way(${bb})["natural"="water"];
  way(${bb})["waterway"~"^(river|stream|canal)$"];
  node(around:${rTown},${ortLat.toFixed(5)},${ortLng.toFixed(5)})["place"~"^(town|city|village)$"];
);out center bb ${ELEMAN_TAVANI};`;
}

// ── Ayna havuzu: sağlık + saygılı geri çekilme ──────────────────────────────
class AynaHavuzu {
  constructor(urls) {
    this.aynalar = urls.map((url) => ({ url, sogukKadar: 0, ardisikHata: 0, istek: 0, hata: 0 }));
  }
  /** Şu an kullanılabilir aynayı seç (en az yüklü olan). */
  sec(wid) {
    const simdi = Date.now();
    const uygun = this.aynalar.filter((a) => a.sogukKadar <= simdi);
    if (!uygun.length) return null;
    const off = wid % uygun.length;
    return uygun[off];
  }
  iyi(a) { a.ardisikHata = 0; a.istek++; }
  /**
   * Kötü cevap → ÜSTEL SOĞUTMA (aynayı yakma; 429 alırsan bekle, sıraya dön).
   * 5 sn, 10, 20, 40 … tavan 5 dk.
   */
  kotu(a) {
    a.hata++; a.ardisikHata++;
    const bekle = Math.min(300000, 5000 * 2 ** (a.ardisikHata - 1));
    a.sogukKadar = Date.now() + bekle;
    return bekle;
  }
  /** En erken hangi anda bir ayna serbest kalır? */
  enErkenMs() {
    const simdi = Date.now();
    return Math.max(0, Math.min(...this.aynalar.map((a) => a.sogukKadar)) - simdi);
  }
}

/**
 * Ayna sağlık yoklaması — ÜÇ sonuç üretir:
 *   ok      → ABD koordinatına gerçek veri döndü, kullan.
 *   mesgul  → sunucu AYAKTA ama boğulmuş (429/503/504). KULLANILIR: geri
 *             çekilme mekanizması zaten var, "meşgul" ile "ölü" karıştırılmaz.
 *   ölü     → bağlantı reddi / DNS / sertifika / zaman aşımı (2 deneme), ya da
 *             200 dönüp 0 eleman veren BÖLGESEL ayna (osm.ch yalnızca İsviçre).
 * Ölü aynayı denemek her hatada 30-90 sn yakıyordu; listeden çıkarılır.
 */
export async function aynaYokla(urls, { fetchFn = fetch, timeout = 45000, deneme = 2 } = {}) {
  const q = `[out:json][timeout:25];(node(around:30000,32.5,-89.5)["place"~"^(town|city|village)$"];);out center 30;`;
  const tek = async (url) => {
    const t0 = Date.now();
    try {
      const r = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(timeout),
      });
      if (r.status === 429 || r.status === 503 || r.status === 504) {
        return { url, ok: true, mesgul: true, not: `HTTP ${r.status} (meşgul — kullanılır)`, ms: Date.now() - t0 };
      }
      if (!r.ok) return { url, ok: false, not: `HTTP ${r.status}`, ms: Date.now() - t0 };
      const j = await r.json();
      const n = j?.elements?.length ?? 0;
      return { url, ok: n > 0, not: n > 0 ? `${n} eleman` : "ABD verisi yok (bölgesel ayna)", ms: Date.now() - t0 };
    } catch (e) {
      const kod = e.cause?.code || e.name || "";
      // Zaman aşımı GEÇİCİ olabilir (ayna o an boğulmuş) → tekrar dene.
      // ECONNREFUSED / ENOTFOUND / sertifika = KALICI → tekrar deneme, boşa vakit.
      const gecici = kod === "TimeoutError" || /timeout/i.test(e.message || "");
      return { url, ok: false, gecici, not: (e.cause?.code || e.message || "hata").slice(0, 40), ms: Date.now() - t0 };
    }
  };
  return Promise.all(urls.map(async (url) => {
    let son = null;
    for (let i = 0; i < deneme; i++) {
      son = await tek(url);
      if (son.ok || !son.gecici) return son; // kalıcı hata → tekrar deneme
      if (i < deneme - 1) await sleep(3000);
    }
    return son;
  }));
}

// ── Kalıcı hücre önbelleği ──────────────────────────────────────────────────
export async function onbellekOku(dosya = CACHE_DOSYA) {
  const m = new Map();
  if (!existsSync(dosya)) return m;
  const rl = createInterface({ input: createReadStream(dosya), crlfDelay: Infinity });
  for await (const satir of rl) {
    if (!satir.trim()) continue;
    try {
      const o = JSON.parse(satir);
      if (o?.k) m.set(o.k, { road: o.r, power: o.p, water: o.w, town: o.t });
    } catch { /* bozuk satır atlanır — önbellek kritik değil */ }
  }
  return m;
}

function onbellekYaz(kayitlar, dosya = CACHE_DOSYA) {
  if (!kayitlar.length) return;
  mkdirSync(path.dirname(dosya), { recursive: true });
  appendFileSync(dosya, kayitlar.map((x) =>
    JSON.stringify({ k: x.k, r: x.d.road, p: x.d.power, w: x.d.water, t: x.d.town })).join("\n") + "\n");
}

// ── Süper hücre kurulumu ────────────────────────────────────────────────────
export function superHucreler(hucreler, boy = SUPER) {
  const sup = new Map();
  for (const [key, c] of hucreler) {
    const la = Math.floor(c.lat / boy), ln = Math.floor(c.lng / boy);
    const sk = `${la}|${ln}`;
    if (!sup.has(sk)) {
      sup.set(sk, {
        kutu: { minLat: la * boy, minLng: ln * boy, maxLat: (la + 1) * boy, maxLng: (ln + 1) * boy },
        hucreler: [],
      });
    }
    sup.get(sk).hucreler.push({ key, ...c });
  }
  return [...sup.values()];
}

/** Kırpılma şüphesinde süper hücreyi 4'e böl (hücreleri çeyreklere dağıt). */
export function dorteBol(is) {
  const { minLat, minLng, maxLat, maxLng } = is.kutu;
  const oLat = (minLat + maxLat) / 2, oLng = (minLng + maxLng) / 2;
  const kutular = [
    { minLat, minLng, maxLat: oLat, maxLng: oLng },
    { minLat, minLng: oLng, maxLat: oLat, maxLng },
    { minLat: oLat, minLng, maxLat, maxLng: oLng },
    { minLat: oLat, minLng: oLng, maxLat, maxLng },
  ];
  return kutular
    .map((kutu) => ({
      kutu,
      hucreler: is.hucreler.filter((h) =>
        h.lat >= kutu.minLat && h.lat < kutu.maxLat && h.lng >= kutu.minLng && h.lng < kutu.maxLng),
    }))
    .filter((x) => x.hucreler.length);
}

// ── Ana akış ────────────────────────────────────────────────────────────────
async function main() {
  // Pool (Client değil): saatler süren taramada Supabase bağlantıyı düşürüyor.
  const client = new pg.Pool({
    connectionString: dbUrl(),
    max: 4,
    keepAlive: true,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
  client.on("error", (e) => console.warn(`\npg boşta bağlantı hatası (yok sayıldı): ${e.message}`));

  // 1) Ayna sağlığı — ölü aynayı denemek her hatada 30-90 sn yakıyordu.
  const yoklama = await aynaYokla(OVERPASS_MIRRORS);
  for (const y of yoklama) console.log(`ayna ${y.ok ? "✔" : "✘"} ${String(y.ms).padStart(6)}ms  ${y.not.padEnd(26)} ${y.url}`);
  const canli = yoklama.filter((y) => y.ok).map((y) => y.url);
  if (!canli.length) {
    console.error("Hiçbir Overpass aynası ABD verisi döndürmedi — koşu iptal (resume güvenli).");
    await client.end();
    process.exit(1);
  }
  const havuz = new AynaHavuzu(canli);
  const CONCURRENCY = parseInt(process.env.GEO_CONCURRENCY || String(canli.length * PER_MIRROR), 10);
  console.log(`canlı ayna: ${canli.length} · işçi: ${CONCURRENCY} (ayna başına ~${PER_MIRROR})`);

  // 2) Huni eşiği: koordinatlı + skorlu en iyi GEO_TOP kaydın skor tabanı.
  const eyaletKosul = GEO_EYALET.length ? "and state = any($2)" : "";
  const thr = await client.query(
    `select grade_score s from offmarket_leads
     where lat is not null and grade_score is not null ${eyaletKosul}
     order by grade_score desc offset $1 limit 1`,
    GEO_EYALET.length ? [GEO_TOP, GEO_EYALET] : [GEO_TOP]);
  const minScore = thr.rows[0]?.s ?? 0;

  const pend = await client.query(
    `select lead_id, lat::float8 lat, lng::float8 lng from offmarket_leads
     where geo_enriched_at is null and lat is not null and grade_score >= $1
       ${GEO_EYALET.length ? "and state = any($3)" : ""}
     order by grade_score desc
     limit $2`,
    GEO_EYALET.length ? [minScore, GEO_TOP, GEO_EYALET] : [minScore, GEO_TOP]);
  console.log(
    `geo kuyruğu: ${pend.rows.length} lead (skor >= ${minScore}, top ~${GEO_TOP}` +
    `${GEO_EYALET.length ? `, eyalet ${GEO_EYALET.join("/")}` : ""})`);

  // 3) 0.001° hücre dedupe — komşu parseller tek sorgu paylaşır.
  const cells = new Map();
  for (const r of pend.rows) {
    const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
    if (!cells.has(key)) cells.set(key, { lat: r.lat, lng: r.lng, ids: [] });
    cells.get(key).ids.push(r.lead_id);
  }
  console.log(`hücre: ${cells.size} (dedupe ${(pend.rows.length / Math.max(1, cells.size)).toFixed(1)}x)`);

  // Toplu DB yazımı — süper hücre başına TEK update (unnest).
  async function yaz(kayitlar) {
    if (!kayitlar.length) return 0;
    const ids = [], ro = [], po = [], wa = [], to = [];
    for (const k of kayitlar) for (const id of k.ids) {
      ids.push(id); ro.push(k.d.road); po.push(k.d.power); wa.push(k.d.water); to.push(k.d.town);
    }
    if (!ids.length) return 0;
    for (let a = 1; ; a++) {
      try {
        await client.query(
          `update offmarket_leads l set dist_road_m=v.road, dist_power_m=v.power,
             dist_water_m=v.water, dist_town_m=v.town, geo_enriched_at=now()
           from (select unnest($1::text[]) lead_id, unnest($2::int[]) road,
                        unnest($3::int[]) power, unnest($4::int[]) water,
                        unnest($5::int[]) town) v
           where l.lead_id = v.lead_id`,
          [ids, ro, po, wa, to]);
        return ids.length;
      } catch (e) {
        if (a >= 3) throw e;
        await sleep(3000 * a);
      }
    }
  }

  // 4) KALICI ÖNBELLEK — daha önce sorulmuş hücre bir daha SORULMAZ.
  const onbellek = await onbellekOku();
  const onbellektenYazilacak = [];
  for (const [key, c] of [...cells]) {
    const d = onbellek.get(key);
    if (d) { onbellektenYazilacak.push({ ids: c.ids, d }); cells.delete(key); }
  }
  if (onbellektenYazilacak.length) {
    let n = 0;
    for (let i = 0; i < onbellektenYazilacak.length; i += 500) {
      n += await yaz(onbellektenYazilacak.slice(i, i + 500));
    }
    console.log(`önbellekten (ağa gidilmeden): ${onbellektenYazilacak.length} hücre / ${n} lead`);
  }

  // 5) Süper hücre kuyruğu.
  const queue = superHucreler(cells);
  const toplamHucre = cells.size;
  console.log(`süper hücre (${SUPER}°): ${queue.length} · sorgu başına ~${(toplamHucre / Math.max(1, queue.length)).toFixed(1)} hücre → istek ${toplamHucre} yerine ~${queue.length}`);
  if (!queue.length) {
    console.log("yapılacak ağ işi yok.");
    await client.end();
    return;
  }

  let doneHucre = 0, doneLead = 0, fail = 0, bolme = 0, stop = false;
  const t0 = Date.now();

  async function refreshSummary() {
    await client.query(`begin;
      delete from offmarket_grade_summary;
      insert into offmarket_grade_summary(state, grade, n, geo_n)
        select state, grade, count(*), count(*) filter (where geo_enriched_at is not null)
        from offmarket_leads group by 1,2;
      commit;`).catch(() => {});
  }

  async function sorgu(is, wid) {
    const body = "data=" + encodeURIComponent(superSorgu(is.kutu));
    for (let deneme = 0; deneme < 4; deneme++) {
      const ayna = havuz.sec(wid + deneme);
      if (!ayna) { await sleep(Math.min(15000, havuz.enErkenMs() + 500)); continue; }
      try {
        const res = await fetch(ayna.url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body,
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (!res.ok) {
          // 429 = kotayı aştık, 504/503 = sunucu boğuldu → SOĞUT, yakma.
          const bekle = havuz.kotu(ayna);
          if (deneme === 3) throw new Error(`overpass ${res.status}`);
          await sleep(Math.min(bekle, 8000));
          continue;
        }
        const j = await res.json();
        havuz.iyi(ayna);
        return j;
      } catch (e) {
        havuz.kotu(ayna);
        if (deneme === 3) throw e;
        await sleep(2000);
      }
    }
    throw new Error("overpass yok");
  }

  async function worker(wid) {
    for (;;) {
      const is = queue.shift();
      if (!is || stop) return;
      try {
        const j = await sorgu(is, wid);
        const n = j?.elements?.length ?? 0;
        // Eleman tavanına dayandıysa cevap KIRPILMIŞ olabilir → böl, veri kaybetme.
        if (n >= ELEMAN_TAVANI && is.hucreler.length > 1) {
          const parcalar = dorteBol(is);
          if (parcalar.length > 1) { queue.push(...parcalar); bolme++; continue; }
        }
        const kayitlar = is.hucreler.map((h) => ({ key: h.key, ids: h.ids, d: parseDistances(j, h.lat, h.lng) }));
        await yaz(kayitlar);
        onbellekYaz(kayitlar.map((k) => ({ k: k.key, d: k.d })));
        doneHucre += kayitlar.length;
        doneLead += kayitlar.reduce((s, k) => s + k.ids.length, 0);
      } catch (e) {
        fail++;
        // Ücretsiz aynada 429/504 sık — düşen süper hücre KAYBEDİLMEZ, kuyruğun
        // SONUNA atılır (ayna o arada soğur). En fazla 2 kez; sonra bu tura
        // bırakılır, `geo_enriched_at is null` kaldığı için sonraki tur alır.
        is.tekrar = (is.tekrar ?? 0) + 1;
        if (is.tekrar <= 2) queue.push(is);
        if (fail % 10 === 0) console.warn(`\nhata (${fail}): ${JSON.stringify(is.kutu)} → ${e.message}`);
        if (fail > 200 && fail > doneHucre / 4) {
          stop = true;
          console.error("\nOverpass sürekli hata veriyor — duraklatıldı (resume güvenli)");
          return;
        }
      }
      const dk = (Date.now() - t0) / 60000;
      process.stdout.write(
        `\rhücre ${doneHucre}/${toplamHucre} · lead ${doneLead} · kalan sorgu ${queue.length} · ` +
        `hata ${fail} · bölme ${bolme} · ${(doneHucre / dk).toFixed(0)} hücre/dk · ${(doneLead / dk).toFixed(0)} lead/dk   `);
      // NOT: özet tablo koşu ORTASINDA tazelenmiyor (2026-07-27 kesintisi:
      // 566K satırlık aggregate 500 hücrede bir koşunca Postgres'i devirdi).
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  await refreshSummary();
  const dk = (Date.now() - t0) / 60000;
  console.log(
    `\nbitti: ${doneHucre} hücre / ${doneLead} lead, ${fail} hata, ${bolme} bölme · ` +
    `${dk.toFixed(1)} dk · ${(doneHucre / dk).toFixed(0)} hücre/dk · ${(doneLead / dk).toFixed(0)} lead/dk`);
  console.log("Şimdi: node scraper/grade-offmarket.mjs (notları tazele)");
  await client.end();
}

if (process.argv[1] && process.argv[1].endsWith("geo-enrich-offmarket.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
