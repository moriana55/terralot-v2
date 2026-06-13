# TerraLot — Teknoloji & Platform Altyapısı
### Teknik Mimari, Geliştirme Durumu ve Yol Haritası

---

## 1. PLATFORM GENEL BAKIŞ

TerraLot, arsa satış sürecinin tamamını dijitalleştiren uçtan uca bir teknoloji platformudur.

```
┌──────────────────────────────────────────────────────┐
│                    TERRALOT PLATFORM                  │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  MÜŞTERİ    │  │   ADMİN      │  │  AI MOTOR   │ │
│  │  WEB SİTESİ │  │   PANELİ     │  │             │ │
│  │             │  │              │  │ Arsa Keşif  │ │
│  │ Listeleme   │  │ Envanter     │  │ Değerleme   │ │
│  │ Detay       │  │ Lead'ler     │  │ Skorlama    │ │
│  │ Harita      │  │ Ödemeler     │  │ Fiyatlama   │ │
│  │ Checkout    │  │ Finansal     │  │             │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                │                  │        │
│  ┌──────┴────────────────┴──────────────────┴──────┐ │
│  │              VERİTABANI + API                    │ │
│  │         PostgreSQL + Prisma ORM                  │ │
│  └──────────────────┬───────────────────────────────┘ │
│                     │                                 │
│  ┌──────────────────┴───────────────────────────────┐ │
│  │            ENTEGRASYONLAR                         │ │
│  │  Stripe  │  WhatsApp  │  Email  │  id.land       │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 2. TEKNOLOJİ YIĞINI

| Katman | Teknoloji | Neden Seçildi |
|--------|-----------|---------------|
| **Frontend** | Next.js 16, React 19 | En güncel, en hızlı React framework |
| **Styling** | TailwindCSS 4 | Hızlı geliştirme, tutarlı tasarım |
| **Backend** | Next.js API Routes | Tek kod tabanı, serverless |
| **ORM** | Prisma | Type-safe veritabanı erişimi |
| **Veritabanı** | PostgreSQL (Neon) | Ölçeklenebilir, serverless, güvenilir |
| **Hosting** | Vercel | Global CDN, %99.99 uptime, otomatik ölçekleme |
| **Ödeme** | Stripe | PCI-DSS uyumlu, 135+ para birimi, recurring |
| **AI** | OpenAI GPT-4 | Arsa analizi, müşteri iletişimi |
| **Harita** | Leaflet + OpenStreetMap | Ücretsiz, özelleştirilebilir |
| **Email** | Resend | Developer-friendly, yüksek deliverability |
| **Mesajlaşma** | WhatsApp Business API | Uluslararası müşteri iletişimi |
| **Versiyon Kontrol** | Git + GitHub | Endüstri standardı |

---

## 3. TAMAMLANAN MODÜLLER

### 3.1 Müşteri Web Sitesi

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| Ana sayfa | ✅ Tamamlandı | Profesyonel landing page, CTA butonları |
| Arsa listeleme | ✅ Tamamlandı | Filtreleme (eyalet, fiyat, dönüm), sıralama |
| Arsa detay sayfası | ✅ Tamamlandı | Galeri, harita, özellikler, taksit hesaplayıcı |
| İnteraktif harita | ✅ Tamamlandı | Tüm arsalar harita üzerinde, tıklanabilir |
| Responsive tasarım | ✅ Tamamlandı | Mobil, tablet, masaüstü tam uyumlu |
| SEO optimizasyonu | ✅ Tamamlandı | Meta tags, sitemap, structured data |
| Hız optimizasyonu | ✅ Tamamlandı | Lighthouse skoru 95+ |

### 3.2 Admin Paneli

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| Dashboard | ✅ Tamamlandı | Genel bakış, KPI kartları, son işlemler |
| Listing yönetimi | ✅ Tamamlandı | Arsa ekleme, düzenleme, silme, durum değişikliği |
| Lead yönetimi | ✅ Tamamlandı | Gelen talepler, durum takibi |
| Ödeme takibi | ✅ Tamamlandı | Tahsilat durumu, geciken ödemeler |
| Finansal analiz | ✅ Tamamlandı | Parsel bazlı kar/zarar, eyalet analizi |
| Taksit simülasyonu | ✅ Tamamlandı | 12/24/36 ay plan karşılaştırması |
| Gelir/gider grafikleri | ✅ Tamamlandı | Aylık trend, kümülatif projeksiyon |

### 3.3 Tasarım Kalitesi

Platform, kurumsal düzeyde UI/UX standartlarında geliştirilmiştir:
- Modern, minimalist tasarım dili
- Tutarlı renk paleti ve tipografi
- Micro-interactions ve smooth transitions
- Dark/light mode desteği
- Accessibility standartlarına uyum (WCAG 2.1)

---

## 4. PLANLI GELİŞTİRMELER

### Faz 1: Ödeme Altyapısı (3-4 hafta)

| Özellik | Detay |
|---------|-------|
| Stripe Checkout | Peşinat tahsilat sayfası |
| Recurring payments | Otomatik aylık taksit çekimi |
| Ödeme başarısız yönetimi | Retry logic, kart güncelleme |
| Fatura/makbuz | Otomatik e-mail ile gönderim |
| Müşteri portalı | Ödeme geçmişi, kalan taksit görüntüleme |

### Faz 2: AI Arsa Keşif Motoru (6-8 hafta)

| Özellik | Detay |
|---------|-------|
| County auction tarama | Otomatik web scraping, yeni arsaları tespit |
| AI skorlama | 15 kriter üzerinden 0-100 puan |
| Comparable sales | Benzer arsaların satış fiyatları analizi |
| Otomatik fiyatlama | Maliyet + pazar verisi → önerilen satış fiyatı |
| Alert sistemi | "Yeni fırsat: Texas, 5 acre, $1,200, skor: 87/100" |

**AI Skorlama Kriterleri:**

| Kriter | Ağırlık | Açıklama |
|--------|---------|----------|
| Fiyat/piyasa oranı | %20 | Auction fiyatı vs piyasa değeri |
| Buildability | %15 | İnşaat yapılabilirlik |
| Road access | %15 | Yol erişimi kalitesi |
| Utilities | %10 | Su, elektrik, kanalizasyon yakınlığı |
| Flood risk | %10 | Sel riski (FEMA verisi) |
| Zoning | %10 | İmar durumu uygunluğu |
| Eyalet talebi | %10 | Geçmiş satış hızı |
| Dönüm başı fiyat | %5 | Bölge ortalaması karşılaştırma |
| Toprak kalitesi | %5 | USDA soil survey |

### Faz 3: İletişim & Otomasyon (3-4 hafta)

| Özellik | Detay |
|---------|-------|
| Email otomasyonu | Hoşgeldin, ödeme hatırlatma, makbuz |
| WhatsApp entegrasyonu | Uluslararası müşteri desteği |
| AI chatbot | 7/24 müşteri soruları yanıtlama |
| SMS bildirimleri | Ödeme hatırlatma, yeni listing bildirimi |

### Faz 4: Uluslararası Genişleme (3-4 hafta)

| Özellik | Detay |
|---------|-------|
| Çoklu dil | İspanyolca, Arapça, Portekizce, Türkçe |
| Para birimi gösterimi | USD + yerel para birimi |
| Bölgesel ödeme yöntemleri | PIX (Brezilya), OXXO (Meksika) |
| Lokalize pazarlama sayfaları | Her dil için özel landing page |

### Faz 5: Default Yönetim Sistemi (2-3 hafta)

| Gün | Aksiyon | Otomatik mi? |
|-----|---------|:---:|
| 0 | Ödeme günü, Stripe çekim dener | ✅ |
| 1 | Başarısız → email hatırlatma | ✅ |
| 3 | İkinci deneme + SMS | ✅ |
| 7 | WhatsApp mesajı + uyarı emaili | ✅ |
| 14 | Resmi uyarı mektubu (email) | ✅ |
| 30 | Son uyarı — "30 gün içinde ödeme yapılmazsa sözleşme fesh edilir" | ✅ |
| 60 | Otomatik sözleşme feshi, arsa envantere geri döner | ✅ |
| 61 | Arsa yeniden listelenir, yeni müşteri aranır | ✅ |

---

## 5. GÜVENLİK & UYUMLULUK

| Alan | Önlem |
|------|-------|
| Veri güvenliği | HTTPS everywhere, encrypted at rest |
| Ödeme güvenliği | Stripe PCI-DSS Level 1 uyumlu |
| Kimlik doğrulama | JWT + httpOnly cookies |
| Yetkilendirme | Role-based access control |
| Yedekleme | Otomatik günlük veritabanı yedekleme |
| Uptime | Vercel %99.99 SLA |
| GDPR | Veri silme hakkı, privacy policy |
| Veri lokasyonu | ABD (Vercel Edge Network) |

---

## 6. ÖLÇEKLENEBİLİRLİK

Platform, sıfırdan ölçeklenebilir mimaride tasarlanmıştır:

| Metrik | Mevcut Kapasite | Ölçeklenmiş |
|--------|----------------|-------------|
| Eşzamanlı kullanıcı | 1,000 | 100,000+ |
| Listing sayısı | 500 | 50,000+ |
| Aylık işlem | 100 | 10,000+ |
| Veritabanı | 10GB | 1TB+ |
| API yanıt süresi | <200ms | <200ms |

Vercel'in serverless mimarisi sayesinde trafik artışında otomatik ölçekleme yapılır, ek sunucu yönetimi gerekmez.

---

## 7. GELİŞTİRME TAKVİMİ

```
AY 1        ████░░░░░░░░░░░░░░░░░░░░  Stripe ödeme altyapısı + test
AY 2-3      ░░░░████████░░░░░░░░░░░░  AI arsa keşif motoru + veri entegrasyonu
AY 3-4      ░░░░░░░░░░░░████░░░░░░░░  WhatsApp + email + chatbot otomasyon
AY 4-5      ░░░░░░░░░░░░░░░░████░░░░  Uluslararası genişleme + çoklu dil
AY 5-6      ░░░░░░░░░░░░░░░░░░░░████  Default yönetimi + optimizasyon
            ─────────────────────────
            Toplam: 4-6 ay (sermaye sonrası)
