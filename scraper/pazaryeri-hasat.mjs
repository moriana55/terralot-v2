#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// PAZARYERİ HASADI — LandHub ilan fiyatları → competitor_listings
//
//   node scraper/pazaryeri-hasat.mjs            # tam tur (kaldığı yerden)
//   node scraper/pazaryeri-hasat.mjs --dry      # yazma, sadece rapor
//   LIMIT=200 node scraper/pazaryeri-hasat.mjs  # kısa deneme
//
// NEDEN BU DOSYA VAR
// Parsel fiyatlarımızın %83'ü (291.173 kayıt) `sabit-2999` — yani piyasanın en
// ucuz oyuncusunun medyan dönüm fiyatı, parselle hiç ilgisi yok. Gerçek piyasa
// değeri yalnız FL ve CO'da var, çünkü tapu satış bedeli yalnız "açık kayıt"
// eyaletlerinde kamuya açık. TX, NM, MT, WY, ID, KS, MS, UT, ND "non-disclosure"
// eyaletler: satış bedeli tapuya YAZILMAZ, hiçbir zaman çekilemez. Envanterin
// en büyük iki eyaleti (TX 231K, NM 139K) bu grupta.
//
// İlan fiyatı satış bedeli DEĞİLDİR — isteme fiyatıdır ve genelde satıştan
// yüksektir. Ama gerçek bir piyasa sinyalidir ve non-disclosure eyaletlerde
// elde edilebilecek TEK sinyaldir. Bu yüzden ayrı bir kademe olarak tutulur
// (bkz. price_basis) ve tapu comp'uyla ASLA aynı güvende sayılmaz.
//
// KAYNAK SEÇİMİ — erişim kurallarına uyularak
//   landsearch.com  : robots izin veriyor ama sitemap Cloudflare sorgusu arkasında → KULLANILMADI
//   landwatch.com   : robots'a erişim 403 (Akamai) → KULLANILMADI
//   landandfarm.com : robots'a erişim 403 (Akamai) → KULLANILMADI
//   landflip.com    : robots.txt "Disallow: /" → KULLANILMADI
//   landhub.com     : robots.txt "Allow: /" + properties-sitemap.xml yayınlıyor → KULLANILIYOR
// Erişim engelini aşmaya çalışmıyoruz; izin veren kaynakla çalışıyoruz.
//
// NAZİKLİK: eşzamanlı 3 istek, her istek arası bekleme, hata olunca geri çekilme.
// Kesintiye dayanıklı: işlenen URL'ler checkpoint dosyasına yazılır, tekrar
// koşunca kaldığı yerden devam eder (Mac/VPS kapansa da iş kaybolmaz).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const LIMIT = Number(process.env.LIMIT || 0);

const SITEMAP = "https://www.landhub.com/properties-sitemap.xml";
const UA = "Mozilla/5.0 (compatible; VegaLandBot/1.0; +arsa fiyat arastirmasi)";
const ESZAMAN = 3;       // aynı anda en fazla 3 istek — siteyi boğma
const BEKLE_MS = 350;    // istek arası nefes
const VERI_DIR = resolve(HERE, "data");
const CHECKPOINT = resolve(VERI_DIR, "pazaryeri-islenen.txt");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EYALETLER = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new-hampshire": "NH",
  "new-jersey": "NJ", "new-mexico": "NM", "new-york": "NY", "north-carolina": "NC",
  "north-dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode-island": "RI", "south-carolina": "SC", "south-dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west-virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
/** Eyalet adı ya da iki harfli kod → iki harfli kod. Tanınmazsa null. */
export function eyaletKodu(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) {
    const k = s.toUpperCase();
    return Object.values(EYALETLER).includes(k) ? k : null;
  }
  return EYALETLER[s.toLowerCase().replace(/\s+/g, "-")] ?? null;
}

/** "Antrim County" / "Rapides Parish" → "Antrim" / "Rapides". */
const countyTemiz = (v) => {
  const s = String(v ?? "").replace(/\s+(county|parish|borough)\s*$/i, "").trim();
  return s || null;
};

/**
 * İlan sayfasını çöz — kaynak `__NEXT_DATA__` içindeki props.pageProps.
 *
 * ⚠ REGEX İLE ÇÖZMEK YANLIŞTI: sayfada "similarProperties" listesi de var ve
 * ilk `"acres"` / `"county"` eşleşmesi çoğu zaman O LİSTEDEN geliyordu (Michigan
 * ilanı 0,49 acre iken ilk eşleşme 47,63 çıkıyordu — sessiz yanlış veri).
 * pageProps yalnız İLANIN KENDİSİNİ taşır.
 */
export function sayfaCoz(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  let p;
  try { p = JSON.parse(m[1])?.props?.pageProps; } catch { return null; }
  if (!p || typeof p !== "object") return null;

  const state = eyaletKodu(p.state);
  const price = Number(p.price);
  if (!state || !Number.isFinite(price) || price <= 0) return null;

  // acres alanı boş olabiliyor; o zaman İLANIN KENDİ BAŞLIĞINDAN okunur
  // ("Michigan, Antrim County, 0.49 Acres, Lot 397"). Başlık da vermiyorsa
  // null kalır — acre uydurulmaz, $/acre hesabı yanlış olmaktansa eksik kalsın.
  let acres = Number(p.acres);
  if (!Number.isFinite(acres) || acres <= 0) {
    const t = String(p.title ?? "").match(/([0-9]+(?:\.[0-9]+)?)\s*acres?\b/i);
    acres = t ? Number(t[1]) : NaN;
  }

  const lat = Number(p.latitude), lng = Number(p.longitude);
  return {
    state,
    county: countyTemiz(p.county),
    acres: Number.isFinite(acres) && acres > 0 ? acres : null,
    price,
    title: String(p.title ?? "").trim() || null,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
  };
}

