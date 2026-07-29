// DB'den yalnız kimlik sütunlarını çeker (hızlı) → karşılaştırma için
import { sb } from "./db.mjs";
import fs from "node:fs";
const { count } = await sb.from("offmarket_leads").select("*", { count: "exact", head: true });
const SAYFA = 10000; const out = [];
for (let off = 0; off < count; off += SAYFA) {
  const { data, error } = await sb.from("offmarket_leads").select("lead_id,state,county,region,apn,source")
    .order("lead_id", { ascending: true }).range(off, off + SAYFA - 1);
  if (error) throw new Error(error.message);
  if (!data.length) break;
  out.push(...data);
}
fs.writeFileSync("scripts/_gecici/db-anahtarlar.json", JSON.stringify(out));
console.log("çekilen:", out.length, "/", count);
