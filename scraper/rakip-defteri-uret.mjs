#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ⚔️ RAKİP DEFTERİ — build-time birleştirici (SADECE bu sayfa için, harita/
// popup katmanlarına dokunmaz).
//
// Kaynak 1: scraper/rakip-tapu-sonuc.json — Mohave County tapu kaydı (LLC'nin
//   KENDİ ALIM deed'i: recording_no, deed_type, karsi_taraf/satıcı, tarih,
//   fiyat=SALEP; ayrıca paket-tapu düzeltmesi zaten uygulanmış: deed_parcel_count
//   + birim_fiyat_tahmini alanları mevcutsa kullanılır).
// Kaynak 2: scraper/rakip-ilan-fiyat.json — discountlots.com ilan/arşiv verisi
//   (satış/ilan fiyatı, peşinat, aylık ödeme, vade, statü, ilan URL, snapshot
//   tarihi). Bu kaynak "rakip ilanı" — county tapu KAYDI DEĞİL.
// Kaynak 3: scraper/rakip-tapu-diger.json — Discount Lots dışındaki bilinen
//   rakipler (ikinci sekme, bilgi amaçlı).
//
// APN ile join edilir. Çıktı: dashboard/src/data/rakip-defteri.json.
// Dashboard bunu lib/rakip-defteri.ts ile açar; runtime scraper bağımlılığı YOK.
//
// DÜRÜSTLÜK: eksik/eşleşmeyen alan uydurulmaz, null bırakılır. "Alım" alanları
// HER ZAMAN county tapu kaynaklı; "satış/ilan" alanları HER ZAMAN rakip ilanı
// kaynaklı — ikisi asla karıştırılmaz (kaynak etiketi lib tarafında eklenir).
//
// Kullanım: node scraper/rakip-defteri-uret.mjs
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TAPU_PATH = path.join(__dirname, "rakip-tapu-sonuc.json");
const ILAN_PATH = path.join(__dirname, "rakip-ilan-fiyat.json");
const DIGER_PATH = path.join(__dirname, "rakip-tapu-diger.json");
const OUT_PATH = path.join(ROOT, "dashboard", "src", "data", "rakip-defteri.json");

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    console.error(`[rakip-defteri-uret] ${p} okunamadı:`, err.message);
    return null;
  }
}

function toNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function main() {
  const tapu = readJson(TAPU_PATH);
  const ilan = readJson(ILAN_PATH);
  const diger = readJson(DIGER_PATH);

  const tapuByApn = new Map();
  for (const r of tapu?.kayitlar ?? []) {
    const apn = (r.belge_no_apn ?? "").trim();
    if (apn) tapuByApn.set(apn, r);
  }

  const ilanByApn = new Map();
  for (const r of ilan?.kayitlar ?? []) {
    const apn = (r.apn ?? "").trim();
    if (apn) ilanByApn.set(apn, r);
  }

  // Tüm bilinen APN'lerin birleşik kümesi (iki kaynaktan biri eksik olsa da kayıt kaybolmasın).
  const allApns = new Set([...tapuByApn.keys(), ...ilanByApn.keys()]);

  const kayitlar = [...allApns].sort().map((apn) => {
    const t = tapuByApn.get(apn) ?? null;
    const i = ilanByApn.get(apn) ?? null;

    const kayitTipi = t?.kayit_tipi ?? i?.kayit_tipi ?? "belirsiz";
    const deedParcelCount = toNumOrNull(t?.deed_parcel_count) ?? 1;
    const birimFiyatTahmini = toNumOrNull(t?.birim_fiyat_tahmini);

    return {
      apn,
      kayitTipi,
      bolge: t?.bolge ?? i?.bolge ?? null,
      acres: toNumOrNull(t?.acres ?? i?.acres),

      // ── ALIM (kaynak: county tapu) ──
      alimFiyati: toNumOrNull(t?.fiyat),
      alimTarihi: t?.tarih || null,
      recordingNo: t?.recording_no || null,
      deedType: t?.deed_type || null,
      satici: t?.karsi_taraf || null,
      legal: t?.legal || null,
      deedParcelCount,
      birimFiyatTahmini,

      // ── SATIŞ / İLAN (kaynak: rakip ilanı — discountlots.com) ──
      satisFiyati: toNumOrNull(i?.satis_fiyati),
      pesinat: toNumOrNull(i?.pesinat),
      aylik: toNumOrNull(i?.aylik),
      vade: toNumOrNull(i?.vade),
      statu: i?.statu || null,
      ilanBaslik: i?.ilan_baslik || null,
      ilanUrl: i?.kaynak_url || null,
      snapshotTarihi: i?.snapshot_tarihi || null,
    };
  });

  const digerOyuncular = (diger?.records ?? []).map((r) => ({
    firma: r.firma ?? r["firma/owner"] ?? "Bilinmiyor",
    tip: r.tip ?? null,
    parselSayisi: toNumOrNull(r.parsel_sayisi) ?? 0,
    bolgeler: Array.isArray(r.bolgeler) ? r.bolgeler : [],
    ornekApnler: Array.isArray(r.ornek_apnler) ? r.ornek_apnler : [],
    mailingState: r.mailing_state || null,
    not: r.not || null,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    source:
      "scraper/rakip-tapu-sonuc.json (Mohave County tapu) + scraper/rakip-ilan-fiyat.json (rakip ilanı/discountlots.com) + scraper/rakip-tapu-diger.json (diğer oyuncular)",
    toplamKayit: kayitlar.length,
    kayitlar,
    digerOyuncular,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[rakip-defteri-uret] ${kayitlar.length} kayıt + ${digerOyuncular.length} diğer oyuncu -> ${path.relative(ROOT, OUT_PATH)}`);
}

main();
