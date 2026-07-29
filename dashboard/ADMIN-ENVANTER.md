# Admin Envanteri — /admin altındaki her sayfa

> Tarih: 2026-07-29 · Kapsam: `src/app/admin/**/page.tsx` (63 üst-düzey sayfa + 4 alt rota + 19 whitepaper cildi)
> Amaç: "hâlâ çok karışık" şikâyetini kaynağında çözmek. **Hiçbir sayfa silinmedi.**
> Menü verisi tek yerde: [`src/app/admin/nav.ts`](src/app/admin/nav.ts)

## Nasıl okunur

| Durum | Anlamı |
|---|---|
| **CANLI** | Gerçek bir sorgudan (API / Supabase / üretilmiş JSON) besleniyor |
| **YARIM** | Bir kısmı gerçek, bir kısmı mock / donmuş snapshot / devre dışı buton |
| **ÖLÜ** | Sabit dizi, boş kaynak veya `ComingSoon` ile kilitli |

| Hedef | Anlamı |
|---|---|
| **Kalsın** | Menüde, iş akışındaki grubunda |
| **Arşiv** | Route çalışıyor ama günlük menüden çıkarıldı → `🧪 Lab` grubunda (`NEXT_PUBLIC_SHOW_WIP=1`) |
| **Yönlendirildi** | `redirect()` ile başka sayfaya taşındı; eski link/yer imi kırılmıyor |

---

## 1 · BUL — arsa bul

| Sayfa | Ne yapıyor | Veri kaynağı | Durum | Hedef |
|---|---|---|---|---|
| `harita` | **Tam ekran** vitrin haritası (müşteri/yatırımcı sunumu) | `/api/admin/offmarket-map-clusters` + `offmarket-breakdown` | CANLI | Kalsın |
| `off-market-harita` | Aynı envanter, **panel içi analitik** görünüm + istatistik şeridi | Aynı iki uç | CANLI | Kalsın ⚠️ *(bkz. Karar 1)* |
| `arsa-notlari` | A+..F not motorunun vitrini, OSM gerçek yol/elektrik/su mesafeleri | `/api/admin/arsa-notlari` | CANLI | Kalsın |
| `all-deals` | **Ana tarayıcı** — tüm kaynakların birleştiği filtreli deal listesi | `/api/admin/all-deals` → `lib/unified-deals` (5 JSON) | CANLI | Kalsın |
| `satilabilir-cekirdek` | ~20K Mohave lead'inden en iyi ~500 parsel | `/api/admin/all-deals` + istemci filtresi | CANLI | Kalsın |
| `canli-sorgu` | Bir county'yi O AN sorgula, `offmarket_leads`'e kaydet | `/api/admin/live-county` | CANLI | Kalsın |
| `saved-searches` | Filtre setini kaydet / çalıştır / yeni eşleşmeleri gör | `/api/saved-searches` (+ `/run`, `/run-all` cron) | CANLI | Kalsın |
| `ucuz-arsa` | Vergi-borçlu ucuz arsa + şeffaf puanlama rubriği | `data/cheap-land.json` (40 kayıt, TX, 2026-06-21) | YARIM (donmuş) | Kalsın |
| `ucuz-arsa/[id]` | Tek parsel değerleme paneli, güvenilirlik rozetleri | Aynı JSON, `generateStaticParams` | YARIM | Kalsın (alt rota) |
| `real-deals` | Dallas County için küratörlü 246 deal | `data/real-deals.json` | YARIM (donmuş) | Kalsın |
| `mohave` | Mohave (AZ) off-market envanteri + skor | `data/mohave-offmarket.json` | CANLI (snapshot) | Kalsın |
| `luna` | Luna (NM) envanteri — skor/değerleme henüz yok | `data/import-propstream-nm-luna.json` | CANLI (snapshot) | Kalsın ⚠️ *(bkz. Karar 4)* |
| `off-market` | Access-code'lu off-market deal tablosu | `lib/data.offMarketProperties` = **`[]`** | **ÖLÜ** | **Yönlendirildi → `/admin/arsa-notlari`** |

