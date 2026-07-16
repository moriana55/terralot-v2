#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// 🐋 BÜYÜK OYUNCULAR KATMANI — build-time üretim.
//
// Kaynak 1: scraper/rakip-tapu-diger.json (keşif ajanı raporu — Mohave'nin
//   Discount Lots dışındaki büyük arsa oyuncuları; en büyükleri parsel sayısına
//   göre burada TANIM olarak sabitlenmiştir, eşleştirme kuralları dahil).
// Kaynak 2: Mohave County parsel CSV önbelleği (269K satır, OWNER +
//   MAILING_ADDRESS + LATITUDE/LONGITUDE + SALEP/SALEDT) — varsayılan konum
//   /tmp/mohave-parcel38.csv, MOHAVE_CSV env ile değiştirilebilir.
//   (az-mohave.opendata.arcgis.com ParcelQueryLayer/38 hub CSV'si.)
//
// Eşleştirme: oyuncu başına OWNER-önek listesi VE/VEYA MAILING_ADDRESS içerir
// kuralı (gizli ağlar aynı posta kutusunu paylaşır — owner adları alakasız).
//
// Çıktı: dashboard/src/data/buyuk-oyuncular.json — kompakt satır dizileri
// ([oyuncuIdx, apn, lat, lng, acres, landValue, salep, saledt, deedParcelCount,
// birimFiyatTahmini]) + oyuncu meta. Dashboard bunu lib/buyuk-oyuncular.ts ile
// açar; runtime scraper bağımlılığı YOK.
//
// PAKET TAPU (bulk deed) DÜZELTMESİ: county aynı RECPTNO'ya (tapu kayıt no)
// bağlı N parseli varsa, SALEP'i HER parsele TOPLAM olarak yazıyor (örn.
// SIMPLE FOODS LLC / APN 308-22-040 / RECPTNO 2020059875 / SALEP $35.000 —
// ama aynı RECPTNO'da 6 parsel var, gerçek birim fiyat ~$5.833). Bu yüzden
// tam CSV taramasıyla RECPTNO->parsel-sayısı haritası çıkarılır; deedParcelCount
// (RECPTNO boşsa 1) ve birimFiyatTahmini (=salep/deedParcelCount) hesaplanıp
// satıra eklenir. Dashboard toplam fiyatı GİZLEMEZ, ama tek parselin fiyatıymış
// gibi de sunmaz (bkz. lib/paket-tapu.ts).
//
// Kullanım: node scraper/buyuk-oyuncular-uret.mjs
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { deedParcelCount, unitPriceEstimate } from "./lib/deed-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = process.env.MOHAVE_CSV || "/tmp/mohave-parcel38.csv";
const OUT_PATH = path.join(ROOT, "dashboard", "src", "data", "buyuk-oyuncular.json");

// İlk 8 oyuncu (rakip-tapu-diger.json sıralaması, parsel sayısına göre).
// tip: gizli_ag | yatirimci | gelistirici (geliştiriciler flip rakibi değil —
// haritada varsayılan KAPALI başlar, legend'dan açılır).
const OYUNCULAR = [
  {
    id: "gizli-ag-boulder",
    ad: "Gizli ağ — UPS Store Boulder City (11 bilinen shell LLC)",
    kisaAd: "🕵️ Gizli ağ (Boulder City)",
    tip: "gizli_ag",
    // 15 shell LLC'den keşif ajanının İSİMLENDİRDİĞİ 11'i (owner-önek, tüm adresler)
    // + aynı UPS Store kutusunu kullanan diğer kayıtlar (adres kuralı).
    ownerOnekleri: [
      "SIMPLE FOODS", "TEN SLEEP TECH", "M8TRIX", "WYOMING INVESTMENT",
      "WYOMING INVESTMENTS", "BEAUTIFUL PLAINS", "BEAUFIFUL PLAINS",
      "PREMIUM CAPITAL PARTNERS", "UNIX FINANCIAL", "FOURTH HOUSE",
      "WYOMING CORE", "GRAND FINALE", "ROSS QUINTERO",
    ],
    adresIcerir: "806 BUCHANAN",
    not: "15 alakasız isimli LLC aynı UPS Store posta kutusunda (806 Buchanan Blvd Ste 115 Box 298, Boulder City NV) — %99 boş arazi, kimlik gizleme örüntüsü.",
  },
  {
    id: "aileron-entrata",
    ad: "Aileron Investments ağı (Redpoint/Contrail/Arizona Series — Allen Barbarich)",
    kisaAd: "🏗️ Aileron ağı (geliştirici)",
    tip: "gelistirici",
    ownerOnekleri: [],
    adresIcerir: "3141 BEACH VIEW",
    not: "Mohave'nin en büyük özel arazi sahibi ağı — master-plan geliştirici profili, klasik arsa-flip rakibi DEĞİL.",
  },
  { id: "1d-llc", ad: "1D LLC (Stockton Hill Rd Kingman kutu ağı)", kisaAd: "1D LLC", tip: "yatirimci", ownerOnekleri: ["1D LLC"], adresIcerir: null, not: "Kingman posta kutusu ağının en büyüğü (aynı adreste 241 sahip adı)." },
  { id: "ie-properties", ad: "I E Properties LLC", kisaAd: "I E Properties", tip: "yatirimci", ownerOnekleri: ["I E PROPERTIES"], adresIcerir: null, not: "Aynı Stockton Hill Rd kutu ağında, bağımsız büyük yatırımcı." },
  { id: "copperwood-5", ad: "Copperwood 5 LLC", kisaAd: "Copperwood 5 (geliştirici)", tip: "gelistirici", ownerOnekleri: ["COPPERWOOD 5"], adresIcerir: null, not: "%2 boş arazi — konut/geliştirme portföyü, arsa-flip değil." },
  { id: "an-tiarna", ad: "An Tiarna Leibh Real Estate Investments", kisaAd: "An Tiarna Leibh (geliştirici)", tip: "gelistirici", ownerOnekleri: ["AN TIARNA LEIBH"], adresIcerir: null, not: "2024'te 336 parsel tek seferde — subdivision alımı." },
  { id: "western-land", ad: "Western Land & Ranches LLC", kisaAd: "Western Land & Ranches", tip: "yatirimci", ownerOnekleri: ["WESTERN LAND & RANCHES"], adresIcerir: null, not: "Nevada merkezli, %100 boş arazi — klasik arsa-flip/tutma profili." },
  { id: "ctr-trust", ad: "CTR Trust", kisaAd: "CTR Trust", tip: "yatirimci", ownerOnekleri: ["CTR TRUST"], adresIcerir: null, not: "Eski nesil yatırımcı (1997-2011 alımları), güncel aktivite düşük." },
];

