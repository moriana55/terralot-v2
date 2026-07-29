-- parcel_inquiries — SİTENİN TEK TALEP HUNİSİ.
-- Buraya yazan formlar: /p/[id] alıcı sayfası, ana sayfa bülten kaydı,
-- /landforever ilan e-postaları, ilan detay "Inquire" modalı, rezervasyon
-- modalı ve eski /api/inquiries ucu. Eski `Inquiry` tablosundaki satırlar
-- scripts/inquiry-tasi.mjs ile buraya kopyalanır (source='eski-inquiry').
--
-- OWNER ACTION: Supabase SQL Editor'a yapıştır + Run (idempotent; tekrar
-- çalıştırmak güvenli) ya da `node scripts/sql-calistir.mjs sql/parcel_inquiries.sql`.
-- Tablo yokken de form patlamaz (route bellek-içi fallback'e düşer + sayfa
-- WhatsApp/e-posta butonlarını öne çıkarır) ama kayıtlar KALICI olmaz.

create table if not exists public.parcel_inquiries (
  id           uuid primary key default gen_random_uuid(),
  parcel_id    text not null,          -- UnifiedDeal.id (örn. "mohave-123-45-678")
  parcel_title text,                   -- "5.21 Acres in Mohave County, AZ" (snapshot)
  name         text not null,
  email        text not null,
  phone        text,
  message      text,
  status       text not null default 'NEW',  -- NEW / CONTACTED / QUALIFIED / CLOSED
  created_at   timestamptz not null default now()
);

-- ── Huni birleştirme genişletmeleri (idempotent) ────────────────────────────
-- 1) email NOT NULL kalkıyor: telefonla gelen lead insert'te patlıyor ve
--    sessizce kayboluyordu. Artık e-posta VEYA telefon yeterli.
alter table public.parcel_inquiries alter column email drop not null;

-- 2) updated_at — durum değişikliği ne zaman oldu?
alter table public.parcel_inquiries add column if not exists updated_at timestamptz default now();

-- 3) source — lead hangi formdan geldi?
--    p-sayfasi | ilan-detay | rezervasyon | ana-sayfa-bulten | landforever | eski-inquiry
alter table public.parcel_inquiries add column if not exists source text;

-- 4) legacy_id — eski Inquiry tablosunun cuid'i (taşımada tekrar önler).
alter table public.parcel_inquiries add column if not exists legacy_id text;

create index if not exists parcel_inquiries_created_idx
  on public.parcel_inquiries (created_at desc);
create index if not exists parcel_inquiries_parcel_idx
  on public.parcel_inquiries (parcel_id);
create index if not exists parcel_inquiries_source_idx
  on public.parcel_inquiries (source);
-- Taşıma betiği aynı legacy_id'yi iki kez yazamasın.
create unique index if not exists parcel_inquiries_legacy_uidx
  on public.parcel_inquiries (legacy_id) where legacy_id is not null;

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
