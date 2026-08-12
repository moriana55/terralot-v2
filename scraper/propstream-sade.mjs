#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// PROPSTREAM İÇE AKTARMA DOSYASI — başlıklar PropStream'in KENDİ export
// biçiminden alındı, birebir aynı.
//
//   node scraper/propstream-sade.mjs
//
// ⚠ İKİ CANLI HATA VE BEDELİ (2026-08-08):
//
// 1) SÜTUN ADLARI. İlk sürümde "Mailing Address / Property Address" yazmıştım.
//    PropStream bunları TANIMIYOR — kendi adları "Mail Street Address" ve
//    "Street Address". Otomatik eşleme tanımadığı sütunları boş geçti, 500
//    kayıt adressiz içeri girdi, skip trace eşleştirecek adres bulamadı ve
//    SIFIR numara döndü. Kanıt: contact_export-vegaskip.csv'de Street Address,
//    City, Zip, Mail Street Address alanlarının hepsi boş.
//    Başlıklar artık PropStream'in export başlıklarıyla AYNI — eşleme şaşamaz.
//
// 2) KURUM ADI ŞAHIS SANILDI. "78 LC", "66 FEDERAL" gibi kayıtlar ad/soyad
//    diye bölündü (First=LC, Last=78). Kurum tespiti artık yalnız kelime
//    listesine güvenmiyor: ad/soyadın SAYI ya da tek harf çıkması da kurum
//    işareti sayılıyor ve o kayıt Company Name alanına yazılıyor.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";
import { csvSatir } from "./temas-listesi.mjs";
import { adAyir } from "./propstream-listesi.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CIKTI = resolve(HERE, "..", "deliverables");

/** PropStream'in KENDİ export başlıkları — değiştirme. */
const BASLIK = [
  "First Name", "Last Name", "Company Name",
  "Street Address", "City", "State", "Zip",
  "Mail Street Address", "Mail City", "Mail State", "Mail Zip",
];

const KURUM_KELIME =
  /\b(LLC|L\.L\.C|LC|INC|CORP|CORPORATION|COMPANY|CO|INVESTMENTS?|PROPERTIES|HOLDINGS|PARTNERS|PARTNERSHIP|LP|LLP|TRUST|TRUSTEE|TTEE|CUSTODIAN|BANK|CHURCH|MINISTRIES|ASSOCIATION|HOA|HOTELS?|RANCH|FARMS?|GROUP|ENTERPRISES?|DEVELOPMENT|BUILDERS?|CAPITAL|EQUITY|FUND|IRA|LTD|PLC|FEDERAL|NATIONAL|CITY OF|COUNTY OF|STATE OF|USA|ESTATES?)\b/i;

/**
 * Kayıt kurum mu? İki sinyal:
 *  a) adında kurum kelimesi geçiyor
 *  b) ad/soyada ayrıştırınca SAYI ya da tek harf çıkıyor ("78 LC" gibi) —
 *     gerçek kişide olmaz, kütükte kurum/lot numarası demektir.
 */
export function kurumKaydiMi(owner) {
  const s = String(owner ?? "");
  if (KURUM_KELIME.test(s)) return true;
  const { ad, soyad } = adAyir(s);
  if (!ad || !soyad) return true;
  if (/^\d/.test(ad) || /^\d/.test(soyad)) return true;
  if (ad.length < 2 || soyad.length < 2) return true;
  return false;
}

