# $1M Arsa Yatırımı — Eleme ve Değerleme Metodu

**Tarih:** 2026-07-25 · **Bağlam:** Terralot envanteri 565.930 off-market lead · **Amaç:** ~$1M sermayenin en iyi arsalara yerleştirilmesi

---

## 0. ÖNCE ŞUNU NETLEŞTİRELİM: mevcut A+ notu "bunu satın al" demek DEĞİL

Bugüne kadar kurduğumuz A+..F not motoru **mektup önceliklendirme** için tasarlandı: "565K sahipten hangisine önce mektup atalım?" Bu iş için doğru bir araç. Ama satın alma kararı bambaşka bir problem ve iki sebepten mevcut motor buna uygun değil:

**1. Hata maliyeti asimetrik.** Mektupta yanlış pozitif = 1 dolarlık pul israfı. Satın almada yanlış pozitif = elde kalan, satılamayan, her yıl vergi yiyen arsa. Mektup taramasında cömert olmak akıllıca, alım taramasında ölümcül.

**2. Not göreceli, mutlak değil.** A+ = "kendi county'sinin en iyi %1'i". County'nin tamamı çöpse, çöpün en iyisi yine A+ alır. Yatırımda ihtiyacın olan şey göreceli sıra değil mutlak eşik: "buna $X öder miyim?"

Bu yüzden aşağıdaki sistem **ayrı bir katman**: mektup notu (`grade`) kalır, üstüne **Yatırım Notu** (`invest_grade`) gelir. İkisi karıştırılmaz.

---

## 1. EN ÖNEMLİ ELEME: sermaye verimliliği ve devir hızı

**Çerçeve (2026-07-25 Yiğit düzeltmesi):** $1M **duran sermaye değil, dönen sermaye**. Model: $5K'ya 20 arsa al → sat → parayı geri al → tekrar al. Yeri geldiğinde $50K'ya alıp $80K'ya sat. Yani $1M bir **yıllık hacim/ciro** hedefi; herhangi bir anda bağlı olan para çok daha az.

Bu ayrım her şeyi değiştiriyor:

- Sermaye yılda **3 kez** dönüyorsa, $1M'lık yıllık hacim için gereken çalışma sermayesi ~**$330K**.
- Aynı anda 345 açık işlem yok; **aynı anda ~20 açık işlem** var, sürekli akan bir boru hattı.

Dolayısıyla "minimum $10.000 baz" gibi sabit bir taban **yanlış olur** — $5K'lık işi de $50K'lık işi de yapacaksın. Doğru kural şu:

### Sabit maliyet, gereken çarpanı belirler

Sabit maliyet (tapu, kapanış, deed, tescil, mektup payı) parsel büyüklüğünden bağımsız: ~$2.000. Bu, küçük işlemde çok daha ağır basar. Sonuç: **her büyüklük bandının kendi minimum çıkış çarpanı olmalı.**

| Alım | Sabit | Baz | Sürtünme | Bu bandın **gereken satış çarpanı** | Örnek |
|---|---|---|---|---|---|
| $3.000 | $2.000 | $5.000 | %40 | **≥3,0x alım** | $3K → $9K |
| $5.000 | $2.000 | $7.000 | %29 | **≥2,5x** | $5K → $12,5K |
| $15.000 | $2.000 | $17.000 | %12 | **≥1,8x** | $15K → $27K |
| $50.000 | $2.500 | $52.500 | %5 | **≥1,6x** | $50K → $80K |

Senin verdiğin iki örneği bu tabloya koyalım:
- **$50K → $80K**: 1,6x, baz $52.500, net **$27.500 = %52 getiri**. ✅ Bandın eşiğini tam tutturuyor.
- **$5K → $12,5K**: 2,5x, baz $7.000, net **$5.500 = %79 getiri**. ✅ Küçük iş daha yüksek çarpan ister ama tutturursa getirisi daha yüksek.

