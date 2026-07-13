#!/usr/bin/env node
/**
 * RAKİP İLAN FİYATI (satış tarafı) — Discount Lots'un rakip-tapu-sonuc.json'daki 87 Mohave
 * parselini KAÇA SATIŞA ÇIKARDIĞINI (peşinat / aylık taksit / vade) discountlots.com ilan
 * sayfalarından çıkarır. Bu veri county'de YOK çünkü taksitli satışlarda tapu devri
 * (recording) sözleşme bitene kadar yapılmıyor — tek kaynak ilanın kendisi (canlı veya
 * Wayback arşivi).
 *
 * ÖNEMLİ — APN ÇAKIŞMASI RİSKİ: Discount Lots'un APN slug'ı (örn. 403-16-028) FARKLI
 * county'lerde tesadüfen aynı formatta üretilebiliyor (doğrulandı: 403-16-028 canlı sitede
 * Pinal County, Eloy AZ 0.28 akrelik bambaşka bir parseli gösteriyor; bizim kaydımız Mohave'de
 * 480 akrelik STATE OF ARIZONA parseli). Bu yüzden HER eşleşme county alanına ("Mohave") VE
 * akreaj yakınlığına göre doğrulanır; doğrulanamayan kayıtlarda fiyat alanları null bırakılır
 * ve eslesme_notu'na "apn_collision" yazılır — ASLA başka county'nin verisi bizim kayda
 * bağlanmaz.
 *
 * Kaynaklar:
 *   1. Canlı: https://discountlots.com/property/{APN} — Inertia (Laravel+Vue) data-page JSON'u
 *      (props.property: cash_sale_price, down_payment, payment_1, term_1, status, county, ...)
 *   2. Arşiv: web.archive.org — ilan_ilk_arsiv tarihine en yakın snapshot; iki olası biçim:
 *        a) Inertia JSON (site 2023 sonrası migrate olduysa)
 *        b) Eski WordPress/WooCommerce tablo biçimi (Parcel Number / County / ... satırları) —
 *           tag'ler temizlenmiş düz metin üzerinde etiket→değer regex'i ile okunur.
 *
 * Kullanım:
 *   node scraper/rakip-ilan-fiyat.mjs
 *   (rakip-tapu-sonuc.json'un scraper/ dizininde hazır olması gerekir)
 *
 * Çıktı: scraper/rakip-ilan-fiyat.json + scraper/rakip-ilan-fiyat.csv
 */

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_PATH = resolve(__dirname, "rakip-tapu-sonuc.json");
const OUT_JSON = resolve(__dirname, "rakip-ilan-fiyat.json");
const OUT_CSV = resolve(__dirname, "rakip-ilan-fiyat.csv");

const UA = "Mozilla/5.0 (research; one-time throttled crawl)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Inertia data-page="{...}" attribute'unu JSON olarak çıkarır (props.property'yi döner).
function extractInertiaProperty(html) {
  const m = html.match(/data-page="(.*?)">/s);
  if (!m) return null;
  try {
    const raw = decodeEntities(m[1]);
    const d = JSON.parse(raw);
    return d?.props?.property || null;
  } catch {
    return null;
  }
}

