# VegaLand — Hedef 25 Eyalet

**Tarih:** 2026-07-28
**Makinece okunur karşılığı:** `dashboard/src/lib/eyalet-hedefleri.ts`
**Temel:** `ALL-STATES-LAND-RESEARCH.md` tier listesi + iş kuralları + `KAPSAM-ENVANTERI.md` ölçümleri

---

## Seçim kuralları (bu sırayla uygulandı)

1. **Taksitli satış yapılabilmeli.** Contract-for-deed / land contract uygulaması
   oturmuş olmalı. **NY listede YOKTUR** (taksitli satış yapılmaz). NJ, MA, PA, CA
   de Tier 5 "kaçın" grubundadır, alınmadı.
2. **Ucuz arsa yoğunluğu.** Acre başı fiyat düşük veya en azından ucuz iç
   bölgeleri olan eyaletler.
3. **Bölme (subdivide) kolaylığı.** 10-35 acre üstü muafiyet veya ≤5 parsel minor
   split imkânı.
4. **Veri erişilebilirliği.** Sahip adı + **posta adresi** içeren ücretsiz bir
   kaynak var mı? Yoksa Regrid'e mecbur mu?
5. **Mevcut yatırımın korunması.** Veritabanında zaten verisi olan 15 eyalet
   listede tutuldu — sıfırdan başlamak yerine mevcut 565.930 lead'in üstüne inşa.

> **Neden bu 25?** Mevcut 15 eyalet (TX, FL, AR, NM, NC, CO, NV, OR, AZ, SC, MO,
> GA, MI, TN, OK) + taksit-dostu ve ucuz 10 yeni eyalet (MT, WY, ID, KS, NE, SD,
> MS, AL, KY, WV).

---

## Tier 1 — Çekirdek (ucuz + taksit-dostu + veri var)

| Eyalet | $/acre | Taksit | Hedef county | Veri yolu | Durum |
|---|---:|---|---|---|---|
| **NM** New Mexico | 725 | uygun | Valencia, Luna | county ArcGIS | Valencia ✅ 168.831 · Luna ❌ kaynak yok |
| **TX** Texas | 3.725 | koşullu¹ | Hudspeth, Brewster, Presidio, Terrell, Liberty, Cherokee, Harrison, Brazoria, Cochran | county ArcGIS (BIS ortak şema) | 9/9 ✅ |
| **AZ** Arizona | 4.200 | uygun | Mohave, Apache, Navajo, Cochise | Regrid gerekli | ❌ Mohave host'u çöktü, diğerlerinde ücretsiz kaynak yok |

¹ TX'te taksitli satışta (Property Code §5.061-5.085) yıllık hesap özeti,
tapu tescili ve iyileştirme bildirimi zorunlulukları var — yasal ama disiplin ister.

**Neden TX en değerlisi:** ~155 TX county appraisal district servisi **aynı "BIS"
şemasını** paylaşıyor. Sağlayıcı katmanında tek üretici fonksiyon (`txBis`) var;
yeni TX county eklemek **tek satır**. Bu, 25 eyalet hedefinin en ucuz genişleme yolu.

---

## Tier 2 — Ucuz + kolay bölme

| Eyalet | $/acre | Taksit | Hedef county | Veri yolu | Durum |
|---|---:|---|---|---|---|
| **MT** Montana | 1.280 | uygun | Hill, Blaine, Phillips, Garfield, Sanders | ⭐ eyalet geneli ArcGIS | 5/5 ✅ 30.388 boş arsa |
| **WY** Wyoming | 1.000 | uygun | Carbon, Fremont, Lincoln | county ArcGIS | 3/3 ✅ 11.867 |
| **NV** Nevada | 1.230 | uygun | Nye | county ArcGIS | ✅ 31.280 |
| **AR** Arkansas | 2.500 | uygun | Sharp, Izard, Van Buren | ❌ posta adresi yok | Regrid şart |
| **MS** Mississippi | 2.100 | uygun | Jefferson, Claiborne, Amite, Wilkinson, Kemper | araştırıldı | bkz. §Kalan iş |
| **WV** West Virginia | 2.200 | uygun | McDowell, Webster, Calhoun, Clay, Wirt | araştırıldı | bkz. §Kalan iş |
| **OK** Oklahoma | 2.880 | uygun | Pittsburg, Atoka, Beckham, Bryan | ❌ posta adresi yok | Regrid şart |
| **MO** Missouri | 3.200 | koşullu | Camden | county ArcGIS | ❌ servis artık token istiyor |

