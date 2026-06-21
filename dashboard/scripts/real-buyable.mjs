// GERÇEK alınabilir arsalar: minimum_bid (gerçek ihale alış bedeli) + DCAD değeri (Regrid).
// UYDURMA YOK. Sadece value > min_bid olan gerçek fırsatlar.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const TOK = process.env.REGRID_API_TOKEN;
const BASE = "https://app.regrid.com/api/v2";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (x) => (x || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const streetKey = (a) => norm(a).replace(/^\d+\s+/, "").split(",")[0].split(" ").slice(0, 2).join(" ");

async function typeahead(q) {
  try { const r = await fetch(`${BASE}/parcels/typeahead?query=${encodeURIComponent(q)}&token=${TOK}`); if (!r.ok) return []; const d = await r.json(); return d?.parcel_centroids?.features || []; } catch { return []; }
}
async function detail(uuid) {
  try { const r = await fetch(`${BASE}/parcels/${uuid}?token=${TOK}`); if (!r.ok) return null; const d = await r.json(); return (d?.parcels?.features || [])[0]?.properties?.fields || null; } catch { return null; }
}

// Gerçek alış bedeli (min_bid) olan Dallas kayıtları — SALE/STRUCK OFF öncelik (ihaleden direkt alınır)
const { data: cands } = await s
  .from("tax_delinquent_properties")
  .select("id,property_address,owner_name,owner_address,minimum_bid,judgment_amount,sale_date,source,acres")
  .eq("state", "TX").eq("county", "DALLAS COUNTY")
  .not("minimum_bid", "is", null).gt("minimum_bid", 0)
  .not("property_address", "is", null)
  .order("minimum_bid", { ascending: true })
  .limit(180);

console.log(`min_bid'li aday: ${cands?.length || 0}`);
const deals = [];
let scanned = 0, matched = 0;
for (const l of cands || []) {
  if (deals.length >= 15) break;
  scanned++;
  const parts = l.property_address.split(",").map(x => x.trim());
  const q = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
  const feats = await typeahead(q); await sleep(90);
  if (!feats.length) continue;
  const houseNo = (norm(l.property_address).match(/^(\d+)/) || [])[1];
  const want = streetKey(l.property_address);
  const pathOk = (f) => (f.properties?.path || "").toLowerCase().includes("/us/tx/dallas");
  const noOk = (f) => !houseNo || norm(f.properties?.address).startsWith(houseNo + " ");
  const stOk = (f) => streetKey(f.properties?.address) === want;
  const best = feats.find(f => pathOk(f) && noOk(f) && stOk(f)) || feats.find(f => pathOk(f) && noOk(f));
  if (!best?.properties?.ll_uuid) continue;
  matched++;
  const f = await detail(best.properties.ll_uuid); await sleep(90);
  if (!f) continue;

  const landval = Number(f.landval) || 0;
  const parval = Number(f.parval) || 0;
  const value = parval || landval; // toplam değer (bina varsa dahil)
  const minBid = Number(l.minimum_bid) || 0;
  if (value <= 0 || minBid <= 0) continue;
  if (value < minBid * 2) continue; // GERÇEK fırsat: değer alış bedelinin en az 2 katı

  deals.push({
    address: f.address || l.property_address,
    type: l.source.replace("TAX:LGBS:", "").replace("TAX:PBFCM:", ""),
    minBid,                                   // GERÇEK ihale alış bedeli
    dcadValue: value,                          // GERÇEK DCAD değeri
    landval, improv: Number(f.improvval) || 0,
    realSpread: value - minBid,                // GERÇEK fark (değer − alış)
    acres: f.ll_gisacre ? Number(f.ll_gisacre).toFixed(3) : (l.acres || "?"),
    use: f.usedesc || "?",
    owner: f.owner || l.owner_name || null,
    mailAddr: [f.mailadd, f.mailcity, f.mailstate].filter(Boolean).join(", ") || l.owner_address || null,
    saleDate: l.sale_date || null,
    taxDebt: Number(l.judgment_amount) || 0,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((f.address || l.property_address) + ", Dallas, TX")}`,
  });
  console.log(`✅ ${deals.length}  ${f.address}  alış:$${minBid.toLocaleString()}  değer:$${value.toLocaleString()}  spread:$${(value-minBid).toLocaleString()}  [${deals[deals.length-1].type}]`);
}

deals.sort((a, b) => b.realSpread - a.realSpread);
console.log(`\nTarandı:${scanned} eşleşti:${matched} GERÇEK FIRSAT:${deals.length}`);
console.log("\n========== GERÇEK ALINABİLİR ARSALAR ==========");
deals.forEach((d, i) => {
  console.log(`\n${i + 1}. ${d.address}  (${d.acres} ac · ${d.use})`);
  console.log(`   ALIŞ (ihale taban): $${d.minBid.toLocaleString()}   |   DEĞER (DCAD): $${d.dcadValue.toLocaleString()}   |   FARK: $${d.realSpread.toLocaleString()}`);
  console.log(`   Tür: ${d.type}${d.saleDate ? ` · ihale ${d.saleDate}` : ""}${d.owner ? ` · sahip: ${d.owner}` : ""}`);
});
fs.writeFileSync("/tmp/real-buyable.json", JSON.stringify(deals, null, 2));
console.log(`\n-> /tmp/real-buyable.json (${deals.length})`);
process.exit(0);
