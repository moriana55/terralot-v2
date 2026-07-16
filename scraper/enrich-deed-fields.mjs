#!/usr/bin/env node
/**
 * PAKET TAPU (bulk deed) BACKFILL — mevcut scraper/rakip-tapu-sonuc.json'u,
 * scraper/rakip-tapu-dogrula.mjs'nin ağ isteği gerektiren (Wayback + canlı site)
 * tam koşusunu TEKRARLAMADAN, sadece deed_parcel_count/birim_fiyat_tahmini
 * alanları + düzeltilmiş istatistiklerle günceller.
 *
 * NEDEN AYRI SCRIPT: rakip-tapu-dogrula.mjs artık bu alanları kendi başına da
 * üretiyor (bkz. o dosya), ama onu yeniden çalıştırmak Wayback CDX + canlı
 * discountlots.com sorguları gerektirir (~87 APN × ~2.5sn throttle + ağ riski).
 * Bu script SADECE county CSV'sini (offline, zaten /tmp'de) kullanarak var
 * olan kayıtlı JSON'u günceller — tekrarlanabilir, hızlı, ağ bağımlılığı yok.
 *
 * Kullanım:
 *   node scraper/enrich-deed-fields.mjs
 *   MOHAVE_CSV=/path/to/parcel38.csv node scraper/enrich-deed-fields.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deedParcelCount, unitPriceEstimate, computeRecptnoCounts } from "./lib/deed-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = process.env.MOHAVE_CSV || "/tmp/mohave-parcel38.csv";
const JSON_PATH = resolve(__dirname, "rakip-tapu-sonuc.json");
const CSV_OUT_PATH = resolve(__dirname, "rakip-tapu.csv");

function toCsv(rows, cols) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

async function main() {
  if (!existsSync(JSON_PATH)) {
    console.error(`HATA: ${JSON_PATH} yok — önce rakip-tapu(-dogrula).mjs çalıştırılmalı.`);
    process.exit(1);
  }
  if (!existsSync(CSV_PATH)) {
    console.error(`HATA: county CSV bulunamadı: ${CSV_PATH} (MOHAVE_CSV env ile yol ver)`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  const kayitlar = data.kayitlar || [];
  console.log(`${kayitlar.length} kayıt okunuyor, RECPTNO -> parsel sayısı haritası çıkarılıyor…`);
  const recptnoCounts = await computeRecptnoCounts(CSV_PATH);

  let oncekiFiyatlar = [];
  for (const r of kayitlar) {
    const count = deedParcelCount(r.recording_no, recptnoCounts);
    r.deed_parcel_count = count;
    r.birim_fiyat_tahmini = unitPriceEstimate(r.fiyat, count);
  }

  const satis = kayitlar.filter((r) => r.kayit_tipi === "dogrulanmis_satis");
  oncekiFiyatlar = satis.map((r) => Number(r.fiyat)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const oncekiMed = oncekiFiyatlar.length ? oncekiFiyatlar[Math.floor(oncekiFiyatlar.length / 2)] : 0;
  const oncekiOrt = oncekiFiyatlar.length ? Math.round(oncekiFiyatlar.reduce((s, n) => s + n, 0) / oncekiFiyatlar.length) : 0;

  const birimFiyatiSecili = (r) => (r.deed_parcel_count > 1 ? r.birim_fiyat_tahmini : Number(r.fiyat));
  const yeniFiyatlar = satis.map(birimFiyatiSecili).filter((n) => n != null && Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const yeniMed = yeniFiyatlar.length ? yeniFiyatlar[Math.floor(yeniFiyatlar.length / 2)] : 0;
  const yeniOrt = yeniFiyatlar.length ? Math.round(yeniFiyatlar.reduce((s, n) => s + n, 0) / yeniFiyatlar.length) : 0;
  const paketSayisi = kayitlar.filter((r) => r.deed_parcel_count > 1).length;

  data.ozet = {
    ...data.ozet,
    ortalama_satis_fiyat: yeniOrt,
    medyan_satis_fiyat: yeniMed,
    paket_tapu_sayisi: paketSayisi,
    // Şeffaflık için düzeltme öncesi/sonrası rakamlar da saklanır.
    ortalama_satis_fiyat_duzeltme_oncesi_ham_salep: oncekiOrt,
    medyan_satis_fiyat_duzeltme_oncesi_ham_salep: oncekiMed,
  };

  writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));

  const cols = ["kayit_tipi", "site_durumu", "kaynak", "sirket_llc", "eslesen_aday", "ilan_ilk_arsiv", "tarih", "belge_no_apn", "recording_no", "deed_type", "karsi_taraf", "fiyat", "deed_parcel_count", "birim_fiyat_tahmini", "bolge", "acres"];
  writeFileSync(CSV_OUT_PATH, toCsv(kayitlar, cols));

  console.log(`\nPaket tapu (deed_parcel_count > 1) tespit edilen kayıt: ${paketSayisi} / ${kayitlar.length}`);
  console.log(`Medyan satış fiyatı (dogrulanmis_satis, ham SALEP)      : $${oncekiMed} (ort $${oncekiOrt})`);
  console.log(`Medyan satış fiyatı (dogrulanmis_satis, birim düzeltme) : $${yeniMed} (ort $${yeniOrt})`);
  console.log(`\nJSON → ${JSON_PATH}\nCSV  → ${CSV_OUT_PATH}`);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
