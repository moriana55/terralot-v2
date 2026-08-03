# Ahmet — Pazarlama Araştırması (2 Ağustos 2026)

27 Temmuz'da açılan üç görevin cevabı. İkisi araştırma, üçüncüsü (telefon) veri hazırlığı;
üçünün de çıktısı hazır, telefonda sadece sağlayıcı seçimi kaldı.

Bütün rakamlar kendi veritabanımızdan ve ücretsiz ABD kamu kaynaklarından ölçüldü.
Tahmin yok; her etiketin arkasındaki sayı panelde satır satır görünüyor.

| Görev | Durum | Nerede |
|---|---|---|
| Toplu arsa alan şirketler hangi bölgede alıyor, toplu pazarlama yapabilir miyiz? | ✅ Bitti | `/admin/toplu-alicilar` |
| Bölgede yaşayanlar hangi amaçla orada yaşıyor? | ✅ Bitti | `/admin/bolge-profili` |
| Sahiplerin telefon numaralarına ulaşma | ✅ Liste hazır, sağlayıcı seçimi kaldı | `scraper/out/skiptrace-*.csv` |

---

## GÖREV 1 — Toplu arsa alan şirketler

### Kısa cevap
Evet, yapılabilir. **474 şirketin posta adresi kamu tapu kaydından birebir çıktı**, toplu
mektup listesi olarak bugün kullanılabilir. Ama tek liste değil **iki ayrı liste** var ve
ikisine aynı mektup yazılmamalı.

Envanterimizdeki 921.271 parselin **178.859'u (%19) kurumsal sahipli**, 56.191 ayrı şirket.
Eşiği geçen ve peşine düşmeye değer olanlar:

### A) Biriktiriciler — 300 şirket
Bizim tarama alanımızda **25+ parsel** biriktirmiş arsa şirketleri. Ucuz, uzak, taksitle
dönen parsel alırlar. Bunlar hem rakibimiz hem müşterimiz olabilir.

| Şirket | Parsel | Bölge | Posta adresi |
|---|---|---|---|
| Friendly Acres LLC | 1.662 | NM/Valencia | 5348 Vegas Dr, Las Vegas, NV |
| Colony Ridge Development LLC | 959 | TX/Liberty | PO Box 279, Fresno, TX |
| Stephens Properties LP | 950 | 8 county / 4 eyalet | 171 Bear Creek Rd, Sarver, PA |
| GovernmentAuction.com LLC | 944 | AR/Sharp, AR/Van Buren, TX/Hudspeth | 20272 West Valley Blvd, Tehachapi, CA |
| Land of Land Inc | 845 | AR/Sharp, FL/Charlotte, FL/Citrus | PO Box 66, Swedesboro, NJ |
| Cibola Land Corporation | 841 | NM/Valencia | PO Box 1668, Albuquerque, NM |

**Mesaj:** hacim, iskonto, portföy devri. Bunlar parseli gezmez, tabloya bakar.

### B) Aktif alıcılar — 200 şirket
Tapu kaydında **2023 ve sonrasında** devir almış, yani **hâlâ satın alan** şirketler. Ulusal
ev üreticileri burada çıkıyor.

| Şirket | 2023+ aldığı parsel | Ortalama alım | Posta adresi |
|---|---|---|---|
| Millrose Properties Florida LLC | 1.361 | $2.751.040 | 5505 Waterford District Dr, Miami, FL |
| D.R. Horton Inc | 979 | $3.029.493 | 3300 SW 34th Ave, Ocala, FL |
| Lennar Homes LLC | 640 | $945.525 | 10481 Ben C Pratt, Fort Myers, FL |
| Holiday Builders Inc | 599 | $88.140 | 2293 W Eau Gallie Blvd, Melbourne, FL |
| Adams Homes of Northwest Florida | 507 | $473.014 | 100 W Garden St, Pensacola, FL |
| Pulte Home Company LLC | 500 | $1.789.814 | 24311 Walden Center Dr #300, Bonita Springs, FL |

