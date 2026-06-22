# ABD Eyalet Bazlı Tax-Delinquent / Tax-Sale Veri Durumu

> **Amaç:** Terralot (ABD off-market arsa platformu) için scraper kapsamını planlamak.
> Tax-lien & tax-deed (vergi borcu / vergi satışı) listelerinin **online + ÜCRETSİZ** erişilebilirliği eyalet eyalet incelendi.
> **Araştırma tarihi:** Haziran 2026. Tüm bulgular web araştırmasına (resmi county/eyalet siteleri, statüler, açık artırma platformları) dayanıyor — tahmin yok, kaynak gösterildi.

## Kategoriler (Lejant)

| Simge | Kategori | Anlamı |
|-------|----------|--------|
| ✅ | **ÜCRETSİZ / KOLAY** | County'ler listeleri ücretsiz online yayınlıyor VEYA ücretsiz erişilebilir merkezi (statewide) sistem var |
| ⚠️ | **PLATFORM / KISMİ** | Veri çok-county açık artırma platformları üzerinden geliyor (kazınabilir ama platform başına iş) VEYA county kapsamı karışık |
| ❌ | **ÜCRETLİ / ZOR / YOK** | Abonelik gerekiyor, sadece şahsen/PDF, ağır anti-bot, ya da online liste yok |

**Tür kısaltmaları:** LIEN = tax lien (vergi haczi sertifikası) · DEED = tax deed (mülk tapusu satışı) · REDEEM-DEED = redeemable/itfa edilebilir tapu · HYBRID = ikisi karışık

---

## 1. ÖZET TABLO — 50 Eyalet + DC

