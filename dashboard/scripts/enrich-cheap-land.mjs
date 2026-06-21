// 40 ucuz boş arsayı HCAD'den APN ile zenginleştir: dönüm + değer + boş teyidi.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const HCAD = "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query";
const UA = "Mozilla/5.0";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function byApn(apn) {
  const url = `${HCAD}?where=${encodeURIComponent(`acct_num='${apn}'`)}&outFields=Acreage,land_sqft,land_value,total_market_val,bld_value,land_use&returnGeometry=false&f=json`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const d = await r.json();
    const a = (d.features || [])[0]?.attributes;
    if (!a) return null;
    const sqft = Number(a.land_sqft) || 0;
    const acres = a.Acreage ? Number(a.Acreage) : (sqft ? +(sqft / 43560).toFixed(3) : null);
    return {
      acres, sqft,
      landValue: Number(a.land_value) || 0,
      marketValue: Number(a.total_market_val) || 0,
      bldValue: Number(a.bld_value) || 0,
      landUse: a.land_use || null,
    };
  } catch { return null; }
}

// mevcut JSON'daki 40 deal'i id->apn ile eşlemek için DB'den apn çek
const { data: src } = await s.from("tax_delinquent_properties")
  .select("id,apn,property_address")
  .ilike("property_address", "0 %")
  .not("owner_name", "is", null).not("owner_name", "ilike", "%unknown%").not("owner_name", "ilike", "%county of%")
  .not("owner_address", "is", null).not("owner_address", "ilike", "%unknown%")
  .order("judgment_amount", { ascending: true });
const apnById = Object.fromEntries((src || []).map(r => [r.id, r.apn]));

const j = JSON.parse(fs.readFileSync("src/data/cheap-land.json", "utf8"));
let enriched = 0;
for (const d of j.deals) {
  const apn = apnById[d.id];
  if (!apn) continue;
  const v = await byApn(apn);
  await sleep(120);
  if (!v) continue;
  d.acres = v.acres;
  d.sqft = v.sqft;
  d.landValue = v.landValue;      // GERÇEK HCAD arsa değeri
  d.marketValue = v.marketValue;
  d.vacant = v.bldValue === 0;    // boş teyidi
  d.landUse = v.landUse;
  enriched++;
  console.log(`✓ ${d.property} | ${v.acres}ac | değer:$${v.landValue.toLocaleString()} | boş:${v.bldValue === 0}`);
}
j.enrichedAt = "2026-06-21";
j.valueSource = "HCAD (Harris County Appraisal District) — APN ile, kamu/ücretsiz";
fs.writeFileSync("src/data/cheap-land.json", JSON.stringify(j, null, 2));
console.log(`\nzenginleşen: ${enriched}/${j.deals.length}`);
process.exit(0);
