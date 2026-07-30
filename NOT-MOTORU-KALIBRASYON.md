# Not Motoru Kalibrasyonu — 2026-07-30

**Soru:** A+/A dediğimiz parseller gerçekten daha mı iyi, yoksa not motoru kendi
kendine konuşan bir gürültü mü? Eşikler doğru yerde mi?

**Kısa cevap:** Eşikler ve ağırlıklar **doğru yerdeydi. Hiçbiri değiştirilmedi.**
Sorun kalibrasyonda değil, **geo verisinde bir yazılım hatasındaydı**: 2026-07-29
turunda taranan 99.309 parselin %100'ü hatalı biçimde "yol yok → landlocked → F"
damgası yedi. Hata bulundu, düzeltildi, bozuk veri karantinaya alındı, notlar
yeniden hesaplandı. Düzeltmeden sonra not bandları **gerçekleşmiş satış
fiyatlarıyla tekdüze ayrışıyor** — düzeltmeden önce ayrışmıyordu.

> Yiğit'in gözlemi ("99.000 kayıt doğrulandı ama A+/A artmadı, B eridi") doğruydu
> ve semptomu tam olarak bu hataydı.

---

## 1) Motorun röntgeni — mevcut durum

Kaynak: `scraper/lib/grade-core.mjs` (saf skorlayıcı) + `scraper/grade-offmarket.mjs`
(bağlam + eşik + yazma). Dashboard tarafında `dashboard/src/lib/offmarket-grade.ts`
yalnızca **görselleştirme** yapar; puan üretmez.

### 1.1 Puan bileşenleri (toplam ~100, `grade_breakdown` jsonb'ında saklanır)

| Bileşen | Tavan | Neyden gelir |
|---|---|---|
| **Cazibe** | ~40 | acre sweet-spot (0-10) + OSM gerçek mesafeleri (0-30): yol 12 · elektrik 8 · su 6 · kasaba 4 |
| **Likidite** | ~20 | rakip aynı county'de ilan taşıyor mu (4-14) + county nüfus büyümesi (0-6) |
| **Marj** | ~15 | net = est_retail − est_offer − $2.000. Mutlak bant ile **getiri katı** bandının İYİ olanı alınır |
| **Motivasyon** | ~15 | absentee/out-of-state 6 · aynı sahipte 5+ parsel 4 · miras/trust 3 · vergi borçlusu 5 |
| **Risk** | −10 | bilinen POA/HOA subdivision: situs eşleşmesi −8, bölge eşleşmesi −5 |

### 1.2 Acre bandı (`acresPoints`)

`<0.25 ac → 0` · `<0.5 → 4` · `<1 → 7` · **`1-10 → 10`** · `10-20 → 7` · `20-40 → 5` · `>40 → 3`

### 1.3 Geo bandı (`geoPoints`)

- Yol: `≤100 m → 12` · `≤400 → 9` · `≤800 → 6` · `>800 → 3` · **`-1 (1.6 km'de yol yok) → F tavanı`**
- Elektrik: `≤150 m → 8` · `≤500 → 5` · `>500 → 2`
- Su: `≤300 m → 6` · üstü `3` — Kasaba: `≤8 km → 4` · üstü `2`
- `NULL` = taranmadı → 0 puan **+ B tavanı**

### 1.4 Harf notu eşikleri — SABİT DEĞİL, percentile

`GRADE_QUANTILES = [0.01, 0.05, 0.20, 0.50, 0.80]` → A+ en iyi %1 · A sonraki %4 ·
B %15 · C %30 · D %30 · F kalan.

Eşikler **county-içi** hesaplanır (`buildScopedThresholds`); county örneklemi
`COUNTY_MIN_N = 500` altındaysa eyalet (`STATE_MIN_N = 1500`), o da yoksa global
eşik. Şu anki kapsam: **140 county + 23 eyalet** kendi eşiğini kullanıyor.

Bu yüzden A+ alt sınırı her yerde aynı değil: A+ skor aralığı 35-81, A ise 35-72
(NV çöl lotu ile NC kıyı parseli aynı mutlak cetvele vurulmuyor).

### 1.5 Tavan (cap) kuralları — puandan bağımsız tavanlar

