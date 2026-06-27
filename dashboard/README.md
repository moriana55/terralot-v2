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

## İlgili Dokümanlar
- `../AHMET-ARSA-YOL-HARITASI.md` — operasyonel saha kılavuzu + rakip analizi
- `../TERRALOT-ROADMAP.md` — iş & teknik yol haritası
- `AGENTS.md` / `CLAUDE.md` — geliştirme notları
