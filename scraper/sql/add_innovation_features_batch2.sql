-- Supabase SQL Editor'da çalıştır
-- TerraLot · "Competitive edge vs CoStar/LandWatch" özellik paketi · BATCH 2 (feature 6-10)
-- Hepsi ADDITIVE — mevcut veriyi bozmaz. Tablo/kolon yoksa ekler, varsa atlar.
--
-- Bu dosya 3 yeni tablo + 0 kolon ekler:
--   • owner_finance_listings   (Feature 7 — Owner-finance marketplace)
--   • saved_searches           (Feature 9 — Saved searches + alerts)
--   • outreach_events          (Feature 10 — One-click owner outreach log)
--
-- Feature 6 (Flip simülatörü) ve Feature 8 (Lookalike county) saf hesap/okuma
-- olduğu için yeni tablo gerektirmez; mevcut tax_delinquent_properties +
-- county_demographics + competitor_listings ile çalışır.

-- ── Feature 7) owner_finance_listings ──────────────────────────────────────────
-- Taksitli (owner-finance) satışa sunulan parsellerin pazaryeri kaydı.
-- parcel_ref: tax_delinquent_properties.id'ye gevşek referans (FK zorunlu değil —
-- elle eklenen parseller de listelenebilsin diye text tutuyoruz).
create table if not exists owner_finance_listings (
  id uuid primary key default gen_random_uuid(),
  parcel_ref text,                            -- tax_delinquent_properties.id (opsiyonel)
  title text,                                 -- "5-Acre — Grayson, TX"
  state text,
  county text,
  acres numeric,
  price numeric not null,                     -- cash/total resale price ($)
  down_payment numeric,                       -- peşinat ($) — boşsa down_pct kullanılır
  down_pct numeric,                           -- peşinat oranı (örn 10 = %10)
  apr numeric,                                -- yıllık faiz (örn 9.9 = %9.9)
  term_months int,                            -- vade (ay)
  monthly_payment numeric,                    -- hesaplanmış aylık ödeme (cache)
  status text default 'draft',                -- 'draft' | 'active' | 'reserved' | 'sold' | 'archived'
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_ofl_status on owner_finance_listings (status);
create index if not exists idx_ofl_state_county on owner_finance_listings (state, county);

-- ── Feature 9) saved_searches ──────────────────────────────────────────────────
-- Deal Screener / Acquisitions filtre setlerini saklar; cron ile yeni eşleşme alarmı.
create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text default 'deal-screener',        -- 'deal-screener' | 'acquisitions'
  filters_json jsonb not null default '{}'::jsonb,
  notify_email text,                           -- alarm gönderilecek adres (STUB delivery)
  last_run_at timestamptz,
  last_match_count int default 0,
  baseline_ids jsonb default '[]'::jsonb,      -- son çalıştırmadaki eşleşen id'ler (yeni-eşleşme diff için)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_saved_searches_source on saved_searches (source);

-- ── Feature 10) outreach_events ────────────────────────────────────────────────
-- One-click owner outreach: gönderilen mektup/postcard + deal-sheet günlüğü.
create table if not exists outreach_events (
  id uuid primary key default gen_random_uuid(),
  lead_ref text,                              -- tax_delinquent_properties.id
  channel text default 'letter',             -- 'letter' | 'postcard' | 'email'
  type text default 'offer',                 -- 'offer' | 'follow_up' | 'notice'
  status text default 'queued',              -- 'queued' | 'sent' | 'mock' | 'failed'
  provider_id text,                          -- Lob ltr_/psc_ id
  recipient_name text,
  recipient_address text,
  payload_json jsonb,                        -- deal-sheet + merge vars snapshot
  error text,
  created_at timestamptz default now()
);
create index if not exists idx_outreach_lead on outreach_events (lead_ref);
create index if not exists idx_outreach_status on outreach_events (status);
create index if not exists idx_outreach_created on outreach_events (created_at desc);
