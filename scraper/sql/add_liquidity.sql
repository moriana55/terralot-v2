-- Supabase SQL Editor'da çalıştır
alter table tax_delinquent_properties
  add column if not exists liquidity_score numeric,
  add column if not exists county_pop_growth numeric;