// Basit quoted-CSV satır parser (adres/legal alanlarında virgül var).
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function matchOyuncu(owner, addr) {
  for (let i = 0; i < OYUNCULAR.length; i++) {
    const o = OYUNCULAR[i];
    if (o.adresIcerir && addr.includes(o.adresIcerir)) return i;
    for (const on of o.ownerOnekleri) if (owner.startsWith(on)) return i;
  }
  return -1;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`HATA: county CSV bulunamadı: ${CSV_PATH} (MOHAVE_CSV env ile yol ver)`);
    process.exit(1);
  }
  const rl = readline.createInterface({ input: fs.createReadStream(CSV_PATH) });
  let header = null;
  const idx = {};
  const rows = [];
  const perOyuncu = OYUNCULAR.map(() => 0);
  let koordinatsiz = 0;
  // RECPTNO -> parsel sayısı (tam CSV'de, sadece bu döngüde eşleşen oyunculara
  // ait olması gerekmez — bir RECPTNO'nun kaç satırda geçtiğini bilmek yeterli).
  const recptnoCounts = new Map();

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line.replace(/^﻿/, ""));
      for (const k of ["OWNER", "MAILING_ADDRESS", "PARCEL", "PARCEL_SIZE", "LANDVALUE", "SALEP", "SALEDT", "LATITUDE", "LONGITUDE", "RECPTNO"]) {
        idx[k] = header.indexOf(k);
        if (idx[k] < 0) { console.error(`HATA: CSV kolonu yok: ${k}`); process.exit(1); }
      }
      continue;
    }
    const cols = parseCsvLine(line);
    const recptno = (cols[idx.RECPTNO] || "").trim();
    if (recptno) recptnoCounts.set(recptno, (recptnoCounts.get(recptno) || 0) + 1);
    const owner = (cols[idx.OWNER] || "").toUpperCase().trim();
    const addr = (cols[idx.MAILING_ADDRESS] || "").toUpperCase().trim();
    if (!owner && !addr) continue;
    const oi = matchOyuncu(owner, addr);
    if (oi < 0) continue;
    const lat = Number(cols[idx.LATITUDE]);
    const lng = Number(cols[idx.LONGITUDE]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) { koordinatsiz++; continue; }
    perOyuncu[oi]++;
    // Kompakt satır (geçici): [oyuncuIdx, apn, lat, lng, acres, landValue, salep,
    // saledtYYYY/MM/DD, recptno(HAM — aşağıda deedParcelCount'a çevrilir)].
    rows.push([
      oi,
      cols[idx.PARCEL] || "",
      Math.round(lat * 1e5) / 1e5,
      Math.round(lng * 1e5) / 1e5,
      num(cols[idx.PARCEL_SIZE]),
      num(cols[idx.LANDVALUE]),
      num(cols[idx.SALEP]),
      (cols[idx.SALEDT] || "").slice(0, 10) || null,
      recptno,
    ]);
  }

  // İkinci geçiş YOK (CSV tekrar okunmuyor) — recptnoCounts artık tam, satırları
  // deedParcelCount + birimFiyatTahmini ile tamamla (in-memory, ~5K satır).
  for (const r of rows) {
    const recptno = r[8];
    const salep = r[6];
    const count = deedParcelCount(recptno, recptnoCounts);
    r[8] = count;
    r.push(unitPriceEstimate(salep, count));
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "Mohave County ParcelQueryLayer/38 hub CSV (OWNER/MAILING_ADDRESS eşleştirme) + scraper/rakip-tapu-diger.json oyuncu tanımları",
    rowFormat: ["oyuncuIdx", "apn", "lat", "lng", "acres", "landValue", "salep", "saledt", "deedParcelCount", "birimFiyatTahmini"],
    koordinatsizAtlanan: koordinatsiz,
    oyuncular: OYUNCULAR.map((o, i) => ({
      id: o.id, ad: o.ad, kisaAd: o.kisaAd, tip: o.tip, parselSayisi: perOyuncu[i], not: o.not,
    })),
    rows,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  const mb = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`Yazıldı: ${OUT_PATH} (${mb} MB)`);
  OYUNCULAR.forEach((o, i) => console.log(`  ${o.kisaAd}: ${perOyuncu[i]} parsel`));
  console.log(`Toplam nokta: ${rows.length} · koordinatsız atlanan: ${koordinatsiz}`);
}

main();