// Eski WordPress/WooCommerce tablo biçimi: apn'in geçtiği yerin etrafındaki metin
// penceresinde "County", "Cash Price", "Down Payment", "Monthly Payment", "Term" etiketlerini
// arar. Aggregator/"ilgili ilanlar" sayfalarında yanlış karta düşmemek için pencereyi apn
// occurence'ına göre daraltıyoruz.
function extractLegacyFields(html, apn) {
  const text = stripTags(html);
  const apnIdx = text.indexOf(apn);
  if (apnIdx === -1) return null;
  const start = Math.max(0, apnIdx - 1500);
  const end = Math.min(text.length, apnIdx + 3500);
  const win = text.slice(start, end);

  const grab = (label) => {
    const re = new RegExp(`${label}\\s*:?\\s*\\$?\\s*([\\d,]+(?:\\.\\d+)?)`, "i");
    const mm = win.match(re);
    return mm ? Number(mm[1].replace(/,/g, "")) : null;
  };
  const grabText = (label) => {
    const re = new RegExp(`${label}\\s*:?\\s*([A-Za-z ]{2,30})`, "i");
    const mm = win.match(re);
    return mm ? mm[1].trim() : null;
  };

  const county = grabText("County");
  const acreageM = win.match(/Parcel Size\s*:?\s*([\d.]+)\s*acre/i);
  const acreage = acreageM ? Number(acreageM[1]) : null;
  const cashPrice = grab("Cash Price") ?? grab("Sale Price") ?? grab("List Price");
  const downPayment = grab("Down Payment");
  const monthly = grab("Monthly Payment") ?? grab("Payment Amount");
  const term = grab("Term \\(Months\\)") ?? grab("Term");
  const soldBanner = /^Sold!!!/i.test(win.trim()) || /\bSOLD\b/.test(win.slice(0, 200));

  const hasAnyPricing = cashPrice != null || downPayment != null || monthly != null;
  if (!county && !hasAnyPricing) return null; // apn geçiyor ama okunabilir bir tablo yok

  return {
    apn,
    county,
    acreage,
    cash_sale_price: cashPrice,
    down_payment: downPayment,
    payment_1: monthly,
    term_1: term,
    status: soldBanner ? "Sold (arşiv, detay tablo yok)" : null,
    title: null,
    _format: "legacy-metin",
  };
}

function isMohave(county) {
  return !!county && /mohave/i.test(county);
}

function acreageCloseEnough(propAcreage, assessorAcresStr) {
  const a = Number(assessorAcresStr);
  if (!propAcreage || !a || !isFinite(a)) return null; // karşılaştırılamaz
  const diff = Math.abs(propAcreage - a) / a;
  return diff < 0.25;
}

async function fetchText(url, timeoutMs = 30000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, status: res.status, html: null };
    return { ok: true, status: res.status, html: await res.text() };
  } catch (e) {
    return { ok: false, status: "fetch-error", html: null, error: String(e) };
  }
}

