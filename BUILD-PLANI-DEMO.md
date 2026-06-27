# Terralot-v2 BUILD Planı — Yol Haritasını Ürüne Bağlamak (Ahmet Demosu ~2 gün)

Tüm bulgular koddan doğrulandı. **Sürpriz:** Terralot yol haritasının **~%70'ini zaten karşılıyor.** Florida pluggable, AI skorlama çalışıyor, blind-offer şablonu + Lob mock + owner-finance calculator hazır. Eksik = "satış döngüsünü görünür kılmak" + "teklif ekonomisini yol haritasıyla hizalamak" — ikisi de 2 güne sığar.

---

## 1. FLORIDA VERİ KAYNAĞI — sanılandan çok az iş
**VAR:** Scraper Texas-only DEĞİL, **pluggable per-state** (12+ eyalet: TX/FL/TN/NC/GA/OH/AZ/CO/AR/MI/NM/OK). **`scraper/scrape_florida.js` (282 satır) ZATEN VAR** — Marion County LAT PDF scraper'ı tam çalışıyor (login/anti-bot yok). Regrid değerleme eyaletten bağımsız (`usedesc`→vacant, `owner`→absentee). Skorlama (`scoring.js:45`) absentee regex'i zaten yapıyor.
**EKSİK:** RealAuction stub non-US IP'den geo-bloklu; Marion tek-county (Hillsborough/Orange loop yok); `is_vacant`/`is_absentee` kolon yok (Regrid'den türetilebilir, pipeline bağlı değil).
**Efor:** Hillsborough/Orange PDF loop 4-6s · Regrid enrich 3-4s · kolon migration 1s. **Demo kestirmesi:** elle 30-50 FL parsel çek → `florida-deals.json` seed (~2-3 saat, canlı scraper şart değil).

## 2. SATIŞ TARAFI — "yok" değil, "bağlı değil"
**VAR (çalışıyor):** **Owner-finance calculator TAM** (`lib/flip-calc.ts` — amortisman, konfigüre APR, peşinat %/$ , aylık+faiz+ROI+IRR+tablo; default %9.9/%10down/60ay). `admin/owner-finance` listing CRUD. `admin/financing` en olgun ekran (kontrat/buyer/APR/overdue). `/buyer/` portal iskeleti + `lib/buyer.ts` payment schedule.
**EKSİK:** Property→listing tek-tık "Sat" butonu yok. Buyer portal sahte veri ($12,999/$299/48ay). Checkout park (Stripe/GeekPay yok).
**Efor:** owner-finance default %9-11 + preset 1s · `admin/listings`'e "Owner-Finance ile Sat" butonu 4-6s. **Demo kestirmesi:** buyer/Stripe'a girme; sadece preset + Sat butonu (~5-6 saat).

## 3. LOB MEKTUP — sandbox çalışıyor, blind-offer şablonu VAR
**VAR:** `api/lob/route.ts` tam plumbing (key yoksa mock/sandbox, varsa gerçek). **Blind-offer şablonu VAR** (`lib/mailer-data.ts:132` tpl3 "Formal Offer Letter" merge'li + tpl5 imzalanabilir). Teklif hesabı VAR (`api/outreach/route.ts:65` buildDealSheet, offerPct slider). Uçtan uca: lead→deal-sheet→Lob→log.
**EKSİK:** `LOB_API_KEY` yok (mock); Lob template'leri yüklenmemiş (placeholder ID). Teklif % default **110** (minimum-bid'in %110'u) — yol haritası "**market value × %15-25**" diyor, kavramsal düzeltme gerekli. `admin/mailer` Quick Send teklifi hardcoded "15000".
**Efor:** offer mantığını market-value × %15-25 yap 2s · LOB_API_KEY + template yükle 2-3s. **Demo kestirmesi:** mock yeter, sadece teklif mantığını düzelt (~2 saat).

## 4. DEMO AKIŞI — mevcut sayfalar zaten taşıyor
**Demo-hazır:** `admin/ucuz-arsa` (40 deal, rubrik, grade, CSV) · `ucuz-arsa/[id]` (deep-dive, 6-faktör skor, DD checklist, **"Mektup At"** → mailer prefill) · `admin/real-deals` (246 deal, DCAD, spread) · `admin/page` (funnel, brifing, hot counties). Uçtan uca akış BAĞLI: ucuz-arsa/[id]→[Mektup At]→mailer→[Send via Lob]→mock.

---

## SONUÇ — 2 Günlük Demo, En Yüksek-Getiri 4 Madde (~16-18 saat)

1. **🥇 Florida deal seed (~3s)** — Hillsborough+Orange'dan 30-50 parsel → FL toggle. "Texas'ta kanıtladık, Florida'ya genişledik" = yol haritasının görünür kanıtı.
2. **🥈 Teklif mantığı market-value bazlı (~2-3s)** — offer = `market_value × 0.20` (slider %15-25). Rakamlar yol haritasıyla birebir.
3. **🥉 Owner-finance preset + "Sat" butonu (~5-6s)** — default %9-11 + Compass/LANDiO presetleri; `admin/listings`'e Sat butonu. Al→Sat döngüsü.
4. **🏅 Mektup→listing loop kapatma (~4-5s)** — gönderim sonrası "Bu parseli satışa koy" → calculator. **Tek ekranda ucuz-al(mektup)→pahalı-sat(taksit) = demonun "vау" anı.**

**Yapma (demo-sonrası):** Stripe/GeekPay, Clerk buyer auth, gerçek Lob gönderimi (sandbox yeter), RealAuction US-IP.
