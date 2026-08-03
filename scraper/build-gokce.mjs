#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GOKCE CAPITAL DOSYASI — tek rakip derin analizi.
//
// KİM: Erika Gokce'nin şirketi. NYC Belediyesi'nde Uygun Fiyatlı Konut
// Direktörü iken bırakıp tam zamanlı arsa yatırımcısı olmuş (USC mimarlık +
// Columbia şehir politikaları). "Emlakçı değiliz, sattığımız her parselin
// sahibiyiz" diyor; 700+ kişiyi arazi sahibi yapmış. Kitap + YouTube + blog
// ile içerik pazarlaması yapıyor.
//
// NEDEN AYRI DOSYA: `toplu-alicilar` listesinde envanterimizle ÖRTÜŞMESİ en
// yüksek şirket. Bizim county'lerimizde parsel topluyor → hem rakip hem
// potansiyel toplu alıcı.
//
// ⚠ İLAN LİSTESİ ALINAMIYOR: ilan platformu (gokcecapital.gokcap.com,
// CloudFront) Türkiye'den erişime KAPALI (HTTP 403 "blocked from your
// country"). Landmodo'daki satıcı profili de "not public or active" diyor.
// Bu yüzden sayfa onların İLANLARINI değil, kamu tapu kaydındaki
// MÜLKİYETLERİNİ gösterir — ki asıl kanıt değeri olan da budur.
//
// Çalıştır: node scraper/build-gokce.mjs
// Çıktı:    dashboard/src/data/gokce-capital.json
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../dashboard/src/data/gokce-capital.json");
const ARA = "%GOKCE%";

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("set statement_timeout = 0");

// 1) Bizim tarama alanımızdaki parselleri — tam liste
const parseller = (await client.query(`
  select lead_id, state, county, region, apn, owner, acres::float, land_value::float,
         est_offer::float, est_retail::float, grade, grade_score::float,
         mailing_address, mailing_city, mailing_state, mailing_zip,
         situs, lat::float, lng::float, absentee
  from offmarket_leads
  where owner ilike $1
  order by acres desc nulls last
`, [ARA])).rows;

// 2) Tapu kaydındaki (parcel_owners) izleri — alım yılı/fiyatı burada
const tapu = (await client.query(`
  select state, county, apn, owner, acres::float, assessed_total::float,
         last_sale_price::float, last_sale_year, last_sale_month, owner_addr, owner_city, owner_state
  from parcel_owners
  where owner ilike $1
  order by last_sale_year desc nulls last
`, [ARA])).rows;

// 3) Envanterimizle örtüşme: onların bulunduğu county'lerde bizim stok
const bolgeler = [...new Set(parseller.map((p) => `${p.state}/${p.county}`))];
const ortusme = bolgeler.length
  ? (await client.query(`
      select state || '/' || county bolge, count(*)::int bizim_parsel,
             count(*) filter (where grade in ('A+','A'))::int bizim_ustnot
      from offmarket_leads
      where state || '/' || county = any($1)
      group by 1 order by 2 desc
    `, [bolgeler])).rows
  : [];

await client.end();

// Posta adresleri — hepsi sanal ofis/posta kutusu; sayfada bu vurgulanır.
const adresler = [...new Set(parseller.map((p) =>
  [p.mailing_address, p.mailing_city, p.mailing_state].filter(Boolean).join(", ")
).filter(Boolean))];

const toplamDonum = parseller.reduce((a, p) => a + (p.acres || 0), 0);
const toplamDeger = parseller.reduce((a, p) => a + (p.land_value || 0), 0);

// ── İlanları + tapu eşleşmesini birleştir ──────────────────────────────────
// İlan listesi siteden ELLE alındı (CloudFront TR'ye kapalı, bkz. başlık notu).
const veriDir = path.resolve(HERE, "../dashboard/src/data");
const oku = (ad) => (existsSync(path.join(veriDir, ad)) ? JSON.parse(readFileSync(path.join(veriDir, ad), "utf8")) : null);
const ilanDosya = oku("gokce-ilanlar.json");
const eslesme = oku("gokce-eslesme.json");
const ilanlar = ilanDosya?.ilanlar ?? [];

