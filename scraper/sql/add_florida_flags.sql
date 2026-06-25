-- add_florida_flags.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Florida (ve genel) pipeline için is_vacant / is_absentee kolonları.
-- BUILD-PLANI-DEMO.md #1: bu bayraklar Regrid'den türetilebilir ("usedesc"→
-- vacant, "owner" posta adresi → absentee) ama tabloya bağlı değildi.
--
-- Bu migration kolonları EKLER (idempotent). Doldurma ayrı bir adımdır:
--   - is_vacant   : Regrid usedesc / land-use "vacant/unimproved" ise true
--   - is_absentee : sahip posta county'si ≠ parsel county'si ise true
-- Veri yoksa NULL kalır (uydurma yok). scraper/scrape_florida.js deriveFlags()
-- aynı mantığı uygular; bu kolonlar onun Supabase karşılığı.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS tax_delinquent_properties
  ADD COLUMN IF NOT EXISTS is_vacant   boolean,
  ADD COLUMN IF NOT EXISTS is_absentee boolean;

-- Sorgu hızı: skorlama/filtre bu bayrakları sık kullanır.
CREATE INDEX IF NOT EXISTS idx_tdp_is_vacant   ON tax_delinquent_properties (is_vacant);
CREATE INDEX IF NOT EXISTS idx_tdp_is_absentee ON tax_delinquent_properties (is_absentee);

-- (Opsiyonel) Regrid land-use zaten kayıtlıysa, vacant bayrağını türet.
-- usedesc kolon adı projeye göre değişebilir; yoksa bu UPDATE no-op'tur.
-- Yorum satırı bırakıldı — kolon adı doğrulanınca elle çalıştırın:
--
-- UPDATE tax_delinquent_properties
--   SET is_vacant = (lower(coalesce(use_desc,'')) ~ 'vacant|unimproved|raw land')
--   WHERE is_vacant IS NULL AND use_desc IS NOT NULL;
