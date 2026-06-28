# Terralot — 5 Ajanlı Konsolide Audit (2026-06-28)

Salt-okunur audit. 5 boyut: veri/değerleme · scrub/DD · sayfa envanteri · güvenlik · al-sat döngüsü.

---

## TEK CÜMLE
**Boru tesisatı (loop, matematik, auth, sayfalar) sağlam ve demo-ready; ASIL risk veri DÜRÜSTLÜĞÜ** — uydurma değerleme ($2.999/acre sabit), API patlayınca sahte scrub verisi, ve "assessed"i "piyasa değeri" diye "Gerçek Veri" menüsünde göstermek. Ahmet gibi detaycı biri bunları yakalar.

---

## 🔴 DEMO-KILLER (Ahmet'ten önce düzelt)

### 1. $2.999/acre SABİT "retail" — 20.000+ parselde aynı
`scraper/mohave-offmarket.mjs:118,127` · `florida:57` · `colorado:49`
Her Mohave/FL/CO parselinin "retail/resale" değeri sabit $2.999×acre. Ahmet 3 satıra bakar, hepsinin acre başı değeri aynı → "bu değer nereden?" → cevap yok. **"✅ Canlı · Gerçek Veri" menüsünde** gösteriliyor.
→ **Fix:** sabiti kaldır; comp medyanı yoksa "comp yok — doğrula" göster, asla sabit.

### 2. Scrub/dd-check API patlayınca SAHTE veri uyduruyor, "Gerçek" diye sunuyor
`api/dd-check/route.ts:80-98,152-174` → koordinatı hash'leyip uyduruk "Zone AE" / "Pinewood Rd" yol / landlocked döndürüyor (`fallback:true`). Benim `api/admin/scrub` + `api/buildability` bu flag'i **kontrol etmiyor**, "Kaynak: FEMA NFHL" diye gösteriyor. Non-US IP'de FEMA zaten bloklu → dev'de tetiklenir.
→ **Fix:** dd-check fail'de null/error dönsün (uydurmasın); ya da scrub/buildability `fallback`'i "tahmini/unknown" yapsın. **Dürüst örnek zaten var:** `dd-checker` sayfası "⚠️ Tahmini veri" diyor.

### 3. "Piyasa değeri" = county assessed (yol haritası "çıpa yapma" diyor)
`cheap-land/[id]/page.tsx:44,166` · `real-deals` spread = assessed−offer
"marketValue/spread/profit" aslında vergi dairesi assessed değeri. Roadmap (`AHMET...md:76`) net: "Assessed'i çıpa yapma, 2-3 kat sapar."
→ **Fix:** etiketi "Assessed (DCAD/HCAD)" yap + ayrı comp-bazlı değer (ya da null). `real-deals.json`'ın kendi notu zaten dürüst — onu UI'a taşı.

### 4. Supabase RLS uygulanmamış → lead DB açığa çıkabilir
`lib/supabase.ts:7` + 10 admin sayfası tarayıcıdan anon key ile okuyor; `SECURITY_RLS.sql` "owner action" bekliyor.
→ **Fix:** RLS'i uygula (senin Supabase aksiyonun) + admin verisini server route üstünden çek.

---

## 🟡 DÜZELTİLMELİ (demo'yu bloklamaz)
- **Lob gerçek template** wiring (`outreach:189-190`, `mailer:133`) — mock'ta sorun yok, gerçek gönderimde bozuk mail.
- **deal-economics ROI %7.9 kullanıyor** ama listing %9.9 — başlık ROI eksik (`deal-economics.ts:72-76`).
- **offerPct clamp yok** (`outreach:149`) — [15,25]'e sınırla + ≤$10K→%15 kuralını uygula.
- **WIP sayfalar URL'den açılabilir** — menüde gizli ama `/admin/mailer` vb. gate'i geçen direkt açabilir. Server-side WIP guard ekle.
- **Yeni route'larım (all-deals, scrub) in-route requireGate eksik** — middleware koruyor ama defense-in-depth için ekle.
- **Rate limiter in-memory** (serverless'te zayıf) · **6 mutating POST'ta zod yok** · **cheap-land çarpanları tutarsız** (52-60% vs 15-20%, generator script repo'da yok).

---

## 🟢 GERÇEKTEN SAĞLAM (içini rahatlatan kısım)
- **29 admin sayfası canlı Supabase** · 0 bozuk · veri yoksa **dürüst boş ekran** (sahte sayı üretmiyor)
- **Al→sat döngüsü uçtan uca bağlı, DEMO-READY** — mektup→"satışa koy"→owner-finance listing tek ekranda
- **Owner-finance matematiği DOĞRU + unit-testli** — $30K/%10/%7.9/60ay → $546/ay (testle sabit)
- **Teklif mantığı `pricing.ts`'te ZATEN doğru** — market×%15-25, comp yoksa null döner (uydurmuyor)
- **Auth mimarisi sağlam** — middleware fail-closed, secret sızıntısı yok, service_role client'a gitmiyor, eski zillow-scraper 410'a alınmış
- **Ham parsel/sahip verisi gerçek** (HCAD, DCAD/Regrid, ArcGIS, PropStream)
- **Dürüst değerleme motoru VAR** (`lib/pricing.ts`) ama WIP'te gizli + asking comp kullanıyor (sold değil)

---

## GÜNCEL DURUM
- **Teknik/loop hazırlığı:** ~%85 (demo-ready)
- **Veri dürüstlüğü:** ~%40 (asıl açık burada — sold comp yok, $2.999 sabit, assessed=market etiketi)

**İş "özellik eklemek" değil, "sayıları dürüst yapmak."** Bu daha küçük, cerrahi bir iş.

## EN YÜKSEK ETKİLİ 4 FIX
1. $2.999 sabitini öldür → comp yoksa "doğrula" göster
2. dd-check fallback'ini dürüst yap (scrub sahte FEMA göstermesin)
3. "market value/spread" → "assessed" diye yeniden etiketle + comp-bazlı değeri `pricing.ts`'ten besle
4. RLS uygula + admin okumaları server route'a taşı

Bunlar bitince Ahmet'in "bu sayı nereden?" sorusuna her seferinde net cevabın olur.
