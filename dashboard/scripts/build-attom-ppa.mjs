// Offline: ATTOM'dan BÖLGE bazında gerçek satılmış-arsa $/acre medyanı hesaplar
// ve src/data/attom-ppa.json'a yazar. Route bu JSON'u okur (canlı ATTOM çağrısı
// her istekte yapılmaz). Yeniden çalıştırınca veriyi tazeler.
//
// Çalıştır: ATTOM_API_KEY=... node scripts/build-attom-ppa.mjs
//   (key .env.local'de varsa: node -r dotenv/config ... ya da elle ver)

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.ATTOM_API_KEY;
if (!KEY) { console.error("ATTOM_API_KEY yok"); process.exit(1); }
const B = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
const H = { apikey: KEY, Accept: "application/json" };

const med = (a) => { if (!a.length) return null; const b=[...a].sort((x,y)=>x-y); const m=Math.floor(b.length/2); return b.length%2?b[m]:(b[m-1]+b[m])/2; };
const sanePpa = (p) => p >= 200 && p <= 40000; // raw land makul $/acre bandı
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Bölge → temsili koordinat (lat/lng olan kaynaklar: mohave, propstream NM) ──
function regionPoints() {
  const map = new Map(); // "ST|REGION" -> {lat,lng,state,region}
  const add = (state, region, lat, lng) => {
    if (!state || !region || lat == null || lng == null) return;
    const k = `${state}|${region}`;
    if (!map.has(k)) map.set(k, { state, region, lat, lng });
  };
  const mohave = JSON.parse(readFileSync("./src/data/mohave-offmarket.json", "utf8")).rows || [];
  for (const r of mohave) add("AZ", r.region, r.lat, r.lng);
  try {
    const nm = JSON.parse(readFileSync("./src/data/import-propstream-nm-luna.json", "utf8")).rows || [];
    for (const r of nm) add((r.state || "NM").toUpperCase(), r.region || r.county, r.lat, r.lng);
  } catch {}
  return [...map.values()];
}

async function regionPpa(lat, lng) {
  // 1) yakın satışlar
  const r = await fetch(`${B}/sale/snapshot?latitude=${lat}&longitude=${lng}&radius=10&pagesize=25`, { headers: H });
  if (!r.ok) return { ppa: null, n: 0, raw: 0 };
  const j = await r.json();
  const all = (j.property || []).filter(x => /vacant|land/i.test(String(x.summary?.propertyType || "")) && Number(x.sale?.amount?.saleamt) > 0);
  // 2) bulk scrub (aynı tutar+tarih tek temsilci)
  const seen = new Map();
  for (const x of all) { const k = x.sale.amount.saleamt + "|" + x.sale.salesearchdate; if (!seen.has(k)) seen.set(k, x); }
  const clean = [...seen.values()].slice(0, 12);
  // 3) her comp icin sqft -> acre -> $/acre (sane)
  const ppas = [];
  for (const c of clean) {
    try {
      const d = await fetch(`${B}/property/expandedprofile?attomid=${c.identifier.attomId}`, { headers: H });
      const dj = await d.json();
      const sqft = Number(dj.property?.[0]?.lot?.lotSize2 || 0);
      if (sqft > 0) { const ac = sqft / 43560; const ppa = c.sale.amount.saleamt / ac; if (sanePpa(ppa)) ppas.push(ppa); }
      await sleep(120);
    } catch {}
  }
  return { ppa: med(ppas) ? Math.round(med(ppas)) : null, n: ppas.length, raw: all.length };
}

const points = regionPoints();
console.log(`${points.length} bölge işlenecek...`);
const out = {};
for (const p of points) {
  const { ppa, n, raw } = await regionPpa(p.lat, p.lng);
  if (ppa && n >= 3) { out[`${p.state}|${p.region}`] = { ppa, n }; console.log(`✓ ${p.state}|${p.region}: $${ppa}/ac (${n} comp)`); }
  else console.log(`· ${p.state}|${p.region}: yetersiz (n=${n}, raw=${raw}) → comp gerekli`);
  await sleep(150);
}
writeFileSync("./src/data/attom-ppa.json", JSON.stringify({ generatedAt: new Date().toISOString(), source: "ATTOM sale/snapshot + expandedprofile (sqft→acre), bulk-scrubbed", ppa: out }, null, 2));
console.log(`\nYazıldı: src/data/attom-ppa.json · ${Object.keys(out).length} bölge gerçek $/acre`);
