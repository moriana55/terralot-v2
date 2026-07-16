#!/usr/bin/env node
/**
 * RAKİP TAPU DOĞRULAMA (ölçekleme) — Discount Lots'un Mohave'de GEÇMİŞTE listelediği parselleri
 * Wayback Machine CDX API'sinden toplar, güncel Mohave Assessor CSV'siyle (bkz. rakip-tapu.mjs)
 * çapraz doğrular ve her kaydı sınıflandırır:
 *
 *   dogrulanmis_satis : parsel geçmişte discountlots.com'da listelenmiş + bugünkü sahip Discount
 *                       Lots ailesi LLC'lerinden DEĞİL + assessor'da listeleme sonrasına ait satış
 *                       kaydı (SALEDT/SALEP/RECPTNO) var → tapu devri kanıtlı.
 *   envanter          : bugünkü sahip hâlâ Discount Lots ailesi (WP RE Ventures / PW Real Estate
 *                       Ventures / DL Investors — hepsi 450 Anthony Trl, Northbrook IL adresli).
 *   belirsiz          : sahip aile dışı ama satış tarihi listeleme ÖNCESİ veya satış kaydı boş —
 *                       devir olmuş olabilir ama assessor izinden kesin kanıtlanamıyor.
 *
 * Veri kaynakları (hepsi kamuya açık):
 *   1. web.archive.org CDX API → discountlots.com/property/* geçmiş ilan URL'leri (APN slug'lı)
 *   2. Mohave County Assessor ParcelQueryLayer CSV (Esri Hub üzerinden; county sunucusu engelli)
 *
 * Kullanım:
 *   node scraper/rakip-tapu-dogrula.mjs           # CDX çeker + /tmp'deki CSV ile eşler
 *   (önce rakip-tapu.mjs çalıştırılmış olmalı ki /tmp/mohave-parcel38.csv mevcut olsun)
 *
 * Çıktı: rakip-tapu-sonuc.json + rakip-tapu.csv GÜNCELLENİR (kayit_tipi kolonu eklenir).
 */

import { writeFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deedParcelCount, unitPriceEstimate, computeRecptnoCounts } from "./lib/deed-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = "/tmp/mohave-parcel38.csv";
const CDX_URLS = [
  // ilan sayfaları: /property/{APN}
  "http://web.archive.org/cdx/search/cdx?url=discountlots.com/property/*&output=json&fl=original,timestamp&collapse=urlkey&limit=50000",
  // eski WooCommerce ürün sayfaları: /product/...-apn-XXX-XX-XXX-... (slug'da APN geçiyor)
  "http://web.archive.org/cdx/search/cdx?url=discountlots.com/product/*&output=json&fl=original,timestamp&collapse=urlkey&limit=50000",
];

// Discount Lots ailesi LLC'leri — hepsi aynı posta adresi (450 Anthony Trl, Northbrook, IL 60062).
// WP RE Ventures: discountlots.com "SOLD" ilanlarındaki APN'lerin kayıtlı sahibi (çapraz doğrulandı).
// DL Investors 1 LLC: "DL" = Discount Lots; aynı adres; arşivli ilan APN'lerinde sahip olarak çıktı.
// Sonny Capital Group LLC: yine 450 Anthony Trl adresli — arşivli ilan APN'inde sahip olarak çıktı.
const FAMILY = ["WP RE VENTURES", "PW REAL ESTATE VENTURES", "PW REAL VENTURES", "DL INVESTORS", "SONNY CAPITAL"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- CDX: geçmiş ilan URL'lerinden APN'leri topla ----
async function fetchListedApns() {
  const apns = new Map(); // apn -> ilk snapshot zamanı (YYYYMMDD…)
  for (const cdxUrl of CDX_URLS) {
    console.log("Wayback CDX sorgulanıyor…", cdxUrl.split("url=")[1].split("&")[0]);
    let rows = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(cdxUrl, { signal: AbortSignal.timeout(120000) });
      if (res.ok) { rows = await res.json(); break; }
      console.warn(`  CDX HTTP ${res.status} (deneme ${attempt}/4) — ${attempt * 5}sn bekle`);
      await sleep(attempt * 5000);
    }
    if (!rows) throw new Error("CDX 4 denemede alınamadı");
    for (const [url, ts] of rows.slice(1)) {
      // /property/{APN} veya /product/...apn-{APN}... — Mohave APN biçimi: XXX-XX-XXX(A)
      const m =
        url.match(/^https?:\/\/(?:www\.)?discountlots\.com\/property\/(\d{3}-\d{2}-\d{3}[A-Z]?)\/?$/) ||
        url.match(/^https?:\/\/(?:www\.)?discountlots\.com\/product\/[^?]*apn[_-](\d{3}-\d{2}-\d{3}[A-Z]?)\b[^?]*\/?$/i);
      if (!m) continue;
      const apn = m[1].toUpperCase();
      if (!apns.has(apn) || ts < apns.get(apn)) apns.set(apn, ts);
    }
    await sleep(1500); // archive.org'a nazik davran
  }
  console.log(`arşivde APN çıkarılabilen ilan/ürün sayfası: ${apns.size}`);
  return apns;
}