| Tavan | Koşul | Nerede |
|---|---|---|
| **F** | `dist_road_m = -1` (1.6 km içinde yol yok) | `scoreLead` → `gp.landlocked` |
| **B** | `geo_enriched_at` ve `dist_road_m` NULL → geo taraması yapılmamış | `scoreLead`, satır ~211 |
| **C** | net marj ≤ 0 | `scoreLead`, net kontrolü |
| **A** (A+ olamaz) | assessed $/acre outlier (>$200K/ac veya county medyanının 10 katı) | `winsorLandValue` + outlier bloğu |
| **A** (A+ olamaz) | net < $1.000 **ve** getiri katı < 1.0 | A+ taban şartı |
| **N/A** (not verilmez) | kamu sahipli / sahip adı boş-template / acre ≤0 veya >640 | `checkEligibility` |

**B tavanı kuralı tam olarak burada:** `grade-core.mjs` içinde
```js
const geoDone = lead.geo_enriched_at != null || lead.dist_road_m != null;
if (!geoDone) { ...; if (cap !== "F") cap = "B"; }   // A+/A yalnız geo-doğrulanmış parsele
```
Gerekçesi vitrin güvenilirliği: müşteriye A+ diye gösterilen parselin yolu/elektriği
OSM ile fiilen doğrulanmış olmalı.

### 1.6 Bant dağılımı ve skor histogramı (kalibrasyon sonrası, canlı)

| Not | Kayıt | Mektup atılabilir | Geo doğrulanmış | Ort. skor | Skor aralığı |
|---|---:|---:|---:|---:|---|
| A+ | 5.718 | 5.717 | 5.718 | 59,5 | 35 – 81 |
| A | 5.498 | 5.495 | 5.498 | 55,6 | 35 – 72 |
| B | 209.171 | 196.943 | 5.831 | 32,9 | 10 – 62 |
| C | 334.864 | 298.342 | 6.690 | 26,4 | 4 – 65 |
| D | 250.680 | 228.310 | 5.363 | 20,1 | 0 – 51 |
| F | 108.326 | 102.826 | 5.015 | 17,1 | 2 – 61 |
| N/A | 7.014 | 6.407 | 0 | — | — |
| **Toplam** | **921.271** | **844.040** | **34.115** | | |

Skor histogramı (5 puanlık kova): kütle 20-25 bandında (%23), 45 üstü toplam %5,
65 üstü %0,15. Yani skor dağılımı **sağa uzun kuyruklu** — A+ havuzu doğal olarak dar.

Bileşen ortalamaları not bandına göre (`grade_breakdown`):

| Not | Cazibe | Likidite | Marj | Motivasyon | Risk |
|---|---:|---:|---:|---:|---:|
| A+ | 24,9 | 13,1 | 13,2 | 8,8 | −0,5 |
| A | 20,9 | 16,0 | 11,9 | 8,0 | −1,2 |
| B | 7,8 | 9,5 | 11,4 | 4,3 | −0,1 |
| C | 5,0 | 11,7 | 5,7 | 4,3 | −0,3 |
| D | 5,1 | 9,8 | 3,0 | 2,9 | −0,6 |
| F | 4,3 | 10,2 | 1,2 | 2,1 | −0,7 |

A+/A ile alt bandları ayıran şey **cazibe (geo) ve marj**; likidite neredeyse hiç
ayırmıyor (C'nin likiditesi B'den yüksek) — county'ler zaten rakip yoğun bölgelerden
seçildiği için bu bileşen doygun.

---

## 2) Gerçek satışlarla test — notlar gerçeği tutuyor mu?

Ölçüm scripti: **`scraper/not-kalibrasyon.mjs`** (tekrar çalıştırılabilir; sonucu
`grade_calibration` tablosuna yazar, admin ekranı oradan canlı okur).

### 2.1 Yöntem

`land_comps` tablosundaki **gerçekleşmiş** boş arsa satışlarının APN'leri
`offmarket_leads` ile eşleştirilir → "bizim notumuz şuydu / parsel gerçekte şu
fiyata satıldı" çifti. Not, kendi girdisiyle değil **dış bir sonuçla** sınanır.

### 2.2 Örneklem sınırı — dürüstçe

- `land_comps` **25 eyaletin yalnız 2'sini** kapsıyor: FL (192.514) ve CO (15.928).
- **CO dışarıda bırakıldı.** İki nedenle: (a) fiyat alanı county'ye göre sent/dolar
  karışık; (b) tek bir toplu tapu fiyatı (ör. $7.212.000) onlarca ayrı parsele
  aynen yazılmış — kol satışı ayıklaması güvenilmez. APN eşleşmesi zaten 11 satır.
