# Toplantı Notu — 10 Ağustos 2026
## Bu turda nereden nereye geldik

> Ahmet'in en son bildiği durum: **25 eyalet · 921.324 parsel · 51.581 A+/A** (3 Ağustos sunum verisi).
> Aşağıdaki her rakam bu sabah veritabanından ölçüldü.

---

## 1. Envanter — büyüdü ve sayılabilir hale geldi

| | Önce (3 Ağu) | Şimdi | Değişim |
|---|---|---|---|
| Parsel | 921.324 | **1.249.658** | **+%36** |
| Eyalet (veri var) | 25 | **43** | +18 |
| Profillenmiş eyalet / county | — | **34 eyalet · 321 county** | envanterin %95'i |
| A+ | — | **15.121** | — |
| A | — | **54.110** | — |

**Söylenecek:** "Envanteri 1,25 milyon parsele çıkardık ve tamamını kalite notuna ayırdık. En üst dilimde 15.121 parsel var — yol erişimi, elektrik, su ve kasaba mesafesi doğrulanmış, sahibine ulaşılabilir parseller."

---

## 2. Fiyatlandırma — bu turun asıl işi

**Sorun neydi:** Fiyatların büyük kısmı tek bir sabit sayıydı — **291.173 parsele aynı 2.999 dolar** yazılmıştı. O sabitin kaynağı da piyasanın en ucuz oyuncusunun medyan dönüm fiyatıydı. Yani envanterin tamamı, piyasanın en altına göre değerleniyordu.

**Ne yaptık:** Sabiti tamamen kaldırdık, yerine kaynak merdiveni kurduk. Her parselin fiyatının nereden geldiği artık kayıtlı.

| Fiyat dayanağı | Parsel |
|---|---|
| Gerçekleşmiş tapu satışı | 39.065 |
| Piyasa ilan fiyatı | 792.605 |
| Resmî takdir değeri | 87.228 |
| **Toplam dayanaklı** | **918.415 (%73)** |

| | Önce | Şimdi |
|---|---|---|
| Dayanağı olmayan | %77 | **%26** |
| Teklif hesaplanan parsel | 124.844 | **270.384** |

**Söylenecek:** "Fiyatlandırmayı denetledik. Dayanağı olmayan fiyatları kaldırdık — artık her parselin fiyatının kaynağını tek tek gösterebiliyoruz: gerçekleşmiş satış mı, piyasa ilanı mı, resmî takdir mi."

> Bu bir zayıflık itirafı değil. "Sayı kaldırdık" demek denetim yaptık demek. Sorgulanırsa: eski sistem her parsele aynı fiyatı yazıyordu, artık yazmıyor.

---

## 3. Piyasa verisi — 226'dan 41.083'e

| Kaynak | İlan |
|---|---|
| LandHub (hasat) | 26.173 |
| Zillow (ücretli API, kullanılmayan veriden kurtarıldı) | 14.309 |
| Rakip siteleri | 601 |
| **Toplam** | **41.083** |

**Neden önemli:** Teksas ve New Mexico "non-disclosure" eyaletler — tapu satış bedeli kamuya **hiç** açılmaz. Envanterin en büyük iki eyaleti orası (370 bin parsel). İlan verisi olmadan orada fiyat üretilemiyordu; artık üretiliyor.

---

## 4. Kanıt — "bu arsalar satılıyor mu?"

### Hacim
Florida'da son 2 yılda **75.648 kol mesafesi boş arsa satışı** (county sicili; quit-claim ve vergi tapuları hariç). Bizim parselimizin olduğu county'lerde:

| County | Bant | Satış | Medyan |
|---|---|---|---|
| Lee | 0–0,25 dönüm | 6.569 | $30.000 |
| Marion | 0–0,25 | 2.291 | $25.000 |
| Charlotte | 0–0,25 | 2.176 | $21.000 |
| Citrus | 0,25–0,5 | 1.334 | $19.500 |
| Highlands | 0–0,25 | 1.156 | $13.200 |
| Putnam | 0–0,25 | 239 | $5.500 |

### Kâr — aynı parselin alım ve satım fiyatı
**363 parselde** hem alım hem satım kaydı çıkarıldı:

- Medyan çarpan **x1,39** · çeyreklikler x1,17 – x1,79
- **%5'i zararına** satılmış
- Medyan elde tutma **4 ay**

| County | Çift | Medyan alım | Medyan satım | Çarpan |
|---|---|---|---|---|
| Brevard | 117 | $32.000 | $42.500 | x1,46 |
| Citrus | 92 | $20.000 | $27.050 | x1,36 |
| Charlotte | 81 | $21.500 | $30.000 | x1,36 |

**Ekranda göster:** `/admin/cevirme-kaniti` — APN'leriyle tek tek parseller, sicilden doğrulanabilir.

---

## 5. Sistem tarafı

- **Not motoru düzeldi.** Önce yarıda düşüyordu, artık tam tur atıyor (1,25M parsel, ~14 dk).
- **Sunucu kuruldu ve çalışıyor.** Hasat ve geo turları artık her gece kendiliğinden dönüyor; Mac'e bağımlılık bitti. Geo hızı ~4 kat arttı.
- **Vitrin sayfalandı.** A+/A havuzunun tamamı gezilebiliyor, her kartta pinli uydu görüntüsü bağlantısı var.

---

## 6. Sırada ne var

**Hazır bekleyen:** 13.016 kişilik temas listesi — sahibinin posta adresi var, fiyat dayanağı var, teklif hesaplanmış. Skip trace (telefon bulma) PropStream aboneliğinde **ücretsiz** (aylık 50.000 hak, 48.632'si duruyor).

**Önerilen ilk adım:** A+ dilimindeki şahıs sahipli 4.100 kaydı skip trace et, ilk temas turuna çık. Amaç satış değil **oran ölçmek**: kaç kişi cevap veriyor, kaçı satmaya istekli. O rakam çıkmadan 1,25 milyon parselin gerçek değeri bilinmiyor.

---

## ⛔ Toplantıda söylenmeyecekler

| Söyleme | Neden |
|---|---|
| "Rakip ucuza alıp pahalıya satıyor" | Doğrulanmadı, çöktü. Gokce Putnam'da $4.600-5.100 ödemiş, county medyanı $5.500 — piyasadan ucuza almıyorlar. |
| "x9, x11 kâr edenler var" | O parsellerde muhtemelen arsaya yapı yapılmış, doğrulanmadı. Medyan konuş. |
| "Florida'da çevirme kanıtı topladık" | Sadece 9 county tarandı. "Brevard, Citrus, Charlotte ve 6 county'de ölçtük" de. |
| "50 eyalet" | 43'te veri var, 34'ü profilli. Eksik 7: AK, DE, LA, NH, NJ, PA, RI. |
| Herhangi bir temas/satış rakamı | Bugüne kadar tek mektup gitmedi, tek numara çekilmedi. Sıfır. |

---

## Gezilecek ekranlar

1. `/admin/arsa-notlari` — A+ vitrin, sayfa sayfa
2. `/admin/cevirme-kaniti` — alım→satım kanıtı
3. `/admin/harita` — 43 eyalette gerçek nokta
4. `/admin/sunum` — üst düzey özet
