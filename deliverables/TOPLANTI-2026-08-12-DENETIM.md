# Toplantı Notu — 12 Ağustos 2026
## Sistem denetimi: her rakamın kaynağı + düzeltilenler

> Aşağıdaki her sayı **12 Ağustos öğleden sonra canlı veritabanından** ölçüldü.
> Kaynağı yazılamayan hiçbir rakam bu belgede yok.

---

## 1. Bugünkü envanter — ve her sayının nereden geldiği

| Rakam | Değer | Kaynak (kim üretiyor, nereden okunuyor) |
|---|---:|---|
| Toplam parsel | **1.272.766** | `offmarket_leads` tablosu · `offmarket_grade_summary` özetinden toplanır (12 Ağu 11:16 tazelendi) |
| Eyalet | **43** | Aynı özet tablodaki farklı eyalet kodu sayısı |
| County | **1.462** | `offmarket_envanter_ozet_mv` (bugün tazelendi) |
| **A+ lead** | **14.586** | Not motoru `grade-offmarket.mjs`, county-içi yüzdelik eşikle |
| **A lead** | **51.073** | Aynı motor |
| B / C / D / F | 191.394 / 415.288 / 353.579 / 226.399 | Aynı motor |
| Notlandırılamayan | 20.447 | Kamu sahipli, sahip adı boş veya dönüm verisi geçersiz — **F değil**, "değerlendirilemez" |
| Geo doğrulanmış | **947.675 (%74,5)** | Overpass taraması (`geo-enrich-offmarket.mjs`) — yol/elektrik/su/kasaba mesafesi gerçekten ölçülmüş parsel |
| Gerçekten incelenen parsel | **989.227** | Hasat loglarının county bazlı defteri (aşağıda §3'e bak — bu sayı bugün düzeltildi) |
| Süzgeçten geçen | **550.591** | Aynı defter |
| Rakip ilanı | **41.464** | `competitor_listings` + `competitor_intel` (bugün tazelendi) |
| Satış comp'ı | **208.442** | `land_comps` — county sicillerinden gerçekleşmiş boş arsa satışları |
| **Telefonu olan parsel** | **16.376** | PropStream skip trace çıktısı bugün yüklendi (`telefon-aktar.mjs`) |
| Telefonu olan A+/A | **6.802** | Sıcak Arama kuyruğu marj sırasına göre dolu |

---

## 2. A+/A tanımı düzeltildi — sayı **düştü**, çünkü yanlıştı

**Sorun:** Not motoru A+/A verirken sahibe **ulaşılıp ulaşılamadığına bakmıyordu.**
Ölçüldü: Arkansas'taki 4.047 A+/A'nın **3.977'sinde posta adresi yoktu**,
Tennessee'de 538'in **488'inde** yoktu. Yani vitrinde "sahibine ulaşılabilir en iyi
parseller" diye duran kayıtların sahibine ne mektup atılabiliyordu ne de telefon
edilebiliyordu.

**Yapılan:** Posta adresi de telefonu da olmayan parsel artık en fazla **B** alıyor.
Tüm envanter bu kuralla yeniden notlandırıldı (1,27M parsel, ~30 dk).

| | Önce | Sonra |
|---|---:|---:|
| A+ | 15.391 | **14.586** |
| A | 54.734 | **51.073** |
| B | 186.928 | 191.394 |

**Söylenecek:** "Bu hafta kendi vitrinimizi denetledik. A+/A dilimini 'sahibine
ulaşılabilir' diye tanımlıyoruz ama sistem bunu kontrol etmiyormuş — 4.466 parsel
bu tanıma uymadan üst dilimde duruyordu. Kuralı koda yazdık, sayı düştü. Düşen
sayı iyi haberdir: artık A+ dediğimiz her parselin sahibine bugün ulaşabiliriz."

> Skip trace ile telefon geldiğinde bu kayıtlar **kendiliğinden** A+/A'ya geri
> yükselir — motor her gece yeniden koşuyor.

---

## 3. Huni ekranındaki şişik sayı düzeltildi

`/admin/eleme-hunisi` ekranı **3.501.129 parsel incelendi** diyordu. Doğru değildi.

**Sebep:** Sayaç, hasat turlarını **log dosyasının adına** göre tekilleştiriyordu.
Dosya adında tarih olduğu için, aynı 7 eyalet (AL·ID·MS·MT·NC·WV·WY) her gece
yeniden tarandığında **her gece yeniden sayılıyordu** — 10 gecede aynı 246.389
parsel 10 kez toplandı.

**Yapılan:** Tekillik anahtarı artık **county**. Bir county'yi 10 gece taramak
10 kat iş değildir; yalnızca o county'nin **en son** taraması sayılır.

| | Önce (şişik) | Şimdi (gerçek) |
|---|---:|---:|
| İncelenen parsel | 3.501.129 | **989.227** |
| Uygun parsel | 2.217.127 | **550.591** |
| Tekil county | — | **55** |

**Söylenecek:** Bu sayıyı Ahmet'e daha önce söylemediysen hiç açma. Sorarsa:
"Sayacı denetledik, aynı county'nin tekrar taranması sayıyı şişiriyordu, düzelttik."

---

## 4. Veritabanında uydurma kayıt bulundu ve silindi

`scrape_delinquent_tax_rolls.js` her koşuşunda Tarrant ve Montgomery county'sine
**25'er sahte "vergi borçlusu"** basıyordu. Sahip adları House of Cards
karakterleriydi (FRANK UNDERWOOD, DOUG STAMPER, RAYMOND TUSK…), borç ve değer
`Math.random()` ile üretiliyordu.

- **Canlı veritabanına GEÇMEMİŞ** (kontrol edildi: TX Tarrant/Montgomery'de 0 kayıt).
- Yerel veritabanında **50 kayıt** duruyordu → **silindi**.
- Kodu üreten çağrı **kaldırıldı**, bir daha basılmayacak.

Bu, "kaynağını bilmediğimiz veri kalmasın" ilkesinin en sert örneğiydi. Ahmet'e
söylemek zorunda değilsin (müşteriye giden veriye hiç dokunmadı) ama **sen bil**.

---

## 5. Çalışmayan ne varsa çalışır hale getirildi

| Ne bozuktu | Kök sebep | Durum |
|---|---|---|
| Gece turu 9 gündür "BAŞARISIZ" (son başarılı 3 Ağu) | Aşağıdaki 5 adım | ✅ hepsi düzeldi |
| 3 vergi scraper'ı (MVBA, PBFCM, Travis) | Chrome güncellenince puppeteer'ın sürümü kayboldu | ✅ Chrome yolu tek modüle alındı, üçü de veri çekiyor |
| Rakip taraması 6 gündür ölü | Aynı Chrome sebebi | ✅ çalışıyor — 291 ilan tazelendi |
| Rakip radarı | Supabase bağlantısı uzun sorguda kopuyordu | ✅ 3 denemeli yeniden bağlanma eklendi · 41.464 ilan işlendi |
| Tazelik denetçisi | 1,27M satırda sayım zaman aşımına düşünce **çöküyordu ama "OK" yazıyordu** | ✅ özet tablodan sayıyor, artık gerçekten uyarıyor |
| Envanter ekranı 921.324 gösteriyordu | Materialized view 3 Ağustos'tan beri tazelenmemişti, gece turuna bağlı değildi | ✅ tazelendi (1.272.766) + gece turuna eklendi |
| Sunucudaki geo taraması 5 gündür asılı | İki kopya süreç birbirini kilitlemişti (Overpass suçsuz — 5/7 ayna sağlam) | ✅ temizlendi, yeniden başlatıldı, 15 işçiyle dönüyor |

---

## 6. Hâlâ açık — dürüst liste

| Konu | Durum |
|---|---|
| **İlk temas** | Numaralar geldi (16.376 parsel · 6.802 A+/A) ama **hâlâ tek arama yapılmadı, tek mektup gitmedi.** Sıradaki iş bu. |
| **Montana (47.768 lead)** | Eyalet kadastro servisi 10 Ağustos'tan beri sorguya JSON yerine HTML dönüyor. 5 county "servis-kapalı" olarak işaretlendi. Elimizdeki MT verisi **29 Temmuz** hasadından, tazelenmiyor. |
| **Teklif hesaplanmış A+/A** | ~15.600. Ama bu bir eksik DEĞİL: A+/A'nın **%59'u (38.873) 1,5 dönüm üstü** ve orada al-sat yapmıyoruz — komisyon modeli, değer var teklif yok. Gerçek boşluk ~10.000 parsel. |
| **Vergi verisi bayat** | TAX kaynağı 8 gün, ZILLOW 59 gün eski — denetçi artık bunu her gece bildiriyor. |
| **Mac + sunucu çift koşuyor** | İkisi de aynı gece turunu aynı veritabanına koşuyor. Zarar yok (üzerine yazıyor) ama gereksiz; sunucu bir gece temiz döndükten sonra Mac'teki kapatılmalı. |
| ~~Alabama'da mükerrer county~~ | ✅ Çözüldü: "De Kalb" bayat görünümden geliyormuş, tazeleyince kalktı (tek satır: DeKalb 18.325). |

---

## 7. Toplantıda söylenmeyecekler (10 Ağustos listesi + yenileri)

| Söyleme | Neden |
|---|---|
| "3,5 milyon parsel inceledik" | Şişikti, düzeltildi. Doğrusu **989.227**. |
| "1,25 milyonun hepsi A+ adayı" | A+ **14.586**, A **51.073**. |
| "Şu kadar sahiple görüştük" | **Tek arama yapılmadı, tek mektup gitmedi.** Elimizdeki 16.376 numara bir KUYRUK, sonuç değil. |
| "Rakip ucuza alıp pahalıya satıyor" | Doğrulanmadı, çöktü (Gokce Putnam'da piyasa medyanına yakın ödemiş). |
| "50 eyalet" | 43'te veri var. Eksik 7: AK, DE, LA, NH, NJ, PA, RI. |
| "Florida'da çevirme kanıtı topladık" | 9 county tarandı, eyalet geneli değil. |
| "Montana'da canlı veri" | Kaynak kapalı, veri 29 Temmuz'dan. |

---

## Gezilecek ekranlar

1. `/admin/arsa-notlari` — A+ vitrini (artık hepsinin sahibine ulaşılabiliyor)
2. `/admin/cevirme-kaniti` — aynı parselin alım→satım fiyatı, APN'lerle
3. `/admin/harita` — 43 eyalette gerçek nokta
4. `/admin/eleme-hunisi` — düzeltilmiş huni
5. `/admin/arama` — **Sıcak Arama Kokpiti: marj sıralı arama kuyruğu, numaralarıyla**
6. `/admin/sunum-ulusal` — üst düzey özet

> Eski Mohave sunumu artık yok: `/admin/sunum` bu sayfaya yönleniyor, menüden de kaldırıldı. Yanlış ekranı açma ihtimalin sıfır.
