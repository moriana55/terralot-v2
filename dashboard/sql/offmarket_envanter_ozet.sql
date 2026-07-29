-- ─────────────────────────────────────────────────────────────────────────────
-- ADIM 1 · TEK OFF-MARKET ENVANTERİ — county kırılım özeti.
--
-- Tek envanter ekranının eyalet/county açılır listesini ve sayaçlarını besler.
-- PostgREST group-by yapamaz; 566K satırı her istekte taramak da zaman aşımına
-- uğruyor → MATERYALİZE görünüm kullanılır, `scripts/envanter-ozet-tazele.mjs`
-- ile yenilenir (scraper/import sonrası çalıştır).
--
-- county_normalized kullanılır (ham `county` alanı AZ'de bölge adı taşıyor,
-- bkz. sql/county_normalized.sql). HAM DEĞER TABLODA OLDUĞU GİBİ DURUR.
-- Bu betikte DELETE / DROP / TRUNCATE YOKTUR — yalnızca CREATE IF NOT EXISTS.
--
-- Not: aynı adın "düz view" sürümü daha önce oluşturulmuştu; canlı tarama çok
-- yavaş olduğu için kullanılmıyor. Silinmedi (kural: veri/nesne silme yok);
-- ekranlar aşağıdaki `_mv` sürümünü okur.
-- ─────────────────────────────────────────────────────────────────────────────

create materialized view if not exists public.offmarket_envanter_ozet_mv as
select
  state,
  coalesce(county_normalized, county, '(bilinmiyor)') as county,
  count(*)::int                                        as lead_sayisi,
  count(*) filter (where lat is not null and lng is not null)::int as koordinatli,
  count(*) filter (where mailing_address is not null)::int         as postalanabilir,
  count(*) filter (where absentee is true)::int                    as absentee,
  count(*) filter (where acres is not null)::int                   as acre_bilinen,
  round(avg(acres)::numeric, 2)                        as ort_acre,
  count(distinct region)::int                          as bolge_sayisi
from public.offmarket_leads
group by 1, 2;

create unique index if not exists offmarket_envanter_ozet_mv_key
  on public.offmarket_envanter_ozet_mv (state, county);

comment on materialized view public.offmarket_envanter_ozet_mv is
  'Tek Off-Market Envanteri ekranının eyalet/county sayaçları. Salt-okunur türev; scripts/envanter-ozet-tazele.mjs ile yenilenir.';

grant select on public.offmarket_envanter_ozet_mv to service_role;
notify pgrst, 'reload schema';
