-- Cerberus ops: deal yönetimi (#6,7,8,9) + AI analiz (#3) + drift (#5)
create table if not exists deal_tracking (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references tax_delinquent_properties(id) on delete cascade,
  stage text default 'new',          -- new|researching|offer|won|owned|listed|sold|dead
  starred boolean default false,     -- watchlist
  notes text,
  max_offer numeric,
  contacted boolean default false,
  contact_status text,               -- mailed|responded|negotiating
  acquired_cost numeric, holding_cost numeric, list_price numeric, sold_price numeric,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(lead_id)
);
create index if not exists idx_deal_tracking_stage on deal_tracking(stage);
create index if not exists idx_deal_tracking_starred on deal_tracking(starred);

create table if not exists ai_analysis (
  lead_id uuid primary key references tax_delinquent_properties(id) on delete cascade,
  verdict text, summary text, risks text, suggested_offer numeric,
  model text, created_at timestamptz default now()
);

create table if not exists deal_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references tax_delinquent_properties(id) on delete cascade,
  minimum_bid numeric, status_note text, captured_at timestamptz default now()
);
create index if not exists idx_deal_snapshots_lead on deal_snapshots(lead_id);
