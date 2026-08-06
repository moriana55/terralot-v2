# Gokce Capital — kanıt dosyası

**Tarih:** 2026-08-06 · **Nereden:** Hostinger VPS, Litvanya (site Türkiye'den 403 veriyor)

## Bu klasörde ne var
| Dosya | Ne | sha256 |
|---|---|---|
| `_listings.html` | Gokce Capital ilan listesi sayfasının ham kaynağı, 94.604 bayt | `3b2402bfe4a91dbe20de4ad534d2c36a705f606d1d6af307b83ed66910e272a8` |

İçinde **120 ilan bağlantısı** ve **124 fiyat** var: en düşük $1.097 · medyan $12.597 ·
en yüksek $56.997 · toplam liste değeri **$1.548.814**.

## Neden önemli
2026-08-03'te fiyatlar **elle** toplanmıştı (`scraper/data/gokce-ilanlar-ham.txt`,
121 ilan / $1.560.131). Bu otomatik indirme onu bağımsız doğruluyor — fark %0,7.
"Elle yazılmış, uydurma olabilir" itirazı böylece kapanıyor.

## Kanıt zincirinin iki ayağı
1. **Aldığı fiyat** — county tapu/değerleme kaydı (`parcel_owners` tablosu).
   Yeniden üretilebilir, kaynağı kamuya açık.
2. **Sattığı fiyat** — bu klasördeki ham HTML. Zaman damgalı, özeti alınmış.

### Aynı parselde ikisi birden eşleşen iki kayıt (en güçlü kanıt)
| Yer | APN | Aldı | Satıyor | Kat |
|---|---|---:|---:|---:|
| Putnam, FL | 11-11-26-8243-0260-0180 | $2.600 (2024) | $14.497 | **5,6x** |
| Lee, FL | 26-44-27-L3-00007.0120 | $19.419 (2024) | $34.997 | 1,8x |

Ayrıca Putnam'da 9 tapu kaydı daha: 2024'te $2.300–$5.100 arası alımlar,
aynı county'deki ilanlar $6.995–$14.497.

## ⚠️ Dürüstlük sınırı
- İlan **detay sayfaları** (`/property?pn=N`) indirilemedi: ilk birkaç istekten
  sonra site VPS'in IP'sini de engelledi (bot koruması). Elimizde liste sayfası var,
  parsel başına detay sayfası yok.
- Ekran görüntüsü yok; kanıt HTML kaynağı biçiminde.
- "Her parselde 5,6 kat kâr ediyor" DEME. Doğru cümle: *iki parselde tapu kaydı ile
  ilan fiyatı eşleşti, biri 5,6 kat biri 1,8 kat; Putnam'daki diğer alımlar da aynı
  bandı gösteriyor.*
