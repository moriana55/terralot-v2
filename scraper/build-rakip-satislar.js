#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// RAKİP SATIŞLARI KATMANI — build-time üretim.
//
// Kaynak: scraper/rakip-tapu-sonuc.json (87 kayıt; Discount Lots/WP RE Ventures
// ailesi, Mohave County tapu-kanıtlı). Bu dosyada lat/lng YOK — sadece APN
// (belge_no_apn). Koordinat için scraper/mohave-offmarket.csv (20K Mohave
// parsel, apn+lat+lng — az-mohave ArcGIS ParcelQueryLayer'dan çekilmiş) APN
// eşleştirmesiyle kullanılır.
//
// Eşleştirme sırası (öncelik):
//   1) EXACT   — belge_no_apn birebir csv'deki apn ile eşleşir.
//   2) GROUP   — eşleşmezse aynı "book-map" grubundaki (APN'in ilk iki
//      segmenti, örn. "339-17") parsellerin centroid'i alınır (yaklaşık —
//      aynı subdivision/blok, birkaç yüz metre - birkaç km sapma olabilir).
//   3) Hiçbiri bulunamazsa kayıt ATLANIR (sessizce) — sayaç raporlanır.
//
// Çıktı: dashboard/src/data/rakip-satislar.json — dashboard bu statik dosyayı
// okur, runtime'da scraper'a veya bu script'e bağımlılığı YOKTUR.
//
// Kullanım: node scraper/build-rakip-satislar.js
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RAKIP_PATH = path.join(ROOT, "scraper", "rakip-tapu-sonuc.json");
const CSV_PATH = path.join(ROOT, "scraper", "mohave-offmarket.csv");
const OUT_PATH = path.join(ROOT, "dashboard", "src", "data", "rakip-satislar.json");

function parseCsvCoords(csvText) {
  const lines = csvText.split("\n");
  const header = lines[0].split(",");
  const apnIdx = header.indexOf("apn");
  const latIdx = header.indexOf("lat");
  const lngIdx = header.indexOf("lng");
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols.length <= Math.max(apnIdx, latIdx, lngIdx)) continue;
    const apn = cols[apnIdx].replace(/"/g, "").trim();
    const lat = parseFloat(cols[latIdx].replace(/"/g, ""));
    const lng = parseFloat(cols[lngIdx].replace(/"/g, ""));
    if (!apn || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    map.set(apn, { lat, lng });
  }
  return map;
}

function bookMapKey(apn) {
  const parts = (apn || "").split("-");
  return parts.slice(0, 2).join("-");
}

function buildGroupCentroids(coordMap) {
  const groups = new Map(); // key -> {latSum,lngSum,n}
  for (const [apn, c] of coordMap.entries()) {
    const key = bookMapKey(apn);
    if (!key) continue;
    const g = groups.get(key) || { latSum: 0, lngSum: 0, n: 0 };
    g.latSum += c.lat; g.lngSum += c.lng; g.n += 1;
    groups.set(key, g);
  }
  const centroids = new Map();
  for (const [key, g] of groups.entries()) {
    centroids.set(key, { lat: g.latSum / g.n, lng: g.lngSum / g.n });
  }
  return centroids;
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(RAKIP_PATH, "utf8"));
  const kayitlar = raw.kayitlar || [];
  const coordMap = parseCsvCoords(fs.readFileSync(CSV_PATH, "utf8"));
  const groupCentroids = buildGroupCentroids(coordMap);

  let exact = 0, grouped = 0, skipped = 0;
  const records = [];

  for (const r of kayitlar) {
    const apn = r.belge_no_apn || "";
    let coord = coordMap.get(apn);
    let coordSource = null;
    if (coord) { coordSource = "exact"; exact++; }
    else {
      const key = bookMapKey(apn);
      const g = groupCentroids.get(key);
      if (g) { coord = g; coordSource = "group"; grouped++; }
    }
    if (!coord) { skipped++; continue; }

    records.push({
      id: apn || `${r.kayit_tipi}-${records.length}`,
      apn,
      kayitTipi: r.kayit_tipi,
      lat: coord.lat,
      lng: coord.lng,
      coordSource,
      fiyat: toNumber(r.fiyat),
      tarih: r.tarih || null,
      recordingNo: r.recording_no || null,
      deedType: r.deed_type || null,
      karsiTaraf: r.karsi_taraf || null,
      sirketLlc: r.sirket_llc || null,
      bolge: r.bolge || null,
      acres: toNumber(r.acres),
      legal: r.legal || null,
      siteDurumu: r.site_durumu || null,
    });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "scraper/rakip-tapu-sonuc.json (Discount Lots / WP RE Ventures ailesi, Mohave County tapu kaydı) + scraper/mohave-offmarket.csv (APN→lat/lng eşleşmesi)",
    totalKayit: kayitlar.length,
    haritadaGosterilen: records.length,
    atlanan: skipped,
    coordEslesmeExact: exact,
    coordEslesmeGroup: grouped,
    ozet: raw.ozet || null,
    records,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Yazıldı: ${OUT_PATH}`);
  console.log(`Toplam kayıt: ${kayitlar.length} · Haritada: ${records.length} (exact ${exact} + group ${grouped}) · Atlanan: ${skipped}`);
}

main();
