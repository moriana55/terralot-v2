-- Supabase SQL Editor'da çalıştır.
-- County demografi + piyasa sinyali profili — build-county-demographics.js doldurur.
-- "Zillow neye bakıyorsa": değer endeksi (ZHVI) + likidite/talep (days-to-pending,
-- inventory) + büyüme (PEP) + inşaat iştahı (BPS permits) + ACS demografi.
-- Path of Growth + Deal Screener + Lookalike + Underwrite skorlarını besler.
--
-- Tek seferde tüm tablo + ek kolonlar. Idempotent: tekrar çalıştırmak güvenli
-- (create table if not exists + add column if not exists).
create table if not exists county_demographics (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  county text not null,                       -- "HARRIS COUNTY" (UPPER, build script ile aynı normalize)
  state_fips text,                            -- "48"  (Zillow/BPS FIPS join için)
  county_fips text,                           -- "201" (3 hane)

  -- ── Census ACS 5-yr (gerekli: CENSUS_API_KEY) ─────────────────────────────
  median_household_income numeric,            -- B19013_001E
  median_age numeric,                         -- B01002_001E
  population numeric,                          -- B01003_001E (ACS tahmini)
  median_home_value numeric,                  -- B25077_001E
  acs_year int,

  -- ── Census PEP (nüfus büyümesi, keyless CSV) ──────────────────────────────
  pop_growth_1y numeric,                      -- 1 yıllık nüfus büyüme oranı (örn 0.018 = +%1.8)
  pop_growth_5y numeric,                      -- 5 yıllık nüfus büyüme oranı

  -- ── Census Building Permits Survey (BPS, keyless CSV) ─────────────────────
  building_permits numeric,                   -- son yıl toplam konut izni (units)
  permits_growth numeric,                     -- 2 yıllık izin büyümesi (oran)

  -- ── Zillow Research (free CSV) — "Zillow neye bakıyor" ────────────────────
  zhvi numeric,                               -- ZHVI: tipik ev değeri endeksi ($), son ay
  zhvi_yoy numeric,                           -- ZHVI yıllık değişim (oran, örn 0.045 = +%4.5)
  days_to_pending numeric,                    -- median days-to-pending (likidite/talep hızı), son ay
  inventory numeric,                          -- for-sale inventory (arz), son ay

  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (state, county)                      -- upsert onConflict anahtarı
);

-- Tablo daha önce eski şemayla oluşturulduysa eksik kolonları ekle (idempotent).
alter table county_demographics add column if not exists state_fips text;
alter table county_demographics add column if not exists county_fips text;
alter table county_demographics add column if not exists pop_growth_1y numeric;
alter table county_demographics add column if not exists pop_growth_5y numeric;
alter table county_demographics add column if not exists building_permits numeric;
alter table county_demographics add column if not exists permits_growth numeric;
alter table county_demographics add column if not exists zhvi numeric;
alter table county_demographics add column if not exists zhvi_yoy numeric;
alter table county_demographics add column if not exists days_to_pending numeric;
alter table county_demographics add column if not exists inventory numeric;

create index if not exists idx_county_demographics_state on county_demographics (state);
create index if not exists idx_county_demographics_county on county_demographics (county);
create index if not exists idx_county_demographics_fips on county_demographics (state_fips, county_fips);
