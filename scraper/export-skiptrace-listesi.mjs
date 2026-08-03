#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SKIP-TRACE LİSTESİ EXPORT — sağlayıcıya verilecek hazır CSV.
//
// İHTİYAÇ (Ahmet): "bize adamın adı soyadı ve yeri lazım, biz SMS atacağız."
// Skip-trace servisi telefonu AD + ADRES eşleşmesiyle bulur. Bu betik o iki
// alanı en dolu olan dilimi seçip sağlayıcı formatında CSV üretir.
//
// ── KİMİ SEÇİYOR, NEDEN ─────────────────────────────────────────────────────
//  1) grade A+ veya A  → en iyi parseller; 921K'nın tamamı skip-trace edilmez,
//     kayıt başına ücret var.
//  2) ŞAHIS sahipli    → skip-trace gerçek kişide çalışır. LLC/INC/TRUST'ta
//     telefon çıkmaz (şirket kaydı gerekir, o ayrı iş) → varsayılan olarak elenir.
//     KURUMSAL=1 ile dahil edilebilir.
//  3) Adres alanı dolu → posta adresi VEYA mülk adresi. İkisi de yoksa
//     eşleşme şansı çok düşük, boşuna para gider → elenir.
//
// ── ÇIKTI ───────────────────────────────────────────────────────────────────
// Sağlayıcıların (PropStream/BatchData/Skip Genie) beklediği standart kolonlar:
//   First Name, Last Name, Mailing Address/City/State/Zip,
//   Property Address/City/State, APN, County, Acres, Grade
// Ad ayrıştırma: kamu kaydı "SOYAD ADı" veya "ADı SOYAD" karışık gelir; ikisi
// de denenir, ayrıştırılamayan tam ad "Last Name" alanına yazılır (sağlayıcılar
// tam adı da kabul eder) ve `AdAyristi` sütununda işaretlenir — sessiz veri
// bozulması olmasın.
//
// Çalıştır:  node scraper/export-skiptrace-listesi.mjs
//            LIMIT=5000 node scraper/export-skiptrace-listesi.mjs   (deneme partisi)
//            KURUMSAL=1 ...                                          (şirketleri de al)
//            NOT=B ...                                               (B notunu da al)
// Çıktı:     scraper/out/skiptrace-<tarih>-<adet>.csv
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTDIR = path.join(HERE, "out");
const LIMIT = parseInt(process.env.LIMIT || "0", 10);
const KURUMSAL = process.env.KURUMSAL === "1";
const NOTLAR = (process.env.NOT || "A+,A").split(",").map((s) => s.trim()).filter(Boolean);

// Şirket/kurum sahipli kayıtlar — skip-trace'te telefon çıkmaz, para boşa gider.
// Liste gerçek çıktı denetlenerek genişletildi: ilk turda "CENTRAL GA JOINT DEV
// AUTH" (kısaltılmış AUTHORITY) ve "#3 REICM" (harfle başlamayan çöp kayıt)
// şahıs sanılıp listeye girmişti.
const SIRKET_RE = new RegExp([
  "LLC", "L\\.L\\.C", "\\bLLP\\b", "\\bPLLC\\b", "\\bINC\\b", "CORP", "COMPANY", "\\bCO\\b",
  "TRUST", "\\bLTD\\b", "\\bLP\\b", "HOLDING", "PROPERTIES", "PROPERTY", "CAPITAL",
  "INVEST", "GROUP", "VENTURES", "PARTNERS", "ACQUISITION", "\\bFUND\\b", "EQUITY",
  "BANK", "CHURCH", "MINISTR", "FOUNDATION", "CEMETERY", "SCHOOL", "DISTRICT",
  "COUNTY", "STATE OF", "CITY OF", "TOWN OF", "VILLAGE OF", "UNITED STATES",
  "ASSOCIATION", "\\bHOA\\b", "\\bPOA\\b", "AUTHORITY", "\\bAUTH\\b", "COMMISSION",
  "\\bDEV\\b", "DEVELOPMENT", "ENTERPRISE", "MANAGEMENT", "REALTY", "BUILDERS?\\b",
  "\\bHOMES\\b", "\\bFARMS\\b", "RAILROAD", "UTILITY", "ESTATE OF", "TIMBER",
  "WATER", "\\bLAND\\b", "RANCH", "MINING", "\\bOIL\\b", "\\bGAS\\b",
].join("|"), "i");