Aynı $5K'yı $10K'ya satarsan (2,0x): net $3.000 = %43. Fena değil ama küçük iş için zayıf — çünkü aynı emeği $50K'lık işe harcasan $27.500 kazanacaktın.

### Asıl karşılaştırma ölçütü: yıllıklandırılmış getiri

Küçük parsel ucuz olduğu için **daha hızlı satar** (alıcı havuzu geniş, taksitle cazip). Büyük parsel **yavaş satar** ama işlem başına çok daha fazla kazandırır. İkisini adil kıyaslamanın tek yolu:

```
yıllık getiri = (net / baz) × (12 / beklenen satış ayı)
```

| Senaryo | Net/Baz | Satış süresi | **Yıllık** |
|---|---|---|---|
| $5K → $12,5K | %79 | 4 ay | **%237** |
| $5K → $12,5K | %79 | 12 ay | %79 |
| $50K → $80K | %52 | 6 ay | **%104** |
| $50K → $80K | %52 | 18 ay | %35 |

Görüldüğü gibi **süre, fiyattan daha belirleyici**. $5K'lık arsa 4 ayda satıyorsa $50K'lık işten çok daha iyi; 12 ayda satıyorsa tam tersi.

**KURAL 1 (revize):** Sabit fiyat tabanı YOK. Her parsel kendi bandının **minimum çarpanını** geçmeli **ve** yıllıklandırılmış getirisi eşiğin (öneri: **%60**) üstünde olmalı. Bu, $3K'lık lotu da $50K'lık parseli de aynı terazide tartar.

Bu neyi eler: elemenin ağırlığı artık fiyat bandına değil, **çarpan × hız** ikilisine biner. $900'lük Mohave lotu, eğer gerçekten $3.000'e ve 4 ayda satıyorsa havuzda kalır (3,3x). Satmıyorsa — fiyatı ne olursa olsun — elenir.

> Bu yüzden 4. bölümdeki **likidite ölçümü bu metodun kalbi**. Çarpanı comp'tan buluyoruz, hızı ise county emilim oranından. İkisi olmadan hiçbir parsel doğru fiyatlanamaz.

### Operasyonel kapasite sınırı (ihmal edilmemeli)
Aynı anda ~20 açık işlem yönetilebilir. Ortalama işlem büyüklüğü küçüldükçe, aynı $1M hacmi için **daha çok işlem** gerekir:

| Ort. işlem | $1M hacim için | Yılda 3 devirde aynı anda açık |
|---|---|---|
| $5.000 | 200 işlem/yıl | ~17 açık — ✅ yönetilebilir |
| $2.900 | 345 işlem/yıl | ~29 açık — ⚠ zorlanır |
| $20.000 | 50 işlem/yıl | ~4 açık — ✅ rahat |

**Pratik sonuç:** karma portföy en mantıklısı. Küçük-hızlı işler nakit akışını ve devir hızını sağlar; büyük işler operasyonel yükü şişirmeden hacmi taşır.

---

## 2. MUTLAK ELEYİCİLER (binary — ya geçer ya elenir, puanlama yok)

Bunlar "puan kırma" değil, **kapı**. Biri bile takılırsa parsel havuzdan çıkar. Sebebi: bu maddelerin her biri arsayı **satılamaz** yapabilir ve satılamayan arsa fiyatı ne olursa olsun sıfır değerindedir.

### 2.1 Yasal erişim (landlocked) — EN KRİTİK
Mevcut sistemimiz `dist_road_m` ile yola **fiziksel** yakınlığı ölçüyor. **Bu yeterli değil.** Yolun 50 metre yanında olmak, o yola çıkma **hakkın** olduğu anlamına gelmez. Aradaki komşu parselden geçiş hakkı (easement) tapuda kayıtlı değilse arsa landlocked'tır ve neredeyse satılamaz.

- Kontrol: plat haritası + tapu kaydındaki easement şerhi
- Otomatikleştirilebilir kısım: parsel poligonu ile kamu yolu poligonunun **ortak sınırı var mı** (sadece mesafe değil, temas). Bunu Regrid/county parsel geometrisi + TIGER yol katmanıyla hesaplayabiliriz.
- **Neden kapı:** landlocked arsa alıcı bulmaz; bulsa bile fiyat %70-90 iskonto ister.