**Mesaj:** bölünebilir, altyapıya yakın, ruhsat alınabilir toplu parsel. Bunlar ucuz çöl
arsasıyla ilgilenmez; imar ve yol ister.

### Önce kime gidilir — envanterimizle örtüşme
Sayfadaki **kesişim** sütunu asıl karar aracı: şirketin topladığı county'lerde bizim kaç
A+/A notlu parselimiz var. Yüksekse toplu teklifin büyüklüğü de yüksek demektir.

| Şirket | Aynı county'de bizim A+/A parselimiz | Bölgeleri |
|---|---|---|
| Gokce Capital LLC | 12.193 | FL/Highlands, Putnam, NM/Valencia, OR/Klamath |
| WP RE Ventures 1 LLC | 11.632 | AZ/Mohave (4 alt bölge) |
| Frontier Equity Properties LLC | 11.055 | CO/Costilla, NM/Valencia, OR/Klamath |
| Online Land Sales LLC | 10.465 | AR/Izard, AR/Sharp, AZ/Mohave |
| CMH Homes Inc | 10.358 | FL/Charlotte, Citrus, Levy, Putnam |
| Brinvest LLC | 10.194 | NM/Valencia, OR/Klamath, TX/Brewster, TX/Hudspeth |

> ⚠ Kesişim, o county'deki **tüm** envanterimizdir — şirkete ayrılmış stok değil. Teklifin
> üst sınırını gösterir, hazır paketi değil.

**Panelde:** her iki liste de CSV olarak iniyor (şirket, parsel, bölge, posta adresi,
son alım yılı, ortalama alım fiyatı, kesişim).

---

## GÖREV 2 — İnsanlar bu bölgelerde neden yaşıyor?

### Yöntem
BLS QCEW (ABD çalışma istatistikleri, ücretsiz) county başına sektörel istihdam veriyor.
Ölçü olarak **LQ (location quotient)** kullanıldı: bir sektörün o county'de ülke
ortalamasına göre kaç kat yoğun olduğu. Mutlak istihdama bakarsan her yerde "sağlık +
perakende" çıkar ve hiçbir şey öğrenmezsin; yaşam sebebini LQ söyler.

Buna nüfus, medyan yaş, gelir, ev değeri ve büyüme eklendi. **234 county = envanterin %100'ü.**

### Cevap — parsel ağırlıklı
| Yaşam sebebi | Parsel | County | Pay |
|---|---|---|---|
| **Yatak bölgesi (şehre komşu)** | 257.555 | 46 | %28 |
| **Emeklilik bölgesi** | 185.626 | 34 | %20 |
| Tarım · çiftçilik | 124.873 | 22 | %14 |
| Madencilik · enerji | 112.437 | 50 | %12 |
| Kırsal · karma | 64.938 | 34 | %7 |
| Turizm · ikinci ev | 54.376 | 15 | %6 |
| İmalat · lojistik | 50.814 | 19 | %6 |
| Askeri / federal üs | 27.994 | 6 | %3 |
| Üniversite kasabası | 25.008 | 8 | %3 |

**En önemli sonuç: envanterin yarısı iki hikâyede toplanıyor.** Tek genel metin yazmak
yerine iki ana mektup şablonu kurup county'ye göre seçmek doğru olan.

> County sayısına göre sıralamak yanıltıcı olurdu: madencilik 50 county'de çıkıyor ama
> 112K parsel, yatak bölgesi 46 county'de ama 257K parsel. Karar parsele göre verilir.

