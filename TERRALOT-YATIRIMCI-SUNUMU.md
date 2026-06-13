# TerraLot
## ABD Arsa Taksitli Satış Platformu — Yatırımcı Bilgi Dosyası

---

## 1. YÖNETİCİ ÖZETİ

TerraLot, Amerika Birleşik Devletleri'nde vergi borcu nedeniyle düşük fiyata satışa çıkan arsaları satın alıp, dünya genelindeki bireysel yatırımcılara **taksitli ödeme planlarıyla** satan bir teknoloji platformudur.

**İş modeli özeti:**
- Arsalar piyasa değerinin %50-75'i altında county tax auction'lardan temin edilir
- 12, 24 veya 36 aylık taksit seçenekleriyle global müşterilere satılır
- Düşük peşinat ($99-499) ile giriş bariyeri minimuma indirilir
- Aylık taksit gelirleri yeni arsa alımlarına yönlendirilir (kendini besleyen döngü)
- Yapay zeka destekli arsa keşfi, fiyatlama ve müşteri yönetimi

**Mevcut durum:** Platform geliştirmesi tamamlanmış, ilk arsa alımları için sermaye arayışı aşamasındadır.

---

## 2. PAZAR ANALİZİ

### 2.1 ABD Arsa Pazarı
- ABD'de yıllık **$30+ milyar** değerinde boş arsa işlemi gerçekleşmektedir
- 3,000+ county'de her yıl vergi borcu nedeniyle binlerce arsa açık artırmaya çıkar
- Tax deed auction'larda arsalar piyasa değerinin **%20-50'sine** alınabilmektedir

### 2.2 Hedef Kitle
| Segment | Neden Alır? | Tahmini Büyüklük |
|---------|-------------|------------------|
| ABD — düşük gelirli bireyler | Ev sahibi olma hayali, kredi notu problemi | 45M+ hane |
| Latin Amerika | ABD'de yatırım, gelecek göçü planı | 650M nüfus |
| Orta Doğu & Kuzey Afrika | Güvenli liman yatırımı, dolar bazlı varlık | 400M nüfus |
| Güneydoğu Asya | Düşük giriş maliyetli yatırım fırsatı | 680M nüfus |

### 2.3 Rekabet Analizi

| Rakip | Güçlü Yanı | Zayıf Yanı |
|-------|-----------|------------|
| Discount Lots | Büyük envanter | Eski teknoloji, sadece ABD pazarı |
| LandWatch | Yüksek trafik | Sadece ilan platformu, satış yapmıyor |
| LandBoss | CRM araçları | B2B odaklı, son kullanıcıya hitap etmiyor |
| **TerraLot** | **AI + taksit + global pazar** | **Henüz envanter yok (sermaye bekleniyor)** |

### 2.4 Rekabet Avantajımız
1. **Taksitli satış:** Rakiplerin çoğu peşin satış yapar. Taksit = çok daha geniş müşteri havuzu
2. **Teknoloji altyapısı:** Profesyonel platform, otomatik ödeme, AI destekli operasyon
3. **Global erişim:** Çok dilli destek, WhatsApp entegrasyonu, uluslararası ödeme
4. **Veri odaklı:** AI ile arsa keşfi, otomatik değerleme, risk skorlama

---

## 3. İŞ MODELİ

### 3.1 Gelir Kaynakları

```
Arsa Alış (Tax Auction)     →  $2,000 - $5,000
Arsa Satış (Taksitli)       →  $5,000 - $15,000
─────────────────────────────────────────────────
Brüt Kar Marjı              →  %40 - %65
Default Sonrası Net Marj    →  %30 - %50
```

### 3.2 Birim Ekonomisi (Örnek Parsel)

| Kalem | Tutar |
|-------|-------|
| Arsa alış fiyatı (tax auction) | $3,000 |
| Due diligence + kapanış masrafı | $300 |
| **Toplam maliyet** | **$3,300** |
| Satış fiyatı | $8,000 |
| Peşinat | $199 |
| Aylık taksit (24 ay) | $325/ay |
| **Toplam gelir** | **$8,000** |
| **Brüt kar** | **$4,700 (%142 ROI)** |

### 3.3 Taksit Planı Karşılaştırması

| Plan | Peşinat | Aylık Taksit | Toplam Gelir | Başa Baş Noktası |
|------|---------|-------------|-------------|------------------|
| 12 ay | $199 | $650 | $8,000 | 5. ay |
| 24 ay | $199 | $325 | $8,000 | 10. ay |
| 36 ay | $199 | $217 | $8,000 | 15. ay |

