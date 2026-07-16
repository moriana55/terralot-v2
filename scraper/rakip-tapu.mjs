#!/usr/bin/env node
/**
 * RAKİP TAPU TARAMASI — Mohave County (AZ) — Discount Lots / LANDiO (Proverbs) geçmişe dönük satış/sahiplik.
 *
 * SORUN: Mohave County'nin kendi altyapısı (mcgis.mohave.gov, appsweb.mohave.gov, eaglerss/eaglerw
 * recorder portalları) hem bu makineden hem de Anthropic WebFetch altyapısından ECONNRESET veriyor —
 * muhtemelen kurumun ağı/WAF'ı yabancı IP'leri veya otomasyon trafiğini engelliyor. Bu yüzden resmi
 * "mcgis.mohave.gov/.../MapServer/38/query" ArcGIS REST uç noktası doğrudan çalışmıyor.
 *
 * ÇÖZÜM: Aynı parsel katmanı (ParcelQueryLayer / layer 38), Mohave County'nin kendi ArcGIS Online
 * organizasyonu üzerinden "Open Data" portalına (Esri'nin kendi barındırdığı, county ağının dışında)
 * yayınlanmış durumda: https://az-mohave.opendata.arcgis.com/datasets/mohave::parcelquerylayer
 * Bu portal Esri'nin hub.arcgis.com CSV indirme API'sini kullanıyor ve HER ZAMAN erişilebilir kaldı.
 * İndirilen tam CSV (269K+ parsel) ASSESSOR verisidir — SALEP (son satış fiyatı), SALEDT (son satış
 * tarihi), DEEDTYPE, RECPTNO (recording no), OWNER/OWNER_2, MAILING_ADDRESS gibi alanları içerir.
 * Bu, doğrudan "recorder" tapu kaydı değil ama assessor'ın senkronize ettiği satış/devir izidir —
 * Affidavit of Property Value verisiyle besleniyor, dolayısıyla halka açık kamu kaydına dayanıyor.
 *
 * Kullanım:
 *   node scraper/rakip-tapu.mjs                 # CSV'yi indirir (~160MB), tarar, sonuç yazar
 *   SKIP_DOWNLOAD=1 node scraper/rakip-tapu.mjs  # /tmp altında zaten inen CSV varsa tekrar indirmez
 *
 * Çıktı:
 *   scraper/rakip-tapu-sonuc.json
 *   scraper/rakip-tapu.csv
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deedParcelCount, unitPriceEstimate, computeRecptnoCounts } from "./lib/deed-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Esri hub'ın barındırdığı CSV indirme uç noktası — county'nin kendi ağının DIŞINDA, engellenmiyor.
const HUB_CSV_URL =
  "https://az-mohave.opendata.arcgis.com/api/download/v1/items/e47d94a4bcae402f8236c93d3b86834c/csv?layers=38";
const CACHE_PATH = "/tmp/mohave-parcel38.csv";

// Araştırmada bulunan aday tüzel kişi adları + varyasyonları (bkz. rapor).
// - "Discount Lots" (discountlots.com) → Florida LLC, marka adı; Mohave'de örnek eşleşen tapu sahibi
//   "WP RE VENTURES 1 LLC" / "PW REAL ESTATE VENTURES LLC" (aynı adres: 450 Anthony Trl, Northbrook IL) —
//   bu, Discount Lots'un Mohave envanterini beslediğini gösteren ARABULUCU/TEDARİKÇİ toptancı LLC.
// - "LANDiO" (landio.com) → BBB'ye göre "Proverbs Land" DBA'sı, işletmeci "Proverbs Real Estate LLC" /
//   Mohave'de "PROVERBS HOLDINGS AZ LLC" adında bir tüzel kişi bulundu (ticari parsel, land-flip değil).
const CANDIDATES = [
  { label: "Discount Lots (marka)", patterns: ["DISCOUNT LOT"] },
  { label: "WP RE Ventures / PW Real Estate Ventures (Discount Lots tedarikçisi — eşleşen örnek APN ile doğrulandı)", patterns: ["WP RE VENTURES", "PW REAL ESTATE VENTURES", "PW REAL VENTURES"] },
  { label: "LANDiO / Proverbs", patterns: ["LANDIO", "PROVERBS"] },
];

function throttle(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCsv() {
  if (process.env.SKIP_DOWNLOAD === "1" && existsSync(CACHE_PATH)) {
    console.log("CSV önbellekte, indirme atlanıyor:", CACHE_PATH);
    return CACHE_PATH;
  }
  console.log("Esri hub CSV indiriliyor (nazikçe, tek istek)…", HUB_CSV_URL);
  const res = await fetch(HUB_CSV_URL, { redirect: "follow", signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`CSV indirme HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(CACHE_PATH, buf);
  console.log(`indirildi: ${(buf.length / 1024 / 1024).toFixed(1)} MB → ${CACHE_PATH}`);
  return CACHE_PATH;
}

// Basit ama tırnak-içi virgülleri doğru işleyen CSV satır ayrıştırıcı.
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
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

async function scan(csvPath) {
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity });
  let header = null;
  let idx = {};
  const hits = [];
  let n = 0;
  for await (const rawLine of rl) {
    if (!rawLine) continue;
    n++;
    if (!header) {
      // BOM temizle
      header = parseCsvLine(rawLine.replace(/^﻿/, ""));
      header.forEach((h, i) => (idx[h] = i));
      continue;
    }
    const owner = rawLine; // hızlı ön-filtre: satırda aday isimlerden biri geçmiyorsa parse etme
    let matched = null;
    const upper = owner.toUpperCase();
    for (const cand of CANDIDATES) {
      if (cand.patterns.some((p) => upper.includes(p))) { matched = cand; break; }
    }
    if (!matched) continue;
    const row = parseCsvLine(rawLine);
    const get = (k) => row[idx[k]] ?? "";
    hits.push({
      kaynak: "Mohave County Assessor (ParcelQueryLayer / Esri Hub CSV, county ArcGIS servisi engelli olduğu için hub üzerinden)",
      sirket_llc: get("OWNER") || matched.label,
      eslesen_aday: matched.label,
      tarih: get("SALEDT").split(" ")[0] || "",
      belge_no_apn: get("PARCEL"),
      recording_no: get("RECPTNO"),
      deed_type: get("DEEDTYPE"),
      karsi_taraf: "", // assessor verisinde grantor (satan taraf) yok, sadece mevcut sahip (grantee) var
      fiyat: get("SALEP"),
      bolge: get("SITE_ADDRESS") || get("TWN_RNG_SEC") || "",
      owner2: get("OWNER_2"),
      mailing: [get("MAILING_ADDRESS"), get("CITY"), get("STATE"), get("ZIP")].filter(Boolean).join(", "),
      acres: get("PARCEL_SIZE"),
      legal: get("LEGAL_DESCRIPTION"),
    });
  }
  console.log(`taranan satır: ${n}, eşleşen: ${hits.length}`);
  return hits;
}

// PAKET TAPU (bulk deed) düzeltmesi: aynı RECPTNO'ya bağlı N parsel varsa
// county SALEP'i (fiyat) her satıra TOPLAM olarak yazıyor — bkz. lib/deed-utils.mjs.
// deed_parcel_count/birim_fiyat_tahmini eklemek için CSV'yi (RECPTNO kolonu) ayrı
// bir hafif geçişle tarıyoruz (scan()'in ön-filtresi çoğu satırı atladığı için
// tam RECPTNO haritası scan() içinden çıkarılamaz).
async function enrichWithDeedFields(hits, csvPath) {
  const counts = await computeRecptnoCounts(csvPath);
  for (const h of hits) {
    const count = deedParcelCount(h.recording_no, counts);
    h.deed_parcel_count = count;
    h.birim_fiyat_tahmini = unitPriceEstimate(h.fiyat, count);
  }
  return hits;
}

function toCsv(rows) {
  const cols = ["kaynak", "sirket_llc", "eslesen_aday", "tarih", "belge_no_apn", "recording_no", "deed_type", "karsi_taraf", "fiyat", "deed_parcel_count", "birim_fiyat_tahmini", "bolge", "owner2", "mailing", "acres"];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\n");
}

async function main() {
  console.log("Rakip tapu taraması başlıyor (Mohave County, AZ)…");
  await throttle(500); // nazik davran
  const csvPath = await ensureCsv();
  const hits = await scan(csvPath);
  await enrichWithDeedFields(hits, csvPath);

  // Tarihe göre sırala (en yeni önce), tarihsiz olanlar sona.
  hits.sort((a, b) => (b.tarih || "0").localeCompare(a.tarih || "0"));

  const outJsonPath = resolve(__dirname, "rakip-tapu-sonuc.json");
  const outCsvPath = resolve(__dirname, "rakip-tapu.csv");
  writeFileSync(outJsonPath, JSON.stringify(hits, null, 2));
  writeFileSync(outCsvPath, toCsv(hits));

  console.log(`\nToplam eşleşen kayıt: ${hits.length}`);
  console.log(`JSON → ${outJsonPath}`);
  console.log(`CSV  → ${outCsvPath}`);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
