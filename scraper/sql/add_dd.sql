-- Supabase SQL Editor'da çalıştır
alter table tax_delinquent_properties
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists flood_score numeric,
  add column if not exists road_access text,
  add column if not exists dd_checked boolean default false,
  add column if not exists final_score numeric;
create index if not exists idx_tdp_final_score on tax_delinquent_properties (final_score desc);
