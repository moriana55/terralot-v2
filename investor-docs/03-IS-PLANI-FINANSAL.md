# TerraLot — İş Planı & Finansal Model
### Detaylı Gelir Projeksiyonları ve Operasyonel Plan

---

## 1. İŞ MODELİ ÖZETİ

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ ARSA TEMİN  │ →  │ PLATFORM     │ →  │ TAKSİTLİ SATIŞ  │
│             │    │              │    │                 │
│ Tax Auction │    │ Listeleme    │    │ Peşinat $99-499 │
│ %50-75      │    │ Due Diligence│    │ Aylık $79-399   │
│ altı fiyat  │    │ AI Fiyatlama │    │ 12/24/36 ay     │
└─────────────┘    └──────────────┘    └─────────────────┘
                                              │
                          ┌───────────────────┘
                          ▼
                   ┌──────────────┐
                   │ GELİR DÖNGÜSÜ│
                   │              │
                   │ Taksit geliri│
                   │ → Yeni arsa  │
                   │ → Daha fazla │
                   │   gelir      │
                   └──────────────┘
```

---

## 2. BİRİM EKONOMİSİ

### 2.1 Parsel Başı Kar/Zarar Analizi

**Örnek: $8,000'lık bir arsa**

| Kalem | Tutar | Açıklama |
|-------|-------|----------|
| **GİDERLER** | | |
| Arsa alış (auction) | $4,000 | Piyasa değerinin %50'si |
| Title search & closing | $250 | Tapu temizlik kontrolü |
| Kayıt masrafı | $50 | County recording fee |
| Due diligence süresi | $0 | AI otomatik — maliyet yok |
| **Toplam maliyet** | **$4,300** | |
| | | |
| **GELİRLER** | | |
| Peşinat | $199 | Satış anında tahsil |
| Aylık taksit (24 ay) | $325/ay | Otomatik Stripe çekim |
| **Toplam gelir** | **$8,000** | |
| | | |
| **KAR** | **$3,700** | **%86 ROI** |

### 2.2 Taksit Planı Karşılaştırması (Aynı $8,000 Arsa)

| | 12 Ay | 24 Ay | 36 Ay |
|---|---|---|---|
| Peşinat | $199 | $199 | $199 |
| Aylık taksit | $650 | $325 | $217 |
| Toplam gelir | $8,000 | $8,000 | $8,000 |
| Başa baş ayı | 7. ay | 13. ay | 19. ay |
| Kar | $3,700 | $3,700 | $3,700 |
| Avantaj | Hızlı nakit | Dengeli | Geniş kitle |
| Dezavantaj | Az müşteri | — | Uzun süre |

**Optimal strateji:** Portföyün %30'u 12 ay, %50'si 24 ay, %20'si 36 ay olarak dağıtılmalıdır.

### 2.3 Fiyat Segmentleri

| Segment | Alış | Satış | Kar | Hedef Kitle |
|---------|------|-------|-----|-------------|
| Ekonomik | $1,000-$2,500 | $3,000-$5,000 | $1,500-$2,500 | Düşük gelirli, ilk yatırım |
| Orta | $2,500-$5,000 | $6,000-$12,000 | $3,000-$7,000 | Orta gelirli, yatırımcı |
| Premium | $5,000-$12,000 | $15,000-$30,000 | $8,000-$18,000 | Yüksek gelirli, ciddi yatırımcı |

---

## 3. DEFAULT (TEMERRÜT) ANALİZİ

### 3.1 Default Senaryoları

Taksitli arsa satışlarında default kaçınılmazdır. Ancak bu modelde default **zarar değil, fırsattır.**

```
Senaryo A: Müşteri 24 ayı tamamlar
→ Toplam gelir: $8,000 ✓

Senaryo B: Müşteri 12. ayda default eder
→ Tahsil edilen: $199 + ($325 × 12) = $4,099
→ Arsa geri alınır, yeniden satışa çıkar
→ İkinci satıştan: $8,000 daha
→ Toplam gelir: $12,099 (aynı arsadan!)

