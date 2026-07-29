# Filtreli hasat raporu — 2026-07-29 · 7 hedef eyalet

Betik: `scraper/filtreli-hasat.mjs` (kayıt defteri sürücülü, tek motor)
Ham çıktılar: `scraper/logs/filtreli-hasat-2026-07-29-*.json`

## 1) Öncesi / sonrası

| Ölçü | Önce | Sonra | Fark |
|---|---:|---:|---:|
| `offmarket_leads` satır | 566.265 | 585.191 | **+18.926** |
| Toplam UPSERT (yeni + güncellenen) | — | 25.043 | — |
| `offmarket_leads` tablo boyutu | 979 MB | 980 MB | +1 MB |
| Veritabanı toplam | 1123 MB | 1124 MB | **+1 MB** |
| DB tavanı | 2048 MB | — | %55 dolu, tavana yaklaşılmadı |

Yeni satır (18.926) < upsert (25.043) çünkü NC'nin 7.477 upsert'ünün çoğu
zaten tabloda olan NC satırlarını GÜNCELLEDİ (aynı `lead_id` biçimi:
`NC-Brunswick-<apn>`). Yazma yalnızca `ON CONFLICT (lead_id) DO UPDATE`.
`DELETE`/`DROP`/`TRUNCATE` kullanılmadı; satır sayısı hiçbir anda düşmedi.

## 2) Eyalet bazında inen satır ve elenme oranı

| Eyalet | Aday (kaynaktan gelen boş arsa) | Yazılan | Elenen | En büyük eleyen kural |
|---|---:|---:|---:|---|
| MS | 29.736 | 8.386 | %72 | absentee-değil 18.327 |
| WV | 5.418 | 1.201 | %78 | absentee-değil 4.076 |
| MT | 30.388 | 1.541 | %95 | absentee-değil 26.432 |
| NC | 97.945 | 7.477 | %92 | absentee-değil 73.493 |
| AL | 97.420 | 3.254 | %97 | absentee-değil 83.000 |
| ID | 22.972 | 1.349 | %94 | absentee-değil 18.853 |
| WY | 11.867 | 1.835 | %85 | absentee-değil 7.146 |
| **Toplam** | **295.746** | **25.043** | **%92** | — |

### Hangi kural ne kadar eledi (295.746 aday üzerinden)

| Kural | Elenen | Pay |
|---|---:|---:|
| `absentee-degil` (posta eyaleti = parsel eyaleti) | 231.327 | %78,2 |
| `deger-bandi` (land_value < $300 veya > $20.000) | 18.734 | %6,3 |
| `acre-bandi` (acre yok / <0,25 / >640) | 11.893 | %4,0 |
| `kamu-sahipli` (STATE OF / COUNTY OF / BLM …) | 4.782 | %1,6 |
| `mektup-eksik` (beş posta alanından biri boş) | 3.263 | %1,1 |
| `mukerrer` (aynı APN ikinci kez) | 704 | %0,2 |

Süzgeç eşikleri uydurulmadı: acre bandı `scraper/lib/grade-core.mjs`
(`acresPoints` <0,25 = "satışı zor", `MAX_GRADABLE_ACRES` = 640) ve değer bandı
projenin mevcut ucuz-lot bandı ($300–$20.000; oregon/michigan/georgia
off-market betikleriyle aynı). Kamu/template sahip elemesi grade-core
`checkEligibility` ile aynı kural.

**AR hatası tekrarlanmadı:** yazılan 25.043 satırın %100'ünde `owner` +
`mailing_address` + `mailing_city` + `mailing_state` + `mailing_zip` DOLU.
Adressiz tek satır inmedi.

## 3) Çıkan sorunlar

| Eyalet | Sorun | Sonuç |
|---|---|---|
| WV | Kayıt defterinde acre alanı `Acres_C` yazıyordu; katmandaki gerçek ad `CALC_ACRE`. WV servisinin **tüm** sorguları HTTP 400 ("Failed to execute query") dönüyordu — beş WV county'si gerçekte hiç sorgulanamıyordu. | Düzeltildi (servis metadata'sıyla doğrulandı), WV ilk kez indi (1.201 satır). Kapsam ölçümü yeniden koşturuldu: 5/5 çalışıyor. |
| MS | MARIS servisi `resultRecordCount` reddediyor ("Pagination is not supported"). | Motor otomatik `returnIdsOnly` + objectId parçalı çekime düşüyor; tam kapsam alındı. |
| MT / AL | Aday havuzu büyük ama sahiplerin ~%86-95'i eyalet içi oturuyor. | Absentee süzgeci beklenenden çok eledi; MT 30K adaydan 1.541, AL 97K adaydan 3.254. Düşük verim veri hatası değil, gerçek. |
| Tümü | Ücretli API (Regrid/ATTOM) hiç çağrılmadı. | 0 ücretli çağrı. |

## 4) Süzgeç yüzünden atlanan ama sonradan işe yarayabilecek veri

- **Değeri $20.000 ÜSTÜ boş arsa (7 eyalet, ~117.700 parsel):**
  NC 42.604 · AL 41.694 · MT 15.215 · ID 10.095 · WY 4.453 · MS 3.592.
  Bunlar "kötü" değil, **daha büyük bilet** parseller. Ucuz-çok-adet modelinin
  dışında kaldıkları için indirilmedi; ikinci bir bant (ör. $20K–$75K) açılırsa
  hazır bekliyorlar. WV'de değer alanı yok, o yüzden listede yok.
- **Değeri $300 ALTI (~9.800 parsel):** çoğu $0/$1 placeholder assessed —
  grade-core zaten `winsorLandValue` ile bunları "değer yok" sayıyor. Gerçek
  fırsat olabilecek olanlar comp tahminiyle değerlenebilir ama sinyal zayıf.
- **Eyalet içi (absentee olmayan) 231.327 parsel:** mektup dönüşü düşük olduğu
  için alınmadı. Telefon/skiptrace kanalı açılırsa yeniden değerlendirilebilir.
- **0,25 acre altı mikro parseller:** satılabilirliği düşük, bilinçli dışarıda.

## 5) Kalıcı iş

`scraper/filtreli-hasat.mjs` artık `run-all.sh`'in 3d adımı → günlük
`hasat-runner.mjs` turuna otomatik giriyor. Eyalet listesi `HASAT_EYALETLER`
ile daraltılabilir. Süzgeç mantığı `scraper/filtreli-hasat.test.mjs` ile
22 testle korunuyor.
