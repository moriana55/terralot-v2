# Ahmet Sunum Hazırlığı — Soru/Cevap + Öneriler + Haftaya Plan

_Son güncelleme: 2026-06-29. Amaç: Ahmet'in sorabileceği zor sorulara hazır cevap + bu hafta/haftaya yapılacaklar._

---

## 1) Ahmet'in Sorabileceği Zor Sorular → Dürüst Cevaplar

### "Bu değerlemeyi neye göre verdin? Uydurma değil mi?"
- Piyasa değeri = **ATTOM gerçek satılmış-arsa emsali ($/acre) × parselin dönümü**. ATTOM = lisanslı ABD emlak veri sağlayıcısı, gerçek tapu/satış kayıtları.
- **Son 4 yıl filtresi var** (2022+). Eski/bayat satışlar eleniyor. Kart artık emsalin **yıl aralığını** gösteriyor (örn. "ATTOM bölge emsali · 4 emsal (2022–2024)").
- Örnek: Golden Valley/Kingman $4.096/ac (4 emsal, 2022–24). 2.27 acre parsel → ~$9.298 piyasa.
- **County "assessed" değeri (DCAD/HCAD) AYRI** ve "assessed" diye etiketli — bu vergi dairesinin değeri, birebir piyasa değil. İkisini karıştırmıyoruz, dürüst etiketliyoruz.

### "Comp yoksa / az ise ne yapıyorsun?"
- Emsal < 3 ise değer göstermiyoruz; kart **"comp gerekli"** diyor. **Sahte değer üretmiyoruz.**
- Emsal değeri ile county-assessed değer **4 kattan fazla** sapıyorsa → **"⚠ doğrulama gerek"** flag'i; o parselde güvenli teklif vermiyoruz (kırsal $/acre'ı kentsel lota uygulama hatasını engelliyor).

### "Bu veriler ne kadar güncel? Ne zaman çektin?"
- ATTOM emsal verisi: **29 Haziran 2026** tazelendi (kartta `as-of`).
- Tax-delinquent kayıtlar: **her gece 06:00 otomatik** (launchd `com.terralot.sourcing`) — refresh idempotent, deal kimliği sabit.
- Her kaynağın kendi tarihi tutuluyor.

### "Bu adreslere gerçekten mektup atabilir miyim?"
- **~23.925 kayıt mektuba-hazır** (owner adı + posta adresi + min_bid tam). 11 eyalet.
- **Mohave AZ: 20.000 saf off-market lead** — county ArcGIS'ten çekildi, hepsi **absentee doğrulandı** (eyalet-dışı sahip), boş arazi (IMPVALUE=0).
- + **286 küratörlü premium deal** (246 Dallas DCAD + 40 Harris HCAD) gerçek owner/APN/değer.

### "Bunlar off-market mi yoksa ihaleden mi? (asıl soru bu)"
- **Dürüst ol:** eldeki ~33K tax-delinquent kaydın **çoğu ihale/tax-sale kaynaklı**.
- **Mohave 20K = saf off-market** (absentee + vergi-sorunsuz, doğrudan sahipten). Gerçek off-market motoru burada başladı.
- Tüm-eyalet "free mailable off-market" YOK — çoğu county posta adresi vermiyor. **Mohave istisna.** Ölçek için ücretli sağlayıcı gerek (aşağıda).

### "Teklif neden piyasanın %25'i? Adamı kırmaz mı?"
- Blind-offer modeli = piyasa değerinin **%25'i** (önceden %20'ydi, lowball çok kırıyordu → kabul şansı için %25'e çıktık). Spread hâlâ sağlıklı çünkü **nakit satış piyasanın %65'i**.
- Spread = (piyasa × %65) − teklif. Örn. CASTRO AMOR: ~$4.317 nakit satış − $1.661 teklif ≈ konservatif spread.

### "Hukuki olarak başım derde girer mi?"
- Boş arazide yapı yok → **Dodd-Frank/SAFE muafiyeti** (modelin temeli).
- **Non-judicial foreclosure eyaletleri seç** (AZ/TX/TN/MO/NV/OK/AR/WY) → temerrütte hızlı geri-al.
- **CFD (contract for deed) KULLANMA → senet + deed of trust.**
- Türk satıcı: **FIRPTA %15 stopaj + Form 8288-B** önceden planla; US LLC + title company ile uzaktan kapanış.
- **NY'de taksitli satış YAPMA** (alıcı çıkarma sorunu) — NY Ahmet'in ayrı ev işi.

---

## 2) Öneriler (Yiğit'in Ahmet'e götüreceği)

1. **Mohave modelini diğer county'lere genişlet** — ama dürüst ol: her county ArcGIS posta adresi vermiyor. Ölçek için ücretli sağlayıcı şart.
2. **PropStream $99/ay** (doğrulandı: 25K export/ay, vacant+absentee+mailing filtre, skip-trace 12¢) → en hızlı ölçek yolu. Ahmet'e "bunu al" de.
3. **ReportAll API** (bulk min ~$1.000 prepay) → motor olarak daha güçlü, sonraki adım.
4. **Başlangıç hedef county'ler:** Deming/Luna NM, Cochise AZ, Costilla CO, Florida platted lots, Horizon TX (1950-70 spekülatif arsa-bölme kalıntısı = yaşlı/unutmuş eyalet-dışı sahipler).
5. **LANDIO taktiği:** güzel ilanı BULMA, ÜRET — ucuz ham parsel al → GIS komşuluk/mesafe/vergi + AI betimleme giydir → owner-finance sat. ("Parsel → AI ilan üreteci" özelliği önerilebilir.)