// ---- CSV satır ayrıştırıcı (tırnak-içi virgül güvenli) ----
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ---- Assessor CSV'sinde APN'leri ve aile-LLC sahipliklerini tara ----
async function scanCsv(apnSet) {
  const rl = createInterface({ input: createReadStream(CSV_PATH, { encoding: "utf8" }), crlfDelay: Infinity });
  let header = null, idx = {};
  const apnHits = new Map();   // arşivli ilan APN'i → assessor satırı
  const familyRows = [];       // aile LLC'lerinin TÜM güncel sahiplikleri (envanter)
  for await (const raw of rl) {
    if (!raw) continue;
    if (!header) {
      header = parseCsvLine(raw.replace(/^﻿/, ""));
      header.forEach((h, i) => (idx[h] = i));
      continue;
    }
    const upper = raw.toUpperCase();
    const isFamilyLine = FAMILY.some((f) => upper.includes(f));
    // hızlı ön filtre: satırda ne aile adı ne de aranan APN'lerden biri yoksa geç
    if (!isFamilyLine && ![...apnSet].some((a) => raw.includes(a))) continue;
    const row = parseCsvLine(raw);
    const get = (k) => row[idx[k]] ?? "";
    const parcel = get("PARCEL");
    const rec = {
      apn: parcel,
      owner: get("OWNER"),
      owner2: get("OWNER_2"),
      mailing: [get("MAILING_ADDRESS"), get("CITY"), get("STATE"), get("ZIP")].filter(Boolean).join(", "),
      salep: get("SALEP"),
      saledt: get("SALEDT").split(" ")[0],
      recptno: get("RECPTNO"),
      deedtype: get("DEEDTYPE"),
      acres: get("PARCEL_SIZE"),
      bolge: get("SITE_ADDRESS") || get("TWN_RNG_SEC") || "",
      legal: get("LEGAL_DESCRIPTION"),
    };
    if (apnSet.has(parcel)) apnHits.set(parcel, rec);
    if (FAMILY.some((f) => rec.owner.toUpperCase().includes(f))) familyRows.push(rec);
  }
  return { apnHits, familyRows };
}

// ---- Canlı sitedeki ilan statüsü (satıcının KENDİ kaydı): "Sold - Cash", "Servicing Retained"
// (taksitli satılmış, tapu borç bitince devredilir), "Available - Website" vb. Sayfanın Inertia
// JSON'undan okunur. Nazik: istekler arası 1.2sn.
async function fetchSiteStatus(apn) {
  try {
    const res = await fetch(`https://discountlots.com/property/${apn}`, {
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "Mozilla/5.0 (research; one-time throttled crawl)" }, // dikkat: header ASCII olmali
    });
    if (!res.ok) return res.status === 404 ? "ilan-kaldirilmis" : `http-${res.status}`;
    // Inertia data-page attribute'u HTML-escape'li JSON içerir (&quot;status&quot;:...)
    const html = (await res.text()).replace(/&quot;/g, '"');
    const m = html.match(new RegExp(`"status":"([^"]+)","apn":"${apn}"`));
    return m ? m[1] : "status-bulunamadi";
  } catch {
    return "erisim-hatasi";
  }
}