// Harfle başlamayan kayıt ("#3 REICM", "2020 LAND") kişi adı değildir.
// Kişi adı harfle başlar ve içinde "#" / uzun rakam dizisi geçmez
// ("REICM #3" gibi kayıtlar şahıs değil, birim/parsel etiketidir).
const KISI_GIBI = (ad) => {
  const t = String(ad ?? "").trim();
  return /^[A-Za-z]/.test(t) && !/#|\d{3,}/.test(t);
};

// Sahip adını skip-trace'in eşleştirebileceği ad/soyad çiftine çevir.
//
// ABD tapu kayıtlarının ezici çoğunluğu "SOYAD AD ORTAADI" düzeninde tutulur
// (assessor roll geleneği). Ayrıştırmadan önce iki temizlik şart:
//   • ORTAK SAHİPLER: "KIM DOUGLAS & KIM HAE KYUNG" → ilk kişi alınır. Skip-trace
//     tek kişi bekler; iki adı birlikte göndermek eşleşmeyi düşürür.
//   • EKLER: JR/SR/II/III/ETAL/TRUSTEE/LIFE ESTATE gibi kuyruklar ad sanılıp
//     "First Name = JUNIOR" gibi çöp üretiyordu.
// Bunlardan sonra 2-3 kelimelik ad güvenle bölünebilir. Daha uzun/belirsiz
// kalanlar TAM AD olarak gider (sağlayıcılar kabul eder) ve işaretlenir —
// uydurma bölme yapılmaz.
const EK_RE = /\b(JR|SR|II|III|IV|JUNIOR|SENIOR|ET\s*AL|ETAL|ETUX|ET\s*UX|TRUSTEE|TRUSTEES|LIFE\s*ESTATE|LE|REVOCABLE|LIVING)\b\.?/gi;