| # | Eyalet | Kat. | Tür | Ana Kaynak / Platform | Ücretsiz? | Not |
|---|--------|------|-----|------------------------|-----------|-----|
| 1 | **AL** Alabama | ⚠️ | HYBRID (county seçer) | GovEase + AL DOR state PDF | Kısmi | DOR PDF'lerinde adres yok; GovEase login |
| 2 | **AK** Alaska | ✅ | DEED (borough) | Borough siteleri + ArcGIS | Evet | Parçalı (~16 borough), satışlar aralıklı |
| 3 | **AZ** Arizona | ✅ | LIEN (CP, 16% bid-down) | RealAuction `{county}.arizonataxsale.com` | Evet | **En kolay eyalet** — tek template tüm eyalet |
| 4 | **AR** Arkansas | ✅ | REDEEM-DEED | **COSL statewide** (cosl.org) | Evet | Tek merkezi sistem, 75 county, login/captcha yok ⭐ |
| 5 | **CA** California | ⚠️ | DEED | Bid4Assets + GovEase + Grant Street | Evet | 58 county, merkezi yok; Bid4Assets 403 (Cloudflare) |
| 6 | **CO** Colorado | ✅ | LIEN (redeem. treasurer's deed) | RealAuction `{county}.coloradotaxsale.com` + SRI/Zeus + county PDF | Evet | Front Range RealAuction, dağlık SRI/Zeus |
| 7 | **CT** Connecticut | ✅ | REDEEM-DEED | **cttaxsales.com** (Pullman & Comley hub) | Evet | Tek merkezi hub, captcha yok ⭐ |
| 8 | **DE** Delaware | ✅ | REDEEM-DEED (monition) | County sheriff PDF; Sussex Bid4Assets | Evet | 3 county; Kent/Sussex 403 |
| 9 | **DC** Washington DC | ✅ | LIEN | **OTR merkezi** (otr.cfo.dc.gov) | Evet | Tek ücretsiz PDF, en temiz hedef ⭐ |
| 10 | **FL** Florida | ⚠️ | HYBRID (cert→deed) | LienHub (cert) + RealAuction/RealTaxDeed (deed) | Evet | Cert=LienHub, Deed=RealAuction split |
| 11 | **GA** Georgia | ✅ | REDEEM-DEED (20% penalty) | 159 county sitesi (parçalı) | Evet | Çok parçalı, çoğu şahsen ilk-Salı satışı |
| 12 | **HI** Hawaii | ⚠️ | DEED (county) | Legal notices + county siteleri | Kısmi | Sadece Maui temiz liste veriyor |
| 13 | **ID** Idaho | ⚠️ | DEED | RealAuction + Bid4Assets + county PDF | Evet | Karışık; Kootenai en temiz |
| 14 | **IL** Illinois | ⚠️ | HYBRID (cert→deed) | Cook (kendi) + Joseph E. Meyer/iltaxsale.com | Kısmi | Cook Clerk 403; ~94 county tek mütevelli |
| 15 | **IN** Indiana | ⚠️ | LIEN | **SRI Inc / Zeus Auction** + county PDF | Evet | Tek entegrasyon ~92 county; en kolay platform eyaleti |
| 16 | **IA** Iowa | ⚠️ | LIEN | GovEase + iowataxauction.com | Kısmi | Listeler registration-gated, bazı 403 |
| 17 | **KS** Kansas | ⚠️ | DEED (judicial) | County siteleri + CivicSource (Wyandotte) | Çoğu | Merkezi yok |
| 18 | **KY** Kentucky | ✅ | LIEN (cert. of delinquency) | County clerk + **KY DOR merkezi index** | Evet | Clerk'ler 30 gün önce zorunlu yayın ⭐ |
| 19 | **LA** Louisiana | ⚠️ | REDEEM (3 yıl) | **CivicSource** (~50 parish) + Bid4Assets | Evet (browse) | Parish'ler; New Orleans + Baton Rouge dahil |
| 20 | **ME** Maine | ⚠️ | Otomatik lien→tax-acquired | Broker/MLS (2024 yasası) + city | Evet | 2024 yasası satışı broker'a zorunlu kıldı |
| 21 | **MD** Maryland | ⚠️ | LIEN cert | RealAuction `*.marylandtaxsale.com` + Baltimore open-data | Evet | Baltimore City açık-veri API'si en temiz |
| 22 | **MA** Massachusetts | ❌ | HYBRID/redeem | Auctioneer + özel toplu alıcı (Tallage) | Hayır | Merkezi liste yok, çoğu özel toplu devir |
| 23 | **MI** Michigan | ✅ | DEED | **Tax-Sale.info** (~74 county) + Bid4Assets (Wayne) | Evet | Tek site neredeyse tüm eyalet ⭐ |
| 24 | **MN** Minnesota | ✅ | DEED (forfeited land) | County + PublicSurplus + MNBid | Evet | Düşük anti-bot, açık parsel listeleri |
| 25 | **MS** Mississippi | ⚠️ | LIEN (2 yıl redeem) | GovEase + MS SOS tax-forfeited GIS | Kısmi | SOS GIS map ücretsiz; GovEase login |
| 26 | **MO** Missouri | ✅ | HYBRID redeem cert→deed | Per-county collector siteleri | Evet | Merkezi yok, çoğu şahsen satış |
| 27 | **MT** Montana | ✅ | LIEN (assignment) | Per-county treasurer siteleri | Evet | Platform yok (county lienholder); günlük güncel |
| 28 | **NE** Nebraska | ✅ | LIEN cert | County + **NE DOR merkezi liste** + RealAuction (Douglas) | Evet | Eyalet merkezi liste var |
| 29 | **NV** Nevada | ⚠️ | DEED | Bid4Assets + county treasurer PDF | Evet | County PDF kolay; Bid4Assets 403 |
| 30 | **NH** New Hampshire | ⚠️ | DEED (municipal) | nhtaxdeedauctions.com + JSJ Auctions | Evet | Ücretsiz aggregator'lar, kısmi kapsam |
| 31 | **NJ** New Jersey | ⚠️ | LIEN | **RealAuction** (newjerseytaxsale.com) | Evet | 565 belediye, tek platform, öngörülebilir subdomain ⭐ |
| 32 | **NM** New Mexico | ⚠️ | DEED (redemption yok) | **Eyalet PTD** PDF (tax.newmexico.gov) | Evet | Eyalet yönetir, sadece PDF, şahsen bidding |
| 33 | **NY** New York | ⚠️ | HYBRID (NYC lien, upstate deed) | NYSAUCTIONS/AAR + Auctions Intl + LienHub + NYC Open Data | Evet | NYC Open Data API en temiz; çok kaynaklı |
| 34 | **NC** North Carolina | ⚠️ | Foreclosure→DEED (lien yok) | Law firm (Kania/ZLS/Ruff Bond) + county/GIS | Evet | 10-günlük upset-bid; Kania/Mecklenburg 403 |
| 35 | **ND** North Dakota | ❌ | DEED | County auditor; gazete + dağınık PDF | Zor | Merkezi yok, Kasım-only, çoğu şahsen |
| 36 | **OH** Ohio | ⚠️ | HYBRID (lien + deed) | 88 county; RealAuction (foreclosure/deed) | Kısmi | Büyük county'ler lien'i toplu satıyor (retail liste yok) |
| 37 | **OK** Oklahoma | ⚠️ | HYBRID (Eki lien + Haz resale deed) | 77 county treasurer; bazıları GovEase | Kısmi | Metrolar ücretsiz; kırsal patchy, 403 |
| 38 | **OR** Oregon | ⚠️ | DEED | Per-county PDF (sık boş) | Evet | Dağınık, platform yok, formatlar değişken |
| 39 | **PA** Pennsylvania | ⚠️ | DEED | County Tax Claim Bureau PDF + GovDeals/Bid4Assets | Evet | 67 county PDF; Philly/Allegheny Sheriff |
| 40 | **RI** Rhode Island | ✅ | REDEEM-DEED | ~39 belediye sitesi + CivicSource (Providence) | Evet | Parçalı ama ücretsiz, captcha yok |
| 41 | **SC** South Carolina | ⚠️ | REDEEM-DEED (12 ay) | County delinquent tax collector | Evet | Listeler ücretsiz, çoğu şahsen satış, 46 county |
| 42 | **SD** South Dakota | ⚠️ | LIEN/cert (county-held) | County treasurer + sdcounties.org | Kısmi | Karışık format; sdcounties.org 403 |
| 43 | **TN** Tennessee | ⚠️ | REDEEM-DEED (12%/yıl) | GovEase (baskın) + SRI/Zeus + CivicSource + PDF | Evet | Parçalı (~95 county Chancery Court) |
| 44 | **TX** Texas | ⚠️ | REDEEM-DEED (25%/50%) | **LGBS** (taxsales.lgbs.com) + MVBA + county + RealAuction | Evet | Listeler ücretsiz, 3 ana law-firm portalı |
| 45 | **UT** Utah | ✅ | DEED | County HTML listeleri; PublicSurplus (bid) | Evet | En kolay batı eyaleti, captcha yok (sezonsal Mayıs) |
| 46 | **VT** Vermont | ❌ | Town sale (redeem.) | Gazete legal notice + dağınık town | Hayır | Merkezi liste/platform yok — en zor New England |
| 47 | **VA** Virginia | ⚠️ | DEED (judicial) | TACS/taxva.com + forsaleatauction.biz + Bid4Assets | Evet | Tahsilat firmaları yönetiyor, per-sale |
| 48 | **WA** Washington | ⚠️ | DEED | Bid4Assets + RealAuction (King) + county PDF | Evet | County PDF ücretsiz; sezonsal Eyl–Kas |
| 49 | **WV** West Virginia | ⚠️ | LIEN (State Auditor) | **WVSAO.gov** merkezi | Evet | 2022 reformu satışı eyalete taşıdı — tek viewer ⭐ |
| 50 | **WI** Wisconsin | ✅ | DEED (in-rem) | County treasurer + Wisconsin Surplus | Evet | Lien sertifikası yok |
| 51 | **WY** Wyoming | ❌ | LIEN | Büyük county'lerde sadece gazete; bazı PDF | Karışık | Çoğu şahsen lottery; düşük ROI |

---

## 2. KATEGORİ DAĞILIMI

### ✅ ÜCRETSİZ / KOLAY (16 eyalet + DC)
AK, AR, AZ, CO, CT, DE, **DC**, GA, KY, MI, MN, MO, MT, NE, RI, UT, WI

> County'ler veya eyalet doğrudan ücretsiz yayınlıyor. Ana maliyet: county-başına fan-out + PDF parsing. Captcha/paywall yok.

### ⚠️ PLATFORM / KISMİ (30 eyalet)
AL, CA, FL, HI, ID, IL, IN, IA, KS, LA, ME, MD, MS, NV, NH, NJ, NM, NY, NC, OH, OK, OR, PA, SC, SD, TN, TX, VA, WA, WV

> Veri çok-county açık artırma platformları üzerinden VEYA county kapsamı karışık. Kazınabilir ama platform başına iş gerekir. Bazı metrolarda 403/WAF anti-bot.

### ❌ ÜCRETLİ / ZOR / YOK (4 eyalet)
MA, ND, VT, WY

> Merkezi liste yok, gazete/şahsen ağırlıklı, özel toplu devir (MA-Tallage) veya çok düşük ROI.

**Toplam: 17 ÜCRETSİZ · 30 PLATFORM · 4 ZOR = 51 jurisdiction**

> Not: "ücretli abonelik şart" diyen hiç eyalet yok — çekirdek listeler her yerde en azından kısmen ücretsiz. ND/VT/WY "zor" çünkü liste dağınık/gazete/şahsen; MA "zor" çünkü özel toplu devir + merkezi liste yok.

---

## 3. ÇOK-COUNTY PLATFORMLARI (KALDIRAÇ ANALİZİ)

Tek entegrasyonla çok eyalet/county açan platformlar. Sıralama = **kapsam × ücretsiz-görüntülenebilirlik × kazıma kolaylığı**.

### Tier 1 — En İyi Kaldıraç (çok eyalet + ücretsiz görüntüleme)

| Platform | Kapsam | Ücretsiz görüntüleme? | Kazıma | URL |
|----------|--------|----------------------|--------|-----|
| **Bid4Assets** | ~10+ eyalet, 100+ county (CA'nın 56/58'i baskın) + WA, PA, NV, MN, LA, OK, FL, VA, MD, GA, MO | **EVET — tamamen public** (APN, açılış teklifi, deadline login'siz görünür) | Server-rendered HTML (Next.js), stabil URL pattern. WebFetch 403 ama **curl + browser UA = 200**. Captcha yok. **En kolay yüksek-kapsam hedef** | bid4assets.com |
| **SRI / Zeus Auction** | 7 eyalet (CO, FL, IN, IA, LA, MI, TN), 80+ county (IN ağırlıklı) | **EVET — login'siz arama** + indirilebilir liste | `properties.sriservices.com` JS SPA → headless veya gizli JSON API. **Çok değerli (multi-state + ücretsiz)** | sriservices.com / zeusauction.com |

### Tier 2 — Yüksek Kapsam Ama Gated/Zor

| Platform | Kapsam | Ücretsiz görüntüleme? | Kazıma | URL |
|----------|--------|----------------------|--------|-----|
| **RealAuction** (RealTaxLien/RealTaxDeed/RealForeclose) | **11 eyalet** (FL ağırlıklı, düzinelerce FL county + AZ, CO, MD, NJ, WA, OH, ID), 100+ county sitesi | **Kısmi** — takvimler public; tam parsel listesi ücretsiz login arkasında | Per-county ColdFusion (`{county}.realtaxdeed/realtaxlien/realforeclose.com`). **Agresif Cloudflare/WAF → tüm otomatik fetch'lerde 403.** API yok | realauction.com |
| **GovEase** | **14 eyalet** (en geniş eyalet sayısı: AL, AZ, CA, CO, GA, IN, IA, LA, MS, OK, PA, TN, TX, WA), 100+ county | **Gated** — hesap zorunlu, listeler sadece 2–4 hafta önce | Merkezi JS SPA, auth gate. API yok. **En zoru** | govease.com |
| **LienHub / Grant Street** | **Sadece Florida, 30+ county** (Miami-Dade, Broward, Palm Beach, Pinellas) | **Gated** — pre-registration | Site-geneli Cloudflare captcha + login + JS. 403. **Workaround: county tax-collector sitelerini kaz** | lienhub.com |

### Tier 3 — Kolay Ama Düşük Kapsam / Bölgesel

| Platform | Kapsam | Ücretsiz? | Not |
|----------|--------|-----------|-----|
| **CivicSource** (Archon) | LA ağırlıklı + TN, MO, KS, MS, RI | Evet (browse) | JS SPA, SSR yok → headless gerekir. **RealAuction ile bağlantısı YOK** (ayrı rakipler) |
| **GUTS** (g-uts.com) | IN + KY | **EVET — public PDF** | **En kolay kazıma**: `taxsale.g-uts.com/publicreports.aspx?...` numaralandırılabilir PDF endpoint. Login/captcha yok. IN için hızlı kazanç |
| **PublicSurplus** | MN (çok), AZ (Cochise), UT (Salt Lake) | Evet | Public HTML, scraper-dostu; düşük kapsam |
| **Tax-Sale.info** (Title Check) | MI (~74 county) | Evet (browse) | Tek site neredeyse tüm Michigan |
| **cttaxsales.com** (Pullman & Comley) | CT (de facto merkezi) | Evet | Static WordPress hub, izin verici robots.txt |
| **WVSAO.gov** | WV (eyalet geneli) | Evet | 2022 reformu sonrası tek viewer |

### Önemli Düzeltmeler (orijinal varsayımlar)
- **CivicSource ≠ RealAuction** — ayrı rakipler (ünlü dava Grant Street v. RealAuction'dı).
- **GovDeals tax-sale platformu DEĞİL** — surplus; tax-sale kardeşi Bid4Assets.
- **"bidGUTS" diye bir şey yok** — GUTS bir county yazılım/back-office sağlayıcısı (PDF endpoint'leri açık).
- **Tax Sale Resources** = ücretli aggregator (5.100+ jurisdiction, 1.4M lien/yıl) ama tamamen paywall: **$582–$4.970/yıl**. Kazımak yerine satın alma seçeneği.

### Kaldıraç Önceliği (özet)
1. **Bid4Assets** — en geniş ÜCRETSİZ HTML, sadece browser UA gerekir. Tek entegrasyon ~10 eyalet.
2. **SRI/Zeus** — 7 eyalet ücretsiz, headless gerekir.
3. **RealAuction** — en yüksek ham kapsam (11 eyalet) ama Cloudflare 403 + login.
4. **GUTS** — IN için ucuz hızlı kazanç (açık PDF).

---

## 4. İŞ BAĞLAMI — INSTALLMENT (OWNER-FINANCE) EYALETLERİ

Terralot taksitli satışı **sadece** şu 5 eyalette yapıyor: **TX, FL, AZ, NM, CO** (NY'de YAPMIYOR).
Bu eyaletlerin veri durumu kritik:

| Eyalet | Kat. | Tür | Durum & Scraper Stratejisi |
|--------|------|-----|----------------------------|
| **AZ** Arizona | ✅ **EN İYİ** | LIEN | Neredeyse tüm county tek RealAuction şeması `{county}.arizonataxsale.com`. **Tek reusable scraper tüm eyaleti açar.** Treasurer PDF booklet'leri yedek. Veri sezonsal (Şubat satışları). |
| **CO** Colorado | ✅ **İYİ** | LIEN (redeem. deed) | Ücretsiz county PDF listeleri (statüsel gazete ilanı) + RealAuction Front Range + SRI/Zeus dağlık. **En iyi ROI: önce county PDF, sonra RealAuction template.** Bid4Assets KULLANILMIYOR. |
| **FL** Florida | ⚠️ KISMİ | HYBRID | Cert (lien) = **LienHub** (`lienhub.com/county/<county>/certsale`); Deed = **RealAuction** (`<county>.realtaxdeed.com`). Görüntüleme ücretsiz, bidding için kayıt+depozito. Öngörülebilir subdomain pattern ama LienHub ToS otomatik erişimi kısıtlıyor + ikisi de JS/session-gated. |
| **TX** Texas | ⚠️ KISMİ (ücretsize yakın) | REDEEM-DEED | Listeler ücretsiz ama 3 portala dağılmış: **LGBS** (taxsales.lgbs.com — Dallas, Tarrant + çok county, aranabilir tablo+harita) baskın hedef; **MVBA** daha çok county; Harris kendi sitesi (hctax.net); Travis RealAuction; Bexar county PDF. JS-rendered, headless gerekir. Free liste görüntülemede captcha yok. |
| **NM** New Mexico | ⚠️ KISMİ | DEED (redemption yok) | **Eyalet** yönetir (county değil): NM Tax & Revenue PTD tek sayfa, ücretsiz PDF açık artırma ilanları (`tax.newmexico.gov/.../AuctionAdvertisement-<County>-<date>.pdf`). Aranabilir DB yok, online bidding yok (şahsen). **PDF/OCR tablo parsing gerekir**, event-driven. |

**İş notu:** Installment eyaletlerinin hiçbiri ❌ değil. AZ ve CO ✅ (en sağlam). TX, FL, NM ⚠️ ama hepsinde ücretsiz görüntülenebilir veri var. AZ + CO + FL deed tarafı **aynı RealAuction motoruyla** kazınabilir (yüksek kaldıraç).

---

## 5. PAZARTESİ DEMO — HIZLI KAZANÇ ÖNERİSİ

**Şu an kazınmış 12 eyalet:** FL, TX, TN, NC, GA, OH, AZ, AR, CO, MI, NM, OK

Bunlara EK olarak, ✅ ücretsiz/kolay kategorisinden **hızlıca eklenebilecek 5 eyalet** (öncelik sırasıyla):

| Öncelik | Eyalet | Neden Hızlı | Kaynak |
|---------|--------|-------------|--------|
| **1** | **DC** Washington DC | Tek otorite (OTR), tek ücretsiz PDF, captcha yok. **En düşük efor.** 2026 satışı 15 Tem. | otr.cfo.dc.gov/page/real-property-tax-lien-sale-and-resources |
| **2** | **KY** Kentucky | County clerk'ler 30 gün önce zorunlu online yayın; KY DOR merkezi index tüm clerk'leri listeler. Ücretsiz PDF/Excel. | revenue.ky.gov/Property/Pages/Third-Party-Purchaser.aspx |
| **3** | **NE** Nebraska | NE DOR statewide "Delinquent Real Property List" + county listeleri. Tek merkezi liste. | revenue.nebraska.gov/PAD/real-property/nebraska-delinquent-real-property-list |
| **4** | **WV** West Virginia | 2022 reformu sonrası tek merkezi viewer WVSAO.gov, county/status arama, görüntüleme ücretsiz. | wvsao.gov/CountyCollections/ |
| **5** | **IN** Indiana | SRI/Zeus tek entegrasyon ~92 county + GUTS açık PDF endpoint'leri (login/captcha yok). | sriservices.com · taxsale.g-uts.com |

**Alternatif tek-eyalet kolay hedefler** (county-başına iş ama anti-bot yok): **UT** (May, county HTML), **MN** (PublicSurplus + MNBid), **WI** (Wisconsin Surplus), **CT** (cttaxsales.com tek hub).

**Kaldıraç bonusu:** Eğer demo öncesi **Bid4Assets** entegrasyonu eklenirse — tek scraper ile **CA, NV, WA, PA, MN, LA, GA, MO, VA, MD**'den parsel akışı açılır (server-rendered HTML, browser UA yeterli). Bu en yüksek tek-entegrasyon kaldıracı.

---

## 6. SCRAPER MÜHENDİSLİK NOTLARI

- **En kolay build'ler:** AZ (tek RealAuction template, statewide), AR (cosl.org tek sistem), MI (Tax-Sale.info), DC (tek PDF), WV (WVSAO.gov).
- **En yüksek ROI reusable scraper:** RealAuction motoru (AZ + CO Front Range + FL deed + TX Travis aynı engine) — ama Cloudflare 403/login.
- **Bid4Assets:** WebFetch 403 verir ama `curl` + browser User-Agent = 200. Headless + stealth + residential IP en sağlamı.
- **PDF parsing gerektiren:** NM, GA, Bexar TX, çoğu CO/TN county, DC, CT, RI, DE, ND, SD, AL DOR, KY, Tulsa OK.
- **Ortak anti-bot pattern:** .gov siteleri 403/503 (WAF) döndürüyor (Arapahoe CO, Cobb GA, Mecklenburg NC, Franklin OH, Douglas NE, Cook IL, Milwaukee WI, St. Louis MO, Cass ND). Plan: headless browser + UA rotation. Public liste görüntülemede hard CAPTCHA nadir (LienHub ve bazı RealAuction istisna).
- **ArcGIS hub'ları** (Guilford NC, MS SOS, AK borough'lar): JS-heavy ama altta yatan **ArcGIS REST FeatureServer JSON** doğrudan query'lenebilir — UI'ı kazımaya gerek yok.
- **Açık veri API'leri (en temiz):** NYC Open Data (Socrata, dataset 9rz4-mjek), Baltimore City Open Data.
- **Sezonsallık:** Çoğu liste mevsimsel — UT (Mayıs), AZ (Şubat), NV (Şub–May), WA (Eyl–Kas), MI (Ağu–Eyl), MO (Ağustos 4. Pzt), DC (Tem 15), ND (Kasım). Scraper'ı takvimle tetikle.

---

## 7. KAYNAKLAR (Örnek — her bulgu yukarıda ilgili satırda)

**Merkezi sistemler:** cosl.org (AR) · otr.cfo.dc.gov (DC) · wvsao.gov (WV) · tax-sale.info (MI) · revenue.ky.gov (KY) · revenue.nebraska.gov (NE) · tax.newmexico.gov (NM) · cttaxsales.com (CT) · sos.ms.gov/public-lands (MS) · mnbid.mn.gov (MN)

**Platformlar:** bid4assets.com · realauction.com · govease.com · lienhub.com · sriservices.com / zeusauction.com · civicsource.com · g-uts.com · publicsurplus.com · grantstreet.com (mytaxsale.com) · taxsaleresources.com (ücretli)

**Installment eyalet portalları:** `{county}.arizonataxsale.com` (AZ) · `{county}.coloradotaxsale.com` (CO) · taxsales.lgbs.com + mvbalaw (TX) · `<county>.realtaxdeed.com` + lienhub.com (FL) · tax.newmexico.gov PTD (NM)

> Bu döküman web araştırmasına dayanır (Haziran 2026). Eyalet yasaları ve platform sözleşmeleri değişebilir (örn. WV SB 683/2025 özel müzayedeci yetkilendirdi, CO HB24-1056 reformu, ME 2024 broker yasası, AL Act 2018-577). Production scraper öncesi kritik eyaletlerde son durumu doğrula.
