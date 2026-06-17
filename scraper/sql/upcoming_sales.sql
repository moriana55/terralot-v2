-- Supabase SQL Editor'da çalıştır
create table if not exists upcoming_sales (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'GOVEASE',
  county text,
  state text,
  registration_date date,
  sale_date date,
  sale_type text,
  parcel_list_url text,
  address text,
  lat numeric,
  lng numeric,
  scraped_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_upcoming_sales_date on upcoming_sales (sale_date);
create index if not exists idx_upcoming_sales_state on upcoming_sales (state);
