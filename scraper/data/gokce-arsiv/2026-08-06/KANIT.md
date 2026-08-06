# Gokce Capital — kanıt dosyası

**Tarih:** 2026-08-06 · Her satır canlı sorguyla doğrulandı.

---

## ⛔ ÖNCE ŞUNU OKU — "2.600'e alıp 14.497'ye satıyor" İDDİASI GEÇERSİZ

Bu iddia iki ayrı sebepten çöküyor. İkisi de 2026-08-06'da doğrulandı:

**1. Eşleştirilen parsel Gokce'nin değil.**
`11-11-26-8243-0260-0180` — "5,6 kat" hesabının dayandığı parsel. Florida eyalet
kadastro kaydında sahibi **REEL SPEEDY LLC**, Gokce Capital değil.

**2. Elimizdeki alım fiyatlarının hiçbiri piyasa alımı değil.**
Gokce'ye ait 10 parselin **10'unda da** `QUAL_CD1 = "11"`.
Florida DOR kod listesinde 11 = *düzeltme tapusu, quit-claim, vergi tapusu, asgari
damga vergisiyle ya da hiç damga ödenmeden yapılan devir* →
[floridarevenue.com/property/Documents/salequalcodes_bef01012025.pdf](https://floridarevenue.com/property/Documents/salequalcodes_bef01012025.pdf)

Yani `SALE_PRC1` alanındaki $2.300 · $2.400 · $19.419 rakamları **"şu parayı verip
aldı" demek DEĞİL**. Bunlar niteliksiz devir bedelleri.

> Projenin kendi kodunda bu uyarı zaten yazılıydı (`scraper/harvest-owners.mjs`):
> *"SALE_PRC1 sahibin ALIMI olabilir, şirketler arası devir olabilir, ya da nominal
> ($100 quit-claim) olabilir. 'X şu fiyata aldı' demeden önce QUAL_CD1 kontrol
> edilmeli. Mohave'de bu ayrımı yapmadığımız için çarpan hesabı çöpe gitti."*
> Aynı hata tekrarlanmıştı; bu dosya onu düzeltiyor.

---

## ✅ SAVUNULABİLİR OLAN — bunları söyle

### 1. Gokce Capital'ın Florida'da 10 boş arsası var (doğrulandı)
Kaynak: **Florida Statewide Cadastral**, canlı sorgu
`services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0`
Sorgu: `PARCEL_ID IN (...)` → `OWN_NAME = "GOKCE CAPITAL LLC"`, `VI_CD1 = "V"` (boş).

| APN | County | County takdir değeri (arsa) |
|---|---|---:|
| 36-09-24-4075-1320-0230 | Putnam | $7.350 |
| 24-09-24-4075-0440-0260 | Putnam | $6.620 |
| 04-10-24-9030-0090-0220 | Putnam | $9.020 |
| 10-10-24-4060-0140-0450 | Putnam | $6.480 |
| 07-10-24-4181-0580-0010 | Putnam | $9.150 |
| 25-09-24-4076-0860-0230 | Putnam | $10.310 |
| 14-09-24-4076-1560-0250 | Putnam | $6.620 |
| 35-09-24-4076-0460-0150 | Putnam | $7.350 |
| 36-09-24-4076-0260-0040 | Putnam | $7.350 |
| 264427L3000070120 | Lee | $18.791 |

⚠ Lee parselinin APN'i kaynakta **tiresiz** yazılı (`264427L3000070120`).
Tireli biçimle sorgulanırsa "bulunamadı" döner — sunumda bu tuzağa düşme.

### 2. İlan fiyatları arşivlendi
| Dosya | sha256 |
|---|---|
| `_listings.html` (94.604 bayt) | `3b2402bfe4a91dbe20de4ad534d2c36a705f606d1d6af307b83ed66910e272a8` |

Kaynak: `https://gokcecapital.gokcap.com/listings`, 2026-08-06'da **Litvanya'daki
VPS'ten** indirildi (site Türkiye'den HTTP 403 "blocked from your country" veriyor).
İçinde **120 ilan bağlantısı, 124 fiyat**: en düşük $1.097 · medyan $12.597 ·
en yüksek $56.997 · toplam liste değeri **$1.548.814**.

**Yan kazanç:** 2026-08-03'te aynı veri ELLE toplanmıştı (121 ilan / $1.560.131).
Bu otomatik indirme onu bağımsız doğruluyor — fark %0,7. "Elle yazdın, uydurdun"
itirazı bununla kapanır.

### 3. Kurulabilecek dürüst karşılaştırma
Gokce'nin Putnam parsellerinin **county takdir değeri $6.480–$10.310**;
aynı county'deki **ilan fiyatları $6.995–$14.497**.
İkisi de kamuya açık, ikisi de doğrulanabilir. Bu bir *takdir değeri ↔ istenen fiyat*
karşılaştırmasıdır — "alım fiyatı ↔ satış fiyatı" DEĞİLDİR. Cümleyi böyle kur.

---

## Söylenmeyecek cümleler
- ❌ "$2.600'e alıp $14.497'ye satıyor" → parsel onun değil, üstelik bedel niteliksiz devir
- ❌ "Her parselde 5,6 kat kâr ediyor"
- ❌ "Tapu kaydından alım fiyatını biliyoruz" → QUAL_CD=11, alım fiyatı değil

## Söylenebilecek cümle
> *"Gokce Capital'ın Florida'da kayıtlı 10 boş arsası var; county takdir değerleri
> $6.480–$18.791. Aynı bölgedeki ilan fiyatları $6.995–$14.497 bandında. İlan
> sayfasının ham kaynağını arşivledik, özeti şu."*

---

## Neyi ispatlayamıyoruz (açıkça)
- **Gerçek alım fiyatı.** Nitelikli satış kaydı yok. Öğrenmek için Putnam/Lee
  county tapu dairesinin belge görüntüsü (deed) gerekir — damga vergisi tutarından
  gerçek bedel hesaplanabilir. Ücretli/şahsen erişim.
- **İlan detay sayfaları.** İlk birkaç istekten sonra site VPS'in IP'sini de
  engelledi (bot koruması). Elimizde liste sayfası var, parsel başına detay yok.
- **Ekran görüntüsü yok.** Kanıt HTML kaynağı biçiminde — sha256 alındığı için
  ekran görüntüsünden daha zor tartışılır, ama görsel değil.
