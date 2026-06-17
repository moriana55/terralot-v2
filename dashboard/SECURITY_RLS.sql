-- ════════════════════════════════════════════════════════════════════════════
-- TerraLot — Supabase Row-Level Security (RLS) policies
-- OWNER ACTION REQUIRED: run this in the Supabase SQL editor (or `supabase db
-- push`) once. It is idempotent-ish (uses IF NOT EXISTS / DROP ... IF EXISTS).
--
-- THREAT MODEL
--   • The app server uses the SERVICE-ROLE key (supabaseAdmin()) behind admin
--     auth, which BYPASSES RLS. So RLS here is defense-in-depth: it ensures that
--     if the ANON key (NEXT_PUBLIC_SUPABASE_ANON_KEY, shipped to the browser) is
--     ever pointed at these tables directly, it can read NOTHING it shouldn't.
--   • The buyer/investor portals will (when wired) read PER-USER rows. Those
--     tables MUST isolate by the authenticated identity so buyer A can never see
--     buyer B's parcels / payments / contracts (IDOR). Policies for that are at
--     the bottom and assume Supabase Auth (auth.uid()) or a Clerk JWT claim.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Lock down all current operational tables to anon (deny-by-default) ─────
-- These are written/read ONLY by the service role behind admin auth. Enabling
-- RLS with NO permissive anon policy = anon client gets zero rows. The service
-- role still has full access (it bypasses RLS).

alter table if exists public.tax_delinquent_properties enable row level security;
alter table if exists public.competitor_listings        enable row level security;
alter table if exists public.county_demographics        enable row level security;
alter table if exists public.deal_tracking              enable row level security;
alter table if exists public.outreach_events            enable row level security;
alter table if exists public.owner_finance_listings     enable row level security;
alter table if exists public.saved_searches             enable row level security;
alter table if exists public.upcoming_sales             enable row level security;
alter table if exists public.updates                    enable row level security;

-- (No anon SELECT/INSERT/UPDATE/DELETE policies are created for the above →
--  the public anon key cannot touch them. Service role bypasses RLS.)

-- ── 2. Public read-only marketing data (optional) ────────────────────────────
-- The marketing site reads county_demographics / competitor_listings via the
-- SERVER routes (service role), so anon read is NOT required. If you ever want
-- the browser anon client to read these directly, uncomment:
--
-- drop policy if exists "anon read demographics" on public.county_demographics;
-- create policy "anon read demographics" on public.county_demographics
--   for select to anon using (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. BUYER PORTAL — per-buyer isolation (apply when these tables are created)
-- ════════════════════════════════════════════════════════════════════════════
-- Assumes a buyer is identified by their authenticated email or user id. Two
-- variants are provided depending on whether you use Supabase Auth or Clerk.

-- 3a. owner_finance_contracts: one row per signed buyer contract.
--     Suggested columns: id uuid pk, buyer_email text, buyer_user_id text,
--     property_ref text, price int, down_payment int, term_months int,
--     apr numeric, payments_made int, created_at timestamptz.
--
-- create table if not exists public.owner_finance_contracts (
--   id            uuid primary key default gen_random_uuid(),
--   buyer_email   text not null,
--   buyer_user_id text,
--   property_ref  text,
--   price         int  not null,
--   down_payment  int  not null default 0,
--   term_months   int  not null default 48,
--   apr           numeric not null default 0,
--   payments_made int  not null default 0,
--   created_at    timestamptz not null default now()
-- );
-- alter table public.owner_finance_contracts enable row level security;

-- VARIANT A — Supabase Auth (auth.uid() / auth.jwt()->>'email'):
-- drop policy if exists "buyer reads own contracts" on public.owner_finance_contracts;
-- create policy "buyer reads own contracts" on public.owner_finance_contracts
--   for select to authenticated
--   using (
--     buyer_user_id = auth.uid()::text
--     or lower(buyer_email) = lower(auth.jwt() ->> 'email')
--   );

-- VARIANT B — Clerk JWT (configure Clerk as a Supabase third-party auth provider;
-- the buyer's Clerk user id arrives in the 'sub' claim):
-- drop policy if exists "buyer reads own contracts (clerk)" on public.owner_finance_contracts;
-- create policy "buyer reads own contracts (clerk)" on public.owner_finance_contracts
--   for select to authenticated
--   using ( buyer_user_id = (auth.jwt() ->> 'sub') );

-- 3b. Buyer payment rows (if stored per-installment) — same isolation:
-- create policy "buyer reads own payments" on public.buyer_payments
--   for select to authenticated
--   using ( buyer_user_id = auth.uid()::text
--           or lower(buyer_email) = lower(auth.jwt() ->> 'email') );

-- 3c. Buyer documents/contracts in Supabase STORAGE:
--     Put each buyer's files under a path prefixed with their user id, e.g.
--     contracts/<buyer_user_id>/agreement.pdf, then:
-- create policy "buyer reads own files" on storage.objects
--   for select to authenticated
--   using (
--     bucket_id = 'contracts'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );

-- ════════════════════════════════════════════════════════════════════════════
-- 4. INVESTOR PORTAL — per-investor isolation (apply when multi-investor)
-- ════════════════════════════════════════════════════════════════════════════
-- Today the investor portal serves a single investor from owner-curated data.
-- When investor-specific data lands in a table, isolate the same way:
--
-- create policy "investor reads own portfolio" on public.investor_positions
--   for select to authenticated
--   using ( investor_user_id = auth.uid()::text
--           or lower(investor_email) = lower(auth.jwt() ->> 'email') );

-- ── 5. Verify ────────────────────────────────────────────────────────────────
-- After applying, confirm RLS is on everywhere:
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r';
-- Every operational table should show relrowsecurity = true.