const ilanOzet = ilanlar.length ? {
  sayi: ilanlar.length,
  listeDegeri: ilanlar.reduce((a, i) => a + (i.fiyat || 0), 0),
  toplamDonum: Math.round(ilanlar.reduce((a, i) => a + (i.acres || 0), 0) * 10) / 10,
  satista: ilanlar.filter((i) => i.durum === "Available").length,
  beklemede: ilanlar.filter((i) => i.durum === "On Hold").length,
  eyaletler: Object.entries(ilanlar.reduce((a, i) => { a[i.state] = (a[i.state] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]),
  enUcuz: Math.min(...ilanlar.map((i) => i.fiyat)),
  enPahali: Math.max(...ilanlar.map((i) => i.fiyat)),
} : null;

// Satış hunisi ve teklif yapısı — sitelerinden birebir alındı. Bizim kendi
// satış sayfamızı kurarken doğrudan kıyas malzemesi.
const oyunKitabi = {
  huni: [
    { gun: 1, baslik: "Lotu ayır", ozet: "Parseli sitede kendine kilitle — kimse kapamasın." },
    { gun: 2, baslik: "Araziyi incele", ozet: "Sanal da olsa gez, ödevini yap." },
    { gun: 3, baslik: "Ödeme planını seç", ozet: "%5 nakit iade, 9 bonus, 365 gün takas garantisi." },
    { gun: 4, baslik: "Birebir destek", ozet: "Ekiple 1:1 görüşme — her soru cevaplanır." },
    { gun: 5, baslik: "Sahipliği kutla", ozet: "Sözleşmeyi imzala, 700+ kişilik topluluğa katıl." },
  ],
  erkenOdeme: "18 aydan uzun sözleşmelerde: 6 ayda kapatana satış bedelinin %5'i, 12 ayda kapatana %2,5'i nakit iade. $10.000'lik parselde $500'e kadar.",
  takasGarantisi: "365 gün içinde beğenmezsen envanterdeki başka parselle DEĞİŞTİR. Yalnız taksitli alımlarda; ödenen anaparanın %100'ü yeni parsele sayılır (ücretler hariç). Tek bir gecikmiş ödeme garantiyi düşürür.",
  bonuslar: [
    { ad: "Mobil ev üreticilerine ayrıcalıklı erişim", deger: 2250 },
    { ad: "Erika ile aylık soru-cevap Zoom görüşmeleri", deger: 1200 },
    { ad: "3 gecelik otel hediye çeki (50+ lokasyon)", deger: 1000 },
    { ad: "Otel indirim kartı", deger: 500 },
    { ad: "30 dakikalık mimari danışmanlık (Erika mimar)", deger: 225 },
    { ad: "Kendi kendine yetme (homesteading) rehberi", deger: 150 },
    { ad: "İnşaat & imar rehberi", deger: 150 },
    { ad: "Kapanış sonrası kontrol listesi", deger: 100 },
    { ad: "Komşu sahip bulma eğitimi", deger: 100 },
  ],
  bonusToplam: 5675,
  cikarim: "Arsayı ÜRÜN gibi paketliyorlar: aciliyet (lot ayırma) + risksizlik (365 gün takas) + ödül (erken kapatmada nakit iade) + $5.675'lik algılanan ek değer. Fiyat kırmadan dönüşüm artırma oyunu.",
};

writeFileSync(OUT, JSON.stringify({
  uretildi: new Date().toISOString(),
  profil: {
    sirket: "Gokce Capital LLC",
    kurucu: "Erika Gokce",
    gecmis: "NYC Belediyesi Uygun Fiyatlı Konut Direktörü → tam zamanlı arsa yatırımcısı. USC mimarlık lisansı, Columbia şehir politikaları yüksek lisansı.",
    model: "Sahipten nakit teklifle boş arsa alır, kendi portföyünde tutar veya satar. Emlakçı değil — sattığı her parselin sahibi.",
    olcek: "700+ kişiyi arazi sahibi yapmış (kendi beyanı).",
    pazarlama: "Kitap (Land Investing Mistakes), YouTube kanalı, blog — içerik motoruyla inbound satıcı topluyor.",
    site: "gokcecapital.com",
    ilanSitesi: "gokcecapital.gokcap.com — CloudFront ile Türkiye'ye KAPALI (HTTP 403).",
  },
  ozet: {
    parselSayisi: parseller.length,
    toplamDonum: Math.round(toplamDonum * 100) / 100,
    toplamArsaDegeri: Math.round(toplamDeger),
    countySayisi: bolgeler.length,
    eyaletSayisi: new Set(parseller.map((p) => p.state)).size,
    tapuKaydi: tapu.length,
    ortusenBizimParsel: ortusme.reduce((a, o) => a + o.bizim_parsel, 0),
    ortusenBizimUstNot: ortusme.reduce((a, o) => a + o.bizim_ustnot, 0),
  },
  adresler,
  parseller,
  tapu,
  ortusme,
  ilanlar,
  ilanOzet,
  ilanKaynak: ilanDosya?.kaynak ?? null,
  ilanAlindi: ilanDosya?.alindi ?? null,
  eslesme,
  oyunKitabi,
}, null, 1));

console.log(`✔ ${OUT}`);
console.log(`  ${parseller.length} parsel · ${Math.round(toplamDonum)} dönüm · ${bolgeler.length} county · tapu kaydı ${tapu.length}`);
console.log(`  posta adresi (hepsi sanal ofis): ${adresler.length} farklı`);
if (ilanOzet) console.log(`  İLAN: ${ilanOzet.sayi} adet · liste değeri $${ilanOzet.listeDegeri.toLocaleString("en-US")} · ${ilanOzet.toplamDonum} dönüm`);
if (eslesme) console.log(`  tapu eşleşmesi ${eslesme.tapuEslesme} · bizim envanterde ${eslesme.envanterEslesme}`);