---

## 3) Haftaya Yapılacaklar (öncelik sırası)

- [ ] **owner_finance_listings.sql'i Supabase'de çalıştır** (demo finali kalıcı kayıt için — bekleyen owner aksiyonu).
- [ ] **Mohave modelini 1-2 yeni county'de dene** (NM Luna / CO Costilla ArcGIS portallarını test et — posta adresi açık mı?).
- [ ] **PropStream deneme hesabı** aç, 1 county export'unu pipeline'a sok (mailable doğrula).
- [ ] **Lob gerçek entegrasyon (#7)** — mektup atma uçtan uca canlı (şu an outreach+deal-sheet bağlı, Lob API'yi gerçekle).
- [ ] **Değerleme şeffaflığını her ekrana yay** — kart artık temel+emsal+yıl gösteriyor; aynı rozeti acquisitions/real-deals/mailer detaylarına da koy.
- [ ] **Buyer Portal / Referral sistemi** — direkt gelir getiren iki modül (yapılacaklar #1 ve #5).
- [ ] (Opsiyonel) **AI tanıtım videosu (#3)** — parsel → uydu karesi → image-to-video; LANDIO/pirealty modeli.

---

## 4) Tek Cümlelik Güven Mesajı (Ahmet'e)
> "Hiçbir değeri uydurmuyoruz: her piyasa rakamı gerçek satış emsaline dayanıyor, tarihi ve kaç emsal olduğu kartta yazıyor, emsal yoksa değer vermiyoruz. Off-market tarafında Mohave'de 20 bin doğrulanmış absentee lead hazır; ölçek için PropStream/ReportAll yolu net."

---

## 5) 20K Lead'i NASIL Bulduk? (sistematik — Ahmet "nasıl buldunuz" derse)
**Hedef profili: araziyi alıp unutmuş, sahibi uzakta (eyalet-dışı) olan boş arsalar.** Mohave County'nin **halka açık ArcGIS** parsel verisinden ($0, scraper'ımla) şu filtreyle çektik:
- **IMPVALUE = 0** → boş arsa (üstünde yapı/ev YOK)
- **Sahip eyaleti ≠ AZ** → ABSENTEE (sahibi başka eyalette, uzakta)
- **0.8–5 acre** → mektuba + satışa uygun lot boyutu
- ucuz / düşük vergi değeri

**Neden motive satıcı:** 1950-70'lerin spekülatif çöl arsa-bölme kalıntısı. Sahip onlarca yıl önce almış, hiç yapmamış, gitmemiş, belki unutmuş, boşuna vergi ödüyor → mektup gelince ucuza satmaya açık. Bu **gerçek off-market** (ihale DEĞİL, doğrudan sahibe direct-mail).

## 6) 50 Eyalete Nasıl Çıkarız? (veri kaynağı karar ağacı)
Bir county'de lead lazım → o county'nin BEDAVA ArcGIS'i owner + **posta adresi** veriyor mu?
- **EVET** (nadir; Mohave gibi) → bedava çek ($0)
- **HAYIR** (çoğu county — posta adresi vermez) → **PropStream** ($99/ay, 50 eyalet, vacant+absentee+mailing filtre) ile çek → hacim büyürse **ReportAll** (~$1000 PREPAY kredi, aylık değil; ulusal API, owner+mailing)

Her aracın işi: **BUL** = ArcGIS(bedava)/PropStream/ReportAll · **DEĞERLE** = ATTOM (sold comps; şu an trial key, hacimde paralı) · **AT** = Lob (~$1/mektup) · **SINIR(görsel)** = Regrid (opsiyonel, en son). Hepsi aynı `offmarket_leads` tablosuna akar — sistem ayırt etmez.

## 7) Maliyet Sahipliği — Hangi Gider Kimin (TOPLANTIDA NET TUT)
| Kalem | Kim öder |
|---|---|
| Veri (PropStream/ReportAll/ATTOM/skip-trace) | **Ahmet** (iş gideri) |
| Lob mektup/posta | **Ahmet** |
| Parsel ALIM sermayesi + kapanış (title/US LLC/FIRPTA) | **Ahmet** |
| Hosting (Supabase/Vercel/domain) | **Ahmet** (iş tarafı) |
| Yazılım + entegrasyon + işletme | **Yiğit** (haftalık ücret + komisyon) |
| Yiğit'in kendi bilgisayarı/dev ortamı | Yiğit (sadece bu) |

**Ezber cümle:** "Ben motor, sen yakıt. Yazılım + entegrasyon bende; veri + sermaye + kapanış sende. Bu muslukları açtığın gün deal akar." Veri abonelikleri **Ahmet'in kartına/hesabına** açılır, key'i Yiğit sisteme takar — geliştirme ücretinin DIŞINDA.