async function getir(url, deneme = 0) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25000) });
    if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
    if (!r.ok) return null; // 404 vb. — ilan kaldırılmış, sessizce geç
    return await r.text();
  } catch (e) {
    if (deneme >= 2) return null;
    // Geri çekilme: siteyi zorlamak yerine bekle.
    await sleep(3000 * (deneme + 1));
    return getir(url, deneme + 1);
  }
}

async function main() {
  if (!existsSync(VERI_DIR)) mkdirSync(VERI_DIR, { recursive: true });
  const islenen = new Set(
    existsSync(CHECKPOINT) ? readFileSync(CHECKPOINT, "utf8").split("\n").filter(Boolean) : [],
  );
  console.log(`checkpoint: ${islenen.size} URL daha önce işlenmiş`);

  const xml = await getir(SITEMAP);
  if (!xml) { console.error("ÖLÜMCÜL: sitemap alınamadı"); process.exit(1); }
  let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.includes("/property/"));
  console.log(`sitemap: ${urls.length} ilan`);
  urls = urls.filter((u) => !islenen.has(u));
  if (LIMIT) urls = urls.slice(0, LIMIT);
  console.log(`işlenecek: ${urls.length}\n`);
  if (!urls.length) { console.log("yapacak iş yok."); return; }

  const db = DRY ? null : new pg.Client({ connectionString: dbUrl() });
  if (db) await db.connect();

  let ok = 0, acresiz = 0, cozulemedi = 0, hata = 0;
  const parti = [];

  const yaz = async () => {
    if (!parti.length) return;
    if (db) {
      const v = parti.map((_, i) => {
        const o = i * 9;
        return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},now())`;
      }).join(",");
      const p = parti.flatMap((r) => [r.competitor, r.title, r.state, r.county, r.acres, r.price, r.raw_url, r.lat, r.lng]);
      // Tabloda uniq_competitor_url kısıtı var: aynı ilan tekrar hasat edilirse
      // ÇAKIŞMA değil GÜNCELLEME olmalı — ilan fiyatı zamanla değişir.
      // ⚠ Kısıt KISMİ indeks: `... (competitor, raw_url) WHERE raw_url IS NOT NULL`.
      // ON CONFLICT kısmi indeksle ancak AYNI koşul yazılırsa eşleşir; koşulsuz
      // hali "no unique or exclusion constraint matching" hatası veriyordu.
      await db.query(
        `insert into competitor_listings
           (competitor,title,state,county,acres,price,raw_url,lat,lng,scraped_at)
         values ${v}
         on conflict (competitor, raw_url) where raw_url is not null do update set
           title = excluded.title, state = excluded.state, county = excluded.county,
           acres = excluded.acres, price = excluded.price,
           lat = excluded.lat, lng = excluded.lng, scraped_at = excluded.scraped_at`,
        p,
      );
    }
    appendFileSync(CHECKPOINT, parti.map((r) => r.raw_url).join("\n") + "\n");
    parti.length = 0;
  };

  // Basit iş kuyruğu — ESZAMAN kadar işçi, her biri sıradan alır.
  let sira = 0;
  const isci = async () => {
    while (sira < urls.length) {
      const u = urls[sira++];
      const html = await getir(u);
      if (!html) { hata++; continue; }
      const r = sayfaCoz(html);
      if (!r) { cozulemedi++; continue; }
      // Acre'siz ilan $/acre hesabına giremez; yine de yazılır (fiyat sinyali
      // değerli) ama sayacı ayrı tutulur, raporda görünsün.
      if (r.acres == null) acresiz++;
      parti.push({ competitor: "LandHub", raw_url: u, ...r });
      ok++;
      if (parti.length >= 100) await yaz();
      if (ok % 250 === 0) process.stdout.write(`\r  yazılan ${ok} · acresiz ${acresiz} · çözülemedi ${cozulemedi} · hata ${hata}`);
      await sleep(BEKLE_MS);
    }
  };
  await Promise.all(Array.from({ length: ESZAMAN }, isci));
  await yaz();

  console.log(`\n\n── BİTTİ ──`);
  console.log(`  yazılan     : ${ok}`);
  console.log(`  acre'siz    : ${acresiz}  (fiyat var, $/acre hesabına giremez)`);
  console.log(`  çözülemedi  : ${cozulemedi}  (pageProps/eyalet/fiyat yok)`);
  console.log(`  hata        : ${hata}`);
  if (DRY) console.log("\n(--dry: veritabanına YAZILMADI)");
  if (db) await db.end();
}

// Test dosyası import edince main koşmasın.
if (process.argv[1] && process.argv[1].endsWith("pazaryeri-hasat.mjs")) await main();
