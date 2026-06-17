-- ════════════════════════════════════════════════════════════════════════════
-- TerraLot — Scraper → Dashboard sync setup
-- OWNER ACTION REQUIRED: run once in the Supabase SQL editor before using the
-- POST /api/admin/sync-deals endpoint. Idempotent.
--
-- WHAT IT DOES
--   The sync endpoint upserts normalized scraper rows into
--   `tax_delinquent_properties` and dedups by a stable `dedup_key` (derived from
--   APN / parcel id, or a location+source fallback). Postgres UPSERT
--   (ON CONFLICT) needs a UNIQUE constraint/index on that conflict target, so we
--   add the column + a unique index here. Without this, re-imports would create
--   duplicate rows and the endpoint reports an upsert error.
--
--   The extra discount/savings columns may already exist (added by the scraper's
--   scraper/sql/add_deal_score.sql). `ADD COLUMN IF NOT EXISTS` is a no-op when
--   they do.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Dedup key column + unique index (the upsert conflict target).
alter table if exists public.tax_delinquent_properties
  add column if not exists dedup_key text;

create unique index if not exists tax_delinquent_dedup_key_uidx
  on public.tax_delinquent_properties (dedup_key)
  where dedup_key is not null;

-- 2) Columns the importer writes (safe no-ops if already present).
alter table if exists public.tax_delinquent_properties
  add column if not exists scraped_at   timestamptz,
  add column if not exists discount_pct numeric,
  add column if not exists savings      numeric,
  add column if not exists property_address text,
  add column if not exists owner_address text,
  add column if not exists case_number  text,
  add column if not exists raw_url       text,
  add column if not exists lat           double precision,
  add column if not exists lng           double precision;

-- 3) (Optional) Backfill dedup_key for rows imported before this column existed,
--    so they merge with future imports instead of duplicating. Mirrors the
--    apied logic in src/lib/sync-deals.ts (apn-first, else loc fallback).
update public.tax_delinquent_properties
set dedup_key =
  case
    when nullif(trim(apn), '') is not null
      then 'apn:' || lower(regexp_replace(trim(apn), '[^a-z0-9]+', '-', 'gi'))
    when nullif(trim(property_address), '') is not null and nullif(trim(state), '') is not null
      then 'loc:' ||
           lower(regexp_replace(coalesce(nullif(trim(source), ''), 'scraper'), '[^a-z0-9]+', '-', 'gi')) || ':' ||
           lower(regexp_replace(trim(state), '[^a-z0-9]+', '-', 'gi')) || ':' ||
           lower(regexp_replace(coalesce(trim(county), ''), '[^a-z0-9]+', '-', 'gi')) || ':' ||
           lower(regexp_replace(trim(property_address), '[^a-z0-9]+', '-', 'gi'))
    else null
  end
where dedup_key is null;

-- Note: RLS for this table is already enabled by SECURITY_RLS.sql. The sync
-- endpoint uses the service-role key, which bypasses RLS.
