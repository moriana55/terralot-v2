-- owner_finance_listings — "Owner-Finance ile Sat" akışının kalıcı tablosu.
-- Supabase SQL Editor'a yapıştır + Run. (Route fallback'i sayesinde tablo olmadan da
-- demo patlamaz ama kayıt KALICI olmaz; kalıcı ilan için bunu çalıştır.)

create table if not exists public.owner_finance_listings (
  id              uuid primary key default gen_random_uuid(),
  parcel_ref      text,
  title           text,
  state           text,
  county          text,
  acres           numeric,
  price           numeric not null,
  down_payment    numeric,
  down_pct        numeric,
  apr             numeric,
  term_months     integer,
  monthly_payment numeric,
  status          text default 'draft',
  description     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists owner_finance_listings_status_idx
  on public.owner_finance_listings (status, updated_at desc);

-- RLS: yazma yalnız service_role (route supabaseAdmin ile yazar); okuma herkese açık (vitrin).
alter table public.owner_finance_listings enable row level security;

drop policy if exists "owner_finance_public_read" on public.owner_finance_listings;
create policy "owner_finance_public_read"
  on public.owner_finance_listings for select
  using (true);

-- service_role RLS'i baypas eder; ek yazma politikasına gerek yok.
