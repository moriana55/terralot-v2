-- OFF-MARKET LEAD'LERİ — kalıcı tablo (Mohave + diğer eyaletler).
-- Supabase SQL Editor'a yapıştır + Run. Sonra: node scraper/load-offmarket-db.mjs (REST ile 20K basar).
create table if not exists public.offmarket_leads (
  lead_id text primary key,
  state text, county text, region text,
  apn text, owner text,
  mailing_address text, mailing_city text, mailing_state text, mailing_zip text,
  situs text, use text,
  acres numeric, land_value numeric,
  est_offer numeric, est_retail numeric, est_margin numeric,
  absentee boolean, lat numeric, lng numeric,
  source text, updated_at timestamptz default now()
);
create index if not exists offmarket_leads_state_idx  on public.offmarket_leads(mailing_state);
create index if not exists offmarket_leads_region_idx on public.offmarket_leads(region);

-- Okuma herkese açık (vitrin), yazma yalnız service_role (loader).
alter table public.offmarket_leads enable row level security;
drop policy if exists offmarket_leads_read on public.offmarket_leads;
create policy offmarket_leads_read on public.offmarket_leads for select using (true);