### 2.2 İmar / minimum parsel büyüklüğü
0,2 dönümlük bir lot, minimum 1 dönüm şartı olan bir imar bölgesindeyse üzerine **hiçbir şey inşa edilemez**. Değeri komşuya "yan bahçe" olarak satmakla sınırlıdır.

Bu bizim envanterde **büyük bir risk**: FL/Charlotte medyan 0,2 ac, NM/Valencia medyan 0,5 ac, NV/Nye medyan 0,5 ac. Bunlar 1960-70'lerin spekülatif bölme lotları — çoğu bugünkü imar kurallarında tek başına yapılaşmaya kapalı.

- Kontrol: county imar (zoning) katmanı + minimum lot size tablosu
- **Neden kapı:** yapılaşamayan lot ile yapılaşabilen lot arasında 5-10 kat fiyat farkı var. Bunu bilmeden fiyatlamak, kör fiyatlamaktır.

### 2.3 Su erişimi / su hakkı
NM, AZ, CO, NV'de arsanın değeri büyük ölçüde **suya erişimle** belirlenir. Şebeke yoksa kuyu açılabilmeli; kuyu ruhsatı bazı havzalarda kapalıdır (NM'de bazı bölgeler, CO'da Rio Grande havzası).
- **Neden kapı:** su hakkı olmayan çöl arsası "kamp arazisi" fiyatına satılır, "yapılaşma arsası" fiyatına değil.

### 2.4 Septik uygunluğu (perc test)
Kanalizasyon yoksa septik şart; septik için toprak geçirgenliği yeterli olmalı. Kayalık/killi zeminde perc testi geçmez → yapılaşma imkânsız.
- Ön eleme: USDA NRCS toprak verisi (SSURGO) — ücretsiz, ABD geneli, septik uygunluk sınıfı içeriyor.

### 2.5 Sel / sulak alan
- FEMA sel bölgesi (Zone A/AE/V) → sigorta zorunluluğu + yapılaşma kısıtı
- USFWS Ulusal Sulak Alan Envanteri (NWI) → özellikle **Florida'da belirleyici**; sulak alan ilan edilmiş parselde federal izin olmadan çivi çakılamaz
- İkisi de ücretsiz federal veri, otomatik sorgulanabilir

### 2.6 Eğim
%25 üstü eğimde inşaat maliyeti patlar, %35 üstü pratikte yapılaşmaz. USGS yükseklik modelinden (DEM) parsel eğimi hesaplanabilir — ücretsiz.

### 2.7 POA/HOA yükümlülüğü
Yıllık aidat, devir ücreti, birikmiş borç. Aidat borcu parsele bağlıdır, sen alınca sana geçer.
- Mevcut sistemde kısmi anahtar listesi var (Calvada, Cherokee Village, Hot Springs Village vb.) — genişletilmeli.

### 2.8 Tapu temizliği
Vergi haczi, mekanik haciz, bölünmüş miras hissesi (heirs' property — özellikle SC/GA'da yaygın), eksik zincir.
- **Heirs' property özellikle tehlikeli:** 8 kardeşin ortak mirasıysa 8'inin de imzası gerekir; biri bulunamıyorsa satış kilitlenir.

---

## 3. DEĞERLEME — kanıta dayalı, güven etiketli

### Şu anki durum (dürüst tespit)
`est_retail` bugün itibarıyla **tek bir sabit**: `2999` (bir rakibin 1 dönümlük lot için istediği liste fiyatı), dönümle çarpılıyor. Aynı sabit Arkansas'ta da Michigan'da da aynen kullanılıyor. AZ'de 20.000 parsele karşılık sadece 115 farklı perakende değeri var; 3.883 parsel birebir aynı `$900 → $2.999`.

