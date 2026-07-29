#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TEKLİF MOTORU — her lead için piyasa değerinden GERİYE hesaplanan teklif.
//
//   node scraper/teklif-motoru.mjs --dry     # rapor
//   node scraper/teklif-motoru.mjs           # offmarket_leads'e yaz
//
// NEDEN: est_offer bugüne kadar her yerde SABİT $1.200'dü. Lee County'de
// $34.782'lik arsaya da $1.200, Dixie'de $2.038'lik arsaya da $1.200 —
// ilkinde gülünç düşük (sahip cevap vermez), ikincisinde değerin %59'u (kâr yok).
//
// FORMÜL:  baz = teklif + FIXED_COST ; satış/baz ≥ hedef çarpan
//          → teklif ≤ (piyasa ÷ çarpan) − FIXED_COST
//
// PİYASA DEĞERİ: county × DÖNÜM BANDI medyanı, GERÇEK satışlardan (land_comps).
// County medyan $/dönümü kullanmak yanlış olurdu — küçük parsel dönüm başına
// daha pahalıdır, banda ayırmadan kıyas sistematik hata üretir.
//
// HEDEF ÇARPAN: sabit maliyet küçük işlemde daha ağır bastığı için banda göre
// değişir (bkz. YATIRIM-ELEME-METODU.md §1).
//
// ⚠️ 1,5 dönüm ÜSTÜ parsellerde geliştiriciler prim ödüyor (Charlotte 5-40 ac:
// şirket alıcı şahıstan %66 fazla veriyor) — o bantta rekabet edemeyiz,
// teklif üretilmez. Bizim alanımız 0-1,5 dönüm.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const DRY = process.argv.includes("--dry");
const FIXED_COST = 2000;

