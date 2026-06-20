// Dallas TX tam tarama: 514 gerçek tax-borçlu kayıt + Regrid Dallas kapsaması.
// Regrid owner/acres/landval/usedesc doldurur -> gerçek boş arsa dealleri.
// Çıktı: src/data/real-deals.json (snapshot — sayfa bunu okur, API'yi yakmaz).
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const TOK = process.env.REGRID_API_TOKEN;
const BASE = "https://app.regrid.com/api/v2";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (x) => (x || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const streetKey = (a) => norm(a).replace(/^\d+\s+/, "").split(",")[0].split(" ").slice(0, 2).join(" ");
const GOV = /CITY OF|COUNTY OF|\bISD\b|HOMEOWNERS|\bHOA\b|STATE OF|HOUSING AUTH|DISTRICT|CHURCH|ELECTRIC|RAILROAD/i;

async function typeahead(q) {
  try { const r = await fetch(`${BASE}/parcels/typeahead?query=${encodeURIComponent(q)}&token=${TOK}`); if (!r.ok) return []; const d = await r.json(); return d?.parcel_centroids?.features || []; } catch { return []; }
}
async function detail(uuid) {
  try { const r = await fetch(`${BASE}/parcels/${uuid}?token=${TOK}`); if (!r.ok) return null; const d = await r.json(); return (d?.parcels?.features || [])[0]?.properties?.fields || null; } catch { return null; }
}

const { data: cands } = await s
  .from("tax_delinquent_properties")
  .select("id,apn,property_address,owner_name,acres,judgment_amount,minimum_bid,sale_date,raw_url")
  .eq("state", "TX").eq("county", "DALLAS COUNTY")
  .not("property_address", "is", null)
  .limit(514);

console.log(`Dallas aday: ${cands?.length || 0}`);
const deals = [];
let scanned = 0, matched = 0, vacant = 0;
for (const l of cands || []) {
  scanned++;
  if (scanned % 50 === 0) console.log(`  ...${scanned}/${cands.length} (eşleşen:${matched}, deal:${deals.length})`);
  const parts = l.property_address.split(",").map(x => x.trim());
  const q = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
  const feats = await typeahead(q);
  await sleep(90);
  if (!feats.length) continue;
  const houseNo = (norm(l.property_address).match(/^(\d+)/) || [])[1];
  const want = streetKey(l.property_address);
  const pathOk = (f) => (f.properties?.path || "").toLowerCase().includes("/us/tx/dallas");
  const noOk = (f) => !houseNo || norm(f.properties?.address).startsWith(houseNo + " ");
  const stOk = (f) => streetKey(f.properties?.address) === want;
  const best = feats.find(f => pathOk(f) && noOk(f) && stOk(f)) || feats.find(f => pathOk(f) && noOk(f));
  if (!best?.properties?.ll_uuid) continue;
  matched++;

  const f = await detail(best.properties.ll_uuid);
  await sleep(90);
  if (!f) continue;

  const improv = Number(f.improvval) || 0;
  const landval = Number(f.landval) || 0;
  const parval = Number(f.parval) || 0;
  const acres = f.ll_gisacre != null ? Number(f.ll_gisacre) : null;
  const use = f.usedesc || "?";
  const value = landval || parval;
  const debt = Number(l.judgment_amount) || 0;
  const owner = f.owner || l.owner_name || "?";
  const isVacant = improv < 3000 && /VAC|VACANT|LAND|EXEMPT|AGRICUL|MOBILE HOME ON/i.test(use.toUpperCase());
  if (!isVacant || value <= 0) continue;
  vacant++;
  if (GOV.test(owner)) continue; // devlet/HOA alınamaz

  // TEKLİF modeli (wholesale/flip): borcu temizle + sahibe makul nakit, ama değerin altında.
  // taban = max(değerin %45'i, borç + $3k). Tavan = değerin %70'i.
  const floor = Math.max(Math.round(value * 0.45), debt + 3000);
  const offer = Math.min(floor, Math.round(value * 0.7));
  const spread = value - offer;
  if (spread <= 4000) continue; // anlamlı marj yoksa deal sayma

  const mapQ = encodeURIComponent(`${best.properties.address}, Dallas, TX`);
  deals.push({
    id: l.id,
    address: best.properties.address || l.property_address,
    owner,
    mailAddr: [f.mailadd, f.mailcity, f.mailstate].filter(Boolean).join(", ") || null,
    acres: acres != null ? Number(acres.toFixed(3)) : null,
    use,
    landValue: landval || null,
    totalAssessed: parval || null,
    improvValue: improv,
    taxDebt: debt,
    auctionDate: l.sale_date || null,
    lastSalePrice: Number(f.saleprice) || null,
    lastSaleDate: f.saledate || null,
    suggestedOffer: offer,
    estSpread: spread,
    apn: f.parcelnumb || l.apn,
    regridPath: best.properties.path,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${mapQ}`,
    regridUrl: `https://app.regrid.com${best.properties.path}`,
  });
}

deals.sort((a, b) => b.estSpread - a.estSpread);
console.log(`\nTarandı:${scanned}  eşleşen:${matched}  boş-arsa:${vacant}  DEAL:${deals.length}`);

const out = {
  generatedAt: "2026-06-20",
  source: "Dallas County DCAD (assessed values) via Regrid API + terralot tax-delinquent records",
  county: "Dallas County, TX",
  note: "Değerler county assessed (DCAD). Gerçek ve savunulabilir; piyasa değeri yakındır ama birebir değil. Top pick'ler emsalle teyit edilmeli.",
  count: deals.length,
  deals,
};
const dir = path.join(process.cwd(), "src", "data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "real-deals.json"), JSON.stringify(out, null, 2));
console.log(`-> src/data/real-deals.json yazıldı (${deals.length} deal)`);
console.log("\nEN İYİ 8 (spread'e göre):");
deals.slice(0, 8).forEach((d, i) => console.log(`${i + 1}. ${d.address} | değer $${d.landValue?.toLocaleString()} | borç $${d.taxDebt.toLocaleString()} | teklif $${d.suggestedOffer.toLocaleString()} | marj $${d.estSpread.toLocaleString()} | ${d.acres}ac`));
process.exit(0);