**Bu bir değerleme değil, yer tutucu.** $1M kararı buna dayandırılamaz.

### Kurulacak sistem: 4 kademeli, her parselde güven etiketi

Bugün araştırdım, **gerçek satış verisi ücretsiz olarak mevcut**:

| Kaynak | Kapsam | Alanlar |
|---|---|---|
| FL Statewide Cadastral (FDOR) | **Tüm Florida** | `SALE_PRC1, SALE_YR1/MO1` + 2. satış |
| CO Public Parcels | **Tüm Colorado** | `salePrice, saleDate` |
| KC_Taxlots | Klamath OR | `SALE_PRICE, SALE_DATE, YRSOLD` |
| ParcelCAMA2022 | Colleton SC | `SALEPRICE, SALEDATE` |
| SAGIS Parcel Digest | Savannah GA | `Sale_Price` + **`Sale_Quality`** |

Florida'dan çektiğim gerçek kayıtlar (boş arsa, 2020+ satış):

| Satış yılı | Gerçek satış | Dönüm | Assessed | Satış/Assessed |
|---|---|---|---|---|
| 2025 | $4.000 | 0,39 ac | $12.000 | 0,33x |
| 2024 | $55.000 | 6,22 ac | $62.200 | 0,88x |
| 2025 | $125.000 | 6,76 ac | $169.000 | 0,74x |
| 2025 | $600.000 | 5,45 ac | $76.300 | 7,9x |
| 2024 | $100.000 | 5,22 ac | $67.860 | 1,47x |

**Buradaki ders kritik:** oran 0,33x ile 7,9x arasında geziniyor. Yani "assessed × sabit katsayı" yaklaşımı da en az `2999` sabiti kadar yanlış. Tek çare county bazında **medyan + uç değer kırpma + örneklem sayısı**.

**Kademeler:**

- **T1 (yüksek güven):** Aynı county'de, ±%50 dönüm bandında, son 24 ayda, kol satışı (arm's-length) olarak gerçekleşmiş **≥5 boş arsa satışı**. Medyan $/acre alınır.
- **T2 (orta):** Aynı county'de ≥20 satış ama dönüm eşleşmesi zayıf → county medyan $/acre.
- **T3 (düşük):** Satış verisi yok → assessed × county'nin kalibre edilmiş satış/assessed medyanı.
- **T4:** Hiçbiri yok → **değer atanmaz**. Uydurma sabit YOK.

**KURAL 2:** $1M havuzuna **yalnız T1 ve T2 girer.** T3 "ilgi çekici" listesinde durur, alım kararına giremez. T4 zaten yok hükmünde.

**Neden bu kadar katı:** Yatırımın tamamı ARV (satış sonrası değer) tahminine dayanıyor. ARV %30 yanlışsa, %40 marj beklerken %10 zarara geçersin. Tahminin güvenini bilmeden pozisyon almak kumar.

### Kol satışı (arm's-length) filtresi
Ham satış verisinin içinde $1'lik aile devirleri, $100'lük vergi satışları, banka devirleri var. Bunlar piyasa değeri değil. Filtre:
- Fiyat > $1.000 **ve** assessed'in %10'undan büyük
- GA'da `Sale_Quality` alanı doğrudan bunu etiketliyor — kullanılacak
- İstatistiksel: county içinde medyanın 10 katından büyük / 10'da birinden küçük satışlar kırpılır

---

## 4. LİKİDİTE — marj hiçbir şey, hız her şey

Bu bölümü ayrı yazıyorum çünkü en çok atlanan ve $1M ölçeğinde en çok acıtan konu.

$20.000'e alıp $40.000'e satmak kâğıt üzerinde %100 getiri. Ama satış 3 yıl sürerse:
- Yıllık getiri ~%26'ya iner
- 3 yıl boyunca emlak vergisi + POA aidatı ödersin
- Sermayen 3 yıl kilitli kalır — o $20.000'i 3 kez çevirebilseydin çok daha fazla kazanırdın

**Sermaye devir hızı, marjdan daha önemlidir.**

