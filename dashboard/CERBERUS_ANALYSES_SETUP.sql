-- ════════════════════════════════════════════════════════════════════════════
-- TerraLot — Cerberus per-lead AUTO-ANALYSIS persistence
-- OWNER ACTION REQUIRED: run once in the Supabase SQL editor before using the
-- POST /api/admin/cerberus/analyze endpoint or the /admin/cerberus Intel cockpit.
-- Idempotent — safe to re-run.
--
-- WHAT IT DOES
--   The Cerberus analysis pipeline (src/lib/cerberus/analyze.ts) chews on each
--   captured lead/parcel one-by-one and produces a rich LeadAnalysis (verdict
--   AL/BEKLE/GEÇ, score, margin, score components, risk flags, narrative). The
--   batch endpoint persists that analysis HERE so the Intel dashboard can render
--   the funnel and the per-lead drill-down without re-computing every time.
--
--   Dedup is by `parcel_key` (the same stable id the sync/analyze pipeline
--   derives: APN-first, else location fallback). The UNIQUE index makes the
--   batch upsert idempotent — re-analyzing a parcel UPDATES its row in place
--   instead of duplicating, so the endpoint can safely process a backlog and be
--   re-run on a cron without bloating the table.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.lead_analyses (
  id                bigint generated always as identity primary key,
  parcel_key        text not null,
  lead_id           text,
  apn               text,
  source            text,
  state             text,
  county            text,
  address           text,
  acres             numeric,

  -- valuation
  comp_value        numeric,
  per_acre          numeric,
  value_basis       text,            -- county_comp | state_comp | none
  value_confidence  text,            -- high | medium | low
  min_bid           numeric,
  margin            numeric,         -- 0..1 (or null)
  discount_pct      numeric,

  -- verdict
  verdict           text not null,   -- BUY | WATCH | PASS
  score             integer not null default 0,
  confidence        text,            -- high | medium | low
  hard_fail         boolean not null default false,

  -- rich detail (kept as jsonb so the drill-down can render every facet)
  components        jsonb,           -- [{label, pts, max, note}]
  reasons           jsonb,           -- string[]
  risk_flags        jsonb,           -- [{code, level, label}]
  data_gaps         jsonb,           -- string[]

  suggested_action  text,
  narrative         text,
  narrative_source  text,            -- ai | rule-based
  pipeline_version  integer not null default 1,

  analyzed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- Idempotency: one analysis row per parcel. The batch endpoint upserts on this.
create unique index if not exists lead_analyses_parcel_key_uidx
  on public.lead_analyses (parcel_key);

-- Funnel/intel queries hit these filters hardest.
create index if not exists lead_analyses_verdict_idx on public.lead_analyses (verdict);
create index if not exists lead_analyses_score_idx   on public.lead_analyses (score desc);
create index if not exists lead_analyses_state_idx   on public.lead_analyses (state);
create index if not exists lead_analyses_analyzed_idx on public.lead_analyses (analyzed_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Mirror the project's fail-closed posture: lock the table down. The dashboard's
-- API routes use the service-role key (which bypasses RLS), and the admin UI
-- reads through those gated routes — so NO anon/public read policy is added.
alter table public.lead_analyses enable row level security;

-- (No anon SELECT policy on purpose — analyses are internal acquisition intel.)
-- If you later expose a read-only public view, add a narrow policy here instead
-- of opening the base table.
