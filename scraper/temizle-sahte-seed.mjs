#!/usr/bin/env node
/**
 * SAHTE SEED KAYITLARINI TEMİZLE — tek seferlik onarım betiği.
 *
 * NE OLDU (2026-08-12'de bulundu): `scrape_delinquent_tax_rolls.js` içindeki
 * `seedOtherCounties()` fonksiyonu her koşuda Tarrant ve Montgomery county'sine
 * 25'er UYDURMA "vergi borçlusu" basıyordu. Sahip adları House of Cards
 * karakterleriydi (FRANK UNDERWOOD, DOUG STAMPER, RAYMOND TUSK…), borç ve değer
 * `Math.random()` ile üretiliyordu, APN'ler `TAR-400-*` / `MON-*` kalıbındaydı.
 *
 * Kayıtlar yerel SQLite'ta (`zillow_listings.db` → `off_market_leads`) duruyor.
 * Canlı Supabase'e GEÇMEMİŞLER (kontrol edildi: TX Tarrant/Montgomery 0 kayıt),
 * ama orada durdukları sürece bir sonraki `migrate_to_supabase.js` koşusunda
 * gerçek veriyle aynı havuza karışma riski var.
 *
 * Seed çağrısı kaldırıldı; bu betik geride kalanları siler.
 * Kullanım:
 *   node temizle-sahte-seed.mjs --rapor   # sadece göster
 *   node temizle-sahte-seed.mjs           # sil
 */

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.dirname(fileURLToPath(import.meta.url));
const DB_YOLU = path.join(KOK, "zillow_listings.db");
const SADECE_RAPOR = process.argv.includes("--rapor");

// Seed'in imzası: APN kalıbı. Sahip adına göre silmek riskli olurdu (gerçek bir
// "Underwood" soyadlı sahip var — Cuyahoga OH'de, o kayda dokunulmamalı).
const KOSUL = "apn like 'TAR-400-%' or apn like 'MON-%'";

const db = new Database(DB_YOLU);
const bul = db.prepare(`select id, apn, owner_name, city, state from off_market_leads where ${KOSUL}`).all();

console.log(`sahte seed kaydı: ${bul.length}`);
for (const r of bul.slice(0, 5)) console.log(`  ${r.apn} · ${r.owner_name?.trim()} · ${r.city}, ${r.state}`);
if (bul.length > 5) console.log(`  … +${bul.length - 5} kayıt`);

if (SADECE_RAPOR) {
  console.log("--rapor modu — silinmedi.");
} else if (bul.length) {
  const sonuc = db.prepare(`delete from off_market_leads where ${KOSUL}`).run();
  const kalan = db.prepare("select count(*) n from off_market_leads").get().n;
  console.log(`silindi: ${sonuc.changes} · off_market_leads kalan: ${kalan}`);
} else {
  console.log("temiz — silinecek kayıt yok.");
}
db.close();
