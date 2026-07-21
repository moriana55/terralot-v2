-- ─────────────────────────────────────────────────────────────────────────────
-- SICAK ARAMA (CALL CENTER) — mektup outreach'inin telefona dönüşümü
-- Supabase SQL Editor'da BİR KEZ çalıştır (owner action).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Lead'lere telefon alanları (skip-trace importu doldurur)
alter table offmarket_leads add column if not exists phone text;
alter table offmarket_leads add column if not exists phone_source text;
alter table offmarket_leads add column if not exists do_not_call boolean not null default false;

create index if not exists offmarket_leads_phone_idx on offmarket_leads (phone) where phone is not null;

-- 2) Arama kayıtları
create table if not exists call_logs (
  id bigint generated always as identity primary key,
  lead_id text not null references offmarket_leads (lead_id) on delete cascade,
  outcome text not null check (outcome in (
    'no_answer','voicemail','interested','not_interested','wrong_number','callback','dnc'
  )),
  note text,
  callback_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists call_logs_lead_idx on call_logs (lead_id, created_at desc);
create index if not exists call_logs_callback_idx on call_logs (callback_at) where callback_at is not null;

-- 3) Anlaşma boru hattı (5 aşama) — "İlgileniyor" araması otomatik düşer
create table if not exists pipeline_deals (
  lead_id text primary key references offmarket_leads (lead_id) on delete cascade,
  stage text not null default 'ilgileniyor' check (stage in ('ilgileniyor','teklif','pazarlik','sozlesme','tapu')),
  note text,
  offer_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pipeline_deals_stage_idx on pipeline_deals (stage, updated_at desc);

-- 4) RLS: anon erişimi kapalı; yalnızca service-role (API) yazar/okur
alter table call_logs enable row level security;
alter table pipeline_deals enable row level security;
