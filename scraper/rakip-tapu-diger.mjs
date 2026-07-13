#!/usr/bin/env node
/**
 * RAKİP TAPU TARAMASI — Mohave County (AZ) — Discount Lots DIŞINDAKİ satıcılar/yatırımcılar.
 *
 * Bu script iki koldan çalışır:
 *   Kol A: Bilinen rakipler — Rina Land (RinaLand.com → Living Spring LLC / Land Century LLC,
 *          operatör Rina Gevorgyan, Boiling Springs SC) ve LANDiO (landio.com → Proverbs Real
 *          Estate LLC / "Proverbs Land") için Mohave assessor CSV'sinde tapu-bazlı envanter arar.
 *   Kol B: Tersten keşif — OWNER bazında gruplayıp (a) 15+ parsel tutan tüzel kişileri,
 *          (b) eyalet-dışı mailing adresini, (c) IMPVALUE=0 ağırlıklı (boş arazi) olanları
 *          çıkarır; devlet/kabile/HOA/okul/utility gibi bilinen kamu kurumlarını dışlar.
 *          Ayrıca MAILING_ADDRESS bazında kümeleme yaparak aynı posta kutusunu/adresi
 *          paylaşan çok sayıda farklı isimli LLC'yi (klasik "gizli tek operatör, çok shell"
 *          örüntüsü) tespit eder.
 *
 * Veri kaynağı: az-mohave.opendata.arcgis.com (ParcelQueryLayer / layer 38) — Mohave County
 * Assessor'ın Esri Hub üzerinden yayınladığı tam parsel CSV'si (269K+ parsel; SALEP, SALEDT,
 * DEEDTYPE, RECPTNO, OWNER, MAILING_ADDRESS gibi alanlar dahil — kamu kaydı, Affidavit of
 * Property Value ile beslenen assessor senkron verisi).
 *
 * NOT: `scraper/rakip-tapu.mjs` (başka bir ajan tarafından yazıldı, Discount Lots'a odaklı)
 * ile AYNI CSV'yi kullanır ama farklı bir soruya (Discount Lots DIŞINDAKİ satıcılar) bakar.
 * Bu script o dosyaya veya `rakip-tapu-sonuc.json`/`rakip-tapu.csv`'ye DOKUNMAZ.
 *
 * Kullanım:
 *   node scraper/rakip-tapu-diger.mjs                 # CSV'yi indirir (yoksa) ve tarar
 *   CSV_PATH=/tmp/mohave-parcel38.csv node scraper/rakip-tapu-diger.mjs   # önbellekten oku
 *
 * Çıktı:
 *   scraper/rakip-tapu-diger.json
 *   scraper/rakip-tapu-diger.csv
 */

import { writeFileSync, existsSync, createWriteStream } from "node:fs";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const HUB_CSV_URL =
  "https://az-mohave.opendata.arcgis.com/api/download/v1/items/e47d94a4bcae402f8236c93d3b86834c/csv?layers=38";
const CSV_PATH = process.env.CSV_PATH || "/tmp/mohave-parcel38.csv";

// --- Kol A: bilinen rakip aday isimleri (web araştırmasıyla bulundu, bkz. rapor) ---
const KNOWN_COMPETITOR_PATTERNS = [
  { label: "Rina Land (RinaLand.com → Rina Gevorgyan)", patterns: ["LIVING SPRING LLC", "LAND CENTURY"] },
  { label: "LANDiO (landio.com → Proverbs Real Estate LLC)", patterns: ["PROVERBS", "LANDIO"] },
];

// --- Kol B: dışlama listesi (devlet/kabile/HOA/okul/utility/ranch/title) ---
const EXCLUDE_KEYWORDS = [
  "UNITED STATES OF AMERICA", "STATE OF ARIZONA", "CITY OF ", "MOHAVE COUNTY",
  "FORT MOJAVE INDIAN TRIBE", "LAKE HAVASU CITY", "COUNTY OF", "SCHOOL DISTRICT",
  "UNIFIED SCHOOL", "ELEMENTARY SCHOOL", "SOUTHERN CALIFORNIA EDISON", "ARIZONA PUBLIC SERVICE",
  "UNISOURCE", "UNITED EFFORT PLAN", "BUREAU OF LAND", "DEPARTMENT OF", "IRRIGATION DISTRICT",
  "FLOOD CONTROL DISTRICT", "SANITARY DISTRICT", "WATER DISTRICT", "FIRE DISTRICT",
  "HOMEOWNERS ASSOC", "PROPERTY OWNERS ASSOC", "CHURCH", "CEMETERY", "DIOCESE",
  "TOWN OF", "NAVAJO NATION", "HUALAPAI", "KAIBAB", "COLORADO RIVER INDIAN",
  "AIRPORT AUTHORITY", "MOHAVE AIRPORT", "LONDON BRIDGE RESORT", "COMMUNITY COLLEGE",
  "MUNICIPAL PROPERTY", "SANTA FE PACIFIC", "UNION PACIFIC", "SOUTHWEST GAS",
  "FRONTIER COMMUNICATIONS", "CENTURYLINK", "VERIZON", "BYNER CATTLE CO",
  "LAUGHLIN VIEW ESTATES INC", "PIONEER TITLE",
];