*Not: 12 ay planı daha hızlı nakit döngüsü sağlar ancak daha az müşteri çeker. 24 ay optimal dengedir.*

### 3.4 Default (Temerrüt) Yönetimi
- Sektör ortalaması: Taksitli arsa satışlarında **%25-35** default oranı
- Default durumunda arsa **otomatik olarak geri alınır** ve yeniden satışa çıkar
- Tahsil edilen taksitler gelir olarak kalır (contract for deed yapısı)
- Bir arsa ortalama **2.3 kez** satılabilir (default + yeniden satış döngüsü)

---

## 4. TEKNOLOJİ PLATFORMU

### 4.1 Mevcut Durum (Tamamlanan Geliştirmeler)

| Modül | Durum | Açıklama |
|-------|-------|----------|
| Müşteri web sitesi | Tamamlandı | Arsa listeleme, detay sayfaları, harita görünümü |
| Admin paneli | Tamamlandı | Listing yönetimi, lead takibi, ödeme yönetimi |
| Finansal analiz | Tamamlandı | Parsel bazlı kar/zarar, eyalet analizi, taksit simülasyonu |
| Responsive tasarım | Tamamlandı | Mobil uyumlu, tüm cihazlarda çalışır |

### 4.2 Planlanan Geliştirmeler (Sermaye Sonrası)

| Modül | Süre | Açıklama |
|-------|------|----------|
| Stripe ödeme entegrasyonu | 1 hafta | Otomatik taksit çekimi, peşinat tahsilat |
| AI arsa keşif motoru | 2 hafta | County auction verilerini tarar, uygun arsaları puanlar |
| Otomatik değerleme | 1 hafta | Comparable sales analizi ile fiyat önerisi |
| WhatsApp entegrasyonu | 1 hafta | Uluslararası müşteri iletişimi |
| Çoklu dil desteği | 1 hafta | İspanyolca, Arapça, Portekizce |
| Müşteri portalı | 1 hafta | Ödeme geçmişi, sözleşme indirme |
| Default yönetim sistemi | 1 hafta | Otomatik hatırlatma, geri alma süreci |

### 4.3 Teknoloji Yığını
- **Frontend:** Next.js 16, React 19, TailwindCSS
- **Backend:** Node.js, Prisma ORM, PostgreSQL
- **Hosting:** Vercel (global CDN, %99.99 uptime)
- **AI:** OpenAI GPT-4 + custom scoring algorithms
- **Ödeme:** Stripe (PCI-DSS uyumlu, 135+ para birimi)

---

## 5. FİNANSAL PROJEKSİYONLAR

### 5.1 Büyüme Senaryosu (12 Aylık)

| Ay | Aktif Parsel | Satılan | Aylık Gelir (MRR) | Kümülatif Gelir | Kümülatif Maliyet |
|----|-------------|---------|-------------------|-----------------|-------------------|
| 1 | 5 | 2 | $650 | $1,050 | $15,000 |
| 2 | 5 | 3 | $1,625 | $2,675 | $15,000 |
| 3 | 8 | 5 | $3,250 | $5,925 | $24,000 |
| 4 | 12 | 8 | $4,550 | $10,475 | $24,000 |
| 5 | 15 | 10 | $5,850 | $16,325 | $30,000 |
| 6 | 20 | 14 | $7,800 | $24,125 | $36,000 |
| 7 | 25 | 18 | $9,750 | $33,875 | $36,000 |
| 8 | 30 | 22 | $11,700 | $45,575 | $42,000 |
| 9 | 40 | 28 | $14,300 | $59,875 | $42,000 |
| 10 | 50 | 35 | $17,550 | $77,425 | $48,000 |
| 11 | 60 | 42 | $20,800 | $98,225 | $48,000 |
| 12 | 75 | 52 | $24,700 | $122,925 | $54,000 |

### 5.2 Aylık Operasyonel Giderler

| Kalem | Ay 1-3 | Ay 4-6 | Ay 7-12 |
|-------|--------|--------|---------|
| Platform hosting | $20 | $20 | $50 |
| Stripe komisyon (%2.9) | $50 | $250 | $600 |
| id.land abonelik | $20 | $20 | $20 |
| Pazarlama (ads) | $500 | $1,500 | $3,000 |
| Sanal asistan | $0 | $500 | $600 |
| Emlak vergisi (parsel başı) | $75 | $200 | $500 |
| Hukuk / muhasebe | $100 | $200 | $300 |
| **Toplam** | **$765** | **$2,690** | **$5,070** |

### 5.3 Yatırım Getirisi (ROI)