Senaryo C: Müşteri 3. ayda default eder
→ Tahsil edilen: $199 + ($325 × 3) = $1,174
→ Arsa geri alınır, yeniden satışa çıkar
→ Durum: Arsayı tekrar satarsın, zarar yok
```

### 3.2 Default Oranına Göre Senaryo Analizi

**10 arsa portföyü, toplam maliyet $40,000, toplam satış değeri $80,000**

| Default Oranı | Gerçekleşen Satış | Default'dan Kalan Gelir | Yeniden Satış | Toplam Gelir | Net Kar |
|---------------|-------------------|------------------------|---------------|-------------|---------|
| %0 (ideal) | $80,000 | — | — | $80,000 | $40,000 |
| %20 | $64,000 | $6,400 | $16,000 | $86,400 | $46,400 |
| %30 (beklenen) | $56,000 | $8,400 | $24,000 | $88,400 | $48,400 |
| %50 (kötü) | $40,000 | $12,000 | $40,000 | $92,000 | $52,000 |

**Paradoks:** Default oranı arttıkça toplam gelir de artıyor çünkü aynı arsa birden fazla kez satılıyor ve her seferinde peşinat + taksitler tahsil ediliyor.

---

## 4. 12 AYLIK FİNANSAL PROJEKSİYON

### 4.1 Muhafazakar Senaryo ($15,000 sermaye)

| Ay | Yeni Arsa | Toplam Arsa | Satılan | MRR | Kümülatif Gelir | Kümülatif Maliyet |
|----|-----------|-------------|---------|-----|-----------------|-------------------|
| 1 | 5 | 5 | 1 | $325 | $524 | $15,000 |
| 2 | 0 | 5 | 2 | $650 | $1,499 | $15,000 |
| 3 | 2 | 7 | 3 | $975 | $2,799 | $21,000 |
| 4 | 0 | 7 | 4 | $1,300 | $4,424 | $21,000 |
| 5 | 2 | 9 | 5 | $1,625 | $6,374 | $27,000 |
| 6 | 0 | 9 | 6 | $1,950 | $8,649 | $27,000 |
| 7 | 3 | 12 | 8 | $2,600 | $11,574 | $36,000 |
| 8 | 0 | 12 | 9 | $2,925 | $14,824 | $36,000 |
| 9 | 3 | 15 | 11 | $3,575 | $18,724 | $45,000 |
| 10 | 0 | 15 | 12 | $3,900 | $22,949 | $45,000 |
| 11 | 3 | 18 | 14 | $4,550 | $27,824 | $54,000 |
| 12 | 0 | 18 | 15 | $4,875 | $33,024 | $54,000 |

**Yıl sonu:** $33,024 gelir / $54,000 maliyet → Maliyet henüz karşılanmadı ancak aylık $4,875 MRR devam ediyor. 14. ayda toplam başa baş.

### 4.2 Gerçekçi Senaryo ($30,000 sermaye)

| Ay | Yeni Arsa | Toplam | Satılan | MRR | Küm. Gelir | Küm. Maliyet |
|----|-----------|--------|---------|-----|------------|-------------|
| 1 | 8 | 8 | 2 | $650 | $1,048 | $24,000 |
| 2 | 0 | 8 | 4 | $1,300 | $2,697 | $24,000 |
| 3 | 4 | 12 | 6 | $1,950 | $5,046 | $36,000 |
| 4 | 0 | 12 | 8 | $2,600 | $8,045 | $36,000 |
| 5 | 4 | 16 | 10 | $3,250 | $11,694 | $48,000 |
| 6 | 4 | 20 | 14 | $4,550 | $16,643 | $60,000 |
| 7 | 4 | 24 | 18 | $5,850 | $22,892 | $72,000 |
| 8 | 5 | 29 | 22 | $7,150 | $30,441 | $87,000 |
| 9 | 5 | 34 | 26 | $8,450 | $39,290 | $102,000 |
| 10 | 6 | 40 | 30 | $9,750 | $49,439 | $120,000 |
| 11 | 6 | 46 | 35 | $11,375 | $61,213 | $138,000 |
| 12 | 8 | 54 | 40 | $13,000 | $74,612 | $162,000 |

**Yıl sonu:** $74,612 gelir, $13,000 MRR devam ediyor. 6 ay sonra yatırım start → cash flow'dan yeni arsalar finanse ediliyor.

### 4.3 İyimser Senaryo ($50,000 sermaye)

| Gösterge | Değer |
|----------|-------|
| Yıl sonu toplam gelir | $185,000 |
| Yıl sonu MRR | $24,000+ |
| Toplam parsel | 100+ |
| Başa baş | 6. ay |
| Yıllık ROI | %270 |

---

## 5. OPERASYONEL GİDER DETAYI

### 5.1 Başlangıç Maliyetleri (Bir Kez)

| Kalem | Tutar |
|-------|-------|
| Wyoming LLC kuruluşu | $100 |
| Registered agent (yıllık) | $100 |
| EIN numarası | $0 |
| Avukat — sözleşme şablonu | $500 |
| Stripe hesap kurulumu | $0 |
| Domain + branding | $50 |
| **Toplam** | **$750** |

### 5.2 Aylık Sabit Giderler

| Kalem | Ay 1-3 | Ay 4-6 | Ay 7-12 |
|-------|--------|--------|---------|
| Vercel hosting | $20 | $20 | $50 |
| id.land abonelik | $20 | $20 | $20 |
| Stripe komisyon (%2.9) | $50 | $250 | $600 |
| Dijital pazarlama | $500 | $1,500 | $3,000 |
| Sanal asistan (VA) | — | $500 | $600 |
| Parsel emlak vergisi | $75 | $200 | $500 |
| Muhasebe / hukuk | $100 | $200 | $300 |
| Telefon / iletişim | $30 | $30 | $50 |
| **Toplam** | **$795** | **$2,720** | **$5,120** |

### 5.3 Parsel Başı Değişken Giderler

| Kalem | Tutar | Açıklama |
|-------|-------|----------|
| Title search | $100-$200 | Tapu temizlik kontrolü |
| County recording | $30-$80 | Tapu kayıt ücreti |
| Due diligence araçları | $0 | AI ile otomatik |
| Listing fotoğraf/video | $0-$50 | Google Earth + uydu |
| Pazarlama (parsel başı) | $50-$100 | Facebook/Google ads |
| **Toplam (parsel başı)** | **$180-$430** | |

---

## 6. NAKİT AKIŞ PROJEKSİYONU

### 6.1 İlk 6 Aylık Nakit Akışı ($30K Sermaye)

| Ay | Nakit Giriş | Nakit Çıkış | Net | Kümülatif |
|----|-------------|-------------|-----|-----------|
| 1 | $1,048 | $24,795 | -$23,747 | -$23,747 |
| 2 | $1,649 | $795 | +$854 | -$22,893 |
| 3 | $2,349 | $12,795 | -$10,446 | -$33,339 |
| 4 | $2,999 | $2,720 | +$279 | -$33,060 |
| 5 | $3,649 | $14,720 | -$11,071 | -$44,131 |
| 6 | $4,949 | $14,720 | -$9,771 | -$53,902 |

*Not: Nakit çıkışın büyük kısmı yeni arsa alımıdır. Arsa alımı durdurulduğunda nakit akış pozitife döner.*

### 6.2 Break-Even Analizi

```
Sabit aylık gider:    ~$3,000 (ortalama)
Parsel başı MRR:      $325 (24 ay plan ortalaması)
Break-even için:      10 aktif taksitli müşteri
Tahmini süre:         4-5. ay
```

---

## 7. 3 YILLIK VİZYON

| Gösterge | Yıl 1 | Yıl 2 | Yıl 3 |
|----------|-------|-------|-------|
| Aktif parsel | 50 | 200 | 500 |
| Aylık gelir (MRR) | $13,000 | $52,000 | $130,000 |
| Yıllık gelir | $74,000 | $624,000 | $1,560,000 |
| Net kar (gider sonrası) | $20,000 | $250,000 | $800,000 |
| Çalışan sayısı | 1 + VA | 3 | 8 |
| Ülke sayısı | 1 (ABD) | 5 | 15 |

---

## 8. ÇIKIŞ STRATEJİLERİ

Yatırımcı için potansiyel çıkış yolları:

| Strateji | Zamanlama | Tahmini Değer |
|----------|-----------|---------------|
| Temettü (kar dağıtımı) | Ay 6'dan itibaren | Aylık düzenli gelir |
| Hisse satışı (3. parti) | Yıl 2-3 | 3-5x yıllık gelir |
| Şirket satışı | Yıl 3-5 | $2-5M |
| Portföy tasfiyesi | İstediği zaman | Arsaların piyasa değeri |

---

---

## 9. KAYNAKÇA

### Finansal Model Referansları
1. Stripe — Pricing & Fee Structure, *stripe.com/pricing* (2026)
2. Wyoming Secretary of State — LLC Formation, *sos.wyo.gov/Business/StartBusiness.aspx* (2026)
3. IRS — Employer Identification Number (EIN), *irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online* (2026)
4. Mercury Bank — Business Banking for Startups, *mercury.com* (2026)

### Arsa Fiyat Verileri
5. LandWatch — Market Data & Pricing by State, *landwatch.com/market-trends* (2026)
6. Zillow — Land Value Estimates, *zillow.com/research/data* (2025)
7. Redfin — Vacant Land Sales Data, *redfin.com/news/data-center* (2025)
8. County Tax Assessor Records — Cochise County AZ, Hudspeth County TX, Costilla County CO (2025-2026)

### Tax Auction Fiyatlama
9. GovEase — County Tax Deed Auction Results, *govease.com* (2025-2026)
10. Bid4Assets — Completed Auction Price Data, *bid4assets.com* (2025-2026)
11. Tax Sale Support — State-by-state Auction Rules & Pricing, *taxsalesupport.com* (2025)

### Default & Seller Financing İstatistikleri
12. REtipster — "Seller Financing Default Rates in Land Sales", *retipster.com/seller-financing-default-rates* (2024)
13. National Contract Buyers League — Owner Financing Performance Data (2024)
14. American Bar Association — "Contract for Deed: Legal Framework by State", *americanbar.org/groups/real_property_trust_estate* (2024)

### Operasyonel Maliyet Referansları
15. Vercel — Pricing Plans, *vercel.com/pricing* (2026)
16. id.land — Subscription Plans, *id.land/pricing* (2026)
17. Tax Foundation — "Property Tax Rates by State", *taxfoundation.org/data/all/state/property-taxes-by-state* (2025)
18. Upwork — Virtual Assistant Rates (Philippines, LATAM), *upwork.com/hire/virtual-assistants* (2026)

### Pazarlama Benchmark
19. WordStream — "Facebook Ads Benchmarks for Real Estate", *wordstream.com/blog/facebook-ads-benchmarks* (2025)
20. HubSpot — "Cost Per Lead by Industry", *hubspot.com/marketing-statistics* (2025)

---

*TerraLot İş Planı & Finansal Model — Gizli Doküman*
*Mayıs 2026*