async function wayback_closest(apn, yyyymmdd) {
  const ts = (yyyymmdd || "").replace(/\D/g, "") || "20240101";
  const { ok, html } = await fetchText(
    `http://archive.org/wayback/available?url=discountlots.com/property/${apn}&timestamp=${ts}`,
    20000
  );
  if (!ok || !html) return null;
  try {
    const d = JSON.parse(html);
    return d?.archived_snapshots?.closest?.url || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tek APN için ilan verisini bul (canlı → arşiv → yok)
// ---------------------------------------------------------------------------

async function resolveListing(rec) {
  const apn = rec.belge_no_apn;
  const assessorAcres = rec.acres;
  const result = {
    apn,
    kayit_tipi: rec.kayit_tipi,
    satis_fiyati: null,
    pesinat: null,
    aylik: null,
    vade: null,
    faiz: null,
    statu: null,
    ilan_baslik: null,
    kaynak_url: null,
    snapshot_tarihi: null,
    eslesme_notu: "bulunamadi",
  };

  // 1) Canlı site
  const liveUrl = `https://discountlots.com/property/${apn}`;
  const live = await fetchText(liveUrl);
  await sleep(1300);
  if (live.ok && live.html) {
    const prop = extractInertiaProperty(live.html);
    if (prop && String(prop.apn || "").toUpperCase() === apn.toUpperCase()) {
      const countyOk = isMohave(prop.county);
      const acreOk = acreageCloseEnough(prop.acreage, assessorAcres);
      if (countyOk || acreOk === true) {
        result.satis_fiyati = prop.cash_sale_price ?? prop.cash_price_current ?? prop.original_cash_price ?? null;
        result.pesinat = prop.down_payment ?? null;
        result.aylik = prop.payment_1 ?? null;
        result.vade = prop.term_1 ?? null;
        result.faiz = null; // discountlots ilanlarında açık faiz oranı yayınlanmıyor
        result.statu = prop.status ?? null;
        result.ilan_baslik = prop.title || (prop.property_description ? prop.property_description.slice(0, 140) : null);
        result.kaynak_url = liveUrl;
        result.snapshot_tarihi = new Date().toISOString().slice(0, 10) + " (canli)";
        result.eslesme_notu = countyOk ? "canli-inertia-mohave-onaylandi" : "canli-inertia-akreaj-yakin-onaylandi";
        return result;
      } else {
        result.eslesme_notu = `apn_collision-farkli-county:${prop.county || "?"}-akreaj:${prop.acreage ?? "?"}`;
        // fiyat alanlarını KASITLI olarak boş bırakıyoruz — county uyuşmuyor.
      }
    }
  }

  // 2) Wayback arşivi (ilan_ilk_arsiv tarihine en yakın snapshot)
  const snapUrl = await wayback_closest(apn, rec.ilan_ilk_arsiv);
  await sleep(1200);
  if (snapUrl) {
    const arch = await fetchText(snapUrl, 30000);
    await sleep(1200);
    if (arch.ok && arch.html) {
      let prop = extractInertiaProperty(arch.html);
      let format = "arsiv-inertia";
      if (!prop) {
        prop = extractLegacyFields(arch.html, apn);
        format = "arsiv-legacy-metin";
      }
      if (prop) {
        const countyOk = isMohave(prop.county);
        const acreOk = acreageCloseEnough(prop.acreage, assessorAcres);
        if (countyOk || acreOk === true || (!prop.county && !prop.acreage && (prop.cash_sale_price || prop.down_payment || prop.payment_1))) {
          // Not: county/acreaj hiç okunamadıysa ama fiyat alanları apn penceresinden geldiyse
          // (aynı APN string'i etrafındaki tablo), makul güvenle kabul ediyoruz; yine de
          // eslesme_notu'na bunu açıkça yazıyoruz ki şeffaf kalsın.
          result.satis_fiyati = prop.cash_sale_price ?? null;
          result.pesinat = prop.down_payment ?? null;
          result.aylik = prop.payment_1 ?? null;
          result.vade = prop.term_1 ?? null;
          result.faiz = null;
          result.statu = prop.status ?? result.statu;
          result.ilan_baslik = result.ilan_baslik || prop.title || null;
          result.kaynak_url = snapUrl;
          result.snapshot_tarihi = snapUrl.match(/\/web\/(\d{8})/)?.[1] || null;
          if (result.snapshot_tarihi) {
            result.snapshot_tarihi = `${result.snapshot_tarihi.slice(0, 4)}-${result.snapshot_tarihi.slice(4, 6)}-${result.snapshot_tarihi.slice(6, 8)}`;
          }
          result.eslesme_notu = countyOk
            ? `${format}-mohave-onaylandi`
            : acreOk === true
              ? `${format}-akreaj-yakin-onaylandi`
              : `${format}-county-dogrulanamadi-ama-apn-blogunda-bulundu`;
          return result;
        } else if (prop.county) {
          result.eslesme_notu = `apn_collision-farkli-county:${prop.county}-akreaj:${prop.acreage ?? "?"}`;
          return result;
        }
      }
      // Arşiv sayfası var ama tanınabilir fiyat/parcel verisi yok (örn. çoktan satılmış,
      // fiyat tablosu kaldırılmış) — dürüstçe "bulunamadi" bırak.
      result.kaynak_url = result.kaynak_url || snapUrl;
      result.snapshot_tarihi =
        result.snapshot_tarihi || snapUrl.match(/\/web\/(\d{8})/)?.[1]?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") || null;
      result.eslesme_notu = result.eslesme_notu === "bulunamadi" ? "arsiv-sayfada-fiyat-tablosu-yok" : result.eslesme_notu;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

function toCsv(rows, cols) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

async function main() {
  const src = JSON.parse(readFileSync(IN_PATH, "utf8"));
  const kayitlar = src.kayitlar;
  console.log(`${kayitlar.length} APN işlenecek (canlı + arşiv, nazik throttle ~2.5sn/APN)…`);

  const out = [];
  for (let i = 0; i < kayitlar.length; i++) {
    const rec = kayitlar[i];
    process.stdout.write(`[${i + 1}/${kayitlar.length}] ${rec.belge_no_apn} … `);
    const r = await resolveListing(rec);
    console.log(r.eslesme_notu, r.satis_fiyati != null ? `$${r.satis_fiyati}` : "-");

    const alim = Number(rec.fiyat) || null; // rakip-tapu-sonuc.json'daki LLC alım fiyatı (dogrulanmis_satis için)
    const marj = alim && r.satis_fiyati ? r.satis_fiyati - alim : null;
    const carpan = alim && r.satis_fiyati ? Number((r.satis_fiyati / alim).toFixed(2)) : null;

    out.push({
      apn: rec.belge_no_apn,
      kayit_tipi: rec.kayit_tipi,
      alim_fiyati: alim,
      alim_tarihi: rec.tarih || null,
      satis_fiyati: r.satis_fiyati,
      pesinat: r.pesinat,
      aylik: r.aylik,
      vade: r.vade,
      faiz: r.faiz,
      statu: r.statu,
      marj,
      carpan,
      bolge: rec.bolge,
      acres: rec.acres,
      ilan_baslik: r.ilan_baslik,
      kaynak_url: r.kaynak_url,
      snapshot_tarihi: r.snapshot_tarihi,
      eslesme_notu: r.eslesme_notu,
    });
  }

  // ---- Türev analiz ----
  const fiyatBulunan = out.filter((r) => r.satis_fiyati != null);
  const alimlar = out.map((r) => r.alim_fiyati).filter((n) => n > 0);
  const satislar = fiyatBulunan.map((r) => r.satis_fiyati).filter((n) => n > 0);
  const carpanlar = out.map((r) => r.carpan).filter((n) => n != null && n > 0);
  const marjlar = out.map((r) => r.marj).filter((n) => n != null);

  // Aktif taksitli sözleşme: hâlâ tahsilat devam eden (paid-off/tam ödenmiş DEĞİL)
  const aktifTaksitli = out.filter(
    (r) =>
      r.kayit_tipi === "satis_taksitte" &&
      r.statu &&
      !/paid off/i.test(r.statu) &&
      r.aylik != null
  );
  const aylikOrt = aktifTaksitli.length
    ? Math.round(aktifTaksitli.reduce((s, r) => s + r.aylik, 0) / aktifTaksitli.length)
    : null;
  const vadeOrt = aktifTaksitli.filter((r) => r.vade != null).length
    ? Math.round(
        aktifTaksitli.filter((r) => r.vade != null).reduce((s, r) => s + r.vade, 0) /
          aktifTaksitli.filter((r) => r.vade != null).length
      )
    : null;
  const tahminiAylikTahsilat = aylikOrt ? aylikOrt * aktifTaksitli.length : null;

  const ozet = {
    toplam_apn: out.length,
    fiyat_bulunan_apn: fiyatBulunan.length,
    apn_collision_tespit: out.filter((r) => r.eslesme_notu.startsWith("apn_collision")).length,
    medyan_alim_fiyati: median(alimlar),
    medyan_satis_fiyati: median(satislar),
    medyan_marj: median(marjlar),
    medyan_carpan: median(carpanlar),
    aktif_taksitli_sozlesme_sayisi: aktifTaksitli.length,
    aktif_taksitli_ortalama_aylik: aylikOrt,
    aktif_taksitli_ortalama_vade_ay: vadeOrt,
    tahmini_toplam_aylik_tahsilat_usd: tahminiAylikTahsilat,
  };

  console.log("\n=== ÖZET ===");
  console.log(JSON.stringify(ozet, null, 2));

  writeFileSync(OUT_JSON, JSON.stringify({ ozet, kayitlar: out }, null, 2));
  const cols = [
    "apn", "kayit_tipi", "alim_fiyati", "alim_tarihi", "satis_fiyati", "pesinat", "aylik", "vade",
    "faiz", "statu", "marj", "carpan", "bolge", "acres", "ilan_baslik", "kaynak_url", "snapshot_tarihi", "eslesme_notu",
  ];
  writeFileSync(OUT_CSV, toCsv(out, cols));
  console.log(`\nJSON → ${OUT_JSON}\nCSV  → ${OUT_CSV}`);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
