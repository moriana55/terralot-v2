#!/usr/bin/env node
/**
 * EKSİK İNDEKSLER — panelde "zaman aşımı" şeridinin kök sebebi.
 *
 * NEDEN (2026-08-12): `offmarket_leads` 1,27M satır ve paneldeki sorguların
 * çoğu `state` / `state+county` / `grade+grade_score` üzerinden gidiyor. Ama:
 *   • `offmarket_leads_state_idx` adına rağmen `mailing_state` kolonunda —
 *     yani `where state='NC'` HİÇ indeks kullanmıyor, tam tablo taraması.
 *   • Vitrin sorgusu `grade in ('A+','A') order by grade_score desc` iki ayrı
 *     indeks arasında kalıyor, bileşik yok.
 * Sonuç: A+ vitrini her açılışta zaman aşımına düşüp turuncu "rakamlar
 * yedekten gösteriliyor" şeridi çıkarıyordu — sunumda görülecek en kötü şey.
 *
 * CONCURRENTLY kullanılır: tabloyu KİLİTLEMEZ, geo turu ve hasat koşarken
 * güvenle çalışır (karşılığında biraz daha yavaştır).
 *
 *   node indeks-ekle.mjs --rapor   # sadece plan
 *   node indeks-ekle.mjs           # oluştur
 */

import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const RAPOR = process.argv.includes("--rapor");

const INDEKSLER = [
  {
    ad: "offmarket_leads_state_county_idx",
    sql: `create index concurrently if not exists offmarket_leads_state_county_idx
            on offmarket_leads (state, county)`,
    niye: "eyalet/county filtresi — panelin en sık sorgusu, bugüne kadar indekssizdi",
  },
  {
    ad: "offmarket_leads_grade_skor_idx",
    sql: `create index concurrently if not exists offmarket_leads_grade_skor_idx
            on offmarket_leads (grade, grade_score desc nulls last)`,
    niye: "A+ vitrini: nota göre süz, skora göre sırala",
  },
  {
    // Vitrin sorgusu TAM OLARAK şu: `grade in ('A+','A') order by grade_score
    // desc, lead_id asc`. (grade, grade_score) bileşik indeksi buna yetmiyor —
    // iki grade değeri arasında sıralama birleştirmesi gerekiyor ve planlayıcı
    // tam taramaya düşüyordu. Kısmi indeks sorgunun aynısını taşıyor: yalnız
    // A+/A satırları (~66 bin), zaten sıralı.
    ad: "offmarket_leads_vitrin_idx",
    sql: `create index concurrently if not exists offmarket_leads_vitrin_idx
            on offmarket_leads (grade_score desc nulls last, lead_id)
            where grade in ('A+','A')`,
    niye: "A+ vitrini sayfalaması — sunumun ikinci ekranı",
  },
  {
    ad: "offmarket_leads_pin_eksik_idx",
    sql: `create index concurrently if not exists offmarket_leads_pin_eksik_idx
            on offmarket_leads (state) where lat is null`,
    niye: "koordinat tamamlama turları — pinsiz kayıtları bulmak",
  },
];

const c = new pg.Client({ connectionString: dbUrl() });
await c.connect();
// İndeks kurulumu uzun sürebilir; varsayılan statement timeout'a takılmasın.
await c.query("set statement_timeout = 0");

for (const ix of INDEKSLER) {
  const { rows } = await c.query("select 1 from pg_indexes where indexname = $1", [ix.ad]);
  if (rows.length) { console.log(`· ${ix.ad} — zaten var`); continue; }
  if (RAPOR) { console.log(`· ${ix.ad} — OLUŞTURULACAK (${ix.niye})`); continue; }
  const t = Date.now();
  process.stdout.write(`· ${ix.ad} oluşturuluyor… `);
  await c.query(ix.sql);
  console.log(`${Math.round((Date.now() - t) / 1000)} sn (${ix.niye})`);
}

if (!RAPOR) {
  // Planlayıcı yeni indeksleri kullansın diye istatistikler tazelenir.
  process.stdout.write("· ANALYZE… ");
  const t = Date.now();
  await c.query("analyze offmarket_leads");
  console.log(`${Math.round((Date.now() - t) / 1000)} sn`);
  const { rows } = await c.query(
    "select pg_size_pretty(pg_indexes_size('offmarket_leads')) indeks, pg_size_pretty(pg_total_relation_size('offmarket_leads')) toplam"
  );
  console.log(`indeks boyutu: ${rows[0].indeks} · tablo toplam: ${rows[0].toplam}`);
}

await c.end();
