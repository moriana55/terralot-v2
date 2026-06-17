-- Supabase SQL Editor'da çalıştır (Dashboard → SQL Editor → New query → yapıştır → Run)
create table if not exists competitor_listings (
  id uuid primary key default gen_random_uuid(),
  competitor text not null,
  title text,
  state text,
  county text,
  acres numeric,
  price numeric,
  down_payment numeric,
  monthly_payment numeric,
  term_months integer,
  doc_fee numeric,
  apn text,
  notes text,
  our_source_cost numeric,
  raw_url text,
  scraped_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_competitor_listings_competitor on competitor_listings (competitor);
create index if not exists idx_competitor_listings_state on competitor_listings (state);

-- Scraper upsert'ünün (onConflict: competitor,raw_url) çalışması için:
create unique index if not exists uniq_competitor_url
  on competitor_listings (competitor, raw_url) where raw_url is not null;
