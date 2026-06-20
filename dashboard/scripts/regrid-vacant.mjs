// 10 GERÇEK boş arsa: ev numaralı gerçek adresleri typeahead ile eşle,
// Regrid usedesc/improvval ile BOŞ olanları seç (yapı değeri ~0 = arsa).
import { createClient } from "@supabase/supabase-js";

const TOK = process.env.REGRID_API_TOKEN;
const BASE = "https://app.regrid.com/api/v2";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function typeahead(q) {
  try {
    const r = await fetch(`${BASE}/parcels/typeahead?query=${encodeURIComponent(q)}&token=${TOK}`);
    if (!r.ok) return [];
    const d = await r.json();
    return d?.parcel_centroids?.features || [];
  } catch { return []; }
}
async function detail(uuid) {
  try {
    const r = await fetch(`${BASE}/parcels/${uuid}?token=${TOK}`);
    if (!r.ok) return null;
    const d = await r.json();
    return (d?.parcels?.features || [])[0]?.properties?.fields || null;
  } catch { return null; }
}

// streetadı normalize (eşleşme kontrolü için)
const norm = (x) => (x || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const streetKey = (addr) => norm(addr).replace(/^\d+\s+/, "").split(",")[0].split(" ").slice(0, 2).join(" ");

// Ev numaralı (typeahead'lenebilir) gerçek kayıtlar + dönüm
const { data: cands } = await s
  .from("tax_delinquent_properties")
  .select("apn,property_address,owner_name,acres,state,county,judgment_amount,minimum_bid,raw_url")
  .not("owner_name", "is", null).not("owner_name", "ilike", "%unknown%")
  .not("apn", "ilike", "GEO-%")
  .not("property_address", "is", null)
  .not("property_address", "ilike", "0 %")
  .not("property_address", "ilike", "% Property, Texas%")
  .gt("acres", 0)
  .in("state", ["OH", "FL", "TX", "GA", "TN", "NC"])
  .limit(500);

console.log(`Taranacak aday: ${cands?.length || 0}\n`);

const deals = [];
let scanned = 0, matched = 0;
for (const l of cands || []) {
  if (deals.length >= 10) break;
  scanned++;
  // typeahead formatı: "{adres}, {şehir}" — state/zip eklenince boş dönüyor
  const parts = l.property_address.split(",").map(x => x.trim());
  const q = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
  const feats = await typeahead(q);
  await sleep(120);
  if (!feats.length) continue;
  // SIKI eşleşme: path doğru eyalet+ilçeyi içermeli + ev no birebir + street adı eşleşmeli
  const houseNo = (norm(l.property_address).match(/^(\d+)/) || [])[1];
  const want = streetKey(l.property_address);
  const countySlug = norm(l.county).replace(/ COUNTY$/, "").replace(/\s+/g, "-").toLowerCase();
  const stateSlug = l.state.toLowerCase();
  const pathOk = (f) => (f.properties?.path || "").toLowerCase().includes(`/us/${stateSlug}/${countySlug}`);
  const noOk = (f) => !houseNo || norm(f.properties?.address).startsWith(houseNo + " ");
  const stOk = (f) => streetKey(f.properties?.address) === want;
  // en katı: path + ev no + street; gevşetme YOK (yanlış eşleşmektense atla)
  const best = feats.find(f => pathOk(f) && noOk(f) && stOk(f))
            || feats.find(f => pathOk(f) && noOk(f));
  if (!best?.properties?.ll_uuid) continue;
  matched++;

  const f = await detail(best.properties.ll_uuid);
  await sleep(120);
  if (!f) continue;

  const improv = Number(f.improvval) || 0;
  const landval = Number(f.landval) || 0;
  const parval = Number(f.parval) || 0;
  const use = (f.usedesc || "").toUpperCase();
  const bldg = f.ll_bldg_count;
  // BOŞ ARSA kriteri: yapı değeri yok + (kullanım vacant/land veya bina yok)
  const isVacant = improv < 3000 && (bldg == null || bldg === 0 || /VAC|VACANT|LAND|EXEMPT/.test(use));
  if (!isVacant) continue;

  const value = landval || parval;
  if (value <= 0) continue;

  const debt = Number(l.judgment_amount) || 0;
  const offer = Math.max(Math.round(value * 0.55), debt ? Math.round(debt * 1.1) : 0);

  deals.push({
    state: l.state, county: l.county,
    addr: f.address || l.property_address,
    owner: f.owner || l.owner_name,
    mailadd: f.mailadd || null,
    acres: f.ll_gisacre ? Number(f.ll_gisacre).toFixed(3) : Number(l.acres).toFixed(3),
    use: f.usedesc || "?",
    landval, parval, improv, debt, offer,
    margin: value - offer,
    uuid: best.properties.ll_uuid,
    path: best.properties.path,
  });
  console.log(`✅ ${deals.length}/10  [${l.state}] ${f.address}  land=$${landval.toLocaleString()}  use=${f.usedesc}`);
}

console.log(`\nTarandı: ${scanned}  Regrid eşleşti: ${matched}  BOŞ ARSA bulundu: ${deals.length}\n`);
console.log("=== 10 BOŞ ARSA — gerçek Regrid değeri + teklif ===\n");
deals.forEach((d, i) => {
  console.log(`${i + 1}. [${d.state}] ${d.addr} (${d.county})`);
  console.log(`   Sahip: ${d.owner}${d.mailadd ? ` | posta: ${d.mailadd}` : ""}`);
  console.log(`   ${d.acres} acre | ${d.use} | yapı değeri: $${d.improv.toLocaleString()} (boş)`);
  console.log(`   ARSA DEĞERİ (Regrid assessed): $${d.landval.toLocaleString()} | vergi borcu: $${d.debt.toLocaleString()}`);
  console.log(`   >>> ÖNERİLEN TEKLİF: $${d.offer.toLocaleString()}  (tahmini marj ~$${d.margin.toLocaleString()})`);
  console.log("");
});

// JSON çıktısını da kaydet (sayfaya bağlamak için)
const fs = await import("fs");
fs.writeFileSync("/tmp/vacant-deals.json", JSON.stringify(deals, null, 2));
console.log("-> /tmp/vacant-deals.json yazıldı");
process.exit(0);
