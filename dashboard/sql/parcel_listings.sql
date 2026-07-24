-- parcel_listings — "İlan Üreteci" akışında admin'in düzenleyip yayınladığı
-- ilan metninin kalıcı override deposu. /p/[id] varsa bunu, yoksa composer'ın
-- otomatik ürettiği metni gösterir.
-- Supabase SQL Editor'a yapıştır + Run. (Tablo olmadan da akış patlamaz —
-- publish "persisted:false" döner, /p otomatik üretilen metni gösterir.)

create table if not exists public.parcel_listings (
  parcel_ref  text primary key,
  title       text not null,
  description text not null,
  bullets     jsonb default '[]'::jsonb,
  status      text default 'published',
  updated_at  timestamptz default now()
);

create index if not exists parcel_listings_status_idx
  on public.parcel_listings (status, updated_at desc);

-- RLS: yazma yalnız service_role (route supabaseAdmin ile yazar); okuma herkese
-- açık (/p public sayfası service-role ile okur ama public read de zarar vermez).
alter table public.parcel_listings enable row level security;

drop policy if exists "parcel_listings_public_read" on public.parcel_listings;
create policy "parcel_listings_public_read"
  on public.parcel_listings for select
  using (true);

-- service_role RLS'i baypas eder; ek yazma politikasına gerek yok.