- FL'de yalnız **DOR kalite kodu 01/02** (kol satışı) kullanıldı. Kod `05`
  ("birden çok parsel içeren satış", 70.963 satır, medyan $1,9M) piyasa değeri değildir.
- Eşleşen örneklem: **1.504 gerçek satış**, hepsi FL.
- **A+/A örneklemi n=12.** Tek başına A+/A eşiğini değiştirmeye YETMEZ. Bu böyle
  yazılıyor çünkü "10 satıştan sonuç çıkardım" demek uydurmaktır.

### 2.3 Sonuç — DÜZELTMEDEN SONRA

| Not | FL kayıt | Satan | Satış % | Medyan gerçek satış | Ort. skor | Kanıt gücü |
|---|---:|---:|---:|---:|---:|---|
| A+ | 505 | 10 | 1,98 | $24.000 | 63,8 | ⚠ yetersiz (n=10) |
| A | 122 | 2 | 1,64 | $13.750 | 57,3 | ⚠ yetersiz (n=2) |
| B | 22.560 | 546 | 2,42 | **$15.000** | 40,7 | ✔ |
| C | 42.179 | 698 | 1,65 | **$13.000** | 35,0 | ✔ |
| D | 13.382 | 166 | 1,24 | **$7.900** | 26,9 | ✔ |
| F | 5.391 | 76 | 1,41 | **$6.700** | 23,5 | ✔ |

**Ayrışma tutuyor:** örneklemi yeterli dört bandda (B > C > D > F) medyan
gerçekleşen satış fiyatı not sırasıyla birlikte **tekdüze düşüyor**
($15.000 → $13.000 → $7.900 → $6.700). B'nin medyanı F'nin **2,2 katı**.

**Skor ↔ gerçekleşen satış fiyatı Spearman ρ = 0,325** (n = 1.498). Gürültü değil;
orta güçte pozitif tekdüze ilişki.

Skor desili × medyan gerçekleşen satış:

| Desil | Skor | n | Medyan satış |
|---|---|---:|---:|
| D1 | 12–26 | 150 | $5.750 |
| D2 | 26–33 | 150 | $8.900 |
| D3 | 33–34 | 150 | $12.500 |
| D4 | 34–37 | 150 | $13.250 |
| D5 | 37–38 | 150 | $14.750 |
| D6 | 38–38 | 150 | $14.000 |
| D7 | 38–38 | 150 | $12.000 |
| D8 | 38–41 | 150 | $14.500 |
| D9 | 41–42 | 149 | $15.500 |
| D10 | 42–69 | 149 | $16.500 |

**Önemli nüans:** skorun ayırt etme gücünün neredeyse tamamı **alt yarıda**.
D1→D4 arasında medyan 2,3 kat artıyor ($5.750 → $13.250); D5-D10 arasında ise
$12.000-$16.500 bandında dalgalanıyor. Yani motor **kötüyü ayıklamada güçlü,
iyinin içinden en iyiyi seçmede zayıf.** A+ ile A'yı gerçek satışla ayırmak bu
veriyle mümkün değil (örneklem hem küçük hem doygun bölgede).

### 2.4 Coğrafi doğrulama tavanı gerçekten ayırt edici mi?

| Grup | FL kayıt | Satan | Satış % | Medyan gerçek satış | Ort. skor |
|---|---:|---:|---:|---:|---:|
| geo-doğrulanmış | 889 | 16 | 1,80 | **$23.750** | 59,1 |
| geo-bekliyor | 83.471 | 1.488 | 1,78 | $13.000 | 34,4 |

Geo-doğrulanmış parseller **1,8 kat** yüksek fiyata satılmış. **Ama n=16 —
örneklem yetersiz** ve karıştırıcı değişken var: geo kuyruğu zaten skora göre
sıralı çalıştığı için doğrulanmış kayıtlar baştan yüksek skorlu. Bu tablo
**tavanın gevşetilmesi için delil ÜRETMİYOR, tavanı korumak için de kesin delil
değil.** Karar: tavan **korunuyor** (aşağıda gerekçe).

### 2.5 Yanlış negatif — "gizli A havuzu"

Skoru kendi eyaletindeki **en düşük A skorunu zaten aşan** ama yalnızca
**geo taraması beklediği için** B tavanına takılan kayıt: **12.083**

| NC | FL | OR | NV | CO | ID | AL | MT | NM | TX |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 6.818 | 1.948 | 1.411 | 767 | 422 | 358 | 166 | 70 | 66 | 57 |

