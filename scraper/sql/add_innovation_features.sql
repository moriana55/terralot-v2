-- Supabase SQL Editor'da çalıştır
-- TerraLot · "Competitive edge vs CoStar/LandWatch" özellik paketi
-- Hepsi ADDITIVE — mevcut veriyi bozmaz. Yoksa kolonu ekler, varsa atlar.
--
-- Bu 5 özellik (Underwriting, Arbitrage, Path-of-Growth, Buildability, Comps)
-- mevcut kolonlarla ÇALIŞIR. Aşağıdaki kolonlar opsiyonel zenginleştirmedir:
--   • cached underwriting verdict (tekrar hesaplamamak için)
--   • buildability heuristic snapshot
--   • county permits + 1yr/5yr growth (path-of-growth daha doğru çalışsın)
-- Kolonlar boş kalsa bile API'ler graceful fallback ile çalışır.

-- ── 1) tax_delinquent_properties: underwriting + buildability snapshot ──────────
alter table tax_delinquent_properties
  add column if not exists underwrite_verdict text,        -- 'BUY' | 'PASS' | 'WATCH'
  add column if not exists underwrite_score numeric,       -- 0-100
  add column if not exists underwrite_at timestamptz,
  add column if not exists buildability_score numeric,     -- 0-100
  add column if not exists zoning_class text,               -- heuristic guess
  add column if not exists slope_pct numeric;               -- if known from DEM enrichment
create index if not exists idx_tdp_underwrite_score on tax_delinquent_properties (underwrite_score desc);
create index if not exists idx_tdp_buildability on tax_delinquent_properties (buildability_score desc);

-- ── 2) county_demographics: growth + permits (path-of-growth predictor) ─────────
-- Mevcut: state, county, median_household_income, median_age, population, median_home_value
-- Eklenenler boşsa predictor demografi sinyallerine düşer (yine çalışır).
alter table county_demographics
  add column if not exists pop_growth_1y numeric,          -- 1-yıllık nüfus büyümesi (oran, örn 0.018)
  add column if not exists pop_growth_5y numeric,          -- 5-yıllık nüfus büyümesi (oran)
  add column if not exists building_permits numeric,        -- yıllık konut izni sayısı
  add column if not exists permits_growth numeric;          -- izin büyümesi (yoy oran)

-- ── 3) competitor_listings: sold/comps zenginleştirme ──────────────────────────
-- market-rates ve parcel-comps mevcut kolonlarla (state, county, acres, price) çalışır.
-- 'status' ve 'sold_date' eklenirse comps engine "sold" comp'ları ayırt edebilir.
alter table competitor_listings
  add column if not exists status text,                     -- 'active' | 'sold' | 'pending'
  add column if not exists sold_date date,
  add column if not exists sold_price numeric,
  add column if not exists lat numeric,
  add column if not exists lng numeric;
create index if not exists idx_cl_county_acres on competitor_listings (state, county, acres);
