# VegaLand — Ulusal Veri Boru Hattı

**Kurulum tarihi:** 2026-08-04 · **Sunucu:** Hostinger VPS `2.24.161.97` (⚠ 2026-08-09'da sona eriyor)

Amaç: ABD genelinde **ücretsiz, anahtarsız** parsel verisini toplayıp arsa
adaylarına indirgemek. Regrid gibi ücretli sağlayıcıya gerek kalmadan.

---

## Sonuç (ölçüldü, tahmin değil)

| | Sabah (2026-08-04 öncesi) | Akşam |
|---|---:|---:|
| Kayıtlı eyalet | 25 (20'si veri döndürüyordu) | **40** |
| County | 80 (63'ü çalışıyordu) | 21 eyalette **tamamı** + 336 keşfedilen |
| Erişilebilir parsel | 921.271 (DB'deki satır) | **100.753.638** |

- **Eyalet geneli 21 kaynak → 70.102.767 parsel** (elle doğrulanmış eşleme)
- **County 336 kaynak → 30.650.871 parsel** (otomatik eşleme, güven puanlı)

ABD'de toplam ~150M parsel var; üçte ikisine ücretsiz erişimimiz oldu.

### Eyalet geneli kaynağı olanlar (21)
`TX FL OH NC NJ IN MN CO MA MD AR MS CT MT DE AK WY VT NY HI WI`
Bunun **13'ü** listede hiç yoktu: OH NJ IN MN MA MD CT DE AK VT NY HI WI.

### En büyük tek kazanç — Texas
`2025 Texas Parcels StratMap` tek katmanda **14.333.926 parsel**, sahip adı +
posta adresiyle. Plan ~155 county appraisal district'ini tek tek eklemekti;
gerek kalmadı.

---

## Boru hattı

```
hasat.mjs         ham parseller           → veri/<EY>.ndjson.gz
   ↓              (filtre YOK)
ayikla.mjs        4 kova                  → veri/ayik/{aday,postasiz,sahipsiz,binali}/
   ↓              (hiçbir satır silinmez)
puanla.mjs        A+/A/B/C/D              → veri/puanli/
   ↓
huni.mjs          eleme hunisi tablosu
paketle.mjs       dışa aktarma arşivi
```

Yan araçlar: `kanit.mjs` (sunumda canlı kaynak doğrulaması) ·
`county-kesif.mjs` (county kaynak avı) · `county-hazirla.mjs` (otomatik alan eşleme)

### Komutlar
```bash
node hasat.mjs --tumu                    # eyalet geneli, hepsi
node hasat.mjs --county --guven yuksek   # county kaynakları, önce yüksek güvenli
node ayikla.mjs --hepsi
node puanla.mjs --hepsi
node huni.mjs                            # tablo
node paketle.mjs                         # dışa aktar
```

---

## Kalıcı kararlar (tekrar tartışılmasın)

1. **Değere göre ELEME YOK.** 3.000 dolarlık arsa da 1 milyon dolarlık da listede
   kalır. Değer bir *band etiketi* (`0-25K … 1M+`), eleme kriteri değil. Ucuz band
   al-sat, pahalı band aracılık/komisyon modeli.
2. **Hiçbir satır silinmez, kovaya gider.** Süzgeçten geçmeyen satır atılmıyor;
   `postasiz` skip-trace adayı, `binali` arşiv. Yön değişirse veri yerinde.
3. **Ürün ARSA'dır.** `binali` kovası saklanır ama peşine düşülmez — ev işi
   VegaWest'in (ayrı iş).
4. **Tek eleme kamu mülkü** (COUNTY OF / STATE OF / SCHOOL DISTRICT) — satılık değil.
5. **Ham veri pakete girmez.** Kaynaktan yeniden indirilebilir; hasat kesintiye
   dayanıklı. Paket sadece üretilmiş bilgiyi taşır.

---

## Teknik tuzaklar — hepsi gerçek veri kaybettirdi, tekrar düşme

| Tuzak | Belirti | Çözüm |
|---|---|---|
| **Seyrek OID** | NC'de OID aralığı 28,7M ama 5,9M kayıt. "40 ardışık boş pencere → bitti" kaçışı %0,5'te tetiklendi, **5,9M parsel kaçtı** | Seyreklik = aralık/kayıt ölçülüp pencere genişliği çarpılıyor. Boş pencere sayacı artık durdurmuyor |
| **Sessiz kırpma** | Esri pencereyi `maxRecordCount`'ta kesip fark ettirmiyor | `exceededTransferLimit` okunuyor, pencere ikiye bölünüyor |
| **County'siz APN** | TX katmanında county alanı yok; APN sadece county içinde tekil. **1,7M gerçek parsel "mükerrer" sanılıp atıldı** | Tekilleştirme kaynak OBJECTID'sine göre |
| **returnCentroid maliyeti** | FL poligon katmanı 8.590→63/sn'ye düştü, 504 yağdı | Aynı verinin **nokta sürümü** kullanıldı: 2000 kayıt 1.729 ms |
| **Eş zamanlılık** | FL 4 paralel istekte 504, 1 istekte sorunsuz | Ağır kaynakta `ES_ZAMAN=1 PENCERE=500` |
| **Şişman şema** | FL 119, MD 117 alan; hepsini istemek sunucuyu boğuyor | `kaynaklar.json`'da alan beyaz listesi |
| **OWN_TYPE ≠ sahip adı** | Utah "sahip var" sanıldı; alan mülkiyet TÜRÜ (özel/federal) | Rol kalıplarında `type|code|_id` dışlanıyor |
| **`pkill -f hasat.mjs`** | Uzaktan çalıştırınca **kendi kabuğunu öldürüyor** (ssh komut satırında da geçiyor) | `pkill -f '[h]asat[.]mjs'` |
| **`cd X && nohup Y &`** | `cd` alt kabukta kalır, sonraki `tail` yanlış dizinde arar | Log yolunu tam ver |

---

## Kaynak keşif yöntemi (tekrar gerekirse)

1. **ArcGIS Online araması** — `arcgis.com/sharing/rest/search?q=<eyalet> parcels AND type:"Feature Service"`.
   Tuzak: çapraz eyalet sonuç döner (WA sorgusuna Florida katmanı gelir), başlıkta
   başka eyalet adı geçeni ele.
2. **Eyaletin KENDİ GIS sunucusu** — en iyi kaynakların çoğu AGOL'de değil:
   `gisservices.its.ny.gov` · `maps.nj.gov` · `mdgeodata.md.gov` · `gis.colorado.gov` ·
   `nconemap.gov`. REST kökünü `?f=json` ile listeleyip servis adlarında parsel ara.
3. **County için TIGERweb** — Census'tan county listesi alınıp her biri AGOL'de aranıyor
   (`county-kesif.mjs`). TIGERweb "Los Alamos County" döndürür, `County/Parish/Borough`
   ekini at.
4. **Her adayı CANLI doğrula** — alan listesi (`?f=json`) + `returnCountOnly`. Başlığa
   güvenme: "Parcels_view" adlı katman 286K kayıtla tek county çıkabiliyor.

---

## Bilinen eksikler

- **WV** — `WV_Parcels/MapServer` var ama katman alanları boş dönüyor, başka uçtan denenecek
- **CA** — eyalet katmanı sadece geometri (APN + adres), sahip/posta yok
- **ME** — 704K parsel ama sahip adı da posta adresi de yok
- **OH, MD** — posta adresi var, **sahip adı yok** (isimsiz mektup kampanyası olur)
- **IN, MN, AR, DE, AK** — sahip adı var, posta adresi yok (skip-trace gerekir)
- County eşlemeleri **otomatik**, elle doğrulanmadı — `guven` alanına bak
