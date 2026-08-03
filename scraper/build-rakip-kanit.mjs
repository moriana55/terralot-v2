#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// RAKİP KANITI — "rakipler gerçekten satıyor mu, ne kadara alıp ne kadara
// satıyorlar?" sorusunun BELGELİ cevabı. İki bağımsız kanıt üretir:
//
// 1) MARJ KANITI (tapu kaydı)
//    Rakip ilanının APN'i ile `land_comps` (gerçek tapu satışları, FL+CO)
//    eşleştirilir. Tapu tarihi ilanı ilk gördüğümüz tarihten ÖNCE olduğu için
//    bu kayıt rakibin O PARSELİ SATIN ALDIĞI işlemdir. İlan fiyatı / alış
//    fiyatı = rakibin gerçek marjı. Tahmin değil, tapu.
//
// 2) SATIŞ KANITI (Landio açık API)
//    `listingStatus = PENDING` → alıcı bulunmuş, kapanış bekleniyor.
//    Bu, "ilan listeden kayboldu" tahmininin aksine DOĞRUDAN satış sinyali.
//    Ayrıca taksit şartları (peşinat oranı) buradan çıkar.
//
// ⚠ SINIR: tapu verimiz Kasım 2025'te bitiyor, rakip ilanlarını Temmuz 2026'da
// görmeye başladık. Bu yüzden rakibin 2026 SATIŞLARI tapuda henüz görünmüyor;
// eşleşenler onların ALIŞLARI. Satış tarafı için Landio PENDING sinyali ve
// günlük snapshot zinciri kullanılıyor.
//
// Çalıştır: node scraper/build-rakip-kanit.mjs
// Çıktı:    dashboard/src/data/rakip-kanit.json
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../dashboard/src/data/rakip-kanit.json");

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("set statement_timeout = 0");

// ── 1) Marj kanıtı: ilan ↔ tapu eşleşmesi ───────────────────────────────────
console.log("1/3 · tapu eşleştirmesi…");
const marj = (await client.query(`
  with rakip as (
    select listing_key, competitor, title, apn, status, current_price, acres, first_seen,
           regexp_replace(upper(apn), '[^A-Z0-9]', '', 'g') k,
           case when state ilike '%Florida%' or state = 'FL' then 'FL' else 'CO' end st
    from competitor_tracked
    where apn is not null
      and (state ilike '%Florida%' or state = 'FL' or state ilike '%Colorado%' or state = 'CO')
  ), tapu as (
    select regexp_replace(upper(apn), '[^A-Z0-9]', '', 'g') k, state, sale_year, sale_month, sale_price, acres
    from land_comps where apn is not null and sale_price > 0
  )
  select r.competitor, r.status, r.title, r.apn, r.acres, r.current_price::float ilan_fiyat,
         t.sale_year, t.sale_month, t.sale_price::float alis_fiyat,
         round((r.current_price / nullif(t.sale_price,0))::numeric, 1)::float kat
  from rakip r join tapu t on t.k = r.k and t.state = r.st
  order by (r.current_price / nullif(t.sale_price,0)) desc
`)).rows;
console.log(`   ${marj.length} eşleşme`);

// ── 2) Canlı durum (Landio API'sinden gelen kayıtlar) ───────────────────────
console.log("2/3 · canlı ilan durumu…");
const durum = (await client.query(`
  select competitor, status, count(*)::int n, round(avg(current_price)::numeric)::int ort_fiyat
  from competitor_tracked group by 1, 2 order by 1, 3 desc
`)).rows;

const eyalet = (await client.query(`
  select state, count(*)::int ilan,
         count(*) filter (where status = 'PENDING')::int sozlesmede,
         round(avg(current_price)::numeric)::int ort_fiyat
  from competitor_tracked group by 1 order by 2 desc limit 15
`)).rows;

await client.end();

// ── 3) Taksit şartları — Landio ham cevabından ──────────────────────────────
console.log("3/3 · taksit şartları…");
let taksit = [];
let landioOzet = null;
const outDir = path.join(HERE, "out");
if (existsSync(outDir)) {
  const dosyalar = readdirSync(outDir).filter((f) => /^landio-api-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const son = dosyalar[dosyalar.length - 1];
  if (son) {
    const ham = JSON.parse(readFileSync(path.join(outDir, son), "utf8"));
    const s = (v) => (v == null || v === "" ? null : Number(v));
    taksit = ham
      .filter((x) => x.ownerFinancing && s(x.downPayment) && s(x.price))
      .map((x) => ({
        state: x.state, county: x.county,
        fiyat: s(x.price), pesinat: s(x.downPayment),
        oran: Math.round((s(x.downPayment) / s(x.price)) * 100),
        acres: s(x.acres), gorulme: s(x.viewCount), durum: x.listingStatus,
      }))
      .sort((a, b) => a.oran - b.oran);
    landioOzet = {
      dosya: son,
      toplam: ham.length,
      aktif: ham.filter((x) => x.listingStatus === "ACTIVE").length,
      sozlesmede: ham.filter((x) => x.listingStatus === "PENDING").length,
      taksitli: ham.filter((x) => x.ownerFinancing).length,
      kendiMali: ham.filter((x) => x.isLandioOwned).length,
      ortGorulme: Math.round(ham.reduce((a, x) => a + (Number(x.viewCount) || 0), 0) / ham.length),
      enCokGorulen: ham
        .map((x) => ({ state: x.state, county: x.county, fiyat: Number(x.price) || 0, gorulme: Number(x.viewCount) || 0, acres: Number(x.acres) || 0, durum: x.listingStatus }))
        .sort((a, b) => b.gorulme - a.gorulme).slice(0, 8),
    };
  }
}

const ortKat = marj.length ? Math.round((marj.reduce((a, m) => a + (m.kat || 0), 0) / marj.length) * 10) / 10 : null;

// Hangi bölüm hangi rakipten geliyor — sayfada açıkça yazılsın diye.
// (Tapu eşleşmesi yalnız Discount Lots'ta çıktı; canlı durum + taksit yalnız Landio'da.)
const marjRakipler = [...new Set(marj.map((m) => m.competitor))];

// Peşinat oranı ORTALAMA değil MEDYAN ile özetlenir: dağılım iki tepeli
// (%10-20 bandı ve %50 bandı). Ortalama ikisinin arasına düşüp hiçbir gerçek
// ilanı temsil etmiyor — "%37" diye bir peşinat yok.
const oranlar = taksit.map((t) => t.oran).sort((a, b) => a - b);
const medyanPesinat = oranlar.length ? oranlar[Math.floor(oranlar.length / 2)] : null;
const pesinatBandi = oranlar.length ? { min: oranlar[0], max: oranlar[oranlar.length - 1] } : null;

writeFileSync(OUT, JSON.stringify({
  uretildi: new Date().toISOString(),
  marj, ortKat, marjRakipler, durum, eyalet, taksit, landioOzet,
  medyanPesinat, pesinatBandi,
  // Sayfada dürüstlük notu olarak gösterilir.
  tapuSiniri: "land_comps yalnız FL + CO kapsıyor ve Kasım 2025'te bitiyor; eşleşenler rakibin ALIŞ işlemleri.",
}, null, 1));

console.log(`\n✔ ${OUT}`);
console.log(`  marj kanıtı: ${marj.length} eşleşme · ortalama ${ortKat}x`);
if (landioOzet) console.log(`  Landio: ${landioOzet.aktif} aktif · ${landioOzet.sozlesmede} SÖZLEŞMEDE · ${landioOzet.taksitli} taksitli`);
console.log(`  taksit şartı bilinen: ${taksit.length} ilan`);
