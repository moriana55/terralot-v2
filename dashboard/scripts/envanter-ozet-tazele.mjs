// Off-Market Envanteri county özetini yeniler (materyalize görünüm).
// Scraper/import sonrası çalıştır. Salt-türev: kaynak tabloya dokunmaz.
import postgres from "postgres";
import { ENV } from "./_gecici/db.mjs";
const sql = postgres(ENV.DIRECT_URL, { ssl: "require", max: 1 });
console.log("Özet tazeleniyor…");
await sql`refresh materialized view concurrently public.offmarket_envanter_ozet_mv`;
const r = await sql`select count(*)::int n, sum(lead_sayisi)::int t from public.offmarket_envanter_ozet_mv`;
console.log("TAMAM ·", r[0].n, "county satırı ·", r[0].t, "lead");
await sql.end();
