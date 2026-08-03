#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TOPLU ARSA ALAN ŞİRKETLER — snapshot üretici.
//
// SORU (Ahmet, 27 Tem): "Toplu arsa alan şirketler hangi bölgelerde arsa alıyor,
// onlara toplu şekilde pazarlama yapabilir miyiz?"
//
// CEVABIN KAYNAĞI — İKİ AYRI KAMU KAYDI, İKİ AYRI ALICI SINIFI:
//   1) offmarket_leads  → bizim tarama alanımızdaki parsellerin BUGÜNKÜ sahipleri.
//      Kurumsal + çok parselli olan = arsa BİRİKTİRİCİ (land banker / flipper).
//      Posta adresi de aynı kayıtta → toplu mektup listesi doğrudan çıkar.
//   2) parcel_owners    → son satış YILI olan kayıtlar. `last_sale_year >= eşik`
//      olan kurumsal sahip = HÂLÂ AKTİF ALICI (ev üreticileri burada çıkıyor).
//
// EŞLEŞTİRME (sayfanın asıl değeri): her alıcının topladığı county'lerde BİZİM
// kaç A+/A notlu off-market parselimiz var? Kesişim varsa o şirkete toplu teklif
// götürülebilir — "senin aldığın yerde bizde şu kadar parsel var".
//
// Çalıştır:  node scraper/build-toplu-alicilar.mjs
// Çıktı:     dashboard/src/data/toplu-alicilar.json  (sayfa bunu okur)
// Tekrar çalıştırılabilir; DDL ATMAZ, sadece okur.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../dashboard/src/data/toplu-alicilar.json");

// Kurumsal sahip tespiti. Şirket eki ARAR, kamu/dernek kayıtlarını DIŞLAR —
// county trustee, okul bölgesi, kilise, HOA "alıcı" değildir.
const KURUMSAL = `
  owner ~* '(LLC|L\\.L\\.C|\\mINC\\M|CORP|COMPANY|\\mCO\\M|TRUST|\\mLTD\\M|\\mLP\\M|HOLDING|PROPERTIES|PROPERTY|\\mLAND\\M|CAPITAL|INVEST|GROUP|VENTURES|PARTNERS|ACQUISITION|DEVELOP|HOMES|BUILDER|RANCH|REALTY|ESTATES)'
  and owner !~* '(COUNTY|TRUSTEE|STATE OF|CITY OF|TOWN OF|VILLAGE OF|SCHOOL|DISTRICT|UNITED STATES|\\mUSA\\M|DEPT|DEPARTMENT|COMMISSION|AUTHORITY|BUREAU|CHURCH|CEMETERY|MINISTR|ASSOCIATION|HOMEOWNERS|\\mPOA\\M|\\mHOA\\M|CLUB\\M)'
`;

// Kaç parselden itibaren "toplu alıcı" sayıyoruz.
const ESIK = parseInt(process.env.TOPLU_ESIK || "25", 10);
// parcel_owners'ta "hâlâ aktif" eşiği.
const AKTIF_YIL = parseInt(process.env.AKTIF_YIL || "2023", 10);

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();

// ── 1) Biriktiriciler: bizim tarama alanımızda çok parseli olan kurumsal sahipler
console.log("1/4 · biriktirici sahipler…");
const biriktirici = (await client.query(`
  select
    owner,
    count(*)::int                                   parsel,
    round(coalesce(sum(acres),0)::numeric, 0)::int  donum,
    count(distinct state)::int                      eyalet_n,
    count(distinct state || '/' || county)::int     county_n,
    count(mailing_address)::int                     adres_var,
    mode() within group (order by mailing_city)     posta_sehir,
    mode() within group (order by mailing_state)    posta_eyalet,
    mode() within group (order by mailing_address)  posta_adres,
    round(avg(nullif(acres,0))::numeric, 1)::float  ort_donum,
    array_agg(distinct state || '/' || county)      bolgeler
  from offmarket_leads
  where owner is not null and length(owner) > 3 and ${KURUMSAL}
  group by owner
  having count(*) >= $1
  order by count(*) desc
  limit 300
`, [ESIK])).rows;
console.log(`   ${biriktirici.length} şirket (>= ${ESIK} parsel)`);

// ── 2) Bizim A+/A envanterimizin county dağılımı — eşleştirme için
console.log("2/4 · A+/A envanter dağılımı…");
const bizim = new Map();
for (const r of (await client.query(`
  select state || '/' || county k, count(*)::int n
  from offmarket_leads where grade in ('A+','A') group by 1
`)).rows) bizim.set(r.k, r.n);

// Tüm notlardan bağımsız envanter (kesişim boşsa bile "kaç parselimiz var")
const bizimTum = new Map();
for (const r of (await client.query(`
  select state || '/' || county k, count(*)::int n from offmarket_leads group by 1
`)).rows) bizimTum.set(r.k, r.n);