**MT'nin önemi:** Montana MSDI eyalet geneli servisi, 25 eyalet hedefinin
**en temiz kaynağı**. 56 county tek endpoint'te, `PropType='Vacant Land'` standart
bir değer, posta alanları ayrı ve %100 dolu. Yeni MT county eklemek tek satır.

---

## Tier 3 — Fırsat var, dikkat gerekli

| Eyalet | $/acre | Taksit | Hedef county | Veri yolu | Durum |
|---|---:|---|---|---|---|
| **CO** Colorado | 2.290 | uygun | Costilla, Las Animas, Park, Pueblo, Saguache | county + eyalet ArcGIS | 3/5 ✅ · Pueblo/Saguache'de kod sorunu |
| **ID** Idaho | 4.500 | uygun | Owyhee, Cassia, Elmore, Lemhi | county ArcGIS | 4/4 ✅ 23.972 |
| **OR** Oregon | 4.800 | uygun | Klamath, Lake | county ArcGIS | 2/2 ✅ 34.655 |
| **KY** Kentucky | 3.800 | uygun | Harlan, Bell, Leslie, Elliott, Wolfe | araştırıldı | bkz. §Kalan iş |
| **NC** North Carolina | 5.200 | uygun | Brunswick, Rutherford, Northampton | ⭐ eyalet geneli ArcGIS | 3/3 ✅ 97.945 |
| **SC** South Carolina | 4.800 | uygun | Colleton | county ArcGIS | ✅ 12.456 (değer alanı yok) |
| **AL** Alabama | 3.200 | uygun | Wilcox, Perry, Lowndes, Choctaw, Clarke | araştırıldı | bkz. §Kalan iş |
| **GA** Georgia | 4.500 | uygun | Bibb, Chatham | county ArcGIS | 2/2 ✅ 30.144 |
| **KS** Kansas | 2.400 | uygun | Douglas | county ArcGIS | ✅ 41.695 (değer yok) |
| **NE** Nebraska | 2.800 | uygun | Cass | county ArcGIS | ✅ 6.687 |
| **SD** South Dakota | 2.800 | uygun | Pennington | county ArcGIS | ✅ 9.365 |
| **MI** Michigan | 5.500 | koşullu | Roscommon | county ArcGIS | ✅ 7.833 |
| **TN** Tennessee | 3.500 | uygun | Sullivan, Chester | ❌ posta adresi yok | Regrid şart |
| **FL** Florida | 10.000 | uygun | Lee, Charlotte, Putnam, Highlands, Citrus, Brevard, Levy, Marion, Polk | ⭐ eyalet geneli ArcGIS | 7/9 ✅ |

**FL neden Tier 3'te tutuldu:** ortalama $10.000/acre pahalı görünse de iç bölgeler
(Charlotte, Highlands, Citrus, Putnam) hâlâ ucuz, taksitli satış çok yaygın ve
eyalet geneli tek servis 32 county'yi açıyor. DB'de zaten 84.044 mailable FL lead var.

---

## Listeye ALINMAYANLAR ve nedeni

