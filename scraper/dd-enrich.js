/**
 * Due-diligence enrichment — runs road access (Overpass) + flood (FEMA) on the
 * top deals and writes road_access / flood_score / final_score back to Supabase.
 *
 *   node dd-enrich.js            # top 150 unchecked by deal_score
 *   DD_LIMIT=300 node dd-enrich.js
 *
 * Road access (Overpass) works worldwide. FEMA flood blocks non-US IPs
 * (ECONNRESET) — it's attempted but skipped gracefully; runs for real when
 * executed from a US host (Vercel US / US proxy).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { redemptionPenalty } = require('./penalties');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LIMIT = parseInt(process.env.DD_LIMIT || '150', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Overpass requires a User-Agent; rotate mirrors on failure.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const UA = 'terralot-dd/1.0 (land due-diligence; contact sales@nocturndev.com)';
const ROAD_TYPES = 'motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|track';

// Returns { access: 'direct'|'near'|'landlocked', surface }
async function roadCheck(lat, lng) {
  const q = (radius) =>
    `[out:json][timeout:20];way(around:${radius},${lat},${lng})[highway~"^(${ROAD_TYPES})$"];out tags 1;`;
  async function hit(radius) {
    let lastErr;
    for (const url of OVERPASS_MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: 'data=' + encodeURIComponent(q(radius)),
          signal: AbortSignal.timeout(30000),
        });
        if (res.status === 429 || res.status === 504) { lastErr = new Error('overpass ' + res.status); await sleep(3000); continue; }
        if (!res.ok) throw new Error('overpass ' + res.status);
        const j = await res.json();
        return j.elements && j.elements[0] ? j.elements[0] : null;
      } catch (e) { lastErr = e; await sleep(1500); }
    }
    throw lastErr || new Error('overpass all mirrors failed');
  }
  const near = await hit(80); // on/at the parcel
  if (near) return { access: 'direct', surface: near.tags?.highway === 'track' ? 'dirt' : 'paved' };
  const far = await hit(1200); // road within ~1.2km
  if (far) return { access: 'near', surface: far.tags?.highway === 'track' ? 'dirt' : 'paved' };
  return { access: 'landlocked', surface: 'none' };
}

// FEMA flood (US only). Returns score 0–95 or null on failure/unknown.
async function floodCheck(lat, lng) {
  try {
    const url =
      'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query' +
      `?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326` +
      '&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json';
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const j = await res.json();
    const z = (j.features?.[0]?.attributes?.FLD_ZONE || '').toUpperCase();
    if (!z) return 5; // queried OK, no zone => minimal
    if (z.startsWith('V')) return 95;
    if (z.startsWith('A')) return 80;
    if (z === 'D') return 50;
    if (z === 'X') return 5;
    return 40;
  } catch {
    return null; // non-US IP / timeout => unknown, no penalty
  }
}

function penalty(road, flood) {
  let p = 0;
  if (road.access === 'landlocked') p += 30; // biggest land killer
  else if (road.surface === 'dirt' && road.access === 'near') p += 6;
  if (flood != null) {
    if (flood >= 80) p += 20;
    else if (flood >= 35) p += 8;
  }
  return p;
}

(async () => {
  const { data, error } = await supabase
    .from('tax_delinquent_properties')
    .select('id,deal_score,lat,lng,state,source')
    .eq('dd_checked', false)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('deal_score', { ascending: false })
    .limit(LIMIT);
  if (error) { console.error('Sorgu hatası:', error.message); process.exit(1); }
  console.log(`DD enrichment: ${data.length} deal kontrol edilecek (top deal_score, koordinatlı).`);

  let landlocked = 0, floodHits = 0, done = 0, failed = 0;
  for (const row of data) {
    let road;
    try {
      road = await roadCheck(row.lat, row.lng);
    } catch (e) {
      failed++;
      console.error('  road err (atlandı, sonraki run\'da denenir):', e.message);
      await sleep(2500);
      continue; // don't mark dd_checked — retry next run
    }
    const flood = await floodCheck(row.lat, row.lng);
    const pen = penalty(road, flood) + redemptionPenalty(row.state, row.source);
    const final = Math.max(0, Math.round((row.deal_score || 0) - pen));
    if (road.access === 'landlocked') landlocked++;
    if (flood != null && flood >= 35) floodHits++;

    const { error: upErr } = await supabase
      .from('tax_delinquent_properties')
      .update({ road_access: road.access, flood_score: flood, dd_checked: true, final_score: final })
      .eq('id', row.id);
    if (upErr) console.error('  update err:', upErr.message);
    else done++;
    await sleep(2000); // gentle with Overpass to avoid rate-limit bans
  }
  console.log(`✅ ${done} işlendi | ${failed} başarısız (sonra denenecek) | landlocked: ${landlocked} | sel(35+): ${floodHits}`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
