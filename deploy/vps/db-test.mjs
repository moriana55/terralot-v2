#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// db-test.mjs — VPS kurulum doğrulaması: veritabanına bağlanabiliyor muyuz?
//
// SALT OKUMA. Tek bir SELECT atar; INSERT/UPDATE/DELETE/DROP YOK.
// kur.sh bunu "DOĞRULAMA 1/4" adımında çağırır, ama elle de koşturulabilir:
//
//   cd /opt/vegaland/scraper && node ../deploy/vps/db-test.mjs
//
// Bağlantı dizesi scraper/grade-offmarket.mjs → dbUrl() üzerinden okunur;
// yani gerçek turların kullandığı YOLUN AYNISI test edilir (ayrı bir env
// okuma yolu yazmak, "test geçti ama tur patladı" durumunu doğurur).
//
// Çıkış: 0 bağlandı · 1 bağlanamadı
// ─────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const BURADA = path.dirname(fileURLToPath(import.meta.url));
const SCRAPER = process.env.VEGALAND_SCRAPER || path.resolve(BURADA, "../../scraper");

if (!existsSync(path.join(SCRAPER, "grade-offmarket.mjs"))) {
  console.error(`  scraper klasörü bulunamadı: ${SCRAPER}`);
  console.error("  VEGALAND_SCRAPER=/yol/scraper node db-test.mjs");
  process.exit(1);
}

// ⚠ `import pg from "pg"` BURADA ÇALIŞMAZ: bu dosya deploy/vps/ altında, ama
// node_modules scraper/ altında. Statik import dosyanın konumundan yukarı
// bakar, cwd'ye değil. Bu yüzden çözümleme scraper/package.json'a demirlenir.
const require = createRequire(path.join(SCRAPER, "package.json"));
let pg;
try {
  pg = require("pg");
} catch {
  console.error("  'pg' modülü yok — scraper bağımlılıkları kurulmamış.");
  console.error(`  Çözüm: cd ${SCRAPER} && npm ci --omit=dev`);
  process.exit(1);
}

const sayi = (n) => Number(n).toLocaleString("tr-TR");

try {
  const { dbUrl } = await import(path.join(SCRAPER, "grade-offmarket.mjs"));
  const c = new pg.Client({
    connectionString: dbUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 60000,
  });
  await c.connect();

  const { rows: [r] } = await c.query(`
    select count(*)::int                                                    satir,
           count(*) filter (where geo_enriched_at is not null)::int          geo_var,
           count(*) filter (where geo_enriched_at is null and lat is not null)::int kuyruk,
           count(*) filter (where grade in ('A+','A'))::int                  deal,
           round(pg_database_size(current_database()) / 1024.0 / 1024)::int  db_mb
      from offmarket_leads`);

  // "Gizli A" havuzu: geo turunun ÖNCE işleyeceği, getirisi en yüksek küme.
  const { rows: [g] } = await c.query(`
    with a as (select state, min(grade_score) a_min from offmarket_leads
                where grade in ('A','A+') group by 1)
    select count(*)::int n from offmarket_leads o join a on a.state = o.state
     where o.grade = 'B' and o.geo_enriched_at is null and o.lat is not null
       and o.grade_score >= a.a_min`);

  console.log(`  satır ${sayi(r.satir)} · geo ✓ ${sayi(r.geo_var)} · geo kuyruğu ${sayi(r.kuyruk)} · A+/A ${sayi(r.deal)} · DB ${r.db_mb} MB`);
  console.log(`  gizli-A havuzu (geo turunun ilk hedefi): ${sayi(g.n)} kayıt`);

  // Geo turunun yazacağı sütunlar gerçekten var mı? (şema kayması erken yakalanır)
  const { rows: kol } = await c.query(`
    select column_name from information_schema.columns
     where table_name = 'offmarket_leads'
       and column_name in ('dist_road_m','dist_power_m','dist_water_m','dist_town_m','geo_enriched_at')`);
  const eksik = ["dist_road_m", "dist_power_m", "dist_water_m", "dist_town_m", "geo_enriched_at"]
    .filter((k) => !kol.some((x) => x.column_name === k));
  if (eksik.length) {
    console.error(`  ✘ şemada EKSİK sütun: ${eksik.join(", ")} — geo turu yazamaz.`);
    await c.end();
    process.exit(1);
  }
  console.log("  şema: geo sütunları tam ✔");

  if (r.db_mb >= 1900) {
    console.error(`  ⚠ DB ${r.db_mb} MB — 2 GB tavanına yakın. filtreli-hasat tavan aşılırsa kendini durdurur.`);
  }

  await c.end();
  process.exit(0);
} catch (e) {
  console.error(`  bağlanamadı: ${e.message}`);
  process.exit(1);
}
