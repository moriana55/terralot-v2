#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GEO-ZENGİNLEŞTİRME — Kademe-1'den geçen off-market lead'lere OSM Overpass ile
// GERÇEK mesafe verisi: yol / elektrik hattı / su-göl / kasaba.
//
//   node scraper/geo-enrich-offmarket.mjs             # top 25K skorlu kayıt
//   GEO_TOP=40000 node scraper/geo-enrich-offmarket.mjs
//
// • 565K'nın tamamına Overpass ATILMAZ (rate limit) — huni: grade_score'a göre
//   en iyi GEO_TOP kayıt + koordinatı olanlar.
// • Nokta dedupe: 0.001° (~110 m) hücre — aynı subdivision'daki komşu parseller
//   tek Overpass sorgusu paylaşır (sorgu sayısını ~5-10x düşürür).
// • RESUME EDİLEBİLİR: geo_enriched_at IS NULL filtresi; kesip tekrar başlatmak
//   kaldığı yerden sürer. Kalıp: scraper/dd-enrich.js (mirror rotasyonu + UA).
// • Mesafeler Overpass `out center` üzerinden hesaplanır (way merkezi) —
//   yaklaşık değerdir; kartlarda "~" ile gösterilir, kesinlik iddia edilmez.
// • dist_*_m: -1 = tarandı, yarıçap içinde yok. Bitince notları tazele:
//   node scraper/grade-offmarket.mjs
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const GEO_TOP = parseInt(process.env.GEO_TOP || "25000", 10);
// Yeni hasat edilen eyaletleri öne almak için isteğe bağlı kapsam daraltması.
// Huni global grade_score'a göre çalışır; geo puanı OLMAYAN yeni satırlar
// (dist_* boş → cazibeden ~30 puan eksik) global top listesine hiç giremez ve
// sonsuza dek B tavanında kalırdı. GEO_EYALET=MS,WV,… ile o eyaletlerin
// kuyruğu ayrıca koşturulur.
//   GEO_EYALET=MS,WV,MT,NC,AL,ID,WY node scraper/geo-enrich-offmarket.mjs
const GEO_EYALET = (process.env.GEO_EYALET || "")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 2026-07-25 ölçümü: mail.ru 0.6s/200, overpass-api.de 0.8s/200 (sabahki 504
// geçmiş), kumi.systems + private.coffee 25s TIMEOUT, osm.jp 000.
// kumi LİSTEDEN ÇIKARILDI: ölü aynayı denemek her hatada 25sn yakıyordu —
// ana ayna 429 verince hız 67→6 hücre/dk'ya bu yüzden çöktü.
// İki sağlam ayna kaldı; işçiler round-robin ile FARKLI aynadan başlar
// (yük tek aynaya binmesin → 429 azalır).
const OVERPASS_MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
// 2 sağlam ayna × ayna başına ~3 işçi = 6. Ayna başına baskı eskisiyle aynı.
const CONCURRENCY = parseInt(process.env.GEO_CONCURRENCY || "6", 10);
// ⚠ 2026-07-29 ölçümü: SOĞUK sorgu (önbellekte olmayan bölge) mail.ru aynasında
// ~29 sn sürüyor. Eski sabit 22 sn tavanı bu yüzden SIK SIK zaman aşımı
// üretiyordu — istek sunucuda tamamlanıyor, biz cevabı beklemeden atıyorduk.
// Tavan artık ayarlanabilir; yeni eyalet hasadı gibi hep-soğuk turlarda yükselt.
const FETCH_TIMEOUT = parseInt(process.env.GEO_TIMEOUT || "40000", 10);
const UA = "terralot-geo/1.0 (land grading; contact sales@nocturndev.com)";
const ROAD_RE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street)$/;

// Arama yarıçapları (metre) — grade-core geo bantlarıyla uyumlu.
const R_ROAD = 1600, R_POWER = 1500, R_WATER = 1500, R_TOWN = 25000;

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000, d2r = Math.PI / 180;
  const dLat = (bLat - aLat) * d2r, dLng = (bLng - aLng) * d2r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d2r) * Math.cos(bLat * d2r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildQuery(lat, lng) {
  return `[out:json][timeout:25];(
    way(around:${R_ROAD},${lat},${lng})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road|living_street)$"];
    way(around:${R_POWER},${lat},${lng})["power"~"^(line|minor_line)$"];
    node(around:${R_POWER},${lat},${lng})["power"~"^(tower|pole)$"];
    way(around:${R_WATER},${lat},${lng})["natural"="water"];
    way(around:${R_WATER},${lat},${lng})["waterway"~"^(river|stream|canal)$"];
    node(around:${R_TOWN},${lat},${lng})["place"~"^(town|city|village)$"];
  );out center 150;`;
}

// SAF: Overpass cevabı → kategori başına min mesafe (m) veya -1.
export function parseDistances(json, lat, lng) {
  const min = { road: Infinity, power: Infinity, water: Infinity, town: Infinity };
  for (const el of json?.elements ?? []) {
    const elat = Number(el.center?.lat ?? el.lat);
    const elng = Number(el.center?.lon ?? el.lon);
    if (!Number.isFinite(elat) || !Number.isFinite(elng)) continue;
    const t = el.tags ?? {};
    const d = haversine(lat, lng, elat, elng);
    let cat = null;
    if (typeof t.highway === "string" && ROAD_RE.test(t.highway)) cat = "road";
    else if (t.power === "line" || t.power === "minor_line" || t.power === "tower" || t.power === "pole") cat = "power";
    else if (t.natural === "water" || typeof t.waterway === "string") cat = "water";
    else if (typeof t.place === "string") cat = "town";
    if (cat && d < min[cat]) min[cat] = d;
  }
  const out = {};
  for (const [k, v] of Object.entries(min)) out[k] = Number.isFinite(v) ? Math.round(v) : -1;
  return out;
}

// wid = işçi no; her işçi farklı aynadan başlar (round-robin yük dağıtımı).
async function overpass(lat, lng, wid = 0) {
  let lastErr;
  const off = wid % OVERPASS_MIRRORS.length;
  const mirrors = [...OVERPASS_MIRRORS.slice(off), ...OVERPASS_MIRRORS.slice(0, off)];
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of mirrors) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: "data=" + encodeURIComponent(buildQuery(lat, lng)),
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (res.status === 429 || res.status === 504) { lastErr = new Error("overpass " + res.status); await sleep(4000); continue; }
        if (!res.ok) throw new Error("overpass " + res.status);
        return await res.json();
      } catch (e) { lastErr = e; await sleep(1500); }
    }
  }
  throw lastErr ?? new Error("overpass yok");
}

