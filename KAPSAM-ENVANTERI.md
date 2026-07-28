# VegaLand — Dürüst Kapsam Envanteri

**Ölçüm tarihi:** 2026-07-28
**Yöntem:** Hiçbir sayı tahmin/varsayım değildir. Canlı county servislerine gerçek HTTP
sorgusu atıldı; veritabanı sayıları Supabase Postgres'e (`DIRECT_URL`) doğrudan SQL ile
çıkarıldı. Ölü olan "ölü" yazıldı.

---

## 1. Canlı County Registry (`dashboard/src/lib/live-county.ts`)

Registry'de **9 county / 5 eyalet** kayıtlı. Her birine gerçek sorgu atıldı
(`returnCountOnly` + 3 örnek kayıt, `baseWhere` aynen dosyadaki filtre):

| Key | County | Eyalet | HTTP | Yanıt | Filtreye uyan parsel | Alan haritası | Durum |
|---|---|---|---|---|---|---|---|
| `co-costilla` | Costilla | CO | 200 | 6.4 sn | **62.087** | ✅ doğru (ParcelNum/Owner_Name/Mailing_*/Total_Value/Total_Area) | **çalışıyor** |
| `co-lasanimas` | Las Animas | CO | 200 | 0.8 sn | **8.365** | ✅ doğru (ACCOUNTNO/NAME/ADDRESS1/CITY/STATE/ACRES) — ⚠ değer alanı yok | **çalışıyor (değersiz)** |
| `nm-valencia` | Valencia | NM | 200 | 3.8 sn | **168.831** | ✅ doğru (UPC/Owner/OwnerAddre/LANDACT/Shape_Area) | **çalışıyor** |
| `az-mohave` | Mohave | AZ | — | **timeout** | — | test edilemedi | **SERVİS KAPALI** |
| `fl-lee` | Lee | FL | 200 | 1.7 sn | **119.235** | ✅ doğru (STRAP/O_NAME/O_ADDR1/O_STATE/LAND/GISACRES) | **çalışıyor** |
| `tx-brewster` | Brewster | TX | 200 | 1.6 sn | **12.528** | ✅ doğru (BIS CAD şeması) | **çalışıyor** |
| `tx-hudspeth` | Hudspeth | TX | 200 | 1.0 sn | **19.982** | ✅ doğru | **çalışıyor** |
| `tx-presidio` | Presidio | TX | 200 | 1.8 sn | **13.873** | ✅ doğru | **çalışıyor** |
| `tx-terrell` | Terrell | TX | 200 | 0.8 sn | **4.254** | ✅ doğru | **çalışıyor** |

**Sonuç: 9 county'nin 8'i canlı ve doğru; 1'i (AZ Mohave) ölü.**

### AZ Mohave — ölü endpoint detayı
- Endpoint: `https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query`
- DNS çözülüyor (`199.104.207.151`), fakat TCP/TLS bağlantısı 40 sn'de kuruluyor değil.
  `curl` → `http=000`, node `fetch` → `TypeError: fetch failed`.
- Bu **kritik**, çünkü Mohave projenin "aktif pazarı" (admin menüsünde `2 · Aktif Pazar · Mohave`).
  Mohave'nin 20.000 kayıtlık statik verisi DB'de duruyor, ama **canlı tazeleme şu an mümkün değil.**
- Yapılması gereken: Mohave'nin yeni ArcGIS host'unu bulmak (county GIS portalı taşınmış olabilir)
  veya alternatif kaynak.

### Registry'nin yapısal sınırı
Her county için elle `endpoint` + `outFields` + `baseWhere` + `normalize()` yazılmış.
9 county için ~290 satır. Bu yaklaşımla **25 eyalete çıkmak elle sürdürülemez** —
adım 3'teki sağlayıcı katmanının varlık sebebi budur.

---

## 2. Veritabanı — gerçek lead envanteri

**Görev tanımındaki "195K statik lead" rakamı güncel değil. Gerçek sayı:**

### `offmarket_leads` toplam: **565.930 satır / 15 eyalet / 213 county**

"Mailable" tanımı (katı): `owner` + `mailing_address` + `mailing_city` +
`mailing_state` + `mailing_zip` alanlarının **hepsi** dolu.

