// 288 Harris borçlu sahibe HCAD'den GERÇEK değer çek (ücretsiz, kamu).
// land_value + total_market_val. UYDURMA YOK.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const HCAD = "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query";
const UA = "Mozilla/5.0";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SUFFIX = /\b(ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|LN|LANE|BLVD|CIR|CT|COURT|WAY|PL|PLACE|TRL|TER|PKWY|HWY)\.?$/i;

async function hcadValue(propAddr) {
  // "7211 BROWNWOOD ST, HOUSTON, TX, 77020" -> num=7211, street=BROWNWOOD
  const first = propAddr.split(",")[0].trim();
  const m = first.match(/^(\d+)\s+(.+)$/);
  if (!m) return null;
  const num = m[1];
  let street = m[2].replace(SUFFIX, "").trim().replace(/[#].*$/, "").trim();
  const streetKey = street.split(/\s+/).slice(0, 2).join(" ");
  if (!streetKey) return null;
  const where = `site_str_num='${num}' AND site_str_name LIKE '${streetKey.replace(/'/g, "''")}%'`;
  const url = `${HCAD}?where=${encodeURIComponent(where)}&outFields=land_value,total_market_val,total_appraised_val,Acreage,land_use,state_class,owner_name_1&returnGeometry=false&f=json`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const d = await r.json();
    const f = (d.features || [])[0];
    if (!f) return null;
    const a = f.attributes;
    return {
      landValue: Number(a.land_value) || 0,
      marketValue: Number(a.total_market_val) || 0,
      appraised: Number(a.total_appraised_val) || 0,
      acreage: a.Acreage || null,
      landUse: a.land_use || null,
      stateClass: a.state_class || null,
      hcadOwner: a.owner_name_1 || null,
    };
  } catch { return null; }
}

const { data } = await s.from("tax_delinquent_properties")
  .select("owner_name,owner_address,property_address,county,judgment_amount,source")
  .eq("state", "TX").ilike("county", "%harris%")
  .not("owner_name", "is", null).not("owner_name", "ilike", "%unknown%")
  .not("owner_address", "is", null).not("owner_address", "ilike", "%unknown%")
  .order("judgment_amount", { ascending: true });

const rows = (data || []).filter(r => r.property_address && r.owner_address);
console.log(`Harris mail-atılabilir kayıt: ${rows.length}\n`);

const deals = [];
let scanned = 0, matched = 0;
for (const r of rows) {
  scanned++;
  if (scanned % 40 === 0) console.log(`  ...${scanned}/${rows.length} (değer bulunan: ${matched})`);
  const v = await hcadValue(r.property_address);
  await sleep(80);
  if (!v || v.marketValue <= 0) continue;
  matched++;
  const debt = Number(r.judgment_amount) || 0;
  deals.push({
    owner: r.owner_name,
    mailAddr: r.owner_address,
    property: r.property_address,
    debt,
    landValue: v.landValue,
    marketValue: v.marketValue,           // GERÇEK HCAD piyasa değeri
    acreage: v.acreage,
    landUse: v.landUse,
    spreadVsDebt: v.marketValue - debt,    // değer − borç (gerçek)
    type: (r.source || "").replace("TAX:LGBS:", "").replace("TAX:PBFCM:", ""),
    estate: /ESTATE OF/i.test(r.owner_name),
    vacant: /^0 /.test(r.property),
  });
}

// borca göre değeri yüksek olanlar üstte (en iyi fırsat: değer >> borç)
deals.sort((a, b) => (b.marketValue - b.debt) - (a.marketValue - a.debt));

console.log(`\nTarandı:${scanned}  HCAD'de değer bulundu:${matched}\n`);
console.log("===== GERÇEK DEĞERLİ ARSA SAHİPLERİ (en iyi 15) =====");
deals.slice(0, 15).forEach((d, i) => {
  console.log(`\n${i + 1}. ${d.property}${d.estate ? " [MİRAS]" : ""}${d.vacant ? " [BOŞ ARSA]" : ""}`);
  console.log(`   Sahip: ${d.owner}  | posta: ${d.mailAddr}`);
  console.log(`   PİYASA DEĞERİ: $${d.marketValue.toLocaleString()}  (arsa: $${d.landValue.toLocaleString()})  | VERGİ BORCU: $${d.debt.toLocaleString()}  | fark: $${d.spreadVsDebt.toLocaleString()}`);
});

// CSV
const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
let csv = "Sahip,Posta Adresi,Arsa,Piyasa Degeri (HCAD),Arsa Degeri,Vergi Borcu,Deger-Borc Fark,Donum,Tur,Not\n";
deals.forEach(d => { csv += [esc(d.owner), esc(d.mailAddr), esc(d.property), esc(d.marketValue), esc(d.landValue), esc(d.debt), esc(d.spreadVsDebt), esc(d.acreage), esc(d.type), esc([d.estate ? "MIRAS" : "", d.vacant ? "BOS-ARSA" : ""].filter(Boolean).join("/"))].join(",") + "\n"; });
fs.writeFileSync("/Users/yigiterturk/Desktop/harris-degerli-arsalar.csv", csv);
fs.writeFileSync("/tmp/hcad-deals.json", JSON.stringify(deals, null, 2));
console.log(`\n-> ${deals.length} arsa GERÇEK değerle: Desktop/harris-degerli-arsalar.csv`);
process.exit(0);