Bunları A yapan bileşen eksikliği değil; **tek eksik OSM taraması.** Doğru
müdahale eşiği gevşetmek değil, bu 12.083 kayda hedefli geo turu koşturmak
(787.847'lik kuyruğun %1,5'i).

### 2.6 Yanlış pozitif

A+ verilmiş ama comp'ları zayıf olan küme aranmıştır: FL'de A+ örneklemi n=10 ve
medyanı ($24.000) tüm bandların üstünde. **Yanlış pozitif kümesi tespit
edilemedi — ama örneklem bunu iddia etmeye de yetmez.** Diğer 23 eyalette
gerçekleşmiş satış verisi hiç yok.

---

## 3) Asıl bulgu — geo taraması bozuktu (ve neden A+/A artmadı)

### Kök neden

`scraper/geo-enrich-offmarket.mjs` → `superSorgu()` sorgusu `out center bb 4000;`
ile bitiyordu. **Overpass bu kombinasyonda way'ler için `center` alanı
DÖNDÜRMÜYOR** — yalnız `bounds` geliyor. `parseDistances()` ise:

```js
const elat = Number(el.center?.lat ?? el.lat);
if (!Number.isFinite(elat) || ...) continue;   // ← way'lerin TAMAMI atlanıyordu
```

OSM'de **yol, su ve elektrik hattı WAY'dir**. Sonuç: bu üç kategori hiç görülmedi,
`dist_road_m = -1` yazıldı, `grade-core` landlocked kuralıyla parseli doğrudan
**F**'ye düşürdü. Node olan kategoriler (elektrik direği, kasaba) çalışmaya devam
etti — bu yüzden hata "veri yok" gibi değil "arsa kötü" gibi göründü.

### Kanıt

1. **Tarih uyuşması.** Süper hücre yeniden yazımı `edb31b9` 2026-07-29 22:20'de
   girdi. Geo yazımlarının tarih dağılımı:

   | Tarih | Yazılan | Yol bulunan |
   |---|---:|---:|
   | 07-22 … 07-28 | 34.125 | 29.989 (%88) |
   | **07-29 turu** | **99.309** | **0 (%0)** |

2. **Canlı Overpass doğrulaması** (2026-07-30). "Landlocked/F" damgalı üç FL
   parselinin 1.600 m'si içinde Overpass'a göre sırasıyla **81 / 273 / 198 yol** var.
   Düzeltilmiş kodla ölçülen gerçek mesafeler: **483 m / 55 m / 54 m**
   (ikisi "yola cepheli" bandında, 12/12 puan).

3. **Ölçek.** Geo taranmış 133.424 kaydın **103.435'i (%77,5)** landlocked
   damgalıydı; FL'de %97,8, OR'da %96,5, KY/GA/NE'de %100. Florida parsellerinin
   %98'inin 1,6 km'de yolu olmaması fiziksel olarak imkânsız.

4. **Comp kanıtı (düzeltmeden ÖNCE).** F damgalı FL parsellerinden 923'ü gerçekte
   satılmıştı, **medyan $14.000** — B ($15.200) ile aynı seviyede, C ($11.800) ve
   D ($7.900)'nin ÜSTÜNDE. Yani "F" bandı gerçek dünyada F gibi davranmıyordu.
   Düzeltmeden sonra F medyanı **$6.700**'e indi ve sıralama düzeldi.

### Yapılan düzeltme

| Dosya | Değişiklik |
|---|---|
| `scraper/geo-enrich-offmarket.mjs` | `elMerkez()`: `center` → düğüm lat/lon → **bbox ortası**. Bbox ortası, Overpass'ın `out center` tanımının birebir aynısıdır (way'in sınır kutusu merkezi) — uydurma değil, aynı değerin yerel hesabı |
| `scraper/geo-enrich-offmarket.test.mjs` | 3 regresyon testi: center'sız way atlanmaz; gerçekten uzaksa hâlâ −1; `elMerkez` öncelik sırası |
| `scraper/data/geo-cell-cache.ndjson` | 68.102 bozuk hücre temizlendi (tamamı bozuk turdan; yedeği `.bozuk-2026-07-30.yedek`) |
| `scraper/geo-karantina.mjs` (yeni) | Bozuk imzalı (`dist_road_m=-1 AND dist_water_m=-1`, bozuk tur penceresinde) **99.309** satırın `dist_*` + `geo_enriched_at` alanları NULL'landı. **Satır silinmedi**, kayıtlar geo kuyruğuna geri döndü |