> `off-market` neden yönlendirildi: kaynak dizi bilerek boş, tüm butonlar `onClick`'siz,
> `avgDiscount` 0/0 → `NaN%` basıyordu, adı `off-market-leads` / `off-market-harita` ile karışıyordu.
> Kaybolan çalışan işlev yok. Ekranın kodu duruyor: `admin/off-market/_arsiv-ekran.tsx`.

## 2 · DEĞERLENDİR — eleme & underwrite

| Sayfa | Ne yapıyor | Veri kaynağı | Durum | Hedef |
|---|---|---|---|---|
| `alinabilir-harita` | Comp'lu, spread ≥ $1.500 parseller — **projedeki tek 3D arazi görünümü** | `/api/admin/all-deals?map=1&onlyComp=1` | CANLI | Kalsın |
| `deal-map` | Vergi-borçlu + **yaklaşan ihale tarihleri** + megaproje katalizörleri | `tax_delinquent_properties` + `upcoming-sales` + `growth-catalysts` | CANLI | Kalsın |
| `deal-screener` | County fırsat skoru (0-100) + buy-box AL/BEKLE/GEÇ | `county-demographics`, `hot-counties`, `growth-catalysts`, `market-rates` | CANLI | Kalsın |
| `acquisitions` | Satın alma konsolu: grade, DD, aşama, direct-mail CSV | 8 uç + `tax_delinquent_properties` | CANLI | Kalsın |
| `underwrite` | Tek parsel açıklanabilir karar + finansman senaryoları | `POST /api/underwrite` | CANLI | Kalsın |
| `buildability` | Eğim/su/taşkın/yol; lead'siz manuel giriş modu | `POST /api/buildability` → `dd-check` | CANLI | Kalsın |
| `arbitrage` | İçsel değer ile min-bid farkı | `/api/arbitrage` | CANLI | Kalsın |
| `apn-dogrula` | Bizim kayıt **vs** resmî county kaydı + TRS modu + paket-tapu | `/api/admin/apn-dogrula` + Mohave ArcGIS | CANLI | Kalsın |
| `apn-sorgula` | Ham ArcGIS alan tablosu + APN varyant denemesi | Mohave ArcGIS (tarayıcıdan) | CANLI | Arşiv ⚠️ *(bkz. Karar 2)* |
| `cerberus` | Analiz motoru kokpiti + toplu analiz tetikleyici | `/api/admin/cerberus/intel`, `/analyze` | CANLI | Kalsın |
| `cerberus/[key]` | Tek parsel "neden bu karar" | `/api/admin/cerberus/lead` | CANLI | Kalsın (alt rota) |
| `cerberus/[key]/report` | Aynı analizin yazdırılabilir tear-sheet'i | Aynı uç | CANLI | Kalsın (alt rota) |
| `parcels` | Regrid parsel arama + poligon haritası | `/api/regrid` | YARIM (token yoksa mock) | Arşiv |
| `flip-sim` | Flip ekonomisi, IRR, aylık takvim | İstemci `lib/flip-calc` | YARIM (yeniden satış = alış × 3.5) | Arşiv |

## 3 · SAHİBE ULAŞ — lead & outreach