function isFamilyOwner(owner) {
  const u = (owner || "").toUpperCase();
  return FAMILY.some((f) => u.includes(f));
}

function toCsv(rows, cols) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`Assessor CSV yok (${CSV_PATH}) — önce: node scraper/rakip-tapu.mjs`);
    process.exit(1);
  }
  const listed = await fetchListedApns();
  await sleep(1000); // nazik davran
  const { apnHits, familyRows } = await scanCsv(new Set(listed.keys()));
  console.log(`Mohave CSV'de eşleşen arşivli ilan APN'i: ${apnHits.size} (kalanı başka county)`);
  console.log(`Aile LLC güncel sahiplik (envanter): ${familyRows.length}`);

  const out = [];
  const KAYNAK_ARSIV =
    "Wayback (discountlots.com/property/{APN} arşivli ilan) + Mohave Assessor CSV çapraz doğrulama";
  const KAYNAK_ENV = "Mohave County Assessor (ParcelQueryLayer / Esri Hub CSV)";

  // 1) Arşivli ilanlar → canlı site statüsü + assessor kaydıyla sınıflandırma
  console.log(`Canlı site statüleri çekiliyor (${apnHits.size} APN, 1.2sn throttle)…`);
  const siteStatus = new Map();
  for (const apn of apnHits.keys()) {
    siteStatus.set(apn, await fetchSiteStatus(apn));
    await sleep(1200);
  }
  for (const [apn, snapTs] of listed) {
    const rec = apnHits.get(apn);
    if (!rec) continue; // Mohave değil
    const listedDate = `${snapTs.slice(0, 4)}/${snapTs.slice(4, 6)}/${snapTs.slice(6, 8)}`;
    const durum = siteStatus.get(apn) || "";
    const siteSold = /^sold|servicing/i.test(durum); // satıcının kendi kaydına göre satılmış
    let tip;
    if (isFamilyOwner(rec.owner)) {
      // tapu hâlâ ailede: site "satıldı/taksit sürüyor" diyorsa taksitli satış, yoksa envanter
      tip = siteSold ? "satis_taksitte" : "envanter";
    } else if (rec.saledt && (rec.saledt >= listedDate || siteSold)) {
      // tapu aile dışına geçmiş + (satış ilan sonrası VEYA satıcı da satıldı diyor) → kanıtlı
      tip = "dogrulanmis_satis";
    } else tip = "belirsiz";
    out.push({
      kayit_tipi: tip,
      site_durumu: durum,
      kaynak: KAYNAK_ARSIV,
      sirket_llc: tip === "envanter" || tip === "satis_taksitte" ? rec.owner : "Discount Lots (WP RE Ventures ailesi)",
      eslesen_aday: "Discount Lots",
      ilan_ilk_arsiv: listedDate,
      tarih: rec.saledt,
      belge_no_apn: apn,
      recording_no: rec.recptno,
      deed_type: rec.deedtype,
      karsi_taraf: tip === "envanter" ? "" : `${rec.owner}${rec.owner2 ? " & " + rec.owner2 : ""} (${rec.mailing})`,
      fiyat: rec.salep,
      bolge: rec.bolge,
      acres: rec.acres,
      legal: rec.legal,
    });
  }

  // 2) Aile LLC'lerinin arşivde görünmeyen güncel sahiplikleri de envanter olarak ekle
  const seen = new Set(out.map((r) => r.belge_no_apn));
  for (const rec of familyRows) {
    if (seen.has(rec.apn)) continue;
    seen.add(rec.apn);
    out.push({
      kayit_tipi: "envanter",
      site_durumu: "",
      kaynak: KAYNAK_ENV,
      sirket_llc: rec.owner,
      eslesen_aday: "Discount Lots (aile LLC)",
      ilan_ilk_arsiv: "",
      tarih: rec.saledt,
      belge_no_apn: rec.apn,
      recording_no: rec.recptno,
      deed_type: rec.deedtype,
      karsi_taraf: "",
      fiyat: rec.salep,
      bolge: rec.bolge,
      acres: rec.acres,
      legal: rec.legal,
    });
  }

  // PAKET TAPU (bulk deed) düzeltmesi: aynı RECPTNO'ya bağlı N parseli varsa
  // county SALEP'i her satıra TOPLAM olarak yazıyor (doğrulanmış örnek: APN
  // 308-22-040 / RECPTNO 2020059875 / SALEP $35.000, ama aynı RECPTNO'da 6
  // parsel var → gerçek birim fiyat ~$5.833). deed_parcel_count (RECPTNO boşsa
  // 1) ve birim_fiyat_tahmini (=fiyat/deed_parcel_count) her kayda eklenir.
  console.log("RECPTNO -> parsel sayısı haritası çıkarılıyor (paket tapu tespiti)…");
  const recptnoCounts = await computeRecptnoCounts(CSV_PATH);
  for (const r of out) {
    const count = deedParcelCount(r.recording_no, recptnoCounts);
    r.deed_parcel_count = count;
    r.birim_fiyat_tahmini = unitPriceEstimate(r.fiyat, count);
  }

  out.sort((a, b) => (a.kayit_tipi + (b.tarih || "")).localeCompare(b.kayit_tipi + (a.tarih || "")));

  const satis = out.filter((r) => r.kayit_tipi === "dogrulanmis_satis");
  const taksit = out.filter((r) => r.kayit_tipi === "satis_taksitte");
  const env = out.filter((r) => r.kayit_tipi === "envanter");
  const bel = out.filter((r) => r.kayit_tipi === "belirsiz");
  // İSTATİSTİK DÜZELTMESİ: paket kayıtlarda (deed_parcel_count > 1) SALEP yerine
  // birim_fiyat_tahmini kullanılır — aksi halde toplu tapu fiyatı tekil parsel
  // ortalama/medyanını yapay şişirir (bkz. .git/sdd/rakip-ilan-fiyat-report.md'deki
  // ×3,29 tekil-deed bulgusuyla tutarlı; bu düzeltme onu ÇÜRÜTMEZ, aksine SALEP'in
  // ham haliyle kullanılmasının riskini ortadan kaldırır).
  const birimFiyatiSecili = (r) => (r.deed_parcel_count > 1 ? r.birim_fiyat_tahmini : Number(r.fiyat));
  const fiyatlar = satis.map(birimFiyatiSecili).filter((n) => n != null && Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const ort = fiyatlar.length ? Math.round(fiyatlar.reduce((s, n) => s + n, 0) / fiyatlar.length) : 0;
  const med = fiyatlar.length ? fiyatlar[Math.floor(fiyatlar.length / 2)] : 0;
  const paketSayisi = out.filter((r) => r.deed_parcel_count > 1).length;

  console.log(`\nDOĞRULANMIŞ SATIŞ (tapu devri kanıtlı): ${satis.length} (ort $${ort}, medyan $${med} — paket kayıtlarda birim fiyat kullanıldı)`);
  console.log(`SATIŞ-TAKSİTTE (satıcı 'satıldı' diyor, tapu henüz devredilmemiş): ${taksit.length}`);
  console.log(`ENVANTER: ${env.length}`);
  console.log(`BELİRSİZ: ${bel.length}`);
  console.log(`PAKET TAPU (deed_parcel_count > 1): ${paketSayisi} / ${out.length}`);

  const cols = ["kayit_tipi", "site_durumu", "kaynak", "sirket_llc", "eslesen_aday", "ilan_ilk_arsiv", "tarih", "belge_no_apn", "recording_no", "deed_type", "karsi_taraf", "fiyat", "deed_parcel_count", "birim_fiyat_tahmini", "bolge", "acres"];
  const outJson = resolve(__dirname, "rakip-tapu-sonuc.json");
  const outCsv = resolve(__dirname, "rakip-tapu.csv");
  writeFileSync(outJson, JSON.stringify({ ozet: { dogrulanmis_satis: satis.length, satis_taksitte: taksit.length, envanter: env.length, belirsiz: bel.length, ortalama_satis_fiyat: ort, medyan_satis_fiyat: med, paket_tapu_sayisi: paketSayisi }, kayitlar: out }, null, 2));
  writeFileSync(outCsv, toCsv(out, cols));
  console.log(`JSON → ${outJson}\nCSV  → ${outCsv}`);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
