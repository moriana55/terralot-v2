#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SATIŞ KANITI — "bu arsalar gerçekten satılıyor mu, kaça?" sorusunun cevabı.
//
//   node scraper/satis-kaniti.mjs              # rapor + CSV
//   node scraper/satis-kaniti.mjs --ay 24      # son 24 ay (varsayılan 24)
//
// NEDEN: müşteri (Ahmet) envanterin büyüklüğüyle değil SATILABİLİRLİĞİYLE
// ilgileniyor. Rakip analizinden "şu firma şu kadar kâr ediyor" çıkarmaya
// çalışmak iki kez elimizde patladı (Mohave, Gokce) çünkü tapudaki bedel
// piyasa alımı olmayabiliyor. Bu rapor rakip yorumu YAPMAZ; yalnız county
// sicilindeki GERÇEKLEŞMİŞ, PİYASA KOŞULLU satışları sayar.
//
// ── DÜRÜSTLÜK FİLTRELERİ ────────────────────────────────────────────────────
//  · qual_code = '01' → FL DOR kod listesinde "qualified sale" = kol mesafesi
//    piyasa satışı. 11 (quit-claim / vergi tapusu / düzeltme tapusu) DIŞARIDA:
//    Gokce'nin 10 parselinin 10'u da 11'di ve o rakamlar alım fiyatı DEĞİLDİ.
//  · vacant = true → boş arsa; üzerinde yapı olan satış $/dönüm'ü şişirir.
//  · sale_year gerçekçi aralıkta (kaynakta 2096 gibi bozuk yıllar var).
//  · county-içi P10-P90 kırpma → tek bir sahil/şehir lotu medyanı uçurmasın.
//  · Örneklem < 8 olan county RAPORA GİRMEZ (tek satıştan "piyasa" çıkarılmaz).
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CIKTI = resolve(HERE, "..", "deliverables");
const AY = Number(process.argv[process.argv.indexOf("--ay") + 1]) || 24;
const MIN_SATIS = 8;

const med = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const kirp = (a) => { const b = [...a].sort((x, y) => x - y); return b.slice(Math.floor(b.length * 0.1), Math.ceil(b.length * 0.9)); };
const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");

/**
 * FL DOR county kodu → ad. land_comps.county_key "FL:46" biçiminde saklıyor.
 * Doğrulama: teklif-motoru.mjs'te elle yazılmış 17 kodun tamamı bu listeyle
 * birebir uyuşuyor (11 Alachua, 18 Charlotte, 46 Lee, 52 Marion, 64 Putnam …).
 */
export const FL_COUNTY = {
  11: "Alachua", 12: "Baker", 13: "Bay", 14: "Bradford", 15: "Brevard", 16: "Broward",
  17: "Calhoun", 18: "Charlotte", 19: "Citrus", 20: "Clay", 21: "Collier", 22: "Columbia",
  23: "Miami-Dade", 24: "DeSoto", 25: "Dixie", 26: "Duval", 27: "Escambia", 28: "Flagler",
  29: "Franklin", 30: "Gadsden", 31: "Gilchrist", 32: "Glades", 33: "Gulf", 34: "Hamilton",
  35: "Hardee", 36: "Hendry", 37: "Hernando", 38: "Highlands", 39: "Hillsborough",
  40: "Holmes", 41: "Indian River", 42: "Jackson", 43: "Jefferson", 44: "Lafayette",
  45: "Lake", 46: "Lee", 47: "Leon", 48: "Levy", 49: "Liberty", 50: "Madison",
  51: "Manatee", 52: "Marion", 53: "Martin", 54: "Monroe", 55: "Nassau", 56: "Okaloosa",
  57: "Okeechobee", 58: "Orange", 59: "Osceola", 60: "Palm Beach", 61: "Pasco",
  62: "Pinellas", 63: "Polk", 64: "Putnam", 65: "St. Johns", 66: "St. Lucie",
  67: "Santa Rosa", 68: "Sarasota", 69: "Seminole", 70: "Sumter", 71: "Suwannee",
  72: "Taylor", 73: "Union", 74: "Volusia", 75: "Wakulla", 76: "Walton", 77: "Washington",
};
export const countyAdi = (state, key) => {
  const ham = String(key ?? "").split(":").pop().trim();
  if (state === "FL" && /^\d+$/.test(ham)) return FL_COUNTY[Number(ham)] ?? `FL-${ham}`;
  return ham;
};

