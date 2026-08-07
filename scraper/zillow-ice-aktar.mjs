#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ZILLOW İÇE AKTARIM — scraper/zillow_listings.db → competitor_listings
//
//   node scraper/zillow-ice-aktar.mjs --dry    # yazma, sadece rapor
//   node scraper/zillow-ice-aktar.mjs          # Supabase'e yaz
//
// NEDEN: Zillow verisi ÜCRETLİ RapidAPI uç noktasından (private-zillow) çekilmiş
// ve yerel SQLite'ta duruyor — 5.829 ilan, hiç kullanılmamış. Zillow'u KAZIMAK
// yasak (robots.txt ilan yollarını kapatıyor, bot koruması var); ama satın
// alınmış API verisini kullanmak yasak değil. Bu betik kazımaz, sadece elimizde
// ZATEN olan veriyi fiyat merdivenine sokar.
//
// DEĞERİ: TX 1.615 ilan. TX "non-disclosure" eyalet — tapu satış bedeli kamuya
// hiç açılmaz, envanterin en büyük eyaleti (231K parsel) orada. İlan fiyatı
// orada elde edilebilecek tek gerçek piyasa sinyali.
//
// ── İKİ VERİ TUZAĞI ─────────────────────────────────────────────────────────
// 1) YAPI KARIŞIKLIĞI: property_type='LAND' olan kayıtların bir kısmı aslında
//    üzerinde mobil ev/yapı olan parsel (ilk kayıt: "3 acres with Mobile home",
//    bedrooms=3). Bunlar $/dönüm medyanını YUKARI çeker → boş arsalarımızı
//    olduğundan pahalı gösterir. Yapı işareti taşıyanlar ELENİR.
// 2) COUNTY YOK: Zillow county vermiyor (şehir + posta kodu var), fiyat
//    merdiveni ise county bazlı. Koordinattan county FCC'nin ücretsiz Census
//    servisiyle çözülür. Koordinat ~0,05° ızgaraya yuvarlanıp önbelleğe alınır
//    (aynı county'deki yüzlerce ilan için tek sorgu).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const SQLITE = resolve(HERE, "zillow_listings.db");
const ONBELLEK = resolve(HERE, "data", "county-izgara.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Üzerinde yapı olduğuna dair işaret taşıyan ilan mı? (bkz. tuzak 1) */
export function yapiliMi(r) {
  if (Number(r.bedrooms) > 0 || Number(r.bathrooms) > 0) return true;
  if (Number(r.year_built) > 0) return true;
  if (Number(r.area_sqft) > 0) return true; // bina alanı
  const t = `${r.description ?? ""}`.toLowerCase();
  return /\b(mobile home|manufactured|singlewide|doublewide|house|cabin|barn|home on|residence)\b/.test(t);
}

/** SAF: SQLite satırından competitor_listings satırı. Elenirse null + sebep. */
export function satirCoz(r) {
  const price = Number(r.price);
  if (!Number.isFinite(price) || price <= 0) return { atla: "fiyatsız" };
  if (String(r.property_type ?? "").toUpperCase() !== "LAND") return { atla: "arsa-değil" };
  if (yapiliMi(r)) return { atla: "yapılı" };
  let acres = Number(r.lot_size_acres);
  if (!Number.isFinite(acres) || acres <= 0) {
    const sq = Number(r.lot_size_sqft);
    acres = Number.isFinite(sq) && sq > 0 ? sq / 43560 : NaN;
  }
  if (!Number.isFinite(acres) || acres <= 0) return { atla: "acre-yok" };
  const lat = Number(r.latitude), lng = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return { atla: "koordinatsız" };
  return {
    satir: {
      competitor: "Zillow (RapidAPI)",
      title: [r.street_address, r.city].filter(Boolean).join(", ") || null,
      state: String(r.state ?? "").toUpperCase() || null,
      acres: Math.round(acres * 1000) / 1000,
      price,
      raw_url: r.zillow_url ?? null,
      lat, lng,
    },
  };
}

/** ~0,05° ızgara anahtarı — aynı bölgedeki ilanlar tek sorguya düşer. */
export const izgara = (lat, lng) => `${Math.round(lat * 20) / 20},${Math.round(lng * 20) / 20}`;

async function countyBul(lat, lng, onbellek) {
  const k = izgara(lat, lng);
  if (k in onbellek) return onbellek[k];
  try {
    const r = await fetch(
      `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`,
      { signal: AbortSignal.timeout(20000) },
    );
    const j = await r.json();
    const ad = j?.County?.name ? String(j.County.name).replace(/\s+County$/i, "").trim() : null;
    onbellek[k] = ad;
    await sleep(200); // nazik
    return ad;
  } catch {
    onbellek[k] = null; // tekrar tekrar denemesin; uydurma da yapma
    return null;
  }
}

async function main() {
  if (!existsSync(SQLITE)) { console.error(`ÖLÜMCÜL: ${SQLITE} yok`); process.exit(1); }
  const sq = new DatabaseSync(SQLITE, { readOnly: true });
  const rows = sq.prepare("select * from listings").all();
  console.log(`SQLite: ${rows.length} ilan\n`);

  const onbellekDir = resolve(HERE, "data");
  if (!existsSync(onbellekDir)) mkdirSync(onbellekDir, { recursive: true });
  const onbellek = existsSync(ONBELLEK) ? JSON.parse(readFileSync(ONBELLEK, "utf8")) : {};

  const kabul = [];
  const atlanan = {};
  for (const r of rows) {
    const { satir, atla } = satirCoz(r);
    if (atla) { atlanan[atla] = (atlanan[atla] ?? 0) + 1; continue; }
    kabul.push(satir);
  }
  console.log("── ELEME ──");
  for (const [k, v] of Object.entries(atlanan).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)}${String(v).padStart(6)}`);
  console.log(`  ${"KABUL".padEnd(14)}${String(kabul.length).padStart(6)}\n`);

  const benzersiz = new Set(kabul.map((s) => izgara(s.lat, s.lng)));
  console.log(`county çözümü: ${benzersiz.size} ızgara hücresi (${kabul.length} ilan için)`);
  let countysuz = 0;
  for (const s of kabul) {
    s.county = await countyBul(s.lat, s.lng, onbellek);
    if (!s.county) countysuz++;
  }
  writeFileSync(ONBELLEK, JSON.stringify(onbellek));
  console.log(`  county bulunamayan: ${countysuz}\n`);

  const eyalet = {};
  for (const s of kabul) if (s.county) eyalet[s.state] = (eyalet[s.state] ?? 0) + 1;
  console.log("── EYALET DAĞILIMI (county'si çözülenler) ──");
  for (const [k, v] of Object.entries(eyalet).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

  const yazilacak = kabul.filter((s) => s.county);
  if (DRY) { console.log(`\n(--dry: ${yazilacak.length} satır YAZILMADI)`); return; }

  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  // Tekrar koşulduğunda çift kayıt olmasın: bu kaynağın eski satırları silinip
  // yeniden yazılır (ilan fiyatları değişir, güncel hali geçerlidir).
  await db.query("delete from competitor_listings where competitor = 'Zillow (RapidAPI)'");
  for (let i = 0; i < yazilacak.length; i += 500) {
    const p = yazilacak.slice(i, i + 500);
    const v = p.map((_, j) => {
      const o = j * 9;
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},now())`;
    }).join(",");
    await db.query(
      `insert into competitor_listings (competitor,title,state,county,acres,price,raw_url,lat,lng,scraped_at) values ${v}`,
      p.flatMap((s) => [s.competitor, s.title, s.state, s.county, s.acres, s.price, s.raw_url, s.lat, s.lng]),
    );
    process.stdout.write(`\r  yazılan ${Math.min(i + 500, yazilacak.length)}/${yazilacak.length}`);
  }
  console.log("\n✔ bitti.");
  await db.end();
}

if (process.argv[1] && process.argv[1].endsWith("zillow-ice-aktar.mjs")) await main();
