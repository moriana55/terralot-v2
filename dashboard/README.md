# TerraLot — Dashboard (Cerberus Engine)

ABD'de değerinin altındaki boş arazileri (county tax-deed açık artırması, off-market, sahipten) bulup
owner-finance (taksitli) modelle satmaya yönelik arazi al-sat operasyon paneli. Bu klasör müşteriye
(Ahmet) gösterilen admin dashboard'udur; arazi keşfi, değerleme ve lead üretimini tek boru hattında
birleştirir.

## Stack
- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4**
- **Prisma 7** + PostgreSQL (Neon / Supabase)
- **Clerk** (auth) + basit admin-password fallback
- **Regrid** API (parsel / değerleme verisi)
- **Leaflet / react-leaflet** (harita)
- Hosting: **Vercel**

> Not: Bu Next.js sürümü senin bildiğin Next.js değil. Kod yazmadan önce
> `node_modules/next/dist/docs/` altındaki ilgili kılavuzu oku (bkz. `AGENTS.md`).

## Çalışan Modüller (Canlı · Gerçek Veri)
- **Ucuz Boş Arsa** — taranan vacant + tax-delinquent parseller
- **Tax Leads** — county tax-deed / "Lands Available" listeleri
- **Off-Market Leads** — sahipten / off-market fırsatlar
- **Real Deals (Gerçek Dealler)** — skorlanmış gerçek anlaşmalar
- **Mohave Off-Market** — bölgeye özel off-market liste
- **Deal Map** — parsellerin harita görünümü
- **Cerberus Botları** — scraper / veri toplama motoru
- **Piyasa İlanları** — market listing verisi
- **Rakip Radar** (`/admin/rakip-radar`) — rakip ilan yaşam döngüsü (snapshot + diff), satış şüphesi & doğrulama (bkz. aşağıdaki bölüm)

Geliştirme aşamasındaki modüller (Acquisitions, Owner Outreach, AI Underwriting, Owner-Finance
pazaryeri, Payments, Financials vb.) ve "Yakında / kilitli" modüller varsayılan olarak müşteri
görünümünde **gizlidir** (bkz. `NEXT_PUBLIC_SHOW_WIP`).

## Çalıştırma
```bash
npm install
npm run dev      # http://localhost:3002
npm run build    # prod build
npm run start    # prod sunucu
npm run lint
npm run test
```

## Ortam Değişkenleri (env)
`.env` / `.env.local` içinde tanımlanır (repoya commit edilmez):

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Postgres bağlantı (Prisma, pooled) |
| `DIRECT_URL` | Postgres direkt bağlantı (Prisma migrate) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role anahtar (server-only) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk giriş yolu |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk kayıt yolu |
| `REGRID_API_TOKEN` | Regrid parsel/değerleme API token |
| `ADMIN_PASSWORD` | Basit admin giriş şifresi |
| `SESSION_SECRET` | Oturum imzalama secret |
| `NEXT_PUBLIC_SHOW_WIP` | Bkz. aşağı |

### `NEXT_PUBLIC_SHOW_WIP`
Admin menüsündeki "🚧 Geliştiriliyor" ve "🔒 Yakında" gruplarının görünürlüğünü kontrol eder.
Bu gruplar henüz mock/gerçek-olmayan veri içerdiğinden müşteri görünümünde gizlenir.

- Set değil (veya `"1"` değil) → **müşteri/prod görünümü**: sadece "Canlı · Gerçek Veri" görünür.
- `NEXT_PUBLIC_SHOW_WIP=1` → **geliştirici görünümü**: tüm gruplar görünür.

Kalıcı silme değil; geliştirici flag'i set ederek her şeye erişebilir.

## Rakip Radar (snapshot + diff + satış doğrulama)

İki soruya veriyle cevap verir: **rakipler gerçekten satıyor mu** (sadece listeleme değil) ve
**geçmiş satış performansları ne** (satış süresi/DOM, $/acre, indirim davranışı).

- Kaynak: `competitor_listings` (Supabase; `../scraper/competitor-scraper.js` doldurur — Discount Lots, Rina Land, Landio).
- Tablolar: `competitor_snapshots` / `competitor_tracked` / `competitor_events` — DDL: `sql/rakip_radar.sql`
  (RLS açık, anon policy yok → service-role-only). Kurulum: `psql "$DIRECT_URL" -f sql/rakip_radar.sql`
  (⚠️ `.env.local`'daki `DIRECT_URL`/`DATABASE_URL` hâlâ `aws-0-eu-central-1` pooler'ına işaret ediyor ve o tenant artık yok —
  çalışan host `aws-1-eu-central-1.pooler.supabase.com`. Tablolar 2026-07-03'te bu hostla kuruldu; Prisma kullanılacaksa env düzeltilmeli).
- Motor: `src/lib/rakip-radar.ts` (saf, birim testli) — diff olayları `NEW / PRICE_CHANGED / STATUS_CHANGED / DISAPPEARED / REAPPEARED`.
- Kaybolan ilan → **"satış şüphesi"** → Regrid malik kontrolü (`/api/admin/rakip-radar/verify`, gerçek APN gerekir) veya
  Mohave Recorder (`https://eaglerss.mohave.gov/web/` — grantor'a rakip adı yazılır; URL parametresi taşımaz) +
  AZ **Affidavit of Value** araması (gerçek satış fiyatı) ile doğrulanır. Manuel "Satıldı onayla (fiyat)" / "Çekildi" butonları var.

### Günlük çalıştırma (cron)
Sıra önemli: önce scraper kaynak tabloyu tazeler, sonra diff koşusu snapshot alır.
```bash
cd terralot-v2/scraper && node competitor-scraper.js          # 1) kaynak tazele (Puppeteer)
cd ../dashboard && node --env-file=.env.local scripts/rakip-radar-refresh.mjs   # 2) snapshot + diff
```
crontab örneği (her gün 09:00):
```
0 9 * * * cd $HOME/Desktop/Aktif\ Projeler/terralot-v2/scraper && /usr/local/bin/node competitor-scraper.js && cd ../dashboard && /usr/local/bin/node --env-file=.env.local scripts/rakip-radar-refresh.mjs >> /tmp/rakip-radar.log 2>&1
```
> ⚠️ launchd notu: scraper'ın eski launchd job'ı (`com.terralot.sourcing.plist`) 16 Haziran'dan beri ölü —
> proje Desktop'ta olduğu için TCC izni düşmüş olabilir. Yeni bir job kurarsan `launchctl print` ile
> gerçekten koştuğunu doğrula; scraper koşmadan alınan snapshot "değişiklik yok" üretir (yanlış DISAPPEARED üretmez,
> çünkü kaynak tablo upsert'tir ve eski kayıtlar yerinde kalır — ama fiyat/kaybolma sinyali de gelmez).

UI notu: Ekran ilk 279 ilanla tohumlandı (2026-07-03). Tarih **birikiyor** — ilk gerçek diff bir sonraki
snapshot'ta görünür; "çürüyen vs satılan" histogramı DOM ≥ 60 gün ve doğrulanmış satış biriktikçe dolar.

## İlgili Dokümanlar
- `../AHMET-ARSA-YOL-HARITASI.md` — operasyonel saha kılavuzu + rakip analizi
- `../TERRALOT-ROADMAP.md` — iş & teknik yol haritası
- `AGENTS.md` / `CLAUDE.md` — geliştirme notları