async function main() {
  // Pool (Client değil): saatler süren taramada Supabase bağlantıyı düşürüyor.
  // Client'ta bu unhandled 'error' → process ölümü demekti; Pool yeniden bağlanır.
  const client = new pg.Pool({
    connectionString: dbUrl(),
    max: 3,
    keepAlive: true,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
  client.on("error", (e) => console.warn(`\npg boşta bağlantı hatası (yok sayıldı): ${e.message}`));

  // Huni eşiği: koordinatlı + skorlu en iyi GEO_TOP kaydın skor tabanı.
  // GEO_EYALET verildiyse huni O EYALETLERİN İÇİNDE kurulur.
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
     limit $2`, // skorlar ayrık — eşitlik yığılmasına LIMIT koru
    GEO_EYALET.length ? [minScore, GEO_TOP, GEO_EYALET] : [minScore, GEO_TOP]);
  console.log(
    `geo kuyruğu: ${pend.rows.length} lead (skor >= ${minScore}, top ~${GEO_TOP}` +
    `${GEO_EYALET.length ? `, eyalet ${GEO_EYALET.join("/")}` : ""})`);

  // 0.001° hücre dedupe — komşu parseller tek sorgu paylaşır.
  const cells = new Map(); // key → { lat, lng, ids: [] }
  for (const r of pend.rows) {
    const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
    if (!cells.has(key)) cells.set(key, { lat: r.lat, lng: r.lng, ids: [] });
    cells.get(key).ids.push(r.lead_id);
  }
  console.log(`hücre sayısı: ${cells.size} (dedupe ${(pend.rows.length / Math.max(1, cells.size)).toFixed(1)}x)`);

  // CONCURRENCY işçi paylaşımlı kuyruk — Overpass fetch'leri paralel, DB
  // update'leri tek bağlantıda (pg zaten serialize eder, update'ler hızlı).
  let done = 0, fail = 0, stop = false;
  const t0 = Date.now();
  const queue = [...cells.entries()];
  async function refreshSummary() {
    await client.query(`begin;
      delete from offmarket_grade_summary;
      insert into offmarket_grade_summary(state, grade, n, geo_n)
        select state, grade, count(*), count(*) filter (where geo_enriched_at is not null)
        from offmarket_leads group by 1,2;
      commit;`).catch(() => {});
  }
  async function worker(wid) {
    for (;;) {
      const item = queue.shift();
      if (!item || stop) return;
      const [key, cell] = item;
      try {
        const json = await overpass(cell.lat, cell.lng, wid);
        const d = parseDistances(json, cell.lat, cell.lng);
        // Bağlantı koparsa sorguyu 3 kez dene — Overpass sonucu boşa gitmesin.
        for (let a = 1; ; a++) {
          try {
            await client.query(
              `update offmarket_leads set dist_road_m=$1, dist_power_m=$2, dist_water_m=$3,
                 dist_town_m=$4, geo_enriched_at=now() where lead_id = any($5)`,
              [d.road, d.power, d.water, d.town, cell.ids]
            );
            break;
          } catch (e) {
            if (a >= 3) throw e;
            await sleep(3000 * a);
          }
        }
        done++;
      } catch (e) {
        fail++;
        if (fail % 25 === 0) console.warn(`\nhata (${fail}): ${key} → ${e.message}`);
        if (fail > 300 && fail > done) { stop = true; console.error("\nOverpass sürekli hata veriyor — duraklatıldı (resume güvenli)"); return; }
      }
      if (done % 25 === 0) {
        const rate = done / ((Date.now() - t0) / 60000);
        process.stdout.write(`\rhücre ${done}/${cells.size} · hata ${fail} · ${rate.toFixed(0)} hücre/dk\n`);
      }
      // NOT: özet tablo koşu ORTASINDA tazelenmiyor. refreshSummary() 566K
      // satırı baştan sona tarayan bir aggregate; 500 hücrede bir çalışınca
      // diski/RAM'i yiyip Postgres'i devirdi (2026-07-27 kesintisi). Özet
      // yalnızca koşu bitiminde bir kez yazılır — UI'daki geo sayacı koşu
      // boyunca sabit kalır, terminaldeki ilerleme çıktısı canlı olandır.
      await sleep(650); // işçi başına ~1 sorgu/s → toplam ~CONCURRENCY sorgu/s
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  await refreshSummary();
  console.log(`\nbitti: ${done} hücre, ${fail} hata. Şimdi: node scraper/grade-offmarket.mjs (notları tazele)`);
  await client.end();
}

if (process.argv[1] && process.argv[1].endsWith("geo-enrich-offmarket.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