async function main() {
  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  // Aynı kişinin birden çok parseli olabiliyor — kişi başına TEK satır.
  const { rows } = await db.query(
    `select distinct on (owner, mailing_address)
            owner, mailing_address, mailing_city, mailing_state, mailing_zip,
            situs, state, grade_score
       from offmarket_leads
      where grade = 'A+'
        and owner is not null and mailing_address is not null
        and mailing_city is not null and mailing_state is not null and mailing_zip is not null
      order by owner, mailing_address, grade_score desc nulls last`,
  );
  await db.end();

  /**
   * PropStream satırı REDDEDER (yükleme o satırda durur) eğer posta alanları
   * eksikse ya da posta kodu sayı değilse. Tek bir bozuk satır tüm yüklemeyi
   * durdurduğu için burada elenirler — 4.318 kayıtta 15 civarı, ihmal edilebilir.
   */
  const yuklenebilir = (r) => {
    const dolu = (v) => String(v ?? "").trim().length > 0;
    if (!dolu(r.mailing_address) || !dolu(r.mailing_city) || !dolu(r.mailing_state) || !dolu(r.mailing_zip)) return false;
    if (!/^\d{5}(-\d{4})?$/.test(String(r.mailing_zip).trim())) return false;
    return true;
  };
  const elenen = rows.length - rows.filter(yuklenebilir).length;

  const kisi = [], kurum = [];
  for (const r of rows.filter(yuklenebilir)) (kurumKaydiMi(r.owner) ? kurum : kisi).push(r);

  /**
   * `situs` her zaman sokak adresi DEĞİL — county kütüklerinde sık sık TAPU
   * TARİFİ oluyor: "BEG SW COR OF SE1/4 OF NE1/4 TH 335.4'(D) … TO POB".
   * PropStream Street Address alanına 200 karakterden uzun değer kabul
   * etmiyor ve yükleme o satırda hata verip duruyor. Tarif metni zaten adres
   * olarak işe yaramaz (skip trace posta adresiyle eşleştiriyor) → boş bırak.
   */
  const sokakAdresi = (situs) => {
    const s = String(situs ?? "").trim();
    if (!s || s.length > 120) return "";
    // Tapu tarifi işaretleri: metes-and-bounds dili ve kesirli parsel kodları.
    if (/\b(BEG|POB|TH\b|SEC\b|TWP|RNG|LOT\s+\d+\s+BLK|1\/4|N1\/2|S1\/2|E1\/2|W1\/2)\b/i.test(s)) return "";
    return s;
  };

  const satirla = (r, kurumMu) => {
    const { ad, soyad } = adAyir(r.owner);
    return csvSatir([
      kurumMu ? "" : ad,
      kurumMu ? "" : soyad,
      // PropStream hiçbir alanda 200 karakteri kabul etmiyor; birkaç kurum
      // adı (birleşik tröst adları) bunu aşıyor → kırpılır.
      kurumMu ? String(r.owner).trim().slice(0, 200) : "",
      // ── MÜLK ADRESİ = SAHİBİN POSTA ADRESİ (2026-08-09) ──────────────────
      // 25 kayıtlık testte 25/25 SIFIR eşleşme çıktı. Sebep: PropStream bir
      // emlak aracı, skip trace'i kişiyi MÜLK ADRESİNDEN eşleştiriyor. Bizim
      // boş arsalarımızın sokak adresi yok (çoğunda yalnız eyalet vardı),
      // şehir/posta kodu da boştu → arama yapılamadı. Hesaptaki çalışan
      // listeler (TIRED LANDLORDS, VACANT HOUSES) PropStream'in kendi
      // aramasından geldiği için mülk adresleri tamdı.
      //
      // Skip trace'in aradığı şey KİŞİNİN OTURDUĞU ADRES; bizde o bilgi
      // sahibin posta adresi. Parselin tarla adresi burada işe yaramıyor
      // (kimse orada oturmuyor). Bu yüzden her iki adres bloğuna da posta
      // adresi yazılır — "Mail Address Same" mantığı.
      r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip,
      // Posta adresi — skip trace asıl bunu kullanıyor, %100 dolu.
      r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip,
    ]);
  };

  if (!existsSync(CIKTI)) mkdirSync(CIKTI, { recursive: true });
  const t = new Date().toISOString().slice(0, 10);
  const yaz = (ad, arr, k) => {
    const yol = resolve(CIKTI, ad);
    writeFileSync(yol, [csvSatir(BASLIK), ...arr.map((r) => satirla(r, k))].join("\n") + "\n", "utf8");
    return yol;
  };

  const y1 = yaz(`propstream-SAHIS-${kisi.length}-${t}.csv`, kisi, false);
  const y2 = kurum.length ? yaz(`propstream-KURUM-${kurum.length}-${t}.csv`, kurum, true) : null;

  console.log(`A+ tekil kişi (ad + posta adresi benzersiz): ${rows.length.toLocaleString("tr-TR")}`);
  console.log(`  elenen (posta alanı eksik / posta kodu geçersiz): ${elenen}`);
  console.log(`  şahıs : ${kisi.length.toLocaleString("tr-TR")}`);
  console.log(`  kurum : ${kurum.length.toLocaleString("tr-TR")}`);
  console.log(`\n✔ ${y1}    ← ÖNCE BUNU YÜKLE`);
  if (y2) console.log(`✔ ${y2}`);
  console.log(`\nBaşlıklar (PropStream export'uyla birebir):`);
  console.log(`  ${BASLIK.join(" · ")}`);
}

if (process.argv[1] && process.argv[1].endsWith("propstream-sade.mjs")) await main();