export function bantAdi(acres) {
  if (acres <= 0.25) return "0-0,25 ac";
  if (acres <= 0.5) return "0,25-0,5 ac";
  if (acres <= 1.5) return "0,5-1,5 ac";
  if (acres <= 5) return "1,5-5 ac";
  return "5+ ac";
}

async function main() {
  const simdi = new Date();
  const enErken = simdi.getFullYear() - Math.ceil(AY / 12);
  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();

  const { rows } = await db.query(
    `select state, county_key, acres::float8 acres, sale_price::float8 fiyat, sale_year
       from land_comps
      where qual_code = '01' and vacant = true
        and sale_price > 500 and acres > 0
        and sale_year between $1 and $2`,
    [enErken, simdi.getFullYear()],
  );
  // BİZİM ENVANTERİMİZDEKİ county'ler — Ahmet'e "satılıyor" kanıtı ancak
  // ELİMİZDEKİ parsellerin bulunduğu yerler için anlamlı. Palm Beach'te arsa
  // satılması bizim Putnam'daki parselimiz hakkında hiçbir şey söylemez.
  const { rows: bizim } = await db.query(
    "select distinct state, upper(regexp_replace(county,'\\s+(County|Parish).*$','')) c from offmarket_leads where county is not null");
  const bizimSet = new Set(bizim.map((r) => `${r.state}|${r.c}`));
  await db.end();
  console.log(`kol mesafesi (QUAL 01) boş arsa satışı, ${enErken}-${simdi.getFullYear()}: ${rows.length.toLocaleString("tr-TR")}\n`);

  const kova = new Map();
  for (const r of rows) {
    const k = `${r.state}|${countyAdi(r.state, r.county_key)}|${bantAdi(r.acres)}`;
    if (!kova.has(k)) kova.set(k, []);
    kova.get(k).push({ fiyat: r.fiyat, ppa: r.fiyat / r.acres });
  }

  const satirlar = [["eyalet", "county", "bant", "satis_adedi", "medyan_fiyat", "medyan_usd_donum"].join(",")];
  const rapor = [];
  for (const [k, arr] of kova) {
    if (arr.length < MIN_SATIS) continue;
    const [state, county, bant] = k.split("|");
    if (!bizimSet.has(`${state}|${county.toUpperCase()}`)) continue;
    const f = kirp(arr.map((x) => x.fiyat));
    const p = kirp(arr.map((x) => x.ppa));
    if (!f.length || !p.length) continue;
    rapor.push({ state, county, bant, n: arr.length, medF: med(f), medP: med(p) });
  }
  rapor.sort((a, b) => b.n - a.n);
  for (const r of rapor) satirlar.push([r.state, r.county, r.bant, r.n, Math.round(r.medF), Math.round(r.medP)].join(","));

  if (!existsSync(CIKTI)) mkdirSync(CIKTI, { recursive: true });
  const yol = resolve(CIKTI, `satis-kaniti-${simdi.toISOString().slice(0, 10)}.csv`);
  writeFileSync(yol, satirlar.join("\n") + "\n", "utf8");

  const toplamSatis = rapor.reduce((s, r) => s + r.n, 0);
  console.log(`county × bant (≥${MIN_SATIS} satış): ${rapor.length}`);
  console.log(`kapsanan satış  : ${toplamSatis.toLocaleString("tr-TR")}\n`);
  console.log("EYALET COUNTY          BANT          SATIŞ   MEDYAN FİYAT   MEDYAN $/DÖNÜM");
  for (const r of rapor.slice(0, 25)) {
    console.log(
      `  ${r.state}   ${r.county.padEnd(16).slice(0, 16)} ${r.bant.padEnd(12)} ${String(r.n).padStart(5)}   ${usd(r.medF).padStart(12)}   ${usd(r.medP).padStart(14)}`,
    );
  }
  console.log(`\n✔ ${yol}`);
}

if (process.argv[1] && process.argv[1].endsWith("satis-kaniti.mjs")) await main();
