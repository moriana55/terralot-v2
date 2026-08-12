#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// BÖLGE PROFİLİ — "arsalarımızın olduğu yerde insanlar hangi amaçla yaşıyor?"
//
// SORU (Ahmet, 27 Tem): "Arsaların bulunduğu bölgelerde yaşayan insanlar hangi
// amaçla orada yaşıyor? (Daha sonra pazarlama amacıyla kullanılacak.)"
//
// CEVABIN KAYNAĞI — BLS QCEW (ücretsiz, anahtar İSTEMEZ):
//   https://data.bls.gov/cew/data/api/<yıl>/a/area/<FIPS>.csv
//   County başına: sektörel istihdam + işyeri sayısı + ortalama maaş + LQ.
//
// ── LQ (location quotient) NEDEN ÖNEMLİ ─────────────────────────────────────
// Mutlak istihdam her yerde "sağlık + perakende" der — bilgi taşımaz. LQ, bir
// sektörün o county'de ÜLKE ORTALAMASINA GÖRE kaç kat yoğun olduğunu verir.
// LQ 4.0 madencilik = "burası maden kasabası". Yaşam sebebini LQ söyler.
//
// ── SINIFLANDIRMA KURAL TABANLI, TAHMİN DEĞİL ───────────────────────────────
// Her etiketin arkasında ölçülmüş sayı var ve sayfada gösteriliyor. Model/LLM
// yorumu YOK. Eşikler aşağıda `SINIFLAR` içinde açıkça yazılı.
//
// Demografi (yaş, nüfus, büyüme, gelir, ZHVI, inşaat izni) `county_demographics`
// tablosundan gelir — build-county-demographics.js dolduruyor.
//
// Çalıştır:  node scraper/build-bolge-profili.mjs
//            COUNTY_N=120 node scraper/build-bolge-profili.mjs   (kapsamı genişlet)
// Çıktı:     dashboard/src/data/bolge-profili.json
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../dashboard/src/data/bolge-profili.json");
const YIL = process.env.QCEW_YIL || "2024";
const COUNTY_N = parseInt(process.env.COUNTY_N || "80", 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// NAICS sektör kodu → Türkçe ad.
const SEKTOR = {
  "11": "Tarım · ormancılık · balıkçılık",
  "21": "Madencilik · petrol · gaz",
  "22": "Enerji/su altyapısı",
  "23": "İnşaat",
  "31-33": "İmalat",
  "42": "Toptan ticaret",
  "44-45": "Perakende",
  "48-49": "Ulaştırma · depolama",
  "51": "Bilgi · medya",
  "52": "Finans · sigorta",
  "53": "Gayrimenkul · kiralama",
  "54": "Profesyonel · teknik hizmet",
  "55": "Şirket yönetimi",
  "56": "İdari · destek · atık",
  "61": "Eğitim (özel)",
  "62": "Sağlık · sosyal hizmet",
  "71": "Sanat · eğlence · rekreasyon",
  "72": "Konaklama · yeme-içme",
  "81": "Diğer hizmetler",
};
const SAHIP = { 1: "Federal devlet", 2: "Eyalet devleti", 3: "Yerel yönetim", 5: "Özel sektör" };

// ── Sınıflandırma kuralları ─────────────────────────────────────────────────
// Sırayla denenir, ilk eşleşen ana etiket olur; kalanlar "ikincil" olarak listelenir.
// lq = o sektörün location quotient'i, pay = istihdam payı, dm = demografi satırı.
const SINIFLAR = [
  {
    ad: "Askeri / federal üs",
    renk: "#1d4ed8",
    test: (x) => x.federalPay >= 0.10 && x.federalEmp >= 300,
    neden: (x) => `İstihdamın %${Math.round(x.federalPay * 100)}'i federal (${x.federalEmp.toLocaleString("en-US")} kişi) — üs/hapishane/federal tesis göstergesi.`,
  },
  {
    // Eyalet devleti istihdamı yüksek + genç nüfus = kamu üniversitesi (QCEW'de
    // devlet üniversitesi own_code 2 altında görünür, özel sektör 61'de DEĞİL).
    ad: "Üniversite kasabası",
    renk: "#4f46e5",
    test: (x) => x.eyaletPay >= 0.08 && x.eyaletEmp >= 1000 && (x.medyanYas ?? 99) <= 38,
    neden: (x) => `İstihdamın %${Math.round(x.eyaletPay * 100)}'i eyalet kurumu (${x.eyaletEmp.toLocaleString("en-US")} kişi), medyan yaş ${x.medyanYas} — kamu üniversitesi.`,
  },
  {
    // Eşik 5: LQ 3 "sektör var" demek, "bölgeyi tanımlıyor" demek değil.
    // Liberty TX (LQ 3.0) petrol county'si değil, Houston banliyösü.
    ad: "Madencilik · enerji",
    renk: "#7c2d12",
    test: (x) => x.lq("21") >= 5,
    neden: (x) => `Madencilik/enerji yoğunluğu ülke ortalamasının ${x.lq("21").toFixed(1)} katı.`,
  },
  {
    ad: "Tarım · çiftçilik",
    renk: "#65a30d",
    test: (x) => x.lq("11") >= 4,
    neden: (x) => `Tarım/ormancılık yoğunluğu ülke ortalamasının ${x.lq("11").toFixed(1)} katı.`,
  },
  {
    ad: "Turizm · ikinci ev",
    renk: "#c2410c",
    test: (x) => x.lq("71") >= 1.8 || (x.lq("72") >= 1.6 && x.lq("71") >= 1.2),
    neden: (x) => `Rekreasyon LQ ${x.lq("71").toFixed(1)}, konaklama/yeme-içme LQ ${x.lq("72").toFixed(1)} — ziyaretçi ekonomisi.`,
  },
  {
    ad: "Emeklilik bölgesi",
    renk: "#a21caf",
    test: (x) => (x.medyanYas ?? 0) >= 47 || ((x.medyanYas ?? 0) >= 45 && x.lq("62") >= 1.2),
    neden: (x) => `Medyan yaş ${x.medyanYas}${x.lq("62") >= 1.2 ? `, sağlık istihdamı LQ ${x.lq("62").toFixed(1)}` : ""} — emekli ağırlıklı nüfus.`,
  },
  {
    ad: "Yatak bölgesi (şehre komşu)",
    renk: "#0891b2",
    // Nüfusuna göre çok az iş var → çalışanlar başka county'ye gidiyor.
    // ABD geneli iş/nüfus ~0,45. 0,30 altı belirgin dışarı komütasyon demek.
    test: (x) => x.nufus > 0 && x.toplamEmp / x.nufus < 0.30,
    neden: (x) => `Nüfus ${x.nufus.toLocaleString("en-US")} ama county içinde sadece ${x.toplamEmp.toLocaleString("en-US")} iş (oran %${Math.round((x.toplamEmp / x.nufus) * 100)}) — çalışanlar dışarı gidiyor.`,
  },
  {
    ad: "Büyüyen banliyö",
    renk: "#15803d",
    test: (x) => x.lq("23") >= 1.5 && (x.buyume5 ?? 0) > 3,
    neden: (x) => `İnşaat LQ ${x.lq("23").toFixed(1)}, 5 yıllık nüfus artışı %${x.buyume5?.toFixed(1)} — aktif yerleşim.`,
  },
  {
    ad: "İmalat · lojistik",
    renk: "#b45309",
    test: (x) => x.lq("31-33") >= 1.5 || x.lq("48-49") >= 1.8,
    neden: (x) => `İmalat LQ ${x.lq("31-33").toFixed(1)}, ulaştırma/depolama LQ ${x.lq("48-49").toFixed(1)}.`,
  },
];
const VARSAYILAN = {
  ad: "Kırsal · karma",
  renk: "#64748b",
  neden: (x) => `Belirgin bir sektör yoğunlaşması yok; en büyük işveren ${x.enBuyuk?.ad ?? "—"}.`,
};

async function qcew(fips) {
  const url = `https://data.bls.gov/cew/data/api/${YIL}/a/area/${fips}.csv`;
  for (let d = 0; d < 3; d++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "terralot-bolge/1.0 (sales@nocturndev.com)" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      if (!txt.startsWith('"area_fips"')) throw new Error("beklenmeyen içerik");
      const [hdr, ...satir] = txt.trim().split("\n");
      const cols = hdr.split(",").map((c) => c.replace(/"/g, ""));
      return satir.map((s) => {
        // Alanlar tırnaklı veya tırnaksız gelebiliyor — basit CSV ayrıştırma yeterli.
        const v = s.match(/("[^"]*"|[^,]*)/g).filter((_, i) => i % 2 === 0).map((c) => c.replace(/^"|"$/g, ""));
        return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
      });
    } catch (e) {
      if (d === 2) return { hata: e.message };
      await sleep(1500 * (d + 1));
    }
  }
}

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();

console.log(`1/3 · envanter county'leri (top ${COUNTY_N})…`);

// County adı → demografi tablosundaki karşılığı.
// Hasat betikleri county alanına bazen ALT BÖLGE adı yazmış (AZ'de hepsi Mohave),
// bazen de boşluksuz CamelCase ("SanJacinto"). Eşleşmezse o county profillenemez.
const COUNTY_DUZELT = {
  "AZ|DOLAN SPRINGS / MEADVIEW": "MOHAVE",
  "AZ|MEADVIEW / LAKE MEAD": "MOHAVE",
  "AZ|YUCCA / KINGMAN G.": "MOHAVE",
  "AZ|MOHAVE (KIRSAL)": "MOHAVE",
  "AZ|GOLDEN VALLEY / KINGMAN": "MOHAVE",
};
// "SAN JACINTO" → "San Jacinto" (demografi tablosu hepsini büyük harf tutuyor).
const baslikYap = (s) => String(s).toLowerCase().replace(/(^|[\s\-'])\S/g, (c) => c.toUpperCase());
const sayi = (v) => (v == null || v === "" ? null : Number.isFinite(+v) ? +v : null);
const temizle = (s) =>
  String(s ?? "").toUpperCase().replace(/\s+(COUNTY|PARISH|BOROUGH|CENSUS AREA)$/i, "").trim();
function demografiAdi(state, county) {
  const ham = temizle(county);
  const ov = COUNTY_DUZELT[`${state}|${ham}`];
  if (ov) return ov;
  // "SANJACINTO" gibi boşluksuz yazımlar: orijinaldeki büyük harf sınırından ayır.
  const cc = String(county ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
  return temizle(cc);
}

const hedefHam = (await client.query(`
  select state, county,
    count(*)::int lead,
    count(*) filter (where grade in ('A+','A'))::int aplus,
    round(avg(nullif(acres,0))::numeric,1)::float ort_donum
  from offmarket_leads
  group by state, county
  order by count(*) desc
  limit $1
`, [COUNTY_N])).rows;

// Demografi tablosunu bir kez çek, normalize anahtarla eşle (SQL'de değil JS'te —
// düzeltme tablosu burada okunaklı duruyor).
const demo = new Map();
for (const d of (await client.query(`
  select state, county, state_fips, county_fips, median_age, population,
         pop_growth_5y, median_household_income, zhvi, building_permits
  from county_demographics
`)).rows) demo.set(`${d.state}|${temizle(d.county)}`, d);

// Aynı gerçek county'ye düşen alt bölgeler tek satırda toplanır (AZ/Mohave gibi).
const birlesik = new Map();
for (const h of hedefHam) {
  const ad = demografiAdi(h.state, h.county);
  const anahtar = `${h.state}|${ad}`;
  const d = demo.get(anahtar);
  const mevcut = birlesik.get(anahtar);
  if (mevcut) {
    mevcut.lead += h.lead;
    mevcut.aplus += h.aplus;
    mevcut.altBolge.push(h.county);
  } else {
    birlesik.set(anahtar, {
      state: h.state,
      county: d ? baslikYap(d.county.replace(/\s+(County|Parish|Borough|Census Area)$/i, "")) : h.county,
      altBolge: [h.county],
      lead: h.lead, aplus: h.aplus, ort_donum: h.ort_donum,
      sf: d?.state_fips ?? null, cf: d?.county_fips ?? null,
      // county_demographics sayısal alanları metin olarak geliyor — sayıya çevir.
      medyan_yas: sayi(d?.median_age), nufus: sayi(d?.population),
      buyume5: sayi(d?.pop_growth_5y), gelir: sayi(d?.median_household_income),
      zhvi: sayi(d?.zhvi), izin: sayi(d?.building_permits),
    });
  }
}
const hedef = [...birlesik.values()].sort((a, b) => b.lead - a.lead);

const toplamLead = (await client.query(`select count(*)::int n from offmarket_leads`)).rows[0].n;
// Envanterin TAMAMI kaç eyalette — profillenen eyalet sayısıyla KARIŞMASIN.
// Sunum ekranı başlıkta "36 eyalette 1.272.766 arsa" diyordu: parsel sayısı
// envanterin tamamı, eyalet sayısı ise yalnız profillenen county'lerinkiydi.
// İki farklı kapsamdan tek cümle kurmak yatırımcıya açık veriyor.
const eyaletToplam = (await client.query(
  `select count(distinct state)::int n from offmarket_leads where state is not null`
)).rows[0].n;
const kapsanan = hedef.reduce((s, r) => s + r.lead, 0);
console.log(`   ${hedef.length} county · envanterin %${Math.round((kapsanan / toplamLead) * 100)}'i`);
await client.end();

console.log(`2/3 · BLS QCEW ${YIL} çekiliyor…`);
const cikti = [];
let fipsYok = 0, hataN = 0;
for (let i = 0; i < hedef.length; i++) {
  const h = hedef[i];
  if (!h.sf || !h.cf) { fipsYok++; continue; }
  const fips = `${h.sf}${h.cf}`;
  const rows = await qcew(fips);
  if (!Array.isArray(rows)) { hataN++; console.log(`   ✘ ${h.state}/${h.county} — ${rows?.hata}`); continue; }

  // Sahiplik kırılımı (agglvl 71) — federal/eyalet/yerel/özel istihdam.
  const sahip = {};
  for (const r of rows) if (r.agglvl_code === "71") sahip[r.own_code] = +r.annual_avg_emplvl || 0;
  const toplamEmp = +(rows.find((r) => r.agglvl_code === "70")?.annual_avg_emplvl || 0);
  const federalEmp = sahip["1"] || 0;
  const eyaletEmp = sahip["2"] || 0;

  // Özel sektör NAICS sektörleri (agglvl 74, own 5).
  const sektorler = rows
    .filter((r) => r.agglvl_code === "74" && r.own_code === "5" && SEKTOR[r.industry_code])
    .map((r) => ({
      kod: r.industry_code,
      ad: SEKTOR[r.industry_code],
      emp: +r.annual_avg_emplvl || 0,
      isyeri: +r.annual_avg_estabs || 0,
      maas: +r.avg_annual_pay || 0,
      lq: +r.lq_annual_avg_emplvl || 0,
    }))
    .filter((s) => s.emp > 0);

  const lqMap = Object.fromEntries(sektorler.map((s) => [s.kod, s.lq]));
  const ctx = {
    lq: (k) => lqMap[k] ?? 0,
    federalEmp,
    federalPay: toplamEmp > 0 ? federalEmp / toplamEmp : 0,
    eyaletEmp,
    eyaletPay: toplamEmp > 0 ? eyaletEmp / toplamEmp : 0,
    toplamEmp,
    nufus: h.nufus || 0,
    medyanYas: h.medyan_yas,
    buyume5: h.buyume5,
    enBuyuk: [...sektorler].sort((a, b) => b.emp - a.emp)[0],
  };

  const esles = SINIFLAR.filter((s) => s.test(ctx));
  const ana = esles[0] || VARSAYILAN;
  cikti.push({
    state: h.state,
    county: h.county,
    altBolge: h.altBolge.length > 1 ? h.altBolge : [],
    fips,
    lead: h.lead,
    aplus: h.aplus,
    ortDonum: h.ort_donum,
    nufus: h.nufus,
    medyanYas: h.medyan_yas,
    buyume5: h.buyume5,
    gelir: h.gelir,
    zhvi: h.zhvi ? Math.round(h.zhvi) : null,
    izin: h.izin,
    toplamEmp,
    isNufusOran: h.nufus ? +(toplamEmp / h.nufus).toFixed(3) : null,
    sahiplik: Object.entries(sahip).map(([k, v]) => ({ ad: SAHIP[k] ?? k, emp: v })).filter((s) => s.emp > 0),
    // En çok istihdam eden 5 sektör (büyüklük) + en yoğunlaşmış 5 (LQ ≥ 1.2).
    enBuyukSektor: [...sektorler].sort((a, b) => b.emp - a.emp).slice(0, 5),
    enYogunSektor: [...sektorler].filter((s) => s.lq >= 1.2 && s.emp >= 20).sort((a, b) => b.lq - a.lq).slice(0, 5),
    sinif: ana.ad,
    sinifRenk: ana.renk,
    neden: ana.neden(ctx),
    ikincil: esles.slice(1, 4).map((s) => s.ad),
  });
  if ((i + 1) % 10 === 0) console.log(`   ${i + 1}/${hedef.length}…`);
  await sleep(300); // BLS'e saygılı hız
}

console.log("3/3 · yazılıyor…");
const dagilim = {};
for (const c of cikti) dagilim[c.sinif] = (dagilim[c.sinif] || 0) + 1;

// Ana ekran (client bileşeni) 430 KB'lik tam dosyayı import edemez — tarayıcı
// paketini şişirir. Yanına yalnız sayaç içeren küçük bir özet yazılır.
const OZET = path.resolve(HERE, "../dashboard/src/data/bolge-ozet.json");
const parselDagilim = {};
for (const c of cikti) parselDagilim[c.sinif] = (parselDagilim[c.sinif] || 0) + c.lead;
writeFileSync(OZET, JSON.stringify({
  uretildi: new Date().toISOString(),
  countyN: cikti.length,
  eyaletToplam,
  toplamLead: toplamLead,
  kapsananLead: kapsanan,
  eyaletN: new Set(cikti.map((c) => c.state)).size,
  toplamUstNot: cikti.reduce((s, c) => s + c.aplus, 0),
  countyDagilim: dagilim,
  parselDagilim,
  enBuyuk: cikti.slice(0, 3).map((c) => ({ state: c.state, county: c.county, lead: c.lead, aplus: c.aplus, sinif: c.sinif })),
}, null, 1));

writeFileSync(OUT, JSON.stringify({
  uretildi: new Date().toISOString(),
  qcewYil: YIL,
  countyN: cikti.length,
  eyaletToplam,
  fipsYok,
  hataN,
  kapsananLead: kapsanan,
  toplamLead,
  dagilim,
  county: cikti.sort((a, b) => b.lead - a.lead),
}, null, 1));

console.log(`\n✔ ${OUT}`);
console.log(`  ${cikti.length} county profillendi · envanterin %${Math.round((kapsanan / toplamLead) * 100)}'i`);
if (fipsYok) console.log(`  ⚠ FIPS eşleşmeyen: ${fipsYok} (county_demographics'te yok)`);
if (hataN) console.log(`  ⚠ BLS hatası: ${hataN}`);
console.log(`  dağılım: ${Object.entries(dagilim).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
