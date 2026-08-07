#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FİYAT MERDİVENİ — her parselin fiyatını ELDEKİ EN GÜVENİLİR kaynaktan üretir
// ve HANGİ KAYNAKTAN geldiğini `price_basis` sütununa yazar.
//
//   node scraper/fiyat-merdiveni.mjs --dry     # yazma, sadece rapor
//   node scraper/fiyat-merdiveni.mjs           # offmarket_leads'e yaz
//   STATE=TX node scraper/fiyat-merdiveni.mjs  # tek eyalet
//
// NEDEN: fiyatlanmış parsellerin %83'ü (291.173 kayıt) `sabit-2999` etiketliydi
// — tek bir sabit sayı, parselle hiç ilgisi yok, kaynağı piyasanın en ucuz
// oyuncusunun medyan dönüm fiyatı. Müşteri "bu fiyat nereden" diye sorduğunda
// verilecek cevabımız yoktu.
//
// ── MERDİVEN (yukarıdan aşağı; ilk tutan kazanır) ───────────────────────────
//   A · tapu-comp    GERÇEKLEŞMİŞ tapu satışları (land_comps), county × dönüm
//                    bandı P25. En güvenilir. Yalnız "açık kayıt" eyaletlerinde
//                    mümkün — şu an FL + CO.
//   B · ilan-piyasa  Aynı county'deki İLAN fiyatlarının medyan $/dönümü
//                    (competitor_listings). Satış değil İSTEME fiyatıdır, bu
//                    yüzden A'nın altında durur. TX/NM/MT/WY/ID/KS/MS/UT/ND
//                    "non-disclosure" eyaletlerdir: satış bedeli tapuya
//                    yazılmaz, kamuya hiç açılmaz → orada tek gerçek sinyal bu.
//   C · takdir       County'nin resmî takdir (assessed) değeri × eyaletin takdir
//                    rejimi katsayısı. Gerçek veri ama piyasa değeri değil.
//   —   dayanak-yok  Hiçbiri yoksa fiyat YAZILMAZ (null). "2999" yazmaktansa
//                    boş bırakmak dürüst olan.
//
// ── TEKLİF (est_offer) vs DEĞER (est_retail) ────────────────────────────────
// est_retail = parselin piyasa değeri (yukarıdaki merdivenden).
// est_offer  = AL-SAT teklifimiz; yalnız 1,5 dönüm ALTINDA üretilir. Üstünde
// üretilmez çünkü o bantta geliştiriciler prim ödüyor (Charlotte 5-40 ac:
// şirket alıcı şahıstan %66 fazla veriyor) — al-sat'ta rekabet edemeyiz.
// 2026-08-04 kararıyla büyük parseller artık KOMİSYON modeliyle kovalanıyor;
// onlara değer yazılır, teklif yazılmaz (price_basis'te "-buyuk" eki ile
// işaretlenir, sessizce kaybolmasın).
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";
import { BANDS, FIXED_COST, MIN_COMP, MIN_TEKLIF, ASSESSED_TAVAN, hesapla } from "./teklif-motoru.mjs";

const DRY = process.argv.includes("--dry");
const ONLY_STATE = process.env.STATE || null;

/**
 * Eyaletin takdir rejimi: assessed değeri piyasa değerine çeviren katsayı.
 * build-county-valuation.mjs'teki ASSESSMENT_REGIME ile aynı kamuya açık takdir
 * oranlarından türetildi. Listede olmayan eyalet için C kademesi UYGULANMAZ —
 * "ortalama bir katsayı" uydurmak sessiz hata üretir.
 */
export const TAKDIR_KATSAYI = {
  CO: 3.6,  // boş arsa takdir oranı ~%27,9 → satış ≈ 3,6x assessed
  FL: 1.0,  // "just value" piyasa değerine yakın takdir
  OR: 1.2,
  SC: 6.0,
  GA: 2.5,
};

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const pct = (a, p) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
export const countyAnahtar = (s) => String(s ?? "").replace(/\s+(county|parish|borough).*$/i, "").trim().toUpperCase();

