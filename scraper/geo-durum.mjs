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
await c.end();
