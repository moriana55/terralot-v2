-- ─────────────────────────────────────────────────────────────────────────────
-- ADIM 5 · VERİ HİJYENİ (YIKICI DEĞİL)
--
-- Sorun: offmarket_leads.county alanı AZ satırlarında county yerine BÖLGE adı
-- tutuyor ("Dolan Springs / Meadview", "Yucca / Kingman G." …). 20.000 AZ satırının
-- tamamı böyle. Diğer 14 eyalette county adı doğru; yalnızca bazı TX/FL adlarında
-- boşluk düşmüş ("SanJacinto", "TomGreen", "DeafSmith", "SanPatricio").
--
-- Çözüm: HAM `county` DEĞERİNE DOKUNULMAZ. Yeni bir `county_normalized` sütunu
-- eklenir, doğru county oraya yazılır. Ekranlar/istatistikler normalize sütunu
-- okur; ham değer denetim izi olarak yerinde kalır.
--
-- Bu betikte DELETE / DROP / TRUNCATE YOKTUR. Yalnızca ADD COLUMN + UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.offmarket_leads
  add column if not exists county_normalized text;

comment on column public.offmarket_leads.county_normalized is
  'Normalize edilmiş county adı. Ham `county` alanı bazı eyaletlerde bölge adı taşıyor (AZ); bu sütun her zaman gerçek county''dir. Ham değer korunur.';

create index if not exists offmarket_leads_county_norm_idx
  on public.offmarket_leads (state, county_normalized);

-- 1) AZ: bölge etiketlerinin tamamı Mohave County'dir (kaynak: Mohave County
--    ParcelQueryLayer — tek county'den çekildi, `region` alanı zaten bölgeyi tutuyor).
update public.offmarket_leads
   set county_normalized = 'Mohave'
 where state = 'AZ' and county_normalized is distinct from 'Mohave';

-- 2) Diğer eyaletler: ham county adını sadeleştir —
--    " County" son ekini at, CamelCase yapışık adları ayır (SanJacinto → San Jacinto),
--    çoklu boşluğu tekle.
update public.offmarket_leads
   set county_normalized = btrim(
         regexp_replace(
           regexp_replace(
             regexp_replace(county, '\s+County$', '', 'i'),
             '([a-z])([A-Z])', '\1 \2', 'g'),
           '\s+', ' ', 'g')
       )
 where state <> 'AZ'
   and county is not null
   and county_normalized is null;

-- 3) Düzeltme: "Mc"/"Mac" ön ekli county adları CamelCase ayırıcıyla yanlış bölünüyor
--    (McLennan → "Mc Lennan"). Bunlar tek kelimedir; boşluğu geri kapat.
update public.offmarket_leads
   set county_normalized = regexp_replace(county_normalized, '^(Ma?c)\s+([A-Z])', '\1\2')
 where county_normalized ~ '^Ma?c\s+[A-Z]';
