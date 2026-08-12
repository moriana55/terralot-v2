#!/usr/bin/env node
/**
 * KULLANILMAYAN İNDEKSLERİ KALDIR — yazma amplifikasyonu temizliği.
 *
 * NEDEN (2026-08-12): okuma hızı için 4 indeks eklendikten sonra notlandırma
 * turunun YAZMA aşaması çok yavaşladı: eklemeden önce tüm tur ~29 dakikaydı,
 * sonra yazma aşaması tek başına 1 saati aştı. Sebebi yazma amplifikasyonu —
 * `grade` ve `grade_score` her satırda güncellendiği için satır HOT-update
 * olamıyor ve tablodaki İNDEKSLERİN TAMAMI yeniden yazılıyor.
 *
 * `pg_stat_user_indexes` ölçümü (14 Temmuz'daki yeniden başlatmadan bu yana):
 *   grade_skor_idx   68 MB · 0 okuma   ← bugün eklendi, vitrin_idx onu gölgeliyor
 *   state_idx        55 MB · 0 okuma   ← adı yanıltıcı, `mailing_state` üzerinde
 *   region_idx       63 MB · 0 okuma   ← kimse region'a göre sorgulamıyor
 * Üçü birlikte 186 MB ve her satır güncellemesinde 3 fazladan indeks yazması.
 * HİÇ OKUNMADIKLARI için düşürmek okuma tarafına maliyetsiz.
 *
 * Korunanlar (gerçekten okunuyor): pkey · county_norm · grade · state_county ·
 * geo_pending · phone · grade_score · vitrin (8,6 MB, A+ vitrini bunu kullanıyor).
 *
 * Geri almak gerekirse: indeks-ekle.mjs kalıbıyla yeniden oluşturulabilir.
 *
 *   node indeks-temizle.mjs --rapor   # sadece ölç, düşürme
 *   node indeks-temizle.mjs           # düşür
 */

import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const RAPOR = process.argv.includes("--rapor");
const DUSURULECEK = [
  "offmarket_leads_grade_skor_idx",
  "offmarket_leads_state_idx",
  "offmarket_leads_region_idx",
];

const c = new pg.Client({ connectionString: dbUrl() });
await c.connect();
await c.query("set statement_timeout = 0");

for (const ad of DUSURULECEK) {
  const { rows } = await c.query(
    `select idx_scan::int okuma, pg_size_pretty(pg_relation_size(indexrelid)) boyut
       from pg_stat_user_indexes where indexrelname = $1`,
    [ad]
  );
  if (!rows.length) { console.log(`· ${ad} — yok, atlandı`); continue; }
  const { okuma, boyut } = rows[0];
  // GÜVENLİK FRENİ: bir kez bile okunmuşsa DOKUNMA. Ölçüm yalan söylemesin.
  if (okuma > 0) {
    console.log(`⚠ ${ad} — ${okuma} okuma var (${boyut}), KORUNDU`);
    continue;
  }
  if (RAPOR) { console.log(`· ${ad} — düşürülecek (${boyut}, 0 okuma)`); continue; }
  const t = Date.now();
  await c.query(`drop index concurrently if exists ${ad}`);
  console.log(`✓ ${ad} düşürüldü (${boyut}, 0 okuma) — ${Math.round((Date.now() - t) / 1000)} sn`);
}

const { rows: [s] } = await c.query(
  `select pg_size_pretty(pg_indexes_size('offmarket_leads')) indeks,
          pg_size_pretty(pg_total_relation_size('offmarket_leads')) toplam`
);
console.log(`indeks boyutu: ${s.indeks} · tablo toplam: ${s.toplam}`);
await c.end();