| Eyalet | Toplam | Mailable | Mailable % | Absentee | Değeri var | County |
|---|---:|---:|---:|---:|---:|---:|
| TX | 153.093 | 152.411 | %99,6 | 20.125 | 153.093 | 135 |
| FL | 84.044 | 84.044 | %100 | 84.044 | 84.044 | 32 |
| **AR** | 71.585 | **0** | **%0** | 0 | 71.585 | 3 |
| NM | 69.162 | 69.148 | %100 | 69.091 | 69.161 | 2 |
| NC | 38.148 | 26.326 | %69 | 5.660 | 38.148 | 3 |
| CO | 33.243 | 33.233 | %100 | 33.243 | 31.633 | 15 |
| NV | 30.481 | 30.470 | %100 | 25.863 | 30.481 | 1 |
| OR | 23.264 | 23.219 | %99,8 | 16.742 | 23.253 | 2 |
| AZ | 20.000 | 19.995 | %100 | 20.000 | 20.000 | 6 |
| SC | 11.861 | 11.858 | %100 | 5.353 | **0** | 1 |
| MO | 10.351 | 10.334 | %100 | 6.850 | **0** | 1 |
| GA | 10.256 | 10.245 | %100 | 3.365 | 10.256 | 3 |
| MI | 6.431 | 6.416 | %100 | 3.886 | 6.431 | 1 |
| **TN** | 3.666 | **0** | **%0** | 0 | **0** | 2 |
| **OK** | 345 | **0** | **%0** | 0 | **0** | 4 |
| **TOPLAM** | **565.930** | **477.699** | **%84,4** | **294.222** | **528.086** | **213** |