Ölçülecekler:

1. **Emilim oranı (absorption):** County'de yılda kaç boş arsa satılıyor ÷ o an aktif kaç ilan var = kaç aylık stok. Satış sayısını artık cadastral verisinden yıl bazında sayabiliyoruz.
2. **İlanda kalma süresi (DOM):** `rakip-radar` zaten rakip ilanlarının anlık görüntüsünü alıp kaybolanları takip ediyor — kaybolma = satış şüphesi. Bu altyapı DOM ölçümü için hazır.
3. **Alıcı derinliği:** County'de kaç farklı satıcı/ilan var. Tek bir oyuncunun 200 ilanı varsa o "pazar" değil, o oyuncunun stoğudur.

**KURAL 3:** 12 aydan fazla stok barındıran county yatırım havuzuna girmez — orada arsa satılmıyor, birikiyor.

---

## 5. PARSEL BAZINDA UNDERWRITING (yüzde değil, nakit akışı)

Elemeyi geçen her parsel için tam model:

```
Giriş:
  alım fiyatı
+ geri vergi borcu
+ kapanış + tapu + tescil            (~$1.200-2.500)
+ mektup kampanyasının parsel payı
= TOPLAM BAZ

Tutma dönemi (beklenen ay sayısı = county DOM):
+ emlak vergisi × ay
+ POA aidatı × ay
+ sermaye maliyeti (fırsat maliyeti)

Çıkış:
  ARV (T1/T2 comp'tan)
− pazarlama + ilan
− komisyon / kapanış (alıcı tarafı)
− taksitli satışta temerrüt karşılığı
= NET
```

Sonra **üç senaryo**: baz, kötü (ARV −%30, süre ×2), iyi. Kötü senaryoda para kaybediyorsa alma.

**Çıktı metriği: yıllık getiri (IRR), toplam marj değil.** Çünkü sermayeyi ne kadar hızlı geri alıp tekrar kullanabildiğin, tek işlemdeki kârdan önemli.

**KURAL 4:** Kötü senaryoda zarar eden parsel alınmaz — beklenen getirisi ne olursa olsun.

---

## 6. PORTFÖY KURGUSU — $1M tek karar değil, 50 karar

Bu bölüm teknik değil ama en yüksek etkili kısım.

### 6.1 Kademeli yerleştirme (en önemli risk kontrolü)
ARV modelimiz **henüz kanıtlanmadı**. Hiç arsa alıp satmadık; ARV tahminleri comp'lardan geliyor ama bizim alıp bizim sattığımız bir veri noktası yok.

**Bu yüzden $1M tek seferde yerleştirilmez:**

- **Faz 1 — Pilot: $50-75K, 3-5 parsel.** Amaç kâr değil, **model doğrulama**. Gerçekte kaça sattık, kaç ayda sattık, gizli maliyet neydi?
- **Faz 2 — Kalibrasyon: $150-250K.** Pilotun gerçek sayılarıyla modeli düzelt. ARV sistematik olarak %20 yüksek çıktıysa modele kalıcı düzeltme gir.
- **Faz 3 — Ölçek: kalan sermaye**, doğrulanmış modelle.

Pilot maliyeti ~$60K. Modelin yanlış olduğunu $60K'da öğrenmek ile $1M'da öğrenmek arasındaki fark, bu metodun tek başına en değerli çıktısı.

### 6.2 Yoğunlaşma limitleri
- Tek county'ye sermayenin **%25'inden fazlası** girmez. County bazlı şok (imar değişikliği, yangın, su kısıtı) tüm portföyü vurmasın.
- Tek satıcıdan (aynı sahibin 88 parseli gibi toplu anlaşmalar) **%15'ten fazlası** alınmaz.
- En az 3 farklı eyalet — hukuki rejim çeşitliliği (non-judicial foreclosure eyaletlerini tercih et).

### 6.3 Likidite yedeği
Sermayenin **%10-15'i nakit tutulur**: vergi, aidat, beklenmedik tapu temizleme masrafı, ve fırsat çıktığında hızlı hareket için.