### En büyük 12 county
| County | Parsel | A+/A | Yaşam sebebi | Ölçülen gerekçe |
|---|---|---|---|---|
| NM/Valencia | 139.526 | 6.978 | Yatak bölgesi | 77.382 nüfus, county içinde sadece 17.446 iş (%23) — Albuquerque'e gidiyorlar |
| NV/Nye | 52.097 | 2.614 | Madencilik | Madencilik LQ **19,4** |
| OR/Klamath | 37.983 | 2.368 | Tarım | Tarım LQ 4,9 |
| CO/Costilla | 33.153 | 1.709 | Tarım | Tarım LQ 17,3 |
| AR/Sharp | 31.996 | 690 | Emeklilik | Medyan yaş 47,5 |
| TX/Liberty | 30.719 | 1.609 | Yatak bölgesi | 97.993 nüfus, 20.119 iş (%21) — Houston'a gidiyorlar |
| NC/Brunswick | 27.882 | 1.525 | Turizm · ikinci ev | Rekreasyon LQ 2,7 · konaklama LQ 1,7 |
| KS/Douglas | 20.978 | 1.059 | Üniversite | İstihdamın %10'u eyalet kurumu, medyan yaş 31,3 (Kansas Üniversitesi) |
| AR/Izard | 20.464 | 155 | Emeklilik | Medyan yaş 47,5 · sağlık LQ 1,4 |
| AZ/Mohave | 19.942 | 1.003 | Emeklilik | Medyan yaş 53,2 |
| NC/Rutherford | 19.807 | 2 | Yatak bölgesi | 64.850 nüfus, 17.994 iş (%28) |
| AR/Van Buren | 19.125 | 71 | Emeklilik | Medyan yaş 49,6 |

### Her sebebin satış karşılığı
| Yaşam sebebi | Alıcı kim, ne ister |
|---|---|
| Yatak bölgesi | En güçlü hikâye: "şehre X dk, arsa fiyatı şehrin çeyreği". Kendi evini yapmak isteyen aile. |
| Emeklilik | Nakit gücü olan, acelesi olmayan kitle. Sessizlik, iklim, düşük vergi. |
| Tarım | Toprağı bilen alıcı. Dönüm, su hakkı, yol cephesi — "yatırım" değil "kullanım" dili. |
| Madencilik · enerji | Yüksek maaş, dönemsel iş. Peşinat gücü var, hızlı karar. Büyük parsel + kısa vade. |
| Turizm · ikinci ev | Alıcı çoğunlukla bölge dışından. Manzara, kamp/karavan, hafta sonu. |
| Askeri / federal üs | Sık taşınan, kirada oturan, maaşı düzenli kitle. Taksit + "ilk arsan". |
| Üniversite kasabası | Genç, peşinatı düşük, uzun vadeli. Küçük parsel + uzun taksit. |
| İmalat · lojistik | İstikrarlı maaşlı, yerleşik. Taksitli konut arsası. |
| Kırsal · karma | Belirgin tek sebep yok — parselin kendi özelliği (yol/elektrik/su) öne çıkar. |

---

## GÖREV 3 — Telefon numaraları

### Liste hazır: `scraper/out/skiptrace-2026-08-02-15625.csv`
Sahip adı + yeri, skip-trace sağlayıcısına verilecek formatta çıkarıldı. Kolonlar:
ad, soyad, posta adresi/şehir/eyalet/zip, mülk adresi, county, eyalet, APN, kaç parseli
olduğu, toplam dönüm, not, absentee, koordinat.

**37.111 A+/A parsel → 15.625 tekil kişi.** Aradaki fark bilerek: skip-trace **kayıt
başına** ücretlendirir; aynı kişiyi 99 parseli için 99 kez sorgulamak 99 kat para demek,
telefon zaten aynı. Kişi bazında tekilleştirince **maliyet %58 düştü**.

| Ölçü | Değer |
|---|---|
| Tekil kişi (ödenecek kayıt) | **15.625** |
| Posta adresi dolu | 15.611 (%100) |
| Mülk adresi dolu | 8.307 (%53) |
| Ad/soyad ayrıştı | 14.155 (%91) |
| Absentee (arsanın olduğu yerde oturmuyor) | **12.708** |
| Birden fazla parseli olan | 1.922 |
| Elenen şirket/kurum sahipli kayıt | 16.794 |