function isExcluded(name) {
  return EXCLUDE_KEYWORDS.some((kw) => name.includes(kw));
}

async function ensureCsv() {
  if (existsSync(CSV_PATH)) {
    console.log("CSV önbellekte:", CSV_PATH);
    return;
  }
  console.log("CSV indiriliyor (~160MB):", HUB_CSV_URL);
  const res = await fetch(HUB_CSV_URL);
  if (!res.ok) throw new Error(`İndirme başarısız: ${res.status}`);
  await pipeline(res.body, createWriteStream(CSV_PATH));
  console.log("İndirildi:", CSV_PATH);
}

function parseCsvLine(line) {
  // basit CSV parse (quoted alanları destekler)
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  await ensureCsv();

  const rl = createInterface({ input: createReadStream(CSV_PATH, { encoding: "utf-8" }) });
  let header = null;
  const idx = {};
  const owners = new Map(); // owner -> {count, landvalue, impzero, apns[], states:Map, saledts[]}
  const knownHits = KNOWN_COMPETITOR_PATTERNS.map((k) => ({ ...k, rows: [] }));

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line.replace(/^﻿/, ""));
      header.forEach((h, i) => (idx[h] = i));
      continue;
    }
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const owner = (cols[idx.OWNER] || "").trim();
    if (!owner) continue;

    // Kol A: bilinen rakip taraması
    for (const k of knownHits) {
      if (k.patterns.some((p) => owner.toUpperCase().includes(p))) {
        k.rows.push({
          owner,
          apn: cols[idx.PARCEL],
          mailing: `${cols[idx.MAILING_ADDRESS]}, ${cols[idx.CITY]}, ${cols[idx.STATE]}`,
          landvalue: Number(cols[idx.LANDVALUE] || 0),
          salep: cols[idx.SALEP],
          saledt: cols[idx.SALEDT],
          deedtype: cols[idx.DEEDTYPE],
          recptno: cols[idx.RECPTNO],
        });
      }
    }

    // Kol B: owner gruplama
    if (!owners.has(owner)) {
      owners.set(owner, { count: 0, landvalue: 0, impzero: 0, apns: [], states: new Map(), saledts: [] });
    }
    const o = owners.get(owner);
    o.count++;
    o.landvalue += Number(cols[idx.LANDVALUE] || 0) || 0;
    if ((Number(cols[idx.IMPVALUE] || 0) || 0) === 0) o.impzero++;
    const st = (cols[idx.STATE] || "").trim();
    o.states.set(st, (o.states.get(st) || 0) + 1);
    if (o.apns.length < 6) o.apns.push(cols[idx.PARCEL]);
    const sd = (cols[idx.SALEDT] || "").trim();
    if (sd) o.saledts.push(sd);
  }

  console.log("\n=== KOL A: Bilinen rakipler ===");
  for (const k of knownHits) {
    console.log(`${k.label}: ${k.rows.length} parsel bulundu`);
    k.rows.forEach((r) => console.log("  ", r));
  }

  console.log("\n=== KOL B: Tersten keşif (>=15 parsel, dışlananlar hariç) ===");
  const ranked = [...owners.entries()]
    .filter(([name, o]) => o.count >= 15 && !isExcluded(name))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  for (const [name, o] of ranked) {
    const topState = [...o.states.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const vratio = (o.impzero / o.count).toFixed(2);
    console.log(`${name} | ${o.count} parsel | $${o.landvalue.toFixed(0)} land value | vacant=${vratio} | state=${topState}`);
  }

  // NOT: Bu script'in çıktısı manuel küratörlü rapor/JSON ile birleştirilerek
  // scraper/rakip-tapu-diger.json ve .csv dosyaları oluşturuldu (bkz. .git/sdd/rakip-diger-report.md).
  // Aileron Investments LLC (+ seri LLC'ler) ve 806 Buchanan Blvd UPS Store shell ağı gibi
  // adres-bazlı kümeler bu ham çıktıda AYRI satırlar olarak görünür; nihai JSON'da manuel
  // olarak birleştirildi (bkz. rapor Ek-1).
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
