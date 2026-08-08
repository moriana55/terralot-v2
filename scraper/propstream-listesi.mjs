#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// PROPSTREAM SKIP TRACE LİSTESİ — List Automator'a yüklenecek CSV.
//
//   node scraper/propstream-listesi.mjs            # iki dosya: test(150) + A+ tam
//   node scraper/propstream-listesi.mjs --n 500
//
// PropStream içe aktarma sütunları: sahip adı (ad/soyad ayrı ya da tek alan),
// POSTA adresi (sahibin ulaşılabileceği adres) ve PARSEL adresi ayrı ayrı.
// Skip trace POSTA adresine göre eşleştirme yapıyor — o yüzden posta alanları
// eksiksiz olmalı, boş satır yüklenmez (kredi yakar, eşleşme dönmez).
//
// ── SAHİP ADI AYRIŞTIRMA ────────────────────────────────────────────────────
// Kaynakta ad "SMITH, JOHN" ya da "SMITH JOHN A" gibi kütük biçiminde. Virgüllü
// hali güvenli şekilde bölünür (soyad, ad). Virgülsüzde AYIRMA YAPILMAZ —
// "MARIA DEL CARMEN GARCIA LOPEZ" gibi adlarda yanlış bölme, skip trace'in
// yanlış kişiyi bulmasına yol açar; tek alan olarak bırakmak daha güvenli.
// Şirket sahipli parseller (LLC/TRUST/INC) ayrı işaretlenir: onlarda kişisel
// cep numarası çıkmaz, boşuna kredi harcanmasın diye ayrı dosyaya konur.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";
import { csvAlan, csvSatir } from "./temas-listesi.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CIKTI = resolve(HERE, "..", "deliverables");
const N = Number(process.argv[process.argv.indexOf("--n") + 1]) || 150;

/** Kurum sahipli mi — kişisel cep numarası beklenmez. */
export const kurumMu = (ad) =>
  /\b(LLC|L\.L\.C|INC|CORP|CO|COMPANY|TRUST|TR|ESTATE|LP|LLP|PARTNERSHIP|HOLDINGS|PROPERTIES|INVESTMENTS|BANK|CHURCH|ASSOCIATION|HOA|CITY OF|COUNTY OF|STATE OF)\b/i
    .test(String(ad ?? ""));

/**
 * Kütük adından ad/soyad çıkar.
 *
 * ⚠ CANLI DERS (2026-08-08): önce "virgül yoksa bölme" diye tedbirli
 * davranmıştım. Sonuç: 1.817 kaydın yalnız 135'inde First/Last doluydu ve
 * PropStream **ad/soyad'ı boş olan satırları içeri almadı** — 1.817 yükleme
 * 106 kayda düştü. Birleşik "Owner Name" alanını kullanmıyor. Yani burada
 * bölmemek "güvenli" değil, işi tamamen durduran seçenekti.
 *
 * County kütüklerinin biçimi belli: "SOYAD AD ORTA" (virgülsüz) ya da
 * "SOYAD, AD ORTA" (virgüllü). Önce rol/sıfat ekleri temizlenir:
 * TRUSTEE, ETUX, ETAL, HEIRS, JR/SR/II/III, "&" sonrası ikinci sahip.
 */
const ROL_EKLERI = /\b(TRUSTEES?|TTEE|TR|ETUX|ETVIR|ETAL|ET AL|HEIRS?|ESTATE OF|ESTATE|LIFE|REVOCABLE|LIVING|FAMILY|TRUST|DECD|DECEASED|SURVIVOR|JT|JTWROS)\b/gi;
const KUYRUK_EKLERI = /\b(JR|SR|II|III|IV|MD|DDS|ESQ)\b\.?/gi;