```

---

---

## 8. KAYNAKÇA

### Framework & Runtime
1. Next.js 16 Documentation — *nextjs.org/docs* (2026)
2. React 19 — *react.dev* (2026)
3. Node.js — *nodejs.org* (2026)
4. TypeScript — *typescriptlang.org* (2026)

### Veritabanı & ORM
5. Prisma ORM — *prisma.io/docs* (2026)
6. PostgreSQL — *postgresql.org* (2026)
7. Neon Serverless Postgres — *neon.tech* (2026)

### Hosting & Altyapı
8. Vercel — Platform Documentation & SLA, *vercel.com/docs* (2026)
9. Vercel — Uptime & Reliability: %99.99 SLA, *vercel.com/docs/limits/overview* (2026)
10. Vercel Edge Network — Global CDN with 100+ PoPs, *vercel.com/docs/edge-network/overview* (2026)

### Ödeme Altyapısı
11. Stripe — API Documentation, *stripe.com/docs* (2026)
12. Stripe — PCI-DSS Level 1 Compliance, *stripe.com/docs/security/stripe* (2026)
13. Stripe — Supported Countries & Currencies (135+), *stripe.com/global* (2026)
14. Stripe Billing — Recurring Payments & Subscriptions, *stripe.com/docs/billing* (2026)

### AI & Machine Learning
15. OpenAI — GPT-4 API Documentation, *platform.openai.com/docs* (2026)
16. OpenAI — Pricing & Rate Limits, *openai.com/pricing* (2026)

### Harita & Coğrafi Veri
17. Leaflet.js — Open-source Map Library, *leafletjs.com* (2026)
18. OpenStreetMap — Free Map Data, *openstreetmap.org* (2026)
19. id.land — Parcel Boundary API, *id.land* (2026)

### Güvenlik Standartları
20. OWASP — Web Application Security, *owasp.org/www-project-top-ten* (2025)
21. GDPR — General Data Protection Regulation, *gdpr.eu* (2024)
22. WCAG 2.1 — Web Accessibility Guidelines, *w3.org/WAI/WCAG21/quickref* (2024)

### İletişim Entegrasyonları
23. WhatsApp Business API — *business.whatsapp.com/developers* (2026)
24. Resend — Email API for Developers, *resend.com/docs* (2026)
25. Twilio — SMS API, *twilio.com/docs/sms* (2026)

---

*TerraLot Teknoloji & Platform — Gizli Doküman*
*Mayıs 2026*
