-- OFF-MARKET NOT MOTORU — offmarket_leads'e puanlama + geo-zenginleştirme kolonları.
-- Idempotent: tekrar çalıştırılabilir. Uygulama: psql (aws-1 pooler, pgbouncer parametresiz)
-- veya Supabase SQL Editor. Sonra: node scraper/grade-offmarket.mjs
--
-- grade        : A+ / A / B / C / D / F — percentile tabanlı harf notu
-- grade_score  : 0-100 ham skor (ağırlıklar: cazibe ~40, likidite ~20, marj ~15,
--                motivasyon ~15, kapanış riski cezası ~-10) — scraper/lib/grade-core.mjs
-- grade_flags  : jsonb dizi — her notun İNSAN OKUR gerekçe bayrakları (dürüstlük kuralı:
--                tahmin/eksik veri açıkça bayraklanır, sahte etiket üretilmez)
-- dist_*_m     : OSM Overpass gerçek mesafeleri (metre) — geo-enrich-offmarket.mjs yazar.
--                NULL = henüz taranmadı; -1 = tarandı, arama yarıçapında bulunamadı.
-- geo_enriched_at : Overpass taraması ne zaman yapıldı (resume anahtarı).

alter table public.offmarket_leads add column if not exists grade text;
alter table public.offmarket_leads add column if not exists grade_score numeric;
alter table public.offmarket_leads add column if not exists grade_flags jsonb;
alter table public.offmarket_leads add column if not exists dist_road_m integer;
alter table public.offmarket_leads add column if not exists dist_power_m integer;
alter table public.offmarket_leads add column if not exists dist_water_m integer;
alter table public.offmarket_leads add column if not exists dist_town_m integer;
alter table public.offmarket_leads add column if not exists geo_enriched_at timestamptz;

create index if not exists offmarket_leads_grade_idx on public.offmarket_leads (grade);
create index if not exists offmarket_leads_grade_score_idx on public.offmarket_leads (grade_score desc nulls last);
-- Geo kuyruğu: henüz taranmamış, koordinatlı, yüksek skorlu kayıtları hızlı çek.
create index if not exists offmarket_leads_geo_pending_idx
  on public.offmarket_leads (grade_score desc)
  where geo_enriched_at is null and lat is not null;

-- Özet tablo + RPC — UI'ın eyalet×not matrisi + geo ilerlemesini TEK hızlı
-- istekte alması için. 565K üstünde canlı GROUP BY, PostgREST'in ~8s statement
-- timeout'una takılıyor (function-level SET pooler'da işlemedi) → özet,
-- grade-offmarket.mjs / geo-enrich-offmarket.mjs tarafından tazelenir.
create table if not exists public.offmarket_grade_summary (
  state text not null, grade text, n bigint not null, geo_n bigint not null,
  refreshed_at timestamptz not null default now()
);
create or replace function public.offmarket_grade_matrix()
returns table(state text, grade text, n bigint, geo_n bigint)
language sql stable as $$
  select state, grade, n, geo_n from public.offmarket_grade_summary
$$;