/** İlan havuzundan county $/dönüm medyanı. Aykırı ilanlar P10-P90 ile kırpılır. */
export function ilanPpa(fiyatlar) {
  const ppas = fiyatlar.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (ppas.length < MIN_ILAN) return null;
  // Kırpma: tek bir "arazi + ev" ilanı county medyanını uçuruyordu.
  const lo = Math.floor(ppas.length * 0.1), hi = Math.ceil(ppas.length * 0.9);
  const kirpik = ppas.slice(lo, hi);
  return kirpik.length ? med(kirpik) : null;
}
export const MIN_ILAN = 5; // bir county'nin ilan medyanına güvenmek için asgari ilan

/**
 * SAF MERDİVEN — bir parsel için kaynak + değer seçer.
 * Girdi tabloları önceden hazırlanır (tapuP25 / ilanPpaMap / assessed).
 * Dönüş: { basis, retail } ya da null (dayanak yok).
 */
export function merdiven({ acres, landValue, state, tapuP25, ilanPpaDeger }) {
  // A · gerçekleşmiş tapu satışı — bant P25 doğrudan ARV (muhafazakâr).
  if (tapuP25 != null && tapuP25 > 0) return { basis: "tapu-comp", retail: Math.round(tapuP25) };
  // B · ilan piyasası — $/dönüm × parselin dönümü.
  if (ilanPpaDeger != null && ilanPpaDeger > 0 && acres > 0) {
    return { basis: "ilan-piyasa", retail: Math.round(ilanPpaDeger * acres) };
  }
  // C · resmî takdir × eyalet katsayısı.
  const k = TAKDIR_KATSAYI[state];
  if (k && landValue > 0) return { basis: "takdir-tahmini", retail: Math.round(landValue * k) };
  return null;
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg: ${e.message}`));
  const nerede = ONLY_STATE ? `and state = '${ONLY_STATE.replace(/'/g, "")}'` : "";

  // ── A tablosu: tapu satışları (county × bant P25) ─────────────────────────
  const { rows: comps } = await pool.query(
    `select state, county_key, acres::float8 acres, sale_price::float8 fiyat
       from land_comps where sale_price > 1000 and acres > 0`);
  const tapuKova = new Map();
  for (const c of comps) {
    const b = BANDS.find((x) => c.acres > x.lo && c.acres <= x.hi); if (!b) continue;
    const k = `${c.state}|${countyAnahtar(String(c.county_key).split(":").pop())}|${b.ad}`;
    if (!tapuKova.has(k)) tapuKova.set(k, []);
    tapuKova.get(k).push(c.fiyat);
  }
  const tapu = new Map();
  for (const [k, arr] of tapuKova) if (arr.length >= MIN_COMP) tapu.set(k, pct(arr, 0.25));
  console.log(`A · tapu-comp   : ${tapu.size} county×bant (≥${MIN_COMP} gerçek satış)`);

  // ── B tablosu: ilan $/dönüm (county) ──────────────────────────────────────
  const { rows: ilanlar } = await pool.query(
    `select state, county, acres::float8 acres, price::float8 fiyat
       from competitor_listings where price > 0 and acres > 0`);
  const ilanKova = new Map();
  for (const r of ilanlar) {
    const k = `${r.state}|${countyAnahtar(r.county)}`;
    if (!ilanKova.has(k)) ilanKova.set(k, []);
    ilanKova.get(k).push(r.fiyat / r.acres);
  }
  const ilan = new Map();
  for (const [k, arr] of ilanKova) { const v = ilanPpa(arr); if (v != null) ilan.set(k, v); }
  console.log(`B · ilan-piyasa : ${ilan.size} county (≥${MIN_ILAN} ilan, P10-P90 kırpılmış)`);
  console.log(`C · takdir      : ${Object.keys(TAKDIR_KATSAYI).length} eyalet katsayısı\n`);

  // ── Parselleri gez ────────────────────────────────────────────────────────
  const { rows: leads } = await pool.query(
    `select lead_id, state, county, acres::float8 acres, land_value::float8 assessed
       from offmarket_leads where 1=1 ${nerede}`);
  console.log(`parsel: ${leads.length.toLocaleString("tr-TR")}\n`);

  const yazilacak = [];
  const sayac = { "tapu-comp": 0, "ilan-piyasa": 0, "takdir-tahmini": 0, "dayanak-yok": 0 };
  let teklifli = 0, buyuk = 0, assessedFren = 0;

  for (const l of leads) {
    const b = l.acres > 0 ? BANDS.find((x) => l.acres > x.lo && x.hi >= l.acres) : null;
    const ck = countyAnahtar(l.county);
    const r = merdiven({
      acres: l.acres, landValue: l.assessed, state: l.state,
      tapuP25: b ? tapu.get(`${l.state}|${ck}|${b.ad}`) ?? null : null,
      ilanPpaDeger: ilan.get(`${l.state}|${ck}`) ?? null,
    });
    if (!r) { sayac["dayanak-yok"]++; yazilacak.push({ id: l.lead_id, basis: "dayanak-yok", retail: null, teklif: null }); continue; }
    sayac[r.basis]++;

    // Teklif yalnız küçük parselde (al-sat bandı). Büyükte değer yazılır, teklif yazılmaz.
    let teklif = null, basis = r.basis;
    if (!b) { buyuk++; basis = `${r.basis}-buyuk`; }
    else {
      teklif = hesapla(r.retail, b.carpan);
      // Parselin KENDİ assessed değeriyle çapraz kontrol — comp havuzuna
      // yabancı ürün karışırsa (sahil lotu, şehir içi parsel) teklif uçuyor.
      if (teklif != null && l.assessed > 0 && teklif > l.assessed * ASSESSED_TAVAN) { teklif = null; assessedFren++; }
      if (teklif != null) teklifli++;
    }
    yazilacak.push({ id: l.lead_id, basis, retail: r.retail, teklif });
  }

  console.log("── KAYNAK DAĞILIMI ──");
  for (const [k, v] of Object.entries(sayac)) {
    const p = leads.length ? ((v / leads.length) * 100).toFixed(1) : "0";
    console.log(`  ${k.padEnd(16)}${String(v).padStart(9)}  %${p}`);
  }
  console.log(`\n  teklif üretilen : ${teklifli.toLocaleString("tr-TR")}`);
  console.log(`  büyük parsel    : ${buyuk.toLocaleString("tr-TR")}  (değer var, teklif yok — komisyon modeli)`);
  console.log(`  assessed freni  : ${assessedFren.toLocaleString("tr-TR")}  (teklif parselin takdir değerinin ${ASSESSED_TAVAN}x'ini aştı)`);
  console.log(`  asgari teklif   : $${MIN_TEKLIF} · sabit gider $${FIXED_COST}`);

  if (DRY) { console.log("\n(--dry: veritabanına YAZILMADI)"); await pool.end(); return; }

  // ── Yaz ───────────────────────────────────────────────────────────────────
  console.log("\nyazılıyor…");
  let n = 0;
  for (let i = 0; i < yazilacak.length; i += 1000) {
    const p = yazilacak.slice(i, i + 1000);
    await pool.query(
      `update offmarket_leads l set
         est_retail = v.r, est_offer = v.t,
         est_margin = case when v.r is null or v.t is null then null else v.r - v.t end,
         price_basis = v.b
       from (select * from unnest($1::text[], $2::float8[], $3::float8[], $4::text[])
             as t(id, r, t, b)) v
       where l.lead_id = v.id`,
      [p.map((x) => x.id), p.map((x) => x.retail), p.map((x) => x.teklif), p.map((x) => x.basis)],
    );
    n += p.length;
    process.stdout.write(`\r  ${n.toLocaleString("tr-TR")}/${yazilacak.length.toLocaleString("tr-TR")}`);
  }
  console.log("\n✔ bitti — sabit-2999 kalmadı, her fiyatın dayanağı price_basis'te.");
  await pool.end();
}

if (process.argv[1] && process.argv[1].endsWith("fiyat-merdiveni.mjs")) await main();
