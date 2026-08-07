#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ZILLOW COUNTY HASADI — non-disclosure eyaletlerde fiyat dayanağı üretir.
//
//   node scraper/zillow-county-hasat.mjs --dry     # kota harcamaz, plan gösterir
//   node scraper/zillow-county-hasat.mjs           # gerçek tur
//   LIMIT=20 node scraper/zillow-county-hasat.mjs  # ilk 20 county
//
// NEDEN: TX (231.557 parsel) ve NM (139.683) "non-disclosure" eyalet — tapu
// satış bedeli kamuya HİÇ açılmaz, yasal durum. Fiyat merdiveninin A kademesi
// (tapu comp) orada asla kurulamaz. Elde kalan tek gerçek piyasa sinyali İLAN
// fiyatı. Bu iki eyalet olmadan temas listesi 6 eyalette sıkışıp kalıyor.
//
// KAYNAK: Zillow — KAZIMA DEĞİL. Zillow robots.txt ilan yollarını kapatıyor ve
// bot koruması var. Bu betik projenin ÜCRETLİ RapidAPI aboneliğini kullanır
// (private-zillow), yani satın alınmış erişim.
//
// ⚠ KOTA: plan aylık 250 istek. Her istek = 1 county, ~200 ilan. Betik kalan
// kotayı yanıt başlığından okur ve REZERV altına inmez — kotayı tamamen
// tüketip başka işi (canlı sorgu vb.) susturmasın.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const LIMIT = Number(process.env.LIMIT || 0);
const REZERV = 10;          // bu kadar istek dokunulmadan bırakılır
const HOST = "private-zillow.p.rapidapi.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEY = (readFileSync(resolve(HERE, ".env"), "utf8").match(/^RAPIDAPI_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!KEY) { console.error("ÖLÜMCÜL: RAPIDAPI_KEY yok (scraper/.env)"); process.exit(1); }

/** Hedef eyaletler: tapudan fiyat çekilemeyenler (non-disclosure). */
const HEDEF = ["TX", "NM", "MT", "WY", "ID", "KS", "MS", "UT", "ND"];

/** SAF: API kaydından competitor_listings satırı. Elenirse null. */
export function ilanCoz(p, state, county) {
  const pr = p?.property ?? p;
  const fiyat = Number(pr?.price?.value ?? pr?.price ?? pr?.listPrice);
  if (!Number.isFinite(fiyat) || fiyat <= 0) return null;
  // Yapılı parsel $/dönüm medyanını şişirir — yalnız arsa.
  const tip = String(pr?.propertyType ?? pr?.homeType ?? "").toUpperCase();
  if (tip && !tip.includes("LAND") && !tip.includes("LOT")) return null;
  if (Number(pr?.bedrooms) > 0 || Number(pr?.livingArea) > 0) return null;
  // ⚠ CANLI HATA (2026-08-08): dönüm alanını düz `lotSizeAcres`/`lotSize` diye
  // aramıştım; kaynak İÇ İÇE veriyor → 148 istekten 18.439 ilan geldi, hepsi
  // "acre yok" diye elendi, sıfır kayıt yazıldı. Gerçek biçim:
  //   lotSizeWithUnit: { lotSize: 0.75, lotSizeUnit: "acres" }
  // Birim "sqft" de olabildiği için dönüşüm birime bakılarak yapılır.
  const lw = pr?.lotSizeWithUnit ?? {};
  const lotDeger = Number(lw.lotSize ?? pr?.lotSizeAcres ?? pr?.lotAreaValue);
  const birim = String(lw.lotSizeUnit ?? pr?.lotAreaUnit ?? "acres").toLowerCase();
  let acres = NaN;
  if (Number.isFinite(lotDeger) && lotDeger > 0) {
    acres = birim.startsWith("acre") ? lotDeger
      : (birim.includes("sq") ? lotDeger / 43560 : NaN);
  }
  if (!Number.isFinite(acres) || acres <= 0) return null;
  const lat = Number(pr?.location?.latitude ?? pr?.latitude);
  const lng = Number(pr?.location?.longitude ?? pr?.longitude);
  const zpid = pr?.zpid ?? pr?.id;
  return {
    competitor: "Zillow (RapidAPI)",
    title: [pr?.address?.streetAddress, pr?.address?.city].filter(Boolean).join(", ") || null,
    state, county, acres: Math.round(acres * 1000) / 1000, price: fiyat,
    raw_url: zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
  };
}

async function sorgu(county, state) {
  const konum = `${county} County, ${state}`;
  const u = `https://${HOST}/search/byaddress?location=${encodeURIComponent(konum)}&homeType=Land&page=1`;
  const r = await fetch(u, { headers: { "X-RapidAPI-Key": KEY, "X-RapidAPI-Host": HOST }, signal: AbortSignal.timeout(60000) });
  const kalan = Number(r.headers.get("x-ratelimit-requests-remaining") ?? NaN);
  if (!r.ok) return { kalan, ilanlar: [], hata: `HTTP ${r.status}` };
  const j = await r.json();
  return { kalan, ilanlar: j?.searchResults ?? j?.results ?? [] };
}

async function main() {
  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  const { rows: hedefler } = await db.query(
    `select state, county, count(*)::int n
       from offmarket_leads
      where state = any($1) and county is not null
      group by state, county
      having count(*) >= 200
      order by count(*) desc`,
    [HEDEF],
  );
  const liste = LIMIT ? hedefler.slice(0, LIMIT) : hedefler;
  console.log(`hedef county: ${liste.length} (en az 200 parseli olanlar)`);
  console.log(`  ${liste.slice(0, 12).map((h) => `${h.state}/${h.county}(${h.n})`).join(" ")}\n`);
  if (DRY) { console.log("(--dry: kota harcanmadı)"); await db.end(); return; }

  let yazilan = 0, elenen = 0, atlanan = 0;
  for (const h of liste) {
    const { kalan, ilanlar, hata } = await sorgu(h.county, h.state);
    if (Number.isFinite(kalan) && kalan <= REZERV) {
      console.log(`\n⛔ kota rezervi (${REZERV}) — duruldu. kalan: ${kalan}`);
      break;
    }
    if (hata) { atlanan++; process.stdout.write(`\r  ${h.state}/${h.county}: ${hata}   `); continue; }
    const satirlar = [];
    for (const x of ilanlar) {
      const s = ilanCoz(x, h.state, h.county);
      if (s && s.raw_url) satirlar.push(s); else elenen++;
    }
    if (satirlar.length) {
      const v = satirlar.map((_, i) => {
        const o = i * 9;
        return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},now())`;
      }).join(",");
      await db.query(
        `insert into competitor_listings (competitor,title,state,county,acres,price,raw_url,lat,lng,scraped_at)
         values ${v}
         on conflict (competitor, raw_url) where raw_url is not null do update set
           price = excluded.price, acres = excluded.acres, county = excluded.county,
           scraped_at = excluded.scraped_at`,
        satirlar.flatMap((s) => [s.competitor, s.title, s.state, s.county, s.acres, s.price, s.raw_url, s.lat, s.lng]),
      );
      yazilan += satirlar.length;
    }
    process.stdout.write(`\r  ${h.state}/${h.county}: +${satirlar.length} · toplam ${yazilan} · kota ${kalan}    `);
    await sleep(1200);
  }
  console.log(`\n\n── BİTTİ ──\n  yazılan ilan : ${yazilan}\n  elenen       : ${elenen} (yapılı/acre yok/fiyatsız)\n  atlanan county: ${atlanan}`);
  await db.end();
}

if (process.argv[1] && process.argv[1].endsWith("zillow-county-hasat.mjs")) await main();