### Önce aranacaklar — çok parselli sahipler
Tek görüşmede toplu iş çıkar:

| Parsel | Dönüm | Kişi | Nerede oturuyor |
|---|---|---|---|
| 99 | 247 | Shahram Golbari | Los Angeles, CA |
| 95 | 378 | Rogelio Zepeda | Hobart, IN |
| 88 | 3.598 | Frank Reichwein | Topanga, CA |
| 88 | 123 | Uta Petersen | Morgan Hill, CA |
| 59 | 169 | Kent Taylor | Austin, TX |
| 50 | 172 | John Vantress | Pahrump, NV |

### Neden şirketler listede yok
LLC / INC / TRUST sahipli 16.794 kayıt elendi — skip-trace gerçek kişide çalışır, şirket
kaydında telefon çıkmaz, kayıt başına para boşa gider. Şirketlere ulaşmak ayrı bir iş ve
onun listesi zaten `/admin/toplu-alicilar` sayfasında posta adresleriyle duruyor.
İstenirse `KURUMSAL=1` ile dahil edilebilir.

### Kalan tek karar
**Hangi sağlayıcı?** PropStream (mevcut elle export akışı) mı, API'li servis
(BatchData / Skip Genie) mi. API'li olursa otomatikleştirilir, elle dosya alıp verme
biter. Telefonlar geldiğinde geri yükleme hazır:
`node scraper/load-skiptrace.mjs <dosya.xlsx>` → `/admin/arama` kuyruğu dolar.

### Bilinen sınır
AR (71.585 kayıt), TN ve OK'ta kaynak katmanlarda **posta adresi alanı hiç yok** — sahip
adı, mülk adresi ve county var, skip-trace'e girebiliyorlar ama eşleşme oranları posta
adresi olanlardan düşük çıkacaktır. Beklenti buna göre kurulmalı.

---

## Veri altyapısında bu turda düzelenler

Bu araştırmalar sırasında çıkan ve kapatılan gerçek boşluklar:

- **Panel 15 eyalet gösteriyordu, veritabanında 25 eyalet vardı.** Eyalet listesi kodda
  elle sabitlenmiş, yeni hasat edilen 10 eyalet hiç görünmüyordu (565.930 yerine 921.271).
- **Costilla'nın 29.969 parselinde koordinat yoktu** — hasat betiği ArcGIS'ten geometriyi
  hiç istememiş. Koordinatsız parsel haritada çıkmaz ve geo doğrulaması alamaz, yani
  A+/A vitrine hiç giremezdi. Backfill yapıldı, kaynak betik de düzeltildi.
  Texas'ta 15.750, Oklahoma'da 240 kayıt daha dolduruldu.
  **Koordinat kapsamı: %95 → %99,95** (468 kayıt kaldı, o county'lerin açık servisi yok).
- **Geo doğrulaması 13 eyalette sıfırdı.** Geo puanı olmayan kayıt global sıralamaya
  giremediği için sonsuza dek B tavanında kalıyordu. İki tur koşuldu (toplam ~17,7 saat,
  157.865 lead işlendi): geo-doğrulanan **46.198 → 207.630 (4,5 kat)**, A+/A notlu parsel
  **16.437 → 37.324 (2,3 kat)**. Satılabilir vitrin envanteri, tek bir yeni parsel hasat
  edilmeden, sadece elimizdekinin doğrulanmasıyla ikiye katlandı.
- Bölge profilinde AZ county adları alt bölge olarak yazıldığından (Dolan Springs,
  Meadview, Yucca…) Mohave County hiç eşleşmiyordu; 19.942 parsellik en büyük AZ
  envanterimiz profilsizdi. Birleştirildi.

---

*Üreten betikler: `scraper/build-toplu-alicilar.mjs` · `scraper/build-bolge-profili.mjs`
Kaynaklar: kendi tapu/parsel veritabanımız, BLS QCEW 2024, Census ACS/PEP/BPS, Zillow Research.*