---

## 7. İNSAN DOĞRULAMASI — teklif öncesi son kapı

Otomatik sistem hiçbir zaman son karar vermez. Teklif öncesi elle:

1. **Tapu araştırması** (title search) — haciz, easement, zincir
2. **Plat haritası** — gerçek sınırlar, yasal erişim
3. **Uydu + sokak görüntüsü** — çöplük mü, su basmış mı, komşusu hurdalık mı
4. **County imar masasını ara** — "bu parsele ev yapılabilir mi?" Tek telefon, en değerli bilgi
5. **Vergi kaydı** — birikmiş borç kesin tutarı

---

## 8. YATIRIM NOTU (mektup notundan AYRI)

| Not | Şartlar |
|---|---|
| **IG1** | T1 değerleme · tüm mutlak eleyiciler temiz · bandının çarpanını geçiyor · county stok < 6 ay · **yıllık getiri > %100** · kötü senaryoda kârlı |
| **IG2** | T1/T2 · eleyiciler temiz · çarpan tutuyor · stok < 12 ay · **yıllık getiri > %60** · kötü senaryoda başabaş |
| **IG3** | T2 · küçük bayrak var (POA, eğim) veya yıllık getiri %40-60 · takip listesi, alım için ek doğrulama şart |
| **IG-RED** | Bir mutlak eleyiciye takıldı — sebebi yazılır |
| **IG-NA** | Değerleme T3/T4 — karar verilemez |

$1M yalnız **IG1 ve IG2**'ye yerleşir.

---

## 9. YAPILACAKLAR — öncelik sırasıyla

| # | İş | Neden bu sırada | Süre |
|---|---|---|---|
| 1 | **Comp hasatçısı** (FL/CO/OR/SC/GA satışları → `land_comps`) | Her şey değerlemeye dayanıyor; kaynaklar bugün doğrulandı | 1-2 gün |
| 2 | **County değerleme modeli** (medyan $/acre, satış/assessed oranı, örneklem, T1-T4 etiketi) | Comp'sız model yok | 1 gün |
| 3 | **Sermaye verimliliği filtresi** (sürtünme oranı) | Tek satır kod, envanterin %87'sini eliyor — en yüksek getirili iş | 2 saat |
| 4 | **Likidite modeli** (emilim + DOM, rakip-radar üstüne) | Hangi county'de oynanır sorusu | 1-2 gün |
| 5 | **Mutlak eleyici zenginleştirme** (FEMA sel, NWI sulak alan, SSURGO toprak, USGS eğim, imar min lot) | Her biri ücretsiz federal/eyalet API | 3-5 gün |
| 6 | **Underwriting hesaplayıcı** (3 senaryo, IRR) | Yukarıdakiler olmadan anlamsız | 1-2 gün |
| 7 | **`invest_grade` motoru + kokpit ekranı** | Hepsini birleştirir | 2 gün |

Toplam ~2 hafta. Ama **1-3 arası ilk 3 gün** yapılırsa ortaya çıkan liste zaten bugünkünden kat kat savunulabilir olur.

---

## 10. ÖZET — üç cümle

1. $1M **dönen sermaye**: eleme fiyat bandına göre değil, **çarpan × satış hızı** ikilisine göre yapılır — $5K'lık lot da $50K'lık parsel de aynı terazide (yıllıklandırılmış getiri) tartılır; sabit maliyet küçük işlemde daha yüksek çarpan şart koşar.
2. Bugünkü `est_retail` bir sabittir; gerçek satış verisi FL ve CO'da eyalet geneli **ücretsiz** mevcut, değerleme buna oturtulmalı ve **her parselde güven etiketi** taşımalı.
3. Sermaye tek seferde değil **pilot → kalibrasyon → ölçek** şeklinde yerleştirilmeli; modelin yanlış olduğunu $60K'da öğrenmek $1M'da öğrenmekten ucuzdur.