| Senaryo | Sermaye | 12 Ay Sonunda | ROI |
|---------|---------|---------------|-----|
| Muhafazakar | $15,000 | $45,000 | %200 |
| Gerçekçi | $30,000 | $122,000 | %307 |
| İyimser | $50,000 | $250,000 | %400 |

*%30 default oranı dahil edilmiştir. Default edilen arsalar yeniden satışa çıkar.*

---

## 6. RİSK ANALİZİ VE AZALTMA STRATEJİLERİ

| Risk | Olasılık | Etki | Azaltma Stratejisi |
|------|----------|------|---------------------|
| Kötü arsa satın alma | Orta | Yüksek | AI destekli due diligence, 15 maddelik kontrol listesi |
| Yüksek default oranı | Yüksek | Düşük | Modele dahil (%30), arsa geri alınıp tekrar satılır |
| Yasal sorunlar | Düşük | Yüksek | Eyalet bazlı avukat onaylı sözleşme şablonları |
| Pazar doygunluğu | Düşük | Orta | Çok pazarlı strateji (LATAM, MENA, SEA) |
| Ekonomik kriz | Düşük | Orta | Arsa somut varlık, sıfıra düşmez, düşük volatilite |
| Teknik arıza | Düşük | Düşük | Vercel %99.99 uptime, otomatik yedekleme |

---

## 7. ORTAKLIK YAPISI ÖNERİSİ

### Model: Teknoloji Ortaklığı + Gelir Paylaşımı

```
YATIRIMCI                          TEKNOLOJİ ORTAĞI (TerraLot)
─────────                          ───────────────────────────
Sermaye sağlar                     Platform geliştirme & yönetim
Arsa alım bütçesi                  AI arsa keşif motoru
                                   Operasyonel yönetim
                                   Müşteri ilişkileri
                                   Teknik altyapı

Gelir Paylaşımı:                   
  Yatırımcı  → %60                 
  TerraLot   → %40                 

Platform Sahipliği: TerraLot       
Finansal Raporlama: Aylık          
Minimum Süre: 12 ay                
```

### Yatırımcı Hakları
- Gerçek zamanlı finansal dashboard erişimi
- Aylık detaylı performans raporu
- Arsa alım kararlarında veto hakkı
- İstediği zaman bağımsız denetim talep etme hakkı

### Yatırımcı Koruması
- Her arsa yatırımcı adına LLC üzerinden kaydedilir
- Sözleşmeler şeffaf, her işlem izlenebilir
- Portföy değeri düşerse ek sermaye talebi yapılmaz

---

## 8. ARAŞTIRMA KAYNAKLARI VE VERİ ALTYAPISI

Aşağıdaki kaynaklar platform geliştirme sürecinde analiz edilmiştir:

| Kaynak | Kullanım Alanı |
|--------|---------------|
| id.land (Land ID) | Parsel sınırları, topografi, zoning verileri |
| FEMA Flood Maps | Sel riski analizi |
| County GIS Portalları | Vergi borcu, mülkiyet geçmişi |
| LandWatch / Zillow | Comparable sales, piyasa fiyatları |
| US Census Data | Bölgesel demografik analiz |
| Google Earth Pro | Uydu görüntüsü, arazi erişim analizi |
| USDA Web Soil Survey | Toprak kalitesi, tarımsal uygunluk |

---

## 9. HEMEN BAŞLANACAK ADIMLAR

Sermaye onayı sonrasında 30 gün içinde:

| Hafta | Aksiyon | Çıktı |
|-------|---------|-------|
| 1 | Wyoming LLC açılışı + banka hesabı | Yasal yapı hazır |
| 1 | Stripe ödeme entegrasyonu | Ödeme altyapısı aktif |
| 2 | 5 hedef county belirleme + arsa araştırması | Due diligence raporları |
| 2 | Avukat ile sözleşme şablonu finalize | Legal framework hazır |
| 3 | İlk 3-5 arsa satın alımı | Envanter oluştu |
| 3 | Listing sayfaları + fotoğraf/harita | Satışa hazır arsalar |
| 4 | Facebook/Instagram reklam kampanyası başlat | İlk lead'ler |
| 4 | İlk satış | **Gelir başladı** |

---

## 10. İLETİŞİM

**TerraLot — US Land Investment Platform**

Proje Yöneticisi: Yiğit Ertürk
E-posta: erturktolga56@gmail.com

---

*Bu doküman gizli bilgi içermektedir ve sadece potansiyel yatırımcılara yöneliktir.*
*Hazırlanma Tarihi: Mayıs 2026*
