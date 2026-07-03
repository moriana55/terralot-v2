-- parcel_inquiries — /p/[id] herkese-açık alıcı sayfasından gelen talepler.
-- OWNER ACTION: Supabase SQL Editor'a yapıştır + Run (idempotent; tekrar
-- çalıştırmak güvenli). Tablo yokken de form patlamaz (route bellek-içi
-- fallback'e düşer + sayfa WhatsApp/e-posta butonlarını öne çıkarır) ama
-- kayıtlar KALICI olmaz; kalıcı lead için bunu çalıştır.

create table if not exists public.parcel_inquiries (
  id           uuid primary key default gen_random_uuid(),
  parcel_id    text not null,          -- UnifiedDeal.id (örn. "mohave-123-45-678")
  parcel_title text,                   -- "5.21 Acres in Mohave County, AZ" (snapshot)
  name         text not null,
  email        text not null,
  phone        text,
  message      text,
  status       text not null default 'NEW',  -- NEW / CONTACTED / CLOSED
  created_at   timestamptz not null default now()
);

create index if not exists parcel_inquiries_created_idx
  on public.parcel_inquiries (created_at desc);
create index if not exists parcel_inquiries_parcel_idx
  on public.parcel_inquiries (parcel_id);

-- RLS: anon → SADECE INSERT (lead bırakabilir, asla okuyamaz/güncelleyemez).
-- Okuma yalnız service_role (RLS'i baypas eder) — admin route'u onunla okur.
-- Böylece browser'a giden anon key ile başka alıcıların PII'ı çekilemez.
alter table public.parcel_inquiries enable row level security;

drop policy if exists "parcel_inquiries_anon_insert" on public.parcel_inquiries;
create policy "parcel_inquiries_anon_insert"
  on public.parcel_inquiries for insert
  to anon
  with check (true);

-- (SELECT/UPDATE/DELETE politikası YOK → anon hiçbir satır okuyamaz/değiştiremez.
--  service_role RLS'i baypas eder; ek politika gerekmez.)
