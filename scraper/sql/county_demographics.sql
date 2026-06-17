-- Supabase SQL Editor'da çalıştır
-- ACS 5-yr county demografi profili (build-county-demographics.js ile doldurulur).
-- Deal Screener composite opportunity score'unu besler.
create table if not exists county_demographics (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  county text not null,                       -- "HARRIS COUNTY" (UPPER, build script ile aynı normalize)
  median_household_income numeric,            -- B19013_001E
  median_age numeric,                         -- B01002_001E
  population numeric,                          -- B01003_001E
  median_home_value numeric,                  -- B25077_001E
  acs_year int,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (state, county)                       -- upsert onConflict anahtarı
);
create index if not exists idx_county_demographics_state on county_demographics (state);
create index if not exists idx_county_demographics_county on county_demographics (county);