// ── 3) Aktif alıcılar: son satış yılı taze olan kurumsal sahipler
console.log("3/4 · aktif alıcılar (parcel_owners son satış yılı)…");
const aktif = (await client.query(`
  select
    owner,
    count(*)::int                                    parsel,
    count(distinct state || '/' || county)::int      county_n,
    max(last_sale_year)::int                         son_alim,
    count(*) filter (where last_sale_year >= $2)::int taze_parsel,
    round(coalesce(sum(acres),0)::numeric, 0)::int   donum,
    mode() within group (order by owner_city)        posta_sehir,
    mode() within group (order by owner_state)       posta_eyalet,
    mode() within group (order by owner_addr)        posta_adres,
    round(avg(nullif(last_sale_price,0))::numeric,0)::int ort_alim_fiyat,
    array_agg(distinct state || '/' || county)       bolgeler
  from parcel_owners
  where owner is not null and length(owner) > 3 and ${KURUMSAL}
  group by owner
  having count(*) filter (where last_sale_year >= $2) >= $1
  order by count(*) filter (where last_sale_year >= $2) desc
  limit 200
`, [Math.max(5, Math.floor(ESIK / 5)), AKTIF_YIL])).rows;
console.log(`   ${aktif.length} şirket (>= ${AKTIF_YIL} yılından beri alım yapan)`);

// ── 4) Kesişim hesabı + normalize
console.log("4/4 · envanter kesişimi…");
const zenginlestir = (r, tip) => {
  const bolgeler = (r.bolgeler || []).filter(Boolean);
  let kesisimAplus = 0, kesisimTum = 0;
  for (const b of bolgeler) {
    kesisimAplus += bizim.get(b) || 0;
    kesisimTum += bizimTum.get(b) || 0;
  }
  return {
    tip,
    owner: r.owner,
    parsel: r.parsel,
    donum: r.donum ?? null,
    ortDonum: r.ort_donum ?? null,
    eyaletN: r.eyalet_n ?? new Set(bolgeler.map((b) => b.split("/")[0])).size,
    countyN: r.county_n,
    bolgeler: bolgeler.sort(),
    posta: [r.posta_adres, r.posta_sehir, r.posta_eyalet].filter(Boolean).join(", ") || null,
    adresVar: r.adres_var ?? null,
    sonAlim: r.son_alim ?? null,
    tazeParsel: r.taze_parsel ?? null,
    ortAlimFiyat: r.ort_alim_fiyat ?? null,
    // Aynı county'lerde bizim elimizdeki parsel — toplu teklifin büyüklüğü.
    kesisimAplus,
    kesisimTum,
  };
};

const payload = {
  uretildi: new Date().toISOString(),
  esik: ESIK,
  aktifYil: AKTIF_YIL,
  biriktirici: biriktirici.map((r) => zenginlestir(r, "biriktirici")),
  aktif: aktif.map((r) => zenginlestir(r, "aktif")),
};

// Kaynak sayaçları — sayfada "kaç kayıttan türedi" dürüstlüğü için.
payload.sayac = (await client.query(`
  select
    (select count(*) from offmarket_leads)::int lead_toplam,
    (select count(*) from offmarket_leads where ${KURUMSAL})::int lead_kurumsal,
    (select count(*) from parcel_owners)::int owner_toplam,
    (select count(distinct owner) from offmarket_leads where ${KURUMSAL})::int kurumsal_sahip_n
`)).rows[0];

writeFileSync(OUT, JSON.stringify(payload, null, 1));

// Ana ekran için küçük özet (tam dosya 190 KB — client'a taşınmaz).
const enIyi = [...payload.biriktirici, ...payload.aktif]
  .sort((a, b) => b.kesisimAplus - a.kesisimAplus).slice(0, 3)
  .map((x) => ({ owner: x.owner, kesisimAplus: x.kesisimAplus }));
writeFileSync(path.resolve(HERE, "../dashboard/src/data/toplu-alicilar-ozet.json"), JSON.stringify({
  uretildi: payload.uretildi,
  biriktiriciN: payload.biriktirici.length,
  aktifN: payload.aktif.length,
  postaliN: [...payload.biriktirici, ...payload.aktif].filter((x) => x.posta).length,
  kurumsalParsel: payload.sayac.lead_kurumsal,
  kurumsalSahipN: payload.sayac.kurumsal_sahip_n,
  enIyi,
}, null, 1));
await client.end();

console.log(`\n✔ ${OUT}`);
console.log(`  biriktirici: ${payload.biriktirici.length} · aktif alıcı: ${payload.aktif.length}`);
console.log(`  kurumsal parsel: ${payload.sayac.lead_kurumsal.toLocaleString("en-US")} / ${payload.sayac.lead_toplam.toLocaleString("en-US")}`);