export function adAyir(tam) {
  let s = String(tam ?? "").trim();
  if (!s) return { ad: "", soyad: "", tam: "" };
  const ham = s;
  // Ortak sahiplerde ilkini al — skip trace tek kişiye bakıyor.
  s = s.split(/\s*&\s*|\s*;\s*/)[0];
  s = s.replace(ROL_EKLERI, " ").replace(KUYRUK_EKLERI, " ")
       .replace(/["']/g, " ").replace(/\s+/g, " ").trim();

  const i = s.indexOf(",");
  if (i > 0) {
    const soyad = s.slice(0, i).trim();
    const ad = s.slice(i + 1).trim().split(" ")[0];
    if (soyad && ad) return { ad, soyad, tam: ham };
  }
  // Virgülsüz kütük biçimi: İLK kelime soyadı, İKİNCİ kelime ad.
  const p = s.split(" ").filter(Boolean);
  if (p.length >= 2) return { ad: p[1], soyad: p[0], tam: ham };
  return { ad: "", soyad: p[0] ?? "", tam: ham };
}

const BASLIK = [
  "First Name", "Last Name", "Owner Name",
  "Mailing Address", "Mailing City", "Mailing State", "Mailing Zip",
  "Property Address", "Property City", "Property State",
  "APN", "County", "Acres", "Grade", "Score", "Est Offer", "Est Retail", "Price Basis", "Lead ID",
];

function satirla(r) {
  const { ad, soyad, tam } = adAyir(r.owner);
  return csvSatir([
    ad, soyad, tam,
    r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip,
    r.situs ?? "", "", r.state,
    r.apn, r.county, r.acres, r.grade, r.grade_score,
    r.est_offer, r.est_retail, r.price_basis, r.lead_id,
  ]);
}

function yaz(ad, satirlar) {
  const yol = resolve(CIKTI, ad);
  writeFileSync(yol, [csvSatir(BASLIK), ...satirlar].join("\n") + "\n", "utf8");
  return yol;
}

async function main() {
  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  const { rows } = await db.query(
    `select lead_id, grade, grade_score, state, county, apn, acres, situs,
            owner, mailing_address, mailing_city, mailing_state, mailing_zip,
            est_offer, est_retail, price_basis
       from offmarket_leads
      where grade in ('A+','A')
        and owner is not null and mailing_address is not null
        and mailing_city is not null and mailing_state is not null and mailing_zip is not null
        and price_basis is not null and price_basis <> 'dayanak-yok'
        and est_offer is not null
      order by grade_score desc nulls last`,
  );
  await db.end();
  if (!rows.length) { console.log("kayıt yok."); return; }

  const kisi = rows.filter((r) => !kurumMu(r.owner));
  const kurum = rows.filter((r) => kurumMu(r.owner));
  if (!existsSync(CIKTI)) mkdirSync(CIKTI, { recursive: true });
  const t = new Date().toISOString().slice(0, 10);

  // Skip trace bu hesapta ÜCRETSİZ (Pro planı: 50.000/ay, 48.632 kalan) —
  // küçük test dosyasına gerek yok, tüm çalışılabilir havuz yüklenir.
  // Kurum sahipliler yine AYRI dosyada: kredi derdi yok ama cep numarası
  // beklentisi düşük, sonuç oranını bulandırmasın diye karıştırılmıyor.
  const aplus = kisi.filter((r) => r.grade === "A+");
  const y1 = yaz(`propstream-SAHIS-Aplus-${aplus.length}-${t}.csv`, aplus.map(satirla));
  const y2 = yaz(`propstream-SAHIS-TUM-${kisi.length}-${t}.csv`, kisi.map(satirla));
  const y3 = kurum.length ? yaz(`propstream-KURUM-${kurum.length}-${t}.csv`, kurum.map(satirla)) : null;

    console.log(`A+ toplam (çalışılabilir) : ${rows.length.toLocaleString("tr-TR")}`);
  console.log(`  şahıs sahipli           : ${kisi.length.toLocaleString("tr-TR")}   ← skip trace bunlara`);
  console.log(`  kurum sahipli (LLC/TRUST): ${kurum.length.toLocaleString("tr-TR")}   ← cep çıkmaz, ayrı dosya`);
  console.log();
  console.log(`✔ ŞAHIS · A+  (${aplus.length})   → ${y1}   ← önce bunu yükle`);
  console.log(`✔ ŞAHIS · A+/A (${kisi.length}) → ${y2}`);
  if (y3) console.log(`✔ KURUM       (${kurum.length}) → ${y3}   (ayrı yükle, cep beklentisi düşük)`);
  console.log(`\n  toplam ${rows.length} kayıt · skip trace hakkı 48.632 → hepsi ücretsiz`);
  console.log();
  console.log("PropStream'de: List Automator → Import List → CSV yükle → sütunları eşle → Skip Trace.");
  console.log("⚠ Skip trace ayarında CEP/SABİT ayrımını ve DNC bayrağını AÇIK bırak (SMS için şart).");
}

if (process.argv[1] && process.argv[1].endsWith("propstream-listesi.mjs")) await main();