| Eyalet | Neden alınmadı |
|---|---|
| **NY** | ⛔ **Taksitli satış yapılmaz — iş kuralı.** Ayrıca "5-5-3" bölme kuralı çok sıkı. |
| CA, NJ, MA, PA | Tier 5 "kaçın": pahalı + Subdivision Map Act / DRE gibi ağır bürokrasi. |
| MN | Contract-for-deed'e 2024 yasasıyla getirilen sıkı kısıtlar. |
| OH, IN, WI | Land contract'ta ek açıklama/kayıt yükümlülükleri + arsa pahalı ($7.000+). |
| IA | $7.500/acre — bölme amacıyla pahalı. |
| ME, ND | Ucuz ama çok uzak/soğuk; talep tarafı zayıf, ilk 25'e girmedi. |
| UT, WA, VA | Sıkı onay süreçleri veya su hakları karmaşası. |
| LA, HI, AK, VT, NH, DE, RI, MD, CT | Küçük/pahalı/özel düzenlemeli — land flipping için uygun değil. |

---

## Veri yolu özeti — 25 eyalet nasıl beslenecek

| Yol | Eyaletler | Not |
|---|---|---|
| ⭐ **Eyalet geneli tek ArcGIS** | MT, NC, FL | En ucuz genişleme. Yeni county = tek satır. |
| **Ortak şemalı county ailesi** | TX (~155 CAD, BIS şeması) | Yeni county = tek satır. |
| **County bazlı ArcGIS** | CO, NM, NV, OR, SC, GA, MI, KS, NE, SD, WY, ID | County başına bir kayıt. |
| **Regrid şart (ücretsizde posta adresi yok)** | AR, TN, OK, AZ | ⚠ Regrid anahtarı ŞU AN GEÇERSİZ. |
| **Araştırma tamam, kayda geçmeyi bekliyor** | MS, AL, KY, WV | bkz. §Kalan iş |

---

## Kalan iş — 25'e ulaşmak için somut engeller

1. **Regrid aboneliği ölü.** JWT `exp = 2026-07-20`. AR (71.585 satır), TN (3.666),
   OK (345) ve AZ'nin 3 county'si ücretsiz kaynakta posta adresi içermediği için
   **tamamen Regrid'e bağımlı**. Anahtar yenilenmeden bu 4 eyalette mektup atılamaz.
2. **ATTOM anahtarı yetkisiz** (401). Değerleme zenginleştirmesi çalışmıyor.
3. **AZ Mohave ArcGIS host'u çöktü** — ve Mohave projenin "aktif pazarı".
   Yeni host bulunmalı (county GIS portalı taşınmış olabilir) veya
   `az-mohave.opendata.arcgis.com` CSV indirmesine geçilmeli.
4. **MO Camden servisi token istemeye başladı** (HTTP 499).
5. **CO Pueblo/Saguache**: eyalet katmanı arazi kullanımını county'ye özel opak
   kod olarak veriyor → boş arsa ayıklanamıyor. County-özel kod eşlemesi gerekli.
6. **FL Marion ve Polk**: eyalet katmanı 45 sn'de yanıt vermiyor. Bu iki county
   için county-özel servis bulunmalı.
7. **KS/NE/SD'de hedeflenen ucuz county'lerin hiçbirinde halka açık servis yok.**
   Barber, Comanche, Elk (KS); Sioux, Cherry, Dundy (NE); Harding, Ziebach,
   Corson (SD) — hepsi tarandı, bulunamadı. Bu eyaletlerde şu an sadece
   büyük/orta county'lerden (Douglas, Cass, Pennington) veri var.
8. **ID yasal not:** Idaho Code §74-120, parsel verisinin üçüncü tarafa posta
   listesi olarak satılmasını yasaklıyor. Kendi kampanyamızda kullanım ayrı;
   liste ticareti yapılmamalı.
9. **ID ISTC proxy kırılganlığı:** Cassia/Elmore/Lemhi `Referer` başlığına bağlı.
   ISTC uygulamayı değiştirirse sessizce ölür — izleme alarmı konmalı.