function adAyir(tam) {
  let t = String(tam ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { ad: "", soyad: "", ayristi: false };

  // Ortak sahip → ilk kişi.
  t = t.split(/\s*(?:&| AND )\s*/i)[0].trim();
  // Ekleri at, artakalan noktalama temizle.
  t = t.replace(EK_RE, " ").replace(/\s+/g, " ").replace(/[.,]+$/, "").trim();
  if (!t) return { ad: "", soyad: String(tam).trim(), ayristi: false };

  // "SOYAD, AD" — virgül varsa düzen kesin.
  if (t.includes(",")) {
    const [soyad, kalan] = t.split(",", 2);
    const ad = (kalan || "").trim().split(" ")[0] || "";
    if (soyad.trim() && ad) return { ad, soyad: soyad.trim(), ayristi: true };
  }

  const p = t.split(" ").filter(Boolean);
  // "SOYAD AD" ve "SOYAD AD ORTAADI" — ikisinde de ilk kelime soyad, ikincisi ad.
  if (p.length === 2 || p.length === 3) return { ad: p[1], soyad: p[0], ayristi: true };
  return { ad: "", soyad: t, ayristi: false };
}

const esc = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();

const rows = (await client.query(
  `select lead_id, state, county, apn, owner, acres, grade, grade_score, absentee,
          mailing_address, mailing_city, mailing_state, mailing_zip, situs, lat, lng
   from offmarket_leads
   where grade = any($1)
     and owner is not null and length(owner) > 3
     and (mailing_address is not null or (situs is not null and situs <> ''))
   order by grade_score desc nulls last
   ${LIMIT ? "limit " + LIMIT : ""}`,
  [NOTLAR]
)).rows;

let elenenSirket = 0;
// TEKİLLEŞTİRME: skip-trace KAYIT BAŞINA ücretlidir. Aynı kişi 40 parsele sahipse
// 40 kez sorgulamak 40 kat para demek — telefon zaten aynı. Kişi başına tek satır
// gönderilir, kaç parseli olduğu ParcelCount'ta durur (çok parselli sahip zaten
// daha değerli bir görüşme).
const kisiler = new Map();
for (const r of rows) {
  const sirket = SIRKET_RE.test(r.owner) || !KISI_GIBI(r.owner);
  if (sirket && !KURUMSAL) { elenenSirket++; continue; }
  const { ad, soyad, ayristi } = adAyir(r.owner);
  const anahtar = [
    String(r.owner).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    String(r.mailing_address ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
  ].join("|");

  const mevcut = kisiler.get(anahtar);
  if (mevcut) {
    mevcut.ParcelCount++;
    mevcut.TotalAcres += Number(r.acres) || 0;
    // Örnek parsel olarak en iyi notlusu kalsın (görüşmede o konuşulur).
    if ((Number(r.grade_score) || 0) > (Number(mevcut.Score) || 0)) {
      Object.assign(mevcut, {
        "Property Address": r.situs ?? "", "Property County": r.county ?? "",
        "Property State": r.state ?? "", APN: r.apn ?? "", Grade: r.grade ?? "",
        Score: r.grade_score ?? "", Lat: r.lat ?? "", Lng: r.lng ?? "", LeadId: r.lead_id,
      });
    }
    continue;
  }

  kisiler.set(anahtar, {
    "First Name": sirket ? "" : ad,
    "Last Name": sirket ? r.owner : soyad,
    "Full Name": r.owner,
    "Mailing Address": r.mailing_address ?? "",
    "Mailing City": r.mailing_city ?? "",
    "Mailing State": r.mailing_state ?? "",
    "Mailing Zip": r.mailing_zip ?? "",
    "Property Address": r.situs ?? "",
    "Property County": r.county ?? "",
    "Property State": r.state ?? "",
    APN: r.apn ?? "",
    ParcelCount: 1,
    TotalAcres: Number(r.acres) || 0,
    Grade: r.grade ?? "",
    Score: r.grade_score ?? "",
    Absentee: r.absentee === true ? "yes" : r.absentee === false ? "no" : "",
    Lat: r.lat ?? "",
    Lng: r.lng ?? "",
    LeadId: r.lead_id,
    AdAyristi: ayristi ? "yes" : "no",
    SahipTipi: sirket ? "company" : "person",
  });
}
const cikti = [...kisiler.values()]
  .map((o) => ({ ...o, TotalAcres: Math.round(o.TotalAcres * 100) / 100 }))
  .sort((a, b) => (Number(b.Score) || 0) - (Number(a.Score) || 0));

if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
const bas = cikti.length ? Object.keys(cikti[0]) : [];
const csv = [bas.join(","), ...cikti.map((o) => bas.map((k) => esc(o[k])).join(","))].join("\r\n");
const tarih = new Date().toISOString().slice(0, 10);
const dosya = path.join(OUTDIR, `skiptrace-${tarih}-${cikti.length}.csv`);
writeFileSync(dosya, "﻿" + csv);

// Kalite özeti — sağlayıcıya vermeden önce ne kadarının eşleşme şansı yüksek.
const postaVar = cikti.filter((o) => o["Mailing Address"]).length;
const mulkVar = cikti.filter((o) => o["Property Address"]).length;
const adBolundu = cikti.filter((o) => o.AdAyristi === "yes").length;
const absentee = cikti.filter((o) => o.Absentee === "yes").length;

await client.end();

console.log(`\n✔ ${dosya}`);
console.log(`  parsel: ${rows.length.toLocaleString("en-US")} → TEKİL KİŞİ: ${cikti.length.toLocaleString("en-US")} (skip-trace bu kadarına ödenir)  (not: ${NOTLAR.join("/")}${KURUMSAL ? ", şirketler dahil" : ""})`);
console.log(`  elenen şirket sahipli: ${elenenSirket.toLocaleString("en-US")}${KURUMSAL ? " (dahil edildi)" : ""}`);
console.log(`  posta adresi olan   : ${postaVar.toLocaleString("en-US")} (%${Math.round((postaVar / cikti.length) * 100)})`);
console.log(`  mülk adresi olan    : ${mulkVar.toLocaleString("en-US")} (%${Math.round((mulkVar / cikti.length) * 100)})`);
console.log(`  ad/soyad ayrıştı    : ${adBolundu.toLocaleString("en-US")} (%${Math.round((adBolundu / cikti.length) * 100)}) — kalanı tam ad olarak gitti`);
console.log(`  absentee (bölge dışı): ${absentee.toLocaleString("en-US")}`);
console.log(`\n  Telefon geldikten sonra: node scraper/load-skiptrace.mjs <dosya.xlsx>`);
