#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GEO KARANTİNA — bozuk geo taramasını geri alır (SATIR SİLMEZ, sadece UPDATE).
//
//   node scraper/geo-karantina.mjs --dry     # sadece say, yazma
//   node scraper/geo-karantina.mjs
//
// NEDEN: 2026-07-29 turunda süper hücre sorgusu `out center bb` yazıyordu;
// Overpass bu kombinasyonda way'ler için `center` DÖNDÜRMEZ. parseDistances
// center'sız elemanı atlıyordu → yol/su/elektrik hattı (hepsi OSM'de WAY)
// hiç görülmedi → dist_road_m = -1 → grade-core "landlocked" kuralı → F.
// Doğrulama (2026-07-30, canlı Overpass): F damgalı 3 parselin 1.600 m'sinde
// sırasıyla 81 / 273 / 198 yol var; düzeltilmiş kodla mesafeler 483/55/54 m.
//
// BOZUK İMZA: dist_road_m = -1 VE dist_water_m = -1 (ikisi de yalnız way'den
// gelir). Node kaynaklı kategoriler (elektrik direği, kasaba) o turda da
// doldu — bu yüzden imza yalnız way tabanlı iki kategoriye bakar.
//
// Bu script o satırların dist_* + geo_enriched_at alanlarını NULL'lar; satır
// silinmez, not silinmez (grade yeniden hesaplanınca güncellenir). Kayıtlar
// geo kuyruğuna geri döner ve DÜZELTİLMİŞ kodla yeniden taranır.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const DRY = process.argv.includes("--dry");
// Bozuk turun penceresi (ilk bozuk yazımdan turun sonuna).
export const BOZUK_TUR_BASLANGIC = process.env.GEO_KARANTINA_TS || "2026-07-29 17:00:00+00";
export const BOZUK_KOSUL = `geo_enriched_at >= $1 and dist_road_m = -1 and dist_water_m = -1`;

async function main() {
  const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();

  const once = await c.query(
    `select count(*) toplam,
            count(*) filter (where geo_enriched_at is not null) geo_dogrulanmis,
            count(*) filter (where ${BOZUK_KOSUL}) bozuk,
            count(*) filter (where grade = 'F') f_notu
     from offmarket_leads`, [BOZUK_TUR_BASLANGIC]);
  const o = once.rows[0];
  console.log(`ÖNCE : toplam=${o.toplam} · geo=${o.geo_dogrulanmis} · bozuk=${o.bozuk} · F=${o.f_notu}`);

  if (DRY) { await c.end(); return; }

  const r = await c.query(
    `update offmarket_leads
        set dist_road_m = null, dist_power_m = null, dist_water_m = null,
            dist_town_m = null, geo_enriched_at = null
      where ${BOZUK_KOSUL}`, [BOZUK_TUR_BASLANGIC]);
  console.log(`karantinaya alınan satır: ${r.rowCount} (dist_* + geo_enriched_at → NULL)`);

  const sonra = await c.query(
    `select count(*) toplam, count(*) filter (where geo_enriched_at is not null) geo_dogrulanmis
     from offmarket_leads`);
  const s = sonra.rows[0];
  console.log(`SONRA: toplam=${s.toplam} · geo=${s.geo_dogrulanmis}`);
  if (Number(s.toplam) !== Number(o.toplam)) throw new Error("SATIR SAYISI DEĞİŞTİ — beklenmeyen durum!");
  console.log("✓ satır sayısı korundu. Sıradaki: node scraper/grade-offmarket.mjs");
  await c.end();
}

if (process.argv[1]?.endsWith("geo-karantina.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