| Sayfa | Ne yapıyor | Veri kaynağı | Durum | Hedef |
|---|---|---|---|---|
| `off-market-leads` | Motive sahipler + ham kayıt/DD tablosu (`?tab=dd`) | `tax_delinquent_properties` + `/api/dd-check` | CANLI | Kalsın |
| `arama` | Sıcak arama kokpiti: kuyruk, saat dilimi, DNC, geri arama | `/api/admin/call-center` | CANLI | Kalsın |
| `outreach` | Tek lead'e Lob mektubu + 3 dokunuşlu kadans | `/api/outreach`, `/api/admin/outreach-tick` | CANLI (koşullu) | Kalsın |
| `mohave/kampanya` | Segment → dedupe → Lob-ready CSV / toplu gönderim | `/api/admin/mohave-campaign` | CANLI | Kalsın |
| `anlasma-hatti` | İlgileniyor → Teklif → Pazarlık → Sözleşme → Tapu | `/api/admin/pipeline` | CANLI | Kalsın |
| `contacts` | Wholesaler/scout/realtor/yatırımcı ağı | `/api/admin/contacts` | YARIM (activity mock) | Kalsın |
| `tax-leads` | — | — | ÖLÜ (shim) | **Yönlendirildi → `off-market-leads?tab=dd`** *(2026-07-13'te yapılmış)* |
| `mailer` | Kampanya panosu + tek kişilik hızlı gönderim | İstatistikler `lib/mailer-data` **sabit**; gönderim `/api/lob` gerçek | YARIM | Arşiv |

## 4 · SAT — ilan & tahsilat

| Sayfa | Ne yapıyor | Veri kaynağı | Durum | Hedef |
|---|---|---|---|---|
| `ilan-ureteci` | Parsel seç → ilan metni üret → `/p` sayfasına yayınla | `lib/unified-deals` + `buildBuyerListing` | CANLI | Kalsın |
| `satis-sayfalari` | Yayındaki `/p` linkleri, kaynak filtresi, toplu kopyalama | Aynı kaynak | CANLI | Kalsın ⚠️ *(bkz. Karar 3)* |
| `talepler` | `/p` formundan düşen alıcı talepleri | `/api/admin/parcel-inquiries` | CANLI (tablo yoksa geçici bellek) | Kalsın |
| `owner-finance` | Taksitli satış ilanları + vade preset'leri + kredi ön-elemesi | `/api/owner-finance` | CANLI (kredi stub) | Kalsın |
| `payments` | Ödeme kayıtları ve durumları | `/api/admin/payments` → `Payment` | CANLI | Kalsın |
| `parcel-sunum` | Alıcıya gönderilen tek-parsel baskı sayfası (taksit planı + uydu) | `/api/admin/all-deals?id=` | CANLI | Kalsın (menüde değil; `talepler` ve haritalardan linkli) |
| `leads` | Site iletişim formu lead'leri (İngilizce) | `/api/admin/inquiries` → `Inquiry` | CANLI | Arşiv ⚠️ *(bkz. Karar 5)* |
| `listings` | Property CRUD listesi | `/api/admin/property` | YARIM (düzenle devre dışı) | Arşiv |
| `analytics` | Property kâr/ROI + vade simülasyonu | `/api/admin/property?view=analytics` | CANLI (tablo doluysa) | Arşiv |
| `financing` | Sözleşme/gecikme takibi | `ComingSoon` ile kilitli | **ÖLÜ** | Arşiv |
| `referrals` | Referans partner + komisyon | `ComingSoon` ile kilitli, sabit dizi | **ÖLÜ** | Arşiv |

## 5 · PAZAR & RAKİP

| Sayfa | Ne yapıyor | Veri kaynağı | Durum | Hedef |
|---|---|---|---|---|
| `istihbarat` | GERÇEK tapu satışları + county değerlemesi + rakip profilleri | `/api/admin/istihbarat` | CANLI | Kalsın |
| `market` | County/eyalet kokpiti + county A vs B karşılaştırma | `/api/admin/market` | CANLI | Kalsın |
| `rakip-radar` | **ANA RAKİP EKRANI** — ilan yaşam döngüsü, fiyat geçmişi, satış doğrulama | `/api/admin/rakip-radar` (+`/refresh`,`/verify`,`/override`) | CANLI (en derin) | Kalsın |
| `rakip-defteri` | Kim neyi kaça aldı/sattı — parsel parsel tapu defteri | `data/rakip-defteri.json` | CANLI (snapshot) | Kalsın |
| `lookalike` | Kazanan county'ye demografik benzeyenler | `/api/lookalike` | CANLI | Kalsın |
| `path-of-growth` | 12-18 ayda ısınacak county'ler (momentum) | `/api/path-of-growth` | CANLI | Kalsın |
| `competitor-radar` | Rakip manzarası + satış sinyali + **PropStream deed CSV import** | `/api/admin/competitor-radar` (+`/import-sales`) | CANLI (sığ) | Arşiv ⚠️ *(bkz. Karar 6)* |
| `rakip-istihbarat` | Kaybolan ilan = muhtemel satış + sıcak bölge skoru | `/api/admin/rakip-istihbarat` | CANLI | Arşiv (yerini `istihbarat` aldı) |
| `pazar-ortusme` | "Rakip satıyor + bizim envanterimiz var" kanıtlı pazar | `/api/admin/market-overlap` | CANLI | Arşiv (yerini `istihbarat` aldı) |
| `competitor-analysis` | Rakip taksit planı vs bizim maliyet — arbitraj hesabı | `/api/competitor-listings`, `/api/market-rates` | CANLI | Arşiv (menüde hiç yoktu) |
| `market-listings` | Zillow kazımasından piyasa ilanları | `tax_delinquent_properties` `source LIKE 'ZILLOW%'` | CANLI (eski veri) | Arşiv |

## 6 · TAKİP & SİSTEM

| Sayfa | Ne yapıyor | Veri kaynağı | Durum | Hedef |
|---|---|---|---|---|
| `portfoy` | Sourced deal, potansiyel spread, grade dağılımı | `/api/admin/all-deals` + `portfolio-summary` | CANLI | Kalsın |
| `yontem` | Neye göre alıyoruz — eleme hunisi + **dürüstlük frenleri** | `/api/admin/istihbarat` | YARIM (metin sabit, sayılar canlı) | Kalsın |
| `eyalet-kapsami` | Nerede varız/yokuz — county başına gerçek ölçüm | `/api/admin/eyalet-kapsami` (`scripts/kapsam-olc.mjs`) | CANLI | Kalsın |
| `data-coverage` | Mailable %, absentee %, skip-trace %, hitlist kapsamı | Doğrudan Supabase (anon client) | CANLI ⚠️ **RLS riski** | Kalsın |
| `markets` | Pazar olgunluk kayıt defteri (izleme→araştırma→pilot→aktif) | `lib/market-registry-data` (3 JSON) | YARIM (status elle) | Kalsın |
| `scraper` | Bot filosu durumu + yaklaşan icra satışları takvimi | `/api/scraper-fleet`, `upcoming-sales?view=calendar` | CANLI | Kalsın |
| `sunum` | Mohave operasyonunun 3 ekranlık canlı-veri demosu | `data/mohave-offmarket.json` + skor motoru | CANLI | Kalsın |
| `sistem` | İş modeli anlatısı + 3 canlı sayaç | `/api/admin/all-deals?pageSize=1` | YARIM | Arşiv ⚠️ *(bkz. Karar 7)* |
| `deals` | **Yatırımcı** ilişkileri CRM'i (arsa değil!) | `/api/admin/deals` → `Deal` | CANLI | Arşiv (ayrı iş) |
| `presentation` | 6 slaytlık yatırımcı sunumu | **Tamamen sabit**, 803 satır, hiç fetch yok | ÖLÜ (statik içerik) | Arşiv |
| `presentation/whitepaper` + `vol0..vol17` | 18 ciltlik whitepaper | Tamamen sabit JSX | ÖLÜ (statik içerik) | Arşiv |

---

## Sahibin karar vermesi gereken şüpheli birleştirmeler

Bunların **hiçbiri yapılmadı** — çünkü her birinde diğer sayfada olmayan çalışan bir özellik var.
Karar verilirse taşınması gereken şeyi de yazdım.

**Karar 1 — `harita` + `off-market-harita`**
Aynı API, aynı veri. Fark: `harita` tam ekran vitrin (sidebar'ı kapatır), `off-market-harita` panel içinde analitik.
*Birleştirilirse taşınacak:* çoklu eyalet seçimi ve "haritada çizilen nokta sayısı" (`onMeta`) → `harita`'ya.
*Öneri:* `harita`'ya "panel görünümü" anahtarı ekleyip tek sayfaya indirmek.

**Karar 2 — `apn-sorgula` → `apn-dogrula`**
`apn-dogrula` aynı ArcGIS sorgusunu yapıyor **ve** üstüne kendi kaydımızla karşılaştırıyor.
*Birleştirilirse taşınacak:* ham ArcGIS alan tablosu (tüm `outFields`) + APN varyant denemesi (`apnCandidates`).
Şimdilik `apn-sorgula` arşive alındı, route çalışıyor.

**Karar 3 — `satis-sayfalari` + `ilan-ureteci`**
Aynı `getDeals()` + `toBuyerParcel` kaynağı, neredeyse birebir aynı tablo. Fark sadece aksiyon sütunu.
*Birleştirilirse:* tek sayfa + iki sekme ("İlan üret" / "Yayındaki linkler"); `CopyAllButton`, kaynak çipleri ve "fiyatsızları göster" korunmalı.

**Karar 4 — `mohave` + `luna`**
Aynı sayfa şablonu, farklı county. `luna`'da skor/kampanya yok.
*Birleştirilirse:* tek parametrik "Bölge Envanteri" sayfası (`?bolge=mohave|luna`).

**Karar 5 — `leads` + `talepler`**
İkisi de "form lead'i" ama **farklı tablolar** (`Inquiry` vs `parcel_inquiries`).
*Birleştirilirse:* tek "Alıcı Talepleri" sayfası, iki kaynağı da okuyup satırda kaynağını göstermeli.
Şimdilik canlı+Türkçe olan `talepler` menüde, `leads` arşivde.

**Karar 6 — `competitor-radar` → `rakip-radar`**
`competitor-radar`'ın kendi kod yorumu `rakip-radar`'ı "derin versiyon" diye işaret ediyor.
*Birleştirilirse taşınacak:* **PropStream deed CSV içe aktarma kutusu** (`ImportBox`, `/api/admin/competitor-radar/import-sales`) — doğrulanmış gerçek satış girişinin tek yolu, kaybolmamalı.

**Karar 7 — `sistem` + `yontem`**
İkisi de "nasıl çalışıyoruz" anlatısı; `sistem`'in H1'i literal olarak "Sistem & Yöntem".
*Birleştirilirse taşınacak:* `sistem`'deki `byStateDetail` eyalet tablosu (ppa, comps, absentee %) — `yontem`'de yok.

---

## Birleştirmeyle ilgisiz, ama bulundu

1. **`data-coverage` RLS riski** — tek sayfa ki doğrudan tarayıcıdan `@/lib/supabase` (anon client) ile
   `offmarket_leads` / `tax_delinquent_properties` okuyor. `/api/competitor-listings/route.ts` yorumu tam
   bu desenin RLS altında sessizce 0 satır döndürdüğünü ve bu yüzden API'ye taşındığını anlatıyor.
   → Sayfanın gerçekten veri gösterdiği doğrulanmalı; göstermiyorsa admin-gated bir API'ye taşınmalı.

2. **Native `<select>` 13 sayfada duruyor** (proje kuralı: yasak, `@/components/Dropdown` kullanılmalı):
   `acquisitions` (3), `all-deals` (2), `analytics` (2), `mohave/kampanya` (2), `rakip-defteri` (2),
   `competitor-radar` (2), `arbitrage`, `canli-sorgu`*, `leads`, `mailer`, `market`, `owner-finance`, `payments`.
   (*`canli-sorgu` kodunda kuralın kendisi yazılı ve orada kural uygulanmış.)
   Bu toparlamada dokunulmadı — ayrı bir iş.

3. **Whitepaper numaralandırması kaymış** — `presentation/whitepaper` indeksindeki etiketler
   klasör adlarıyla uyuşmuyor ("Cilt 10" → `vol11-trustees`).

4. **`saved-searches` yorum/UI çelişkisi** — dosya başı "Email/cron delivery is a STUB (TODO)" diyor,
   sayfa metni cron'un `vercel.json`'da aktif olduğunu söylüyor. Doğrulanmalı.

5. **`ucuz-arsa/[id]` `generateStaticParams`'a bağlı** — JSON'daki 40 id için statik üretiliyor.
   Veri Supabase'e taşınırsa bu rota kırılır.

---

## Değişen dosyalar (2026-07-29)

| Dosya | Ne oldu |
|---|---|
| `src/app/admin/nav.ts` | **YENİ** — menünün tek kaynağı, iş akışına göre 6 grup + Lab |
| `src/app/admin/sidebar.tsx` | **YENİ** — arama kutulu, gruplu, daraltılabilir kenar menüsü |
| `src/app/admin/layout.tsx` | Menü tanımı çıkarıldı, sadece şablon kaldı |
| `src/app/admin/page.tsx` | "Komuta Merkezi" → **"Bugün"** başlangıç ekranı (6 gerçek sayaç) |
| `src/app/admin/off-market/page.tsx` | `redirect()` → `/admin/arsa-notlari` |
| `src/app/admin/off-market/_arsiv-ekran.tsx` | **YENİ** — eski ekranın kodu (derlemeye girmez) |
