-- ─────────────────────────────────────────────────────────────────────────────
-- RAKİP RADAR — ilan yaşam döngüsü (snapshot + diff) tabloları
--
-- competitor_listings (scraper'ın upsert ettiği "şu an ne görüyoruz" tablosu)
-- tek başına tarih tutmaz. Bu üç tablo tarih ekler:
--   • competitor_snapshots : her refresh koşusunda görülen ilanların ham kaydı
--   • competitor_tracked   : ilan başına yaşam döngüsü durumu (DOM, fiyat
--                            geçmişi, kayboldu/satış şüphesi/doğrulanmış satış)
--   • competitor_events    : diff olayları (NEW / PRICE_CHANGED / DISAPPEARED …)
--
-- Çalıştırma:  npx prisma db execute --file sql/rakip_radar.sql --url "$DIRECT_URL"
-- RLS: SECURITY_RLS.sql deseniyle aynı — RLS açık, anon policy YOK → sadece
-- service role okur/yazar. Dashboard bu tablolara /api/admin/rakip-radar/*
-- (gate'li, service role) üzerinden erişir.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.competitor_snapshots (
  id          uuid primary key default gen_random_uuid(),
  run_at      timestamptz not null,
  listing_key text not null,
  competitor  text,
  title       text,
  apn         text,
  url         text,
  price       numeric,
  acres       numeric,
  state       text,
  county      text,
  status      text,
  seen_at     timestamptz not null default now()
);
create index if not exists competitor_snapshots_key_run
  on public.competitor_snapshots (listing_key, run_at);
create index if not exists competitor_snapshots_run
  on public.competitor_snapshots (run_at);

create table if not exists public.competitor_tracked (
  listing_key    text primary key,
  competitor     text,
  title          text,
  apn            text,
  url            text,
  state          text,
  county         text,
  acres          numeric,
  first_seen     timestamptz not null,
  last_seen      timestamptz not null,
  initial_price  numeric,
  current_price  numeric,
  price_history  jsonb not null default '[]'::jsonb, -- [{at, price}]
  price_cuts     int not null default 0,
  status         text not null default 'ACTIVE',
  -- ACTIVE | PENDING | SUSPECTED_SOLD | SOLD_VERIFIED | WITHDRAWN
  disappeared_at timestamptz,
  dom_days       int,           -- kaybolma anındaki pazar günü sayısı
  sold_price     numeric,       -- manuel onayda girilen satış fiyatı
  verification   jsonb,         -- {method, owner, ownerChanged, checkedAt, note}
  updated_at     timestamptz not null default now()
);
create index if not exists competitor_tracked_status
  on public.competitor_tracked (status);
create index if not exists competitor_tracked_competitor
  on public.competitor_tracked (competitor);

create table if not exists public.competitor_events (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  listing_key text not null,
  type        text not null, -- NEW | PRICE_CHANGED | STATUS_CHANGED | DISAPPEARED | REAPPEARED
  old_value   jsonb,
  new_value   jsonb,
  delta       numeric
);
create index if not exists competitor_events_key_at
  on public.competitor_events (listing_key, at);
create index if not exists competitor_events_at
  on public.competitor_events (at);

-- Service-role-only (anon policy yok)
alter table if exists public.competitor_snapshots enable row level security;
alter table if exists public.competitor_tracked   enable row level security;
alter table if exists public.competitor_events    enable row level security;
