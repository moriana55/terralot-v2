#!/usr/bin/env node
// GEO DURUM SAYACI — tek satır özet: doğrulanan / kalan / A+/A mektup atılabilir.
// geo-turu.sh her partiden sonra çağırır; kesinti olursa nerede kalındığı görünür.
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows: [t] } = await c.query(`
  select count(*)::bigint satir,
         count(*) filter (where geo_enriched_at is not null)::bigint geo,
         count(*) filter (where geo_enriched_at is null)::bigint geosuz,
         count(*) filter (where grade in ('A+','A'))::bigint deal,
         pg_database_size(current_database())::bigint db
  from offmarket_leads`);
const { rows: ey } = await c.query(`
  select state, count(*)::int n from offmarket_leads where grade in ('A+','A')
  group by 1 order by 2 desc limit 30`);
console.log(
  `DURUM ${new Date().toISOString()} · satır ${Number(t.satir).toLocaleString("tr-TR")} · ` +
  `geo ✓ ${Number(t.geo).toLocaleString("tr-TR")} · geo ✗ ${Number(t.geosuz).toLocaleString("tr-TR")} · ` +
  `A+/A ${Number(t.deal).toLocaleString("tr-TR")} · DB ${Math.round(Number(t.db) / 1024 / 1024)} MB`);
console.log("  A+/A eyalet: " + ey.map((r) => `${r.state}:${r.n}`).join(" "));

// ── SAĞLIK: YOL BULMA ORANI ────────────────────────────────────────────────
// 2026-07-29 dersi: `out center bb` hatası yüzünden 99.309 parselin %100'ü
// "yol yok" damgası yedi (bkz. NOT-MOTORU-KALIBRASYON.md). Sağlıklı turlarda
// oran ~%88. Bu satır %0'a yakınsa TUR BOZUK — durdur, kodu kontrol et.
const PENCERE_DK = Number(process.env.GEO_DURUM_PENCERE_DK || 120);
const { rows: [s] } = await c.query(
  `select count(*)::int n,
          count(*) filter (where dist_road_m >= 0)::int yol_var,
          count(*) filter (where dist_water_m >= 0)::int su_var,
          count(*) filter (where dist_power_m >= 0)::int elektrik_var
     from offmarket_leads
    where geo_enriched_at > now() - ($1 || ' minutes')::interval`, [String(PENCERE_DK)]);
if (s.n > 0) {
  const oran = (100 * s.yol_var) / s.n;
  console.log(
    `  son ${PENCERE_DK} dk: ${s.n.toLocaleString("tr-TR")} tarandı · ` +
    `yol bulma %${oran.toFixed(1)} · su %${((100 * s.su_var) / s.n).toFixed(1)} · ` +
    `elektrik %${((100 * s.elektrik_var) / s.n).toFixed(1)} ` +
    `${oran < 20 ? "⛔ ŞÜPHELİ — sağlıklı tur ~%88, DURDUR ve kodu kontrol et" : "✔ sağlıklı bandda"}`);
}

// Gizli A havuzu: skoru eyaletinin A tabanını aşan ama geo bekleyen kayıtlar.
const { rows: [g] } = await c.query(`
  with a as (select state, min(grade_score) a_min from offmarket_leads
              where grade in ('A','A+') group by 1)
  select count(*)::int n from offmarket_leads o join a on a.state = o.state
   where o.grade = 'B' and o.geo_enriched_at is null and o.lat is not null
     and o.grade_score >= a.a_min`);
console.log(`  gizli A havuzu (geo bekleyen, skoru A tabanını aşan): ${g.n.toLocaleString("tr-TR")}`);
await c.end();
