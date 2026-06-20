// Regrid enrichment pipeline testi — gerçek Harris lead'leri üzerinde.
// typeahead(address) -> en yakın centroid (stored lat/lng'e) -> ll_uuid -> detay.
import { createClient } from "@supabase/supabase-js";

const TOK = process.env.REGRID_API_TOKEN;
const BASE = "https://app.regrid.com/api/v2";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function dist(aLat, aLng, bLat, bLng) {
  const dLat = aLat - bLat, dLng = aLng - bLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

async function typeahead(query) {
  const url = `${BASE}/parcels/typeahead?query=${encodeURIComponent(query)}&token=${TOK}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  return d?.parcel_centroids?.features || d?.features || [];
}

async function detailByUuid(uuid) {
  const r = await fetch(`${BASE}/parcels/${uuid}?token=${TOK}`);
  if (!r.ok) return null;
  const d = await r.json();
  const f = (d?.parcels?.features || d?.features || [])[0];
  return f?.properties?.fields || null;
}

// GERÇEK kayıtlar: owner gerçek + apn GEO değil + address template değil + dönüm dolu
const { data: leads } = await s
  .from("tax_delinquent_properties")
  .select("apn,property_address,owner_name,lat,lng,acres,judgment_amount,minimum_bid,state,county")
  .not("owner_name", "is", null).not("owner_name", "ilike", "%unknown%")
  .not("apn", "ilike", "GEO-%")
  .not("property_address", "is", null).not("property_address", "ilike", "% Property, Texas%")
  .gt("acres", 0)
  .in("state", ["OH", "TX", "FL"])
  .limit(10);

console.log(`Test edilecek lead: ${leads?.length || 0}\n`);

for (const l of leads || []) {
  const q = `${l.property_address} Houston TX`;
  const feats = await typeahead(q);
  // stored lat/lng varsa en yakın centroid'i seç, yoksa ilk Harris/TX eşleşmesi
  let best = null;
  if (l.lat && l.lng && feats.length) {
    let bd = Infinity;
    for (const f of feats) {
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const d = dist(l.lat, l.lng, c[1], c[0]);
      if (d < bd) { bd = d; best = f; }
    }
  } else {
    best = feats.find((f) => /TX/i.test(f.properties?.context || "")) || feats[0];
  }

  if (!best) { console.log(`❌ ${l.property_address} -> typeahead boş`); continue; }
  const fields = await detailByUuid(best.properties.ll_uuid);
  if (!fields) { console.log(`❌ ${l.property_address} -> detay boş`); continue; }

  const acres = fields.ll_gisacre ?? fields.gisacre ?? null;
  const parval = fields.parval ?? null;
  const landval = fields.landval ?? null;
  const use = fields.usedesc ?? null;
  const matchAddr = fields.address;
  const ctx = best.properties.context;
  console.log(`✅ DB: ${l.property_address}`);
  console.log(`   Regrid eşleşme: ${matchAddr} (${ctx})`);
  console.log(`   dönüm=${acres}  toplam değer=$${parval}  arsa değeri=$${landval}  tip=${use}  yapım=${fields.yearbuilt}`);
  console.log(`   sahip(Regrid)=${fields.owner}  borç(DB)=$${l.judgment_amount}\n`);
}
process.exit(0);
