-- Supabase SQL Editor'da çalıştır
alter table tax_delinquent_properties
  add column if not exists deal_score numeric,
  add column if not exists discount_pct numeric,
  add column if not exists savings numeric;

create index if not exists idx_tdp_deal_score on tax_delinquent_properties (deal_score desc);
