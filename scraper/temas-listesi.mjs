#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TEMAS LİSTESİ — skip trace ve mektup/arama kampanyası için dışa aktarım.
//
//   node scraper/temas-listesi.mjs                    # A+ ve A, çalışılabilir olanlar
//   node scraper/temas-listesi.mjs --grade A+         # yalnız A+
//   LIMIT=5000 node scraper/temas-listesi.mjs         # ilk 5.000 (skor sırası)
//   node scraper/temas-listesi.mjs --state TX
//
// Çıktı: deliverables/temas-<tarih>.csv  (skip trace servislerinin beklediği
// sütun düzeni: ad + posta adresi + şehir + eyalet + zip; arkasından bizim
// kampanya alanlarımız).
//
// ── "ÇALIŞILABİLİR" TANIMI (bu filtre gevşetilmez) ──────────────────────────
//   1. owner + mailing_address dolu  → adresi olmayana ulaşılamaz. AR ve TN
//      kaynaklarında 4.317 A+/A kaydın sahibi/adresi YOK; vitrinde dururlar
//      ama kampanyaya GİREMEZLER.
//   2. price_basis <> 'dayanak-yok'  → fiyatı uydurma olan parsele teklif
//      mektubu gitmez. (Eski `sabit-2999` fiyatları 2026-08-07'de kaldırıldı.)
//   3. est_offer dolu                → teklif hesaplanamamışsa gönderilecek
//      rakam yok demektir.
//
// ── NEDEN ÖNCE MEKTUP, SONRA TELEFON ────────────────────────────────────────
// Skip trace kayıt başına ~$0,07-0,15. 477 bin kaydın hepsini çekmek $33-57 bin
// eder ve çoğu hiç aranmaz. Doğru sıra: bu listeyi gönder → CEVAP VERENLERİ
// skip trace ettir. Bu dosya ikisine de hazır: skip trace servisine olduğu gibi
// yüklenir, mektup birleştirmesine de aynı sütunlardan beslenir.
//
// ⚠ TELEFON/SMS UYARISI: ABD'de izinsiz pazarlama SMS'i TCPA kapsamında ve
// mesaj başına $500-1.500 tazminatlı; operatörler de A2P kaydı olmayan soğuk
// kampanyaları filtreliyor. Numara elde edilince DNC taraması yapılmadan
// aranmaz/mesaj atılmaz.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CIKTI_DIR = resolve(HERE, "..", "deliverables");

const arg = (ad) => {
  const i = process.argv.indexOf(ad);
  return i > -1 ? process.argv[i + 1] : null;
};
const GRADE = arg("--grade");
const STATE = arg("--state");
const LIMIT = Number(process.env.LIMIT || 0);

/** CSV alanı — virgül/tırnak/satır sonu içeren değer tırnaklanır. */
export function csvAlan(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvSatir = (a) => a.map(csvAlan).join(",");

const BASLIK = [
  // ── Skip trace servislerinin beklediği düzen ──
  "owner_name", "mailing_address", "mailing_city", "mailing_state", "mailing_zip",
  // ── Kampanya alanları ──
  "lead_id", "grade", "grade_score", "state", "county", "apn", "acres",
  "est_offer", "est_retail", "price_basis", "land_value", "absentee",
  "dist_road_m", "dist_town_m", "lat", "lng", "google_maps",
];

async function main() {
  const kosullar = [
    "owner is not null", "mailing_address is not null", "mailing_city is not null",
    "mailing_state is not null", "mailing_zip is not null",
    "price_basis is not null", "price_basis <> 'dayanak-yok'",
    "est_offer is not null",
    GRADE ? `grade = '${GRADE.replace(/'/g, "")}'` : "grade in ('A+','A')",
  ];
  if (STATE) kosullar.push(`state = '${STATE.replace(/'/g, "")}'`);

  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  const { rows } = await db.query(
    `select lead_id, grade, grade_score, state, county, apn, acres,
            owner, mailing_address, mailing_city, mailing_state, mailing_zip,
            est_offer, est_retail, price_basis, land_value, absentee,
            dist_road_m, dist_town_m, lat, lng
       from offmarket_leads
      where ${kosullar.join(" and ")}
      order by (grade = 'A+') desc, grade_score desc nulls last
      ${LIMIT ? `limit ${LIMIT}` : ""}`,
  );
  await db.end();

  if (!rows.length) { console.log("eşleşen kayıt yok."); return; }

  const satirlar = [csvSatir(BASLIK)];
  const dagilim = {}, eyalet = {};
  for (const r of rows) {
    dagilim[r.price_basis] = (dagilim[r.price_basis] ?? 0) + 1;
    eyalet[r.state] = (eyalet[r.state] ?? 0) + 1;
    satirlar.push(csvSatir([
      r.owner, r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip,
      r.lead_id, r.grade, r.grade_score, r.state, r.county, r.apn, r.acres,
      r.est_offer, r.est_retail, r.price_basis, r.land_value, r.absentee,
      r.dist_road_m, r.dist_town_m, r.lat, r.lng,
      // Pinli uydu görüntüsü — sahibi aranırken parseli açıp bakmak için.
      r.lat != null && r.lng != null
        ? `https://www.google.com/maps/place/${r.lat},${r.lng}/@${r.lat},${r.lng},1200m/data=!3m1!1e3`
        : "",
    ]));
  }

  if (!existsSync(CIKTI_DIR)) mkdirSync(CIKTI_DIR, { recursive: true });
  const tarih = new Date().toISOString().slice(0, 10);
  const ad = `temas-${tarih}${GRADE ? `-${GRADE.replace("+", "plus")}` : ""}${STATE ? `-${STATE}` : ""}.csv`;
  const yol = resolve(CIKTI_DIR, ad);
  writeFileSync(yol, satirlar.join("\n") + "\n", "utf8");

  const teklifToplam = rows.reduce((s, r) => s + Number(r.est_offer ?? 0), 0);
  console.log(`✔ ${yol}`);
  console.log(`  kayıt            : ${rows.length.toLocaleString("tr-TR")}`);
  console.log(`  A+ / A           : ${rows.filter((r) => r.grade === "A+").length} / ${rows.filter((r) => r.grade === "A").length}`);
  console.log(`  toplam teklif    : $${Math.round(teklifToplam).toLocaleString("en-US")}  (hepsi kabul edilseydi)`);
  console.log(`  ortalama teklif  : $${Math.round(teklifToplam / rows.length).toLocaleString("en-US")}`);
  console.log(`\n  fiyat dayanağı   : ${Object.entries(dagilim).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  eyalet           : ${Object.entries(eyalet).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join("  ")}`);
  console.log(`\n  skip trace tahmini maliyet: $${(rows.length * 0.07).toFixed(0)} – $${(rows.length * 0.15).toFixed(0)}`);
  console.log(`  (eşleşme başına ödeyen serviste yalnız bulunan numaralar faturalanır)`);
}

if (process.argv[1] && process.argv[1].endsWith("temas-listesi.mjs")) await main();