// Dönüm bandı → (min çarpan, üst sınır dönüm). Küçük işlem daha yüksek çarpan ister.
const BANDS = [
  { ad: "0-0,25 ac", lo: 0.001, hi: 0.25, carpan: 2.5 },
  { ad: "0,25-0,5", lo: 0.25, hi: 0.5, carpan: 2.3 },
  { ad: "0,5-1,5", lo: 0.5, hi: 1.5, carpan: 2.0 },
];
const MIN_COMP = 8;      // banda güvenmek için gereken gerçek satış sayısı
const MIN_TEKLIF = 500;  // altına düşen teklif gönderilmez (posta masrafını çıkarmaz)
// AKIL SAĞLIĞI FRENİ: bant medyanı o parselin kendi assessed değeriyle
// tutarsızsa comp havuzuna yabancı ürün karışmış demektir (Bay=Panama City
// Beach sahil lotları $351K, Alachua=Gainesville şehir içi $305K çıkıyordu —
// çeyrek dönüme $138.600 teklif mektubu gidecekti). Teklif, parselin KENDİ
// assessed değerinin bu katını aşamaz; aşarsa lead atlanır (uydurma yok).
const ASSESSED_TAVAN = 2.0;

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const pct = (a, p) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const usd = (v) => (v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US"));

/** SAF: piyasa değeri + banda göre teklif. Muhafazakâr taraf P25 kullanır. */
export function hesapla(piyasaP25, carpan) {
  if (!piyasaP25 || piyasaP25 <= 0) return null;
  const teklif = piyasaP25 / carpan - FIXED_COST;
  return teklif >= MIN_TEKLIF ? Math.round(teklif / 50) * 50 : null; // 50'ye yuvarla
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg: ${e.message}`));

  // FL county kodu → ad eşlemesi (land_comps county_key 'FL:18' biçiminde).
  const FL = { 11:"Alachua",13:"Bay",14:"Bradford",15:"Brevard",17:"Calhoun",18:"Charlotte",19:"Citrus",
    36:"Hendry",37:"Hernando",38:"Highlands",45:"Lake",46:"Lee",48:"Levy",52:"Marion",57:"Okeechobee",
    63:"Polk",64:"Putnam" };

  // 1) Gerçek satışlardan county × bant piyasa tablosu.
  const { rows: comps } = await pool.query(
    `select county_key, acres::float8 acres, sale_price::float8 fiyat
     from land_comps where state='FL' and sale_price > 1000 and acres > 0`);
  const piyasa = new Map(); // "County|bant" → { p25, med, n }
  const kova = new Map();
  for (const c of comps) {
    const co = Number(String(c.county_key).replace("FL:", ""));
    const ad = FL[co]; if (!ad) continue;
    const b = BANDS.find((x) => c.acres > x.lo && c.acres <= x.hi); if (!b) continue;
    const k = `${ad}|${b.ad}`;
    if (!kova.has(k)) kova.set(k, []);
    kova.get(k).push(c.fiyat);
  }
  for (const [k, arr] of kova) {
    if (arr.length < MIN_COMP) continue;
    piyasa.set(k, { p25: pct(arr, 0.25), med: med(arr), n: arr.length });
  }
  console.log(`piyasa tablosu: ${piyasa.size} county×bant (≥${MIN_COMP} gerçek satış)\n`);

  // 2) Lead'lere uygula.
  const { rows: leads } = await pool.query(
    `select lead_id, county, acres::float8 acres, est_offer::float8 eski,
            land_value::float8 assessed
     from offmarket_leads where state='FL' and acres > 0`);

  const guncel = [];
  const fiyatlanamaz = [];  // comp'a dayanmayan uydurma fiyat BIRAKMA — NULL'a çek
  const ozet = new Map();
  let bandDisi = 0, piyasaYok = 0, assessedFren = 0, assessedYok = 0;
  for (const l of leads) {
    const b = BANDS.find((x) => l.acres > x.lo && l.acres <= x.hi);
    if (!b) { bandDisi++; fiyatlanamaz.push(l.lead_id); continue; }  // 1,5 ac üstü: geliştirici bölgesi
    const ad = String(l.county ?? "").replace(/\s+County.*$/i, "").trim();
    const p = piyasa.get(`${ad}|${b.ad}`);
    if (!p) { piyasaYok++; fiyatlanamaz.push(l.lead_id); continue; }
    let teklif = hesapla(p.p25, b.carpan);
    if (teklif == null) continue;
    // Parselin kendi assessed değeriyle çapraz kontrol.
    if (l.assessed > 0) {
      const tavan = l.assessed * ASSESSED_TAVAN;
      if (teklif > tavan) { assessedFren++; fiyatlanamaz.push(l.lead_id); continue; }
    } else { assessedYok++; fiyatlanamaz.push(l.lead_id); continue; }
    // est_retail de comp'tan gelir. Eskiden 2999 sabitiydi; teklif comp'a
    // geçince "3.200'e al, 2.099'a sat" gibi NEGATİF marjlar oluştu (45.321 lead).
    // İkisi aynı kaynaktan gelmeli: retail = bant P25 (muhafazakâr ARV).
    guncel.push({ id: l.lead_id, teklif, retail: Math.round(p.p25) });
    const k = `${ad}|${b.ad}`;
    if (!ozet.has(k)) ozet.set(k, { county: ad, bant: b.ad, n: 0, teklif, p25: p.p25, med: p.med, comps: p.n, eski: l.eski });
    ozet.get(k).n++;
  }

  console.log("COUNTY      BANT        LEAD   comp   PİYASA P25   YENİ TEKLİF   ESKİ    ÇARPAN");
  for (const s of [...ozet.values()].sort((a, b) => b.n - a.n)) {
    const bandCarpan = BANDS.find((x) => x.ad === s.bant).carpan;
    console.log("  " + s.county.padEnd(11) + s.bant.padEnd(11) + String(s.n).padStart(6) +
      String(s.comps).padStart(7) + usd(s.p25).padStart(13) + usd(s.teklif).padStart(14) +
      usd(s.eski).padStart(8) + `   ${bandCarpan}x`);
  }
  console.log(`\nteklif üretilen lead: ${guncel.length}`);
  console.log(`  bant dışı (1,5 ac üstü — geliştirici bölgesi, atlandı): ${bandDisi}`);
  console.log(`  piyasa verisi yetersiz county×bant: ${piyasaYok}`);
  console.log(`  assessed freni (bant medyanı parselin değeriyle tutarsız): ${assessedFren}`);
  console.log(`  assessed değeri olmayan (teklif üretilemez): ${assessedYok}`);

  if (!DRY) {
    // ÖZET TABLOSU: UI'ın 54K satırı sayfalayıp medyan hesaplamasına gerek yok
    // (offmarket_leads'i lead_id'ye göre sıralamak PostgREST'te statement timeout
    // veriyor). Ağır hesap burada, ekran küçük tabloyu okur.
    await pool.query(`
      create table if not exists offer_summary (
        county text not null, bant text not null,
        lead_n int, comp_n int, piyasa_p25 numeric, piyasa_med numeric,
        carpan numeric, teklif numeric, built_at timestamptz default now(),
        primary key (county, bant)
      );`);
    await pool.query("delete from offer_summary");
    for (const s2 of ozet.values()) {
      const bc = BANDS.find((x) => x.ad === s2.bant).carpan;
      await pool.query(
        `insert into offer_summary (county,bant,lead_n,comp_n,piyasa_p25,piyasa_med,carpan,teklif)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (county,bant) do update set lead_n=excluded.lead_n, comp_n=excluded.comp_n,
           piyasa_p25=excluded.piyasa_p25, piyasa_med=excluded.piyasa_med,
           carpan=excluded.carpan, teklif=excluded.teklif, built_at=now()`,
        [s2.county, s2.bant, s2.n, s2.comps, s2.p25, s2.med, bc, s2.teklif]);
    }
    console.log(`✓ offer_summary yazıldı (${ozet.size} county×bant)`);

    for (let i = 0; i < guncel.length; i += 2000) {
      const part = guncel.slice(i, i + 2000);
      const vals = [], params = [];
      part.forEach((g, j) => {
        vals.push(`($${j * 3 + 1}, $${j * 3 + 2}::numeric, $${j * 3 + 3}::numeric)`);
        params.push(g.id, g.teklif, g.retail);
      });
      await pool.query(
        `update offmarket_leads l set est_offer = v.t, est_retail = v.r, est_margin = v.r - v.t
         from (values ${vals.join(",")}) as v(id, t, r) where l.lead_id = v.id`, params);
      process.stdout.write(`\rgüncellendi: ${Math.min(i + 2000, guncel.length)} / ${guncel.length}`);
    }
    console.log(`\n✓ ${guncel.length} lead'in teklifi + satış değeri güncellendi`);
    // Fiyatlayamadıklarımızda eski uydurma sabiti BIRAKMA — dürüstlük gereği NULL.
    for (let i = 0; i < fiyatlanamaz.length; i += 2000) {
      const part = fiyatlanamaz.slice(i, i + 2000);
      await pool.query(
        `update offmarket_leads set est_offer = null, est_retail = null, est_margin = null
         where lead_id = any($1)`, [part]);
    }
    console.log(`✓ ${fiyatlanamaz.length} lead comp'a dayanmadığı için fiyatsız bırakıldı (uydurma sabit temizlendi)`);
  }
  await pool.end();
}

if (process.argv[1]?.endsWith("teklif-motoru.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
