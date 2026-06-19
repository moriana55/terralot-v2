// Ohio forfeited parselleri → geocode (Census) → skorla → Supabase tax_delinquent_properties.
// Migrate desenini (detId + scoreDeal/extraScores) birebir kullanır.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { liqFor, scoreDeal, extraScores, redemptionPenalty } = require('./scoring');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const detId = (key) => { const h = crypto.createHash('sha256').update(key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function geocode(addr) {
  if (!addr) return null;
  const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=' + encodeURIComponent(addr) + '&benchmark=Public_AR_Current&format=json';
  try {
    const r = await fetch(url);
    const j = await r.json();
    const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
    if (m && m.coordinates) return { lat: m.coordinates.y, lng: m.coordinates.x };
  } catch (e) { /* skip */ }
  return null;
}

(async () => {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ohio_forfeited.json'), 'utf8'));
  const LIMIT = process.env.PUSH_LIMIT ? +process.env.PUSH_LIMIT : rows.length;
  console.log(`Ohio push: ${Math.min(LIMIT, rows.length)} satır geocode+score+upsert...`);
  const out = [];
  let geo = 0;
  for (let i = 0; i < Math.min(LIMIT, rows.length); i++) {
    const r = rows[i];
    const g = await geocode(r.address);
    if (g) geo++;
    const source = 'TAX:OH';
    const liq = liqFor(r.state, r.county);
    const sc = scoreDeal({ value: r.value, bid: r.minimum_bid, source, ownerName: r.owner_name, ...liq });
    const ex = extraScores({ value: r.value, bid: r.minimum_bid, liq01: liq.liq01, source, ownerName: r.owner_name, hasCoords: !!g, acres: r.acres });
    out.push({
      id: detId('TAX|OH|' + (r.county || '') + '|' + (r.apn || '')),
      source, state: r.state || 'OH', county: r.county || null, apn: r.apn || null,
      owner_name: r.owner_name || null, property_address: r.address || null,
      acres: r.acres || null, minimum_bid: r.minimum_bid || null, judgment_amount: r.value || null,
      sale_date: null, scraped_at: new Date().toISOString(),
      lat: g ? g.lat : null, lng: g ? g.lng : null, dd_checked: false,
      final_score: Math.max(0, sc.deal_score - redemptionPenalty(r.state, source)),
      ...sc, ...ex,
    });
    if (i % 20 === 0) process.stdout.write(`\r  ${i}/${Math.min(LIMIT, rows.length)} (geocoded ${geo})  `);
    await sleep(90);
  }
  // Aynı id'yi (aynı county+apn) tekilleştir — batch içi ON CONFLICT çakışmasını önler
  const byId = new Map();
  for (const o of out) byId.set(o.id, o);
  const deduped = [...byId.values()];
  console.log(`\n  upsert ${deduped.length} benzersiz satır (${geo} koordinatlı, ${out.length - deduped.length} kopya elendi)...`);
  for (let i = 0; i < deduped.length; i += 200) {
    const { error } = await supabase.from('tax_delinquent_properties').upsert(deduped.slice(i, i + 200), { onConflict: 'id' });
    if (error) { console.error('UPSERT HATASI:', error.message); process.exit(1); }
  }
  console.log(`✅ ${out.length} Ohio parsel Supabase'e yazıldı, ${geo} tanesi koordinatlı → HARİTADA görünecek.`);
})();
