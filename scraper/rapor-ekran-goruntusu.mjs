#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// HAFTALIK RAPOR — EKRAN GÖRÜNTÜLERİ
//
// Ahmet'e gidecek PDF'e kanıt olarak konacak panel görüntülerini alır.
// Sayfalar gate arkasında olduğu için önce /api/gate ile oturum açılır.
//
// Çalıştır: node scraper/rapor-ekran-goruntusu.mjs
// Çıktı:    scraper/out/rapor-ss/*.png
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out", "rapor-ss");
const TABAN = process.env.TABAN || "http://localhost:3002";

const env = readFileSync(path.resolve(HERE, "../dashboard/.env.local"), "utf8");
const sifre = (env.match(/^ADMIN_PASSWORD=(.*)$/m) || [])[1]?.replace(/^"|"$/g, "");
if (!sifre) throw new Error("ADMIN_PASSWORD bulunamadı");

const SAYFALAR = [
  { ad: "01-sunum", yol: "/admin/sunum-ulusal", baslik: "Ulusal Operasyon Sunumu" },
  { ad: "02-harita", yol: "/admin/harita", baslik: "Harita — 25 eyalet", bekle: 11000, uzaklas: 2 },
  { ad: "03-arsa-notlari", yol: "/admin/arsa-notlari", baslik: "A+ Vitrin", bekle: 12000 },
  { ad: "04-bolge-profili", yol: "/admin/bolge-profili", baslik: "Bölge Profili" },
  { ad: "05-toplu-alicilar", yol: "/admin/toplu-alicilar", baslik: "Toplu Alıcılar" },
  { ad: "06-rakip-kanit", yol: "/admin/rakip-kanit", baslik: "Rakip Kanıtı" },
  { ad: "07-gokce", yol: "/admin/gokce-capital", baslik: "Gokce Capital Dosyası" },
  { ad: "08-envanter", yol: "/admin/off-market-envanter", baslik: "Off-Market Envanteri", bekle: 6000 },
];

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const tarayici = await chromium.launch();
const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const sayfa = await ctx.newPage();

// Gate oturumu
const cevap = await sayfa.request.post(`${TABAN}/api/gate`, { data: { password: sifre } });
if (!cevap.ok()) throw new Error(`gate başarısız: ${cevap.status()}`);
console.log("oturum açıldı");

for (const s of SAYFALAR) {
  try {
    await sayfa.goto(`${TABAN}${s.yol}`, { waitUntil: "networkidle", timeout: 90000 });
    // Harita: ABD'nin tamamı görünsün diye uzaklaştır (varsayılan tek eyalete odaklı).
    if (s.uzaklas) {
      for (let i = 0; i < s.uzaklas; i++) {
        await sayfa.click(".leaflet-control-zoom-out", { timeout: 5000 }).catch(() => {});
        await sayfa.waitForTimeout(1200);
      }
    }
    await sayfa.waitForTimeout(s.bekle ?? 3500);
    const dosya = path.join(OUT, `${s.ad}.png`);
    await sayfa.screenshot({ path: dosya });
    console.log(`✔ ${s.ad}  ${s.baslik}`);
  } catch (e) {
    console.log(`✘ ${s.ad} — ${e.message.slice(0, 70)}`);
  }
}

await tarayici.close();
console.log(`\nçıktı: ${OUT}`);