### Kullanılamaz veri (mektup atılamaz)
- **AR (71.585 satır, %12,6'sı)** — `AR:PARCEL_CENTROID_CAMP` kaynağı: parsel centroid'i var,
  **sahip adı/posta adresi YOK**. Sharp (31.996), Izard (20.464), Van Buren (19.125).
  Bu satırlar mektup kampanyasında **kullanılamaz**.
- **TN (3.666)** ve **OK (345)** — aynı sorun, mailable = 0.
- **NC Northampton (11.788)** — mailable 0. Brunswick/Rutherford (26.360) mailable.
- **Toplam mailable olmayan: 88.231 satır (%15,6).**

### Değer alanı olmayan county'ler (fiyatlama yapılamaz)
- SC Colleton (11.861), MO Camden (10.351), CO Las Animas (1.610), TN/OK'nin tamamı.

### En büyük 15 county (mailable ile)
| Eyalet | County | Toplam | Mailable | Absentee |
|---|---|---:|---:|---:|
| NM | Valencia | 69.005 | 68.991 | 69.005 |
| AR | Sharp | 31.996 | **0** | 0 |
| CO | Costilla | 31.234 | 31.234 | 31.234 |
| NV | Nye | 30.481 | 30.470 | 25.863 |
| AR | Izard | 20.464 | **0** | 0 |
| AR | Van Buren | 19.125 | **0** | 0 |
| OR | Klamath | 17.001 | 16.958 | 12.124 |
| FL | Charlotte | 16.494 | 16.494 | 16.494 |
| FL | Putnam | 14.541 | 14.541 | 14.541 |
| NC | Brunswick | 14.308 | 14.282 | 3.051 |
| FL | Highlands | 13.573 | 13.573 | 13.573 |
| NC | Rutherford | 12.052 | 12.044 | 2.609 |
| SC | Colleton | 11.861 | 11.858 | 5.353 |
| NC | Northampton | 11.788 | **0** | 0 |
| MO | Camden | 10.351 | 10.334 | 6.850 |

### Diğer tablolar
| Tablo | Satır |
|---|---:|
| `land_comps` (tapu satış karşılaştırmaları) | 208.442 |
| `parcel_owners` | 91.939 |
| `tax_delinquent_properties` | 34.664 |
| `county_demographics` | 3.262 |
| `county_valuation` | 81 |
| `Property` (satılık ilan) | 44 |
| `parcel_listings` | **0** |
| `mail_campaign_log` | **0** — henüz hiç mektup gönderilmemiş |

### Registry ile DB arasındaki uyumsuzluk (önemli)
DB'de **15 eyalet / 213 county** veri varken, canlı registry'de sadece **5 eyalet / 9 county** var.
Yani NV Nye, OR Klamath/Lake, SC Colleton, MO Camden, GA Bibb, MI Roscommon,
NC Brunswick/Rutherford, FL Charlotte/Putnam/Highlands/Citrus/Marion/Brevard/Levy ve
TX'in 130+ county'si **bir kez hasat edilmiş ama canlı sorgulanamıyor** — hasat betikleri
`scraper/` altında duruyor, registry'ye taşınmamış. Bu, 25 eyalete çıkışta en ucuz kazanç.

---

## 3. Ücretli API'ler — İKİSİ DE ŞU AN ÖLÜ ⚠️

| Servis | Env | Durum | Kanıt |
|---|---|---|---|
| **Regrid** | `REGRID_API_TOKEN` | ❌ **SÜRESİ DOLMUŞ** | JWT `exp = 2026-07-20T03:19:48Z` (8 gün önce). API `401 {"status":"error","message":"Invalid token"}` — hem `?token=` hem `Authorization: Bearer` ile. |
| **ATTOM** | `ATTOM_API_KEY` | ❌ **YETKİSİZ** | `401 Unauthorized` — `/property/address` ve `/property/basicprofile` uçlarında. Anahtar 32 karakter, format doğru ama hesap aktif değil. |

**Bunun anlamı:** Görev tanımındaki "iki kaynak elde hazır" varsayımı **doğru değil**.
25 eyalete çıkışın Regrid'e dayanan yolu şu an **kapalı**. Sağlayıcı katmanı Regrid'i
destekleyecek şekilde yazıldı, ancak anahtar yenilenene kadar `kimlik-hatasi` durumu döner
ve **hiçbir sahte satır üretmez**.

Ayrıca `dashboard/src/app/api/regrid/route.ts` içinde, token yoksa **sahte parsel (`_mock: true`)**
döndüren bir kod yolu var. Token var ama geçersiz olduğu için bu yol tetiklenmiyor
(401 upstream'e gidiyor) — yine de "sahte veri yasak" kuralıyla çelişen bir kalıntı,
not edildi.

**Sahibin yapması gereken:** Regrid aboneliğini yenile (yeni JWT), ATTOM anahtarını doğrula.

---

## 4. Scraper betikleri

`scraper/` altında **108 adet** `.mjs`/`.js` var. Gruplandırma ve son çalışma tarihleri:

### 4.1 Aktif nesil — county parsel hasadı (Temmuz 2026)
Hepsi `offmarket_leads`'e `upsert(onConflict:"lead_id")` yazar. **Elle koşulmuşlar, otomasyona bağlı DEĞİL.**

| Betik | Kapsam | Son koşum (log) | Sonuç |
|---|---|---|---|
| `offmarket-tx-batch.mjs` (66 county) | TX | 19 Tem 04:20 | 63/66 OK — Live Oak, Jim Wells, Goliad başarısız |
| `offmarket-tx-batch2.mjs` (85 county) | TX | 19 Tem 06:51 | 80/85 OK — Baylor/Carson/Cooke/Winkler `499 Token Required`, Hidalgo `Invalid field: imprv_val` |
| `offmarket-fl.mjs` | FL 67 county | 19 Tem 06:38 | 84.044 kayıt — **33 county 400 hata** (Broward, Duval, Orange, Palm Beach, Pinellas, Sarasota, Volusia…) |
| `arkansas-offmarket.mjs` | AR ×3 | 21 Tem 10:19 | 71.585 — ⚠ posta adresi yok |
| `nc-offmarket.mjs` | NC ×3 | 21 Tem 12:49 | 38.148 |
| `nevada-offmarket.mjs` | NV Nye | 23 Tem | OK |
| `oregon-offmarket.mjs` | OR Klamath+Lake | 23 Tem | OK |
| `southcarolina-offmarket.mjs` | SC Colleton | 23 Tem | OK, değer yok |
| `missouri-offmarket.mjs` | MO Camden | 23 Tem | OK, değer yok |
| `georgia-offmarket.mjs` | GA Bibb+Chatham | 23 Tem | OK |
| `michigan-offmarket.mjs` | MI Roscommon | 23 Tem | OK |
| `grade-offmarket.mjs` | 15 eyalet notlama | 25 Tem 20:31 | 565.930 satır notlandı |
| `harvest-land-comps.mjs` | FL/CO/OR comps | 26 Tem 01:33 | 208.442 comp |

### 4.2 ÖLÜ betikler
- Tüm `scrape_*.js` ailesi (Haziran, tax-delinquent nesli) — launchd'de her gün **anında hata**
- `lgbs-scraper.js`, `scrape_mvba_live.js`, `scrape_pbfcm_live.js` — 14 Haz'dan beri ölü
- `scraper.js` (Zillow/RapidAPI) — `SKIP_ZILLOW=1`, 14 Haz'dan beri veri yok
- `colorado-offmarket.mjs` — çıktısı `colorado-offmarket.csv` **120 byte, boş**
- `florida-offmarket.mjs` — `offmarket-fl.mjs` yerini aldı

### 4.3 launchd — teknik olarak "başarılı", pratikte kör
- Tek plist: `com.terralot.sourcing.plist` → her gün 06:00.
- `launchctl list` → `- 0 com.terralot.sourcing` (yüklü, son çıkış 0).
- `status.json`: `lastSuccessAt: 2026-07-28T03:57:25Z`, `consecutiveFailures: 0`.
- **⚠ KRİTİK:** job Desktop'taki koda değil, `~/Library/Application Support/terralot-runner/scraper/`
  altındaki **aynasına** koşuyor ve bu ayna **29 Haziran'dan beri senkronlanmamış**
  (macOS TCC engeli: `[sync] Desktop okunamadı`). Yani **Temmuz'da yazılan TÜM off-market
  hasatçıları hiçbir otomasyona bağlı değil.**
- Job içindeki `step()` fonksiyonu hataları WARN basıp devam ediyor, çıkış kodunu düşürmüyor
  → **"başarılı" görünen bir job her gün 4 adımda sessizce patlıyor.**
- `.freshness-state.json` en son **4 Temmuz**'da yazılmış → tazelik izleme de bayat.

### 4.4 Değeri: yeniden kullanılabilir endpoint hazinesi
Betiklerden **~170 doğrulanmış ArcGIS endpoint'i** çıkarıldı (TX'in ~155 CAD servisi
organizasyon kimlikleriyle, FL/CO/AR/NC eyalet geneli katmanları, NV/OR/SC/MO/GA/MI
county servisleri). Bunlar `dashboard/src/lib/county-registry.ts` içine **kayıt (config)
olarak** taşındı — artık county eklemek kod yazmayı gerektirmiyor.

**Migrasyon riski:** `backfill-coords.mjs:32-48`, TX county registry'sini diğer `.mjs`
dosyalarını **regex ile parse ederek** üretiyor. Registry sağlayıcı katmanına taşınınca
bu betik kırılır — en kritik migrasyon borcu.

---

## 5. GENİŞLETME SONRASI — ölçülmüş canlı kapsam

Sağlayıcı katmanı kurulduktan sonra kayıt defteri **63 county / 21 eyalete** çıkarıldı ve
**hepsine gerçek sorgu atıldı** (`node --import ./test/resolve-alias.mjs scripts/kapsam-olc.mjs`,
sonuç `dashboard/public/kapsam-olcum.json`).

### Sonuç: 63 county'nin 46'sı veri döndürdü, 16 eyalette canlı kapsam var

| Durum | Sayı | County |
|---|---:|---|
| ✅ **Çalışıyor** (mailable kayıt döndü) | **46** | CO ×3, FL ×8, TX ×9, NV ×1, OR ×2, SC ×1, GA ×2, MI ×1, NC ×3, MT ×5, WY ×3, ID ×4, SD ×1, NE ×1, KS ×1, NM ×1 |
| ⚪ Veri yok (servis çalıştı, filtreye uyan kayıt yok) | 3 | co-pueblo, co-saguache, co-conejos |
| ❌ Servis kapalı | 2 | fl-polk, mo-camden |
| ❌ API anahtarı geçersiz (Regrid'e bağımlı) | 12 | nm-luna, az ×4, ar ×3, tn ×1, ok ×3 |

**Ölçülen boş arsa (sayımı dönen county'lerde): 1.177.660 parsel.**
Örneklenen 25'lik partilerde **mailable oranı %96-100** (KS Douglas hariç, orada
boş-arsa filtresi kurulamıyor).

### Eyalet bazında canlı kapsam
| Eyalet | Çalışan/Toplam | Not |
|---|---|---|
| TX | 9/9 | BIS ortak şeması — yeni county tek satır |
| FL | 8/9 | Polk hariç; eyalet geneli katman |
| MT | 5/5 | ⭐ eyalet geneli tek servis |
| ID | 4/4 | 3'ü Referer başlığına bağımlı |
| CO | 3/6 | Pueblo/Saguache kod sorunu, Conejos katmanda yok |
| WY | 3/3 | county servisleri |
| NC | 3/3 | ⭐ OneMap eyalet geneli |
| GA, OR | 2/2 | |
| NM, NV, SC, MI, SD, NE, KS | 1/1 | |
| **AZ** | **0/4** | Mohave host'u çöktü, diğerleri Regrid'e bağımlı |
| **AR, TN, OK** | **0/7** | Ücretsiz kaynakta posta adresi YOK |
| **MO** | **0/1** | Camden servisi token istiyor |

### Ücretli API tüketimi
Tüm geliştirme + tam ölçüm boyunca harcanan **Regrid çağrısı: 1** (tek 401).
Devre kesici sayesinde geçersiz anahtar 12 county'de tekrar tekrar denenmedi;
ilk denemeden sonra çağrı yapılmadı. ATTOM çağrısı: 0 (doğrulama testleri hariç).

### Ölçüm sırasında bulunan ve düzeltilen gerçek hatalar
1. **HTTP başlığında Türkçe karakter** → `fetch` "Cannot convert argument to a ByteString"
   ile patlıyordu; 9 county'nin tamamı yanlışlıkla "servis kapalı" görünüyordu.
2. **FL eyalet katmanında `LND_VAL` üzerinde sıralama** → 45 sn zaman aşımı.
   `OBJECTID` (indeksli) sıralamaya geçilince 6 county açıldı.
3. **NC Northampton'da posta alanları boş** → tam adres `mailadd` içine paketlenmiş;
   ayrıştırıcı eklendi, 0 mailable → 24/24 mailable oldu.
4. **Regrid 401 döngüsü** → devre kesici eklendi, 12 boş çağrı 1'e indi.

---

## 6. Özet — nerede duruyoruz

| Soru | Başlangıç (bu iş öncesi) | Şimdi (ölçülmüş) |
|---|---|---|
| Canlı sorgu yapılabilen eyalet | **5** (8 county) | **16** (46 county) |
| Kayıt defterindeki eyalet | 5 | **21** |
| Hedef listesindeki eyalet | — | **25** (`eyalet-hedefleri.ts`) |
| Canlı ölçülen boş arsa | ölçülmemişti | **1.177.660 parsel** |
| DB'deki lead | 565.930 / 15 eyalet / 213 county | değişmedi |
| Mektup atılabilir DB lead | 477.699 (%84,4) | değişmedi |
| Ücretli ülke-geneli yedek | ❌ Regrid süresi dolmuş, ATTOM yetkisiz | ❌ aynı — kod hazır, anahtar bekliyor |
| Gönderilen mektup | 0 | 0 |
| Yeni county eklemek | elle endpoint + elle `normalize()` (~30 satır kod) | **kayıt defterine 1-15 satır VERİ** |

### 25'e ulaşmak için kalan somut engeller
1. **MS, AL, KY, WV** — hedef listede var, kayıt defterine henüz girmedi
   (kaynak araştırması yapıldı, doğrulanmış uç noktalar kayda geçirilmeli). **21 → 25**
2. **Regrid anahtarı** — AR/TN/OK/AZ (7 county) tamamen buna bağımlı, ücretsiz kaynakta
   sahibin posta adresi yok. Anahtar yenilenmeden bu 4 eyalette **mektup atılamaz**.
3. **AZ Mohave** — projenin "aktif pazarı", ArcGIS host'u çöktü. Yeni host veya
   `az-mohave.opendata.arcgis.com` CSV yoluna geçilmeli.
4. **MO Camden** — servis token istemeye başladı (HTTP 499).
5. **FL Polk** — eyalet katmanı bu county için hata veriyor, county-özel servis gerekli.
6. **CO Pueblo/Saguache** — arazi kullanımı county'ye özel opak kod; kod eşlemesi gerekli.
7. **KS/NE/SD'nin ucuz county'leri** — halka açık servis YOK (tarandı, bulunamadı);
   şu an sadece Douglas/Cass/Pennington'dan veri var.
8. **Scraper otomasyonu ölü** — launchd aynası 29 Haziran'dan beri senkron değil;
   Temmuz'da yazılan hasatçıların hiçbiri otomatik koşmuyor (§4.3).
