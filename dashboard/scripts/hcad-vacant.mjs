// SADECE BOŞ ARSA: Harris borçlu sahipler → HCAD'de sahip+sokak eşle → yapı değeri 0 olanlar (gerçek boş arsa).
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const HCAD = "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query";
const UA = "Mozilla/5.0";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SUFFIX = /\b(ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|LN|LANE|BLVD|CIR|CT|COURT|WAY|PL|PLACE|TRL|TER|PKWY|HWY)\.?$/i;

const ownerKey = (o) => (o || "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 2).join(" ");
const streetKey = (addr) => {
  const first = addr.split(",")[0].trim().replace(/^0\s+/, "");
  return first.replace(SUFFIX, "").trim().replace(/[#].*$/, "").trim().split(/\s+/).slice(0, 2).join(" ");
};

async function hcadByOwnerStreet(owner, street) {
  const ok = ownerKey(owner), sk = street;
  if (!ok || !sk) return [];
  const where = `owner_name_1 LIKE '${ok.replace(/'/g, "''")}%' AND site_str_name LIKE '${sk.replace(/'/g, "''")}%'`;
  const url = `${HCAD}?where=${encodeURIComponent(where)}&outFields=site_str_num,site_str_name,owner_name_1,land_value,bld_value,total_market_val,Acreage,land_sqft,land_use,state_class&returnGeometry=false&f=json`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return [];
    const d = await r.json();
    return d.features || [];
  } catch { return []; }
}

// Boş arsa adayları: property "0 " ile başlayan (ev numarası yok = boş lot)
const { data } = await s.from("tax_delinquent_properties")
  .select("owner_name,owner_address,property_address,county,judgment_amount,source")
  .eq("state", "TX").ilike("county", "%harris%")
  .not("owner_name", "is", null).not("owner_name", "ilike", "%unknown%")
  .not("owner_address", "is", null).not("owner_address", "ilike", "%unknown%")
  .ilike("property_address", "0 %");

const rows = (data || []);
console.log(`"0 ADDRESS" boş arsa adayı: ${rows.length}\n`);

const deals = [];
let scanned = 0;
for (const r of rows) {
  scanned++;
  const feats = await hcadByOwnerStreet(r.owner_name, streetKey(r.property_address));
  await sleep(90);
  // gerçekten BOŞ olanı seç: yapı değeri 0
  const vacant = feats.find(f => (Number(f.attributes.bld_value) || 0) === 0 && (Number(f.attributes.land_value) || 0) > 0);
  if (!vacant) continue;
  const a = vacant.attributes;
  deals.push({
    owner: r.owner_name,
    mailAddr: r.owner_address,
    property: r.property_address,
    hcadAddr: `${a.site_str_num || "0"} ${a.site_str_name || ""}`.trim(),
    landValue: Number(a.land_value) || 0,      // GERÇEK arsa değeri (boş = bu değer)
    marketValue: Number(a.total_market_val) || 0,
    bldValue: Number(a.bld_value) || 0,         // 0 = boş teyit
    acreage: a.Acreage || (a.land_sqft ? (Number(a.land_sqft) / 43560).toFixed(3) : null),
    landUse: a.land_use,
    debt: Number(r.judgment_amount) || 0,
    estate: /ESTATE OF/i.test(r.owner_name),
  });
  console.log(`✅ ${deals.length}  ${r.property_address}  | sahip:${r.owner_name}  | ARSA DEĞERİ:$${(Number(a.land_value)||0).toLocaleString()}  | borç:$${(Number(r.judgment_amount)||0).toLocaleString()}  | bld:$${a.bld_value}(boş)`);
}

deals.sort((a, b) => b.landValue - a.landValue);
console.log(`\nTarandı:${scanned}  GERÇEK BOŞ ARSA (yapı=0, değer>0):${deals.length}`);

const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
let csv = "Sahip,Posta Adresi,Bos Arsa Adresi,Arsa Degeri (HCAD),Vergi Borcu,Donum,Kullanim,Not\n";
deals.forEach(d => { csv += [esc(d.owner), esc(d.mailAddr), esc(d.property), esc(d.landValue), esc(d.debt), esc(d.acreage), esc(d.landUse), esc(d.estate ? "MIRAS" : "")].join(",") + "\n"; });
fs.writeFileSync("/Users/yigiterturk/Desktop/harris-BOS-ARSALAR.csv", csv);
console.log(`-> ${deals.length} BOŞ ARSA: Desktop/harris-BOS-ARSALAR.csv`);
process.exit(0);
