#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// LANDIO CANLI İLAN ÇEKİCİ — rakibin AÇIK API'sinden birebir veri.
//
// BULUŞ (2026-08-03): landio.com bir SPA ve arkasındaki uç HERKESE AÇIK:
//   https://landio.com/api/properties   → tüm ilanlar, tek JSON (~1 MB)
// HTML kazımaya gerek yok; alanlar sitede GÖRÜNMEYEN bilgileri de içeriyor.
//
// ── NEDEN ÖNEMLİ: "rakip gerçekten satıyor mu?" sorusunun cevabı burada ─────
// Şimdiye kadar sadece "ilan listeden kayboldu" (SUSPECTED_SOLD) diyebiliyorduk;
// satıldı mı yoksa geri mi çekildi ayırt edilemiyordu. API `listingStatus`
// veriyor:
//     ACTIVE   → satışta
//     PENDING  → SÖZLEŞMEDE (alıcı buldu, kapanış bekliyor)  ← satış kanıtı
// Günlük çekilip saklandığında ACTIVE → PENDING → listeden düşme zinciri
// gerçek satış hunisini verir.
//
// Ayrıca sitede yazmayan alanlar: ownerFinancing + downPayment (taksit
// şartları), viewCount (talep sinyali), isLandioOwned (kendi malı mı yoksa
// üçüncü taraf satıcı mı), parcelNumber (gerçek APN → tapu eşleştirmesi),
// koordinat, vergi, imar, elektrik/su/kanalizasyon.
//
// ── ⚠ ROBOTS.TXT UYARISI — OKUMADAN ÇALIŞTIRMA ─────────────────────────────
// landio.com/robots.txt AÇIKÇA `Disallow: /api/` diyor. Veri herkese açık ve
// kimlik doğrulaması yok; ama site sahibi "botlar bu ucu taramasın" demiş.
// Bunu görmezden gelip her gün otomatik çekmek (a) doğru değil, (b) IP
// engeline yol açıp kanalı tamamen kaybettirir.
//
// KARAR: bu betik ELLE, TEK SEFERLİK referans çekimi içindir ve kasıtlı olarak
// bir onay bayrağı ister. Günlük takip için robots'ta SERBEST olan yol
// kullanılmalı: https://www.landio.com/sitemap.xml (774 parsel URL'i, lastmod
// ile) — ilan giriş/çıkışı oradan izlenir. Durum (ACTIVE/PENDING) alanı ancak
// API'de var; sürekli lazımsa doğru adım Landio'dan izin/erişim istemektir.
//
// Çalıştır: ONAY=1 node scraper/rakip-landio-api.mjs
//           KURU=1 ONAY=1 node scraper/rakip-landio-api.mjs   (yazmadan göster)
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = "https://landio.com/api/properties";
const KURU = process.env.KURU === "1";
if (process.env.ONAY !== "1") {
  console.error("DURDURULDU — landio.com/robots.txt `/api/` taramasını yasaklıyor.");
  console.error("Bu betik tek seferlik elle referans çekimi içindir; bilinçli çalıştırmak için ONAY=1 ver.");
  console.error("Günlük takip için sitemap yolunu kullan (robots'ta serbest): https://www.landio.com/sitemap.xml");
  process.exit(2);
}
const sayi = (v) => (v == null || v === "" ? null : Number(v));

const r = await fetch(API, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(60000) });
if (!r.ok) throw new Error(`Landio API HTTP ${r.status}`);
const ilanlar = await r.json();
console.log(`Landio API: ${ilanlar.length} ilan`);

const durum = {};
for (const x of ilanlar) durum[x.listingStatus] = (durum[x.listingStatus] || 0) + 1;
console.log("durum:", Object.entries(durum).map(([k, v]) => `${k}=${v}`).join(" · "));
console.log(`taksitli: ${ilanlar.filter((x) => x.ownerFinancing).length} · Landio'nun kendi malı: ${ilanlar.filter((x) => x.isLandioOwned).length}`);

// Ham cevabı sakla — şema değişirse geriye dönük bakabilelim.
const outDir = path.join(HERE, "out");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const tarih = new Date().toISOString().slice(0, 10);
writeFileSync(path.join(outDir, `landio-api-${tarih}.json`), JSON.stringify(ilanlar, null, 1));

if (KURU) {
  console.log("KURU=1 — veritabanına yazılmadı.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();

let yeni = 0, guncel = 0;
for (const x of ilanlar) {
  const key = `landio|api:${x.id}`;
  const fiyat = sayi(x.price);
  // listingStatus'u kendi durum sözlüğümüze çeviriyoruz:
  //   PENDING → sözleşmede (satış kanıtı), ACTIVE → satışta.
  const st = x.listingStatus === "PENDING" ? "PENDING" : "ACTIVE";

  const mevcut = (await client.query("select listing_key, current_price from competitor_tracked where listing_key = $1", [key])).rows[0];
  if (mevcut) {
    await client.query(
      `update competitor_tracked
         set title=$2, apn=$3, url=$4, state=$5, county=$6, acres=$7,
             current_price=$8, status=$9, last_seen=now(), updated_at=now()
       where listing_key=$1`,
      [key, x.title, x.parcelNumber || null, `https://landio.com/property/${x.id}`,
       x.state, x.county, sayi(x.acres), fiyat, st]
    );
    guncel++;
  } else {
    await client.query(
      `insert into competitor_tracked
         (listing_key, competitor, title, apn, url, state, county, acres,
          initial_price, current_price, status, first_seen, last_seen)
       values ($1,'Landio',$2,$3,$4,$5,$6,$7,$8,$8,$9,now(),now())`,
      [key, x.title, x.parcelNumber || null, `https://landio.com/property/${x.id}`,
       x.state, x.county, sayi(x.acres), fiyat, st]
    );
    yeni++;
  }

  // Her koşuda anlık görüntü — zaman serisi böyle birikir.
  await client.query(
    `insert into competitor_snapshots
       (run_at, listing_key, competitor, title, apn, url, price, acres, state, county, status, seen_at)
     values (now(),$1,'Landio',$2,$3,$4,$5,$6,$7,$8,$9,now())`,
    [key, x.title, x.parcelNumber || null, `https://landio.com/property/${x.id}`,
     fiyat, sayi(x.acres), x.state, x.county, st]
  );
}

await client.end();
console.log(`\n✔ yeni ${yeni} · güncellenen ${guncel} · snapshot ${ilanlar.length}`);
console.log(`  ham cevap: scraper/out/landio-api-${tarih}.json`);
console.log("  Her gün koşturulursa ACTIVE → PENDING → düşme zinciri gerçek satış hunisini verir.");
