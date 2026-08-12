// ─────────────────────────────────────────────────────────────────────────────
// CHROME YOLU — puppeteer başlatan tüm scraper'ların TEK kaynağı.
//
// NEDEN VAR (2026-08-12): Chrome kendini güncelleyince puppeteer'ın indirdiği
// sürüm (149.0.7827.22) önbellekte kalmadı. O günden sonra tarayıcı isteyen
// DÖRT betik birden ("Could not find Chrome") her gece çıkış 1 verdi:
//   scrape_mvba_live.js · scrape_pbfcm_live.js · scrape_delinquent_tax_rolls.js
//   · competitor-scraper.js
// Gece turu 9 gün üst üste "BAŞARISIZ" damgası yedi, rakip verisi dondu.
// Dört yerde ayrı ayrı düzeltmek yerine yol çözümü buraya alındı.
//
// Sıra: PUPPETEER_EXECUTABLE_PATH → sistemde kurulu Chrome/Chromium →
// puppeteer'ın kendi indirdiği sürüm (null dönerse puppeteer kendi bulur).
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("node:fs");

const ADAYLAR = [
  // macOS (Yiğit'in makinesi)
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux (VPS)
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
];

/** Kullanılabilir Chrome yolu — bulunamazsa null. */
function chromeYolu() {
  const elle = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (elle && fs.existsSync(elle)) return elle;
  for (const p of ADAYLAR) if (fs.existsSync(p)) return p;
  return null;
}

/**
 * puppeteer.launch'a verilecek ek ayarlar. Chrome bulunamazsa boş nesne döner
 * (puppeteer kendi indirdiğini dener) — davranış eskisiyle aynı kalır.
 */
function launchAyarlari() {
  const exe = chromeYolu();
  if (!exe) return {};
  return { executablePath: exe };
}

module.exports = { chromeYolu, launchAyarlari, ADAYLAR };
