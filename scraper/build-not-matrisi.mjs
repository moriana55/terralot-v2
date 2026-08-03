#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// NOT MATRİSİ SNAPSHOT — A+ vitrin sayfasının YEDEĞİ.
//
// NEDEN VAR: `/admin/arsa-notlari` sayfası eyalet × not matrisini canlı RPC ile
// (`offmarket_grade_matrix`) hesaplıyor. 921K satırlık tam tarama; veritabanı
// aynı anda ağır yazma altındayken (geo turu, hasat) Supabase statement timeout
// veriyor ve sayfa "canceling statement due to statement timeout" ile TAMAMEN
// boş kalıyordu — yedeği yoktu. Müşteri sunumunda bu ekranın ölmesi kabul
// edilemez.
//
// Bu betik aynı matrisi KENDİ bağlantımızdan (timeout'suz) hesaplayıp diske
// yazar. API önce canlı RPC'yi dener; hata alırsa bu dosyaya düşer ve ekranda
// "snapshot" olduğunu dürüstçe söyler.
//
// Çalıştır (grade-offmarket.mjs'den sonra):  node scraper/build-not-matrisi.mjs
// Çıktı: dashboard/src/data/not-matrisi.json
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./grade-offmarket.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../dashboard/src/data/not-matrisi.json");

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();
// Kendi bağlantımızda timeout'u kaldır — tam tarama birkaç dakika sürebilir.
await client.query("set statement_timeout = 0");

console.log("eyalet × not matrisi hesaplanıyor…");
const matrix = (await client.query(`
  select state,
         grade,
         count(*)::int                        n,
         count(geo_enriched_at)::int          geo_n
  from offmarket_leads
  group by state, grade
  order by state, grade
`)).rows;

const funnel = (await client.query(`
  select count(*)::int                                        total,
         count(grade)::int                                    graded,
         count(geo_enriched_at)::int                          "geoDone",
         count(*) filter (where grade = 'A+')::int             "aPlus",
         count(*) filter (where grade = 'A')::int              a,
         count(*) filter (where grade = 'B')::int              b
  from offmarket_leads
`)).rows[0];

// A+/A vitrin kartları — sayfanın görsel kısmı. Canlı sorgu 921K satırda
// grade_score sıralaması yaptığı için yazma yükü altında timeout alıyordu;
// yedeği burada üretiliyor.
console.log("vitrin kartları…");
const cards = (await client.query(`
  select lead_id, state, county, region, apn, owner, situs, use, acres, land_value,
         est_offer, est_retail, est_margin, absentee, mailing_city, mailing_state,
         grade, grade_score, grade_flags, grade_breakdown,
         dist_road_m, dist_power_m, dist_water_m, dist_town_m, geo_enriched_at, lat, lng
  from offmarket_leads
  where grade in ('A+','A')
  order by grade_score desc nulls last
  limit 30
`)).rows;

await client.end();

writeFileSync(OUT, JSON.stringify({ uretildi: new Date().toISOString(), funnel, matrix, cards }, null, 1));
console.log(`✔ ${OUT}`);
console.log(`  ${matrix.length} matris satırı · ${cards.length} vitrin kartı · toplam ${funnel.total.toLocaleString("en-US")} · A+ ${funnel.aPlus.toLocaleString("en-US")} · A ${funnel.a.toLocaleString("en-US")}`);
