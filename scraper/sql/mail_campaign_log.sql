-- MEKTUP KAMPANYA LOG'U — tekrar-mektup koruması + gönderim kaydı.
-- Supabase SQL Editor'a yapıştır + Run. Dashboard /admin/mohave/kampanya
-- "Kampanyayı Başlat" akışı buraya yazar; "daha önce mektup atılanları hariç
-- tut" toggle'ı owner_key üzerinden buradan okur (tablo yoksa graceful atlar).
create table if not exists public.mail_campaign_log (
  id bigint generated always as identity primary key,
  campaign text not null,                    -- kampanya adı (örn. "absentee-1-5ac-2026-07")
  owner_key text not null,                   -- sahip+posta adresi hash'i (src/lib/mohave-campaign.ts ownerKey)
  owner text,                                -- insan-okur sahip adı (denetim için)
  mailing_address text,                      -- insan-okur posta adresi (denetim için)
  apns text[] not null default '{}',         -- mektubun kapsadığı APN'ler
  parcel_count int,
  total_acres numeric,
  lob_id text,                               -- Lob letter id (ltr_...); dry-run/failed'da null
  status text not null default 'sent',       -- sent | failed | dry_run
  sent_at timestamptz not null default now()
);

-- Exclusion sorgusu owner_key üzerinden; kampanya raporu campaign üzerinden.
create index if not exists mail_campaign_log_owner_key_idx on public.mail_campaign_log(owner_key);
create index if not exists mail_campaign_log_campaign_idx  on public.mail_campaign_log(campaign);

-- Sahip PII + iç kampanya bilgisi içerir: PUBLIC OKUMA YOK.
-- RLS açık + policy yok = yalnız service_role (dashboard API) okur/yazar.
alter table public.mail_campaign_log enable row level security;
