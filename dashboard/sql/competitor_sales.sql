-- ─────────────────────────────────────────────────────────────────────────────
-- RAKİP SATIŞ RADARI — PropStream ile DOĞRULANMIŞ rakip satışları
--
-- competitor_listings (scraper) + competitor_tracked (rakip-radar diff) "şüphe"
-- verir. Bu tablo GERÇEK deed/satış kaydını tutar: sahibi PropStream'de bir rakip
-- LLC'nin (grantor) deed/satış geçmişini export edip /admin/competitor-radar
-- ekranından CSV yükler → buraya upsert edilir.
--
-- Tamamen ADDITIVE — mevcut hiçbir tablo/kolon değişmez, scraper etkilenmez.
-- Idempotent: tekrar çalıştırmak güvenli.
--
-- Çalıştırma (dashboard/ kökünden):
--   npx prisma db execute --file sql/competitor_sales.sql --url "$DIRECT_URL"
--   (veya Supabase SQL Editor'a yapıştır → Run)
--
-- RLS: rakip_radar.sql deseniyle aynı — RLS açık, anon policy YOK → yalnızca
-- service role (dashboard'ın /api/admin/competitor-radar route'ları) okur/yazar.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.competitor_sales (
  id              uuid primary key default gen_random_uuid(),
  sale_key        text unique,          -- deterministik dedup anahtarı (rakip|apn|tarih|fiyat)
  competitor_name text,                 -- UI'da girilen rakip adı (yoksa grantor'a düşer)
  grantor_llc     text,                 -- deed'deki satıcı LLC (PropStream Grantor/Seller)
  grantee         text,                 -- alıcı (bilgi amaçlı; PropStream Grantee/Buyer)
  apn             text,
  sale_date       date,
  price           numeric,
  acres           numeric,
  county          text,
  state           text,
  deed_type       text,
  source          text not null default 'propstream',
  imported_at     timestamptz not null default now()
);

create index if not exists competitor_sales_competitor
  on public.competitor_sales (competitor_name);
create index if not exists competitor_sales_state
  on public.competitor_sales (state);
create index if not exists competitor_sales_sale_date
  on public.competitor_sales (sale_date);

-- Service-role-only (anon policy yok)
alter table if exists public.competitor_sales enable row level security;
