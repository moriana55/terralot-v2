-- Supabase SQL Editor'da çalıştır
alter table tax_delinquent_properties
  add column if not exists flip_score numeric,
  add column if not exists ownerfinance_score numeric,
  add column if not exists confidence numeric;