---

## 4) Eşik/ağırlık kararı — ne DEĞİŞTİ, ne DEĞİŞMEDİ

### Değişmeyenler (bilinçli)

| Kalem | Karar | Gerekçe |
|---|---|---|
| `GRADE_QUANTILES` (%1/%4/%15/%30/%30) | **Değişmedi** | Düzeltme sonrası bandlar gerçek satışla tekdüze ayrışıyor (B>C>D>F). Eşiği kaydırmak için veri yok |
| Bileşen ağırlıkları (40/20/15/15/−10) | **Değişmedi** | Bileşen bazında bant ayrışması zaten cazibe+marj üzerinden geliyor; bunları büyütmek için comp kanıtı yok |
| Acre / geo / marj bantları | **Değişmedi** | Aynı |
| **Geo B tavanı** | **KORUNDU** | Gevşetmek 12.083 kaydı tek kalemde A'ya taşırdı — bu tam anlamıyla not enflasyonu olurdu. Tavanın ayırt ediciliği lehine sinyal var (geo'lu medyan $23.750 vs $13.000) ama n=16, kanıt seviyesinde değil. **Kanıt yokken gevşetmek değil, sıkı kalmak doğru olan.** Doğru müdahale: 12.083 kayda hedefli geo turu |
| Landlocked → F kuralı | **KORUNDU** | Kural doğruydu; girdi verisi bozuktu. Düzeltmeden sonra landlocked kalan kayıt 103.435 → **4.126** (geo taranmışların %12'si) — makul bir oran |
| `COUNTY_MIN_N` / `STATE_MIN_N` | **Değişmedi** | 140 county + 23 eyalet kendi eşiğini kullanıyor; kapsam yeterli |

> **Not enflasyonu yapılmadı.** A+/A sayısı 11.083 → **11.216** (+133, %1,2).
> Bu artış eşik değişikliğinden değil, 99.309 kaydın havuzdan F'ye gitmeyi
> bırakmasıyla percentile tabanlarının doğal kaymasından geldi.

### Değişen tek şey: veri doğruluğu

Not motorunun **mantığında tek satır değişmedi.** `grade-core.mjs` dosyasına
dokunulmadı.

---

## 5) Önce / sonra

| Not | Önce (bozuk geo) | Sonra (düzeltilmiş) | Fark |
|---|---:|---:|---:|
| A+ | 5.581 | **5.718** | +137 |
| A | 5.502 | **5.498** | −4 |
| **A+/A toplam** | **11.083** | **11.216** | **+133** |
| B | 151.373 | 209.171 | +57.798 |
| C | 296.649 | 334.864 | +38.215 |
| D | 247.624 | 250.680 | +3.056 |
| F | 207.528 | **108.326** | **−99.202** |
| N/A | 7.014 | 7.014 | 0 |
| **Toplam satır** | **921.271** | **921.271** | **0** ✔ |
| Geo "doğrulanmış" | 133.424 | 34.115 | −99.309 (sahte doğrulama geri alındı) |
| Mektup atılabilir | ~844.000 | 844.040 | ≈0 |

FL comp testi önce/sonra (aynı örneklem, aynı sorgu):

| Not | Önce medyan gerçek satış | Sonra medyan gerçek satış |
|---|---:|---:|
| B | $15.200 (n=72) | $15.000 (n=546) |
| C | $11.800 (n=325) | $13.000 (n=698) |
| D | $7.900 (n=166) | $7.900 (n=166) |
| F | **$14.000 (n=923)** ✗ sıralama bozuk | **$6.700 (n=76)** ✔ tekdüze |

---

## 6) Sıradaki adımlar (Yiğit'in kararı)

1. **Hedefli geo turu — 12.083 kayıt.** Skoru A tabanını aşan ama geo beklediği
   için B'de duran havuz. Tüm kuyruğun %1,5'i; gerçek A+/A artışı buradan gelir
   ve enflasyon değil, doğrulama olur.
2. **99.309 karantina kaydının yeniden taranması.** Artık düzeltilmiş kodla.
   Bunlar zaten skorca kuyruğun en üstündeydi (geo kuyruğu skor sıralı çalışır).
3. **FL dışı comp toplama.** Kalibrasyonun en büyük zayıflığı örneklem: 25 eyaletin
   1'inde gerçek satış verisi var. NC/TX/NM için `harvest-land-comps.mjs`'e kaynak
   eklenirse A+/A eşiği gerçekten sınanabilir hâle gelir.
4. **CO comp'ları temizlenmeli** — sent/dolar karışıklığı `build-county-valuation.mjs`
   içinde çözülmüş ama `land_comps` ham tablosunda toplu tapu fiyatı sorunu duruyor.

---

## 7) Hedefli geo turu — "gizli A havuzu" (2026-07-30, devam ediyor)

Kalibrasyonun önerdiği adım uygulandı: **tüm 787K kuyruk değil**, yalnız skoru
kendi eyaletinin A tabanını aşan ama geo bekleyen **12.083** kayıt taranıyor.

- Komut: `GEO_GIZLI_A=1 node scraper/geo-enrich-offmarket.mjs`
  (parti parti: `scraper/geo-turu-gizli-a.sh`, `PARTI_BOY=1500`)
- **Sağlık kapısı:** her partiden sonra yol bulma oranı ölçülür; **%20 altına
  düşerse tur DURUR.** 2026-07-29 hatasında bu oran %0'dı.
- **Kanarya (227 kayıt): yol bulma %100** — düzeltme canlıda doğrulandı
  (sağlıklı turlarda ~%88; bu küme yüksek skorlu olduğu için daha da yüksek).
- **Ayna darboğazı:** 7 Overpass aynasından bugün **yalnız 1'i** ayakta
  (maps.mail.ru). Alman kümesi (z./lz4./overpass-api.de) ECONNREFUSED,
  kumi/monicz/private.coffee timeout. IPv4/IPv6 denendi — sorun DNS değil,
  aynalar bu IP'ye kapalı. 3 işçi × 1 ayna → ~20 lead/dk, yani 12 bin kayıt
  ≈ 9-10 saat. Tur arka planda, **resume edilebilir** (kesilirse aynı komut
  kaldığı yerden devam eder; `geo_enriched_at is null` + hücre önbelleği).

Turun durumu her partide `scraper/logs/gizli-a-durum.txt` defterine yazılır;
`node scraper/geo-durum.mjs` tek satırda yol bulma oranı + kalan havuzu verir.

### İlk ara sonuç (1.096 kayıt tarandıktan sonra)

| | Tur öncesi | 1.096 kayıt sonrası |
|---|---:|---:|
| Geo doğrulanmış | 34.115 | **35.212** |
| **A+** | 5.718 | **5.743** |
| **A** | 5.498 | **6.341** |
| **A+/A toplam** | **11.216** | **12.084** (+868) |
| B | 209.171 | 208.303 (−868) |
| C / D / F | 334.864 / 250.680 / 108.326 | **aynı** |
| Gizli A havuzu (kalan) | 12.083 | 10.986 |
| Toplam satır | 921.271 | **921.271** ✔ |

**Yol bulma oranı: %100 (1.096/1.096).** Su %66,9 · elektrik %59,6.

**Bu artış NOT ENFLASYONU DEĞİL — kanıtı:** taranan 1.096 kaydın **868'i**
kendisi A/A+ oldu ve A+/A toplamı **tam olarak +868** arttı; B **tam olarak
−868** düştü; C/D/F **hiç değişmedi**. Yani eşikler kaymadı, alakasız hiçbir
kayıt terfi etmedi. Yükselen tek şey: bu kayıtların üzerindeki **B tavanı
kalktı** — çünkü skorları zaten A tabanının üstündeydi, tek eksikleri
doğrulamaydı. Dönüşüm oranı %79 (kuyruk skora göre sıralı çalıştığı için yüksek).

Eyalet kırılımı (A+/A): OR 764 → **1.333** · NV 1.918 → **2.183** ·
NC 962 → **981** · TX 1.620 → **1.623** · FL 627 → **636** · CO 1.044 → **1.047**.
Diğer eyaletler değişmedi (o partilerde taranmadılar).

## Tekrar üretim

```bash
node scraper/geo-karantina.mjs --dry      # bozuk geo imzası sayımı
node scraper/grade-offmarket.mjs          # notları yeniden hesapla (idempotent)
node scraper/not-kalibrasyon.mjs          # comp testi + grade_calibration'a yaz
cd dashboard && npm test && npm run build
```

Admin ekranı: **`/admin/arsa-notlari` → "Not kalibrasyonu · hangi kanıtla?"**
bölümü tüm bu sayıları `grade_calibration` tablosundan **canlı** okur; ölçüm
çalıştırılmamışsa sabit rakam göstermez, kurulum satırı gösterir.
