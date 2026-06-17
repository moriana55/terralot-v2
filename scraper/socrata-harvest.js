/**
 * Nationwide tax-sale / delinquent-land harvester via the Socrata Discovery API.
 * Finds open datasets across every US state/county/city Socrata portal, maps
 * their (wildly varying) schemas heuristically, scores them, and upserts into
 * Supabase as source SOCRATA:<domain>.  Free, ToS-friendly, no anti-bot.
 *
 *   node socrata-harvest.js
 *   SOCRATA_ROWS=300 SOCRATA_DATASETS=40 node socrata-harvest.js
 */
require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { liqFor, scoreDeal, extraScores, redemptionPenalty } = require('./scoring');
const detId = (key) => { const h = crypto.createHash('sha256').update(key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`; };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ROWS = parseInt(process.env.SOCRATA_ROWS || '300', 10);
const MAX_DATASETS = parseInt(process.env.SOCRATA_DATASETS || '100', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEARCH_TERMS = ['tax sale', 'tax delinquent', 'delinquent tax', 'tax foreclosure', 'tax deed', 'surplus property', 'land sale', 'adjudicated property', 'scavenger sale', 'sheriff sale', 'tax lien', 'tax certificate', 'foreclosed property'];
const NAME_OK = /delinqu|tax.?sale|tax.?deed|foreclos|adjudicat|default|surplus.?propert|scavenger|struck.?off|tax.?lien|sheriff.?sale|tax.?certificat/i;
const NAME_BAD = /sales.?(and|&).?use|use.?tax|conveyance|residential.?sales|sales.?tax|estimated|gross.?receipt|salary|budget|employee|crime|health|covid|permit|license|vehicle|payroll|vendor|expenditure|311|inspection|hotel|lodging/i;

const STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);
// Known city/county Socrata portals whose domain hides the state.
const DOMAIN_STATE = {
  'brla.gov': 'LA', 'nola.gov': 'LA', 'data.nola.gov': 'LA',
  'norfolk.gov': 'VA', 'transparentrichmond.org': 'CA', 'data.oaklandca.gov': 'CA',
  'cityofchicago.org': 'IL', 'cookcountyil.gov': 'IL', 'datacatalog.cookcountyil.gov': 'IL',
  'howardcountymd.gov': 'MD', 'princegeorgescountymd.gov': 'MD', 'baltimorecity.gov': 'MD',
  'sonomacounty.ca.gov': 'CA', 'lacity.org': 'CA', 'sandiego.gov': 'CA', 'sfgov.org': 'CA',
  'clermontauditor.org': 'OH', 'nassaucountyny.gov': 'NY', 'cityofnewyork.us': 'NY',
  'kingcounty.gov': 'WA', 'austintexas.gov': 'TX', 'dallasopendata.com': 'TX',
  'detroitmi.gov': 'MI', 'phila.gov': 'PA', 'boston.gov': 'MA', 'memphistn.gov': 'TN',
  'nashville.gov': 'TN', 'jerseycitynj.gov': 'NJ', 'kcmo.gov': 'MO', 'stlouis-mo.gov': 'MO',
};
function stateFromDomain(d) {
  const m = (d || '').toLowerCase();
  for (const [dom, st] of Object.entries(DOMAIN_STATE)) if (m.includes(dom)) return st;
  let x = m.match(/\.([a-z]{2})\.gov$/); if (x && STATES.has(x[1].toUpperCase())) return x[1].toUpperCase(); // data.ny.gov
  x = m.match(/county([a-z]{2})[.]/); if (x && STATES.has(x[1].toUpperCase())) return x[1].toUpperCase(); // cookcountyil.
  x = m.match(/\.([a-z]{2})\.us$/); if (x && STATES.has(x[1].toUpperCase())) return x[1].toUpperCase();
  x = m.match(/([a-z]{2})\.gov$/); if (x && STATES.has(x[1].toUpperCase())) return x[1].toUpperCase();
  return null;
}

const num = (v) => { if (v == null) return null; const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const pick = (cols, re) => cols.find((c) => re.test(c)) || null;

function buildMapper(sampleRow) {
  const cols = Object.keys(sampleRow);
  return {
    value: pick(cols, /apprais|assess|market.?val|total.?val|fair.?market|^value$|land.?val/i),
    bid: pick(cols, /min.*bid|minimum|opening|amount.?due|tax.?due|total.?tax|judgment|sale.?amount|bid.?amount|delinquent.?amount|balance|total.?owed/i),
    county: pick(cols, /county/i),
    state: pick(cols, /^state$|^st$|state.?name/i),
    owner: pick(cols, /owner|taxpayer|grantee|defendant/i),
    address: pick(cols, /situs|property.?addr|prop.?addr|^address$|location.?addr|street/i),
    acres: pick(cols, /acre|lot.?size|land.?area/i),
    apn: pick(cols, /parcel|^apn$|^pin$|account.?(no|num|nbr)|tax.?id|property.?id/i),
    saleDate: pick(cols, /sale.?date|auction.?date|^date$/i),
    lat: pick(cols, /latitude|^lat$/i),
    lng: pick(cols, /longitude|^lng$|^lon$/i),
  };
}

function isoDate(v) {
  if (!v) return null;
  const s = String(v);
  let mm = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (mm) return `${mm[1]}-${mm[2]}-${mm[3]}`;
  mm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // M/D/YYYY
  if (mm) return `${mm[3]}-${String(mm[1]).padStart(2, '0')}-${String(mm[2]).padStart(2, '0')}`;
  return null;
}

function mapRow(r, m, domain, domainState, idx, dsId) {
  const value = m.value ? num(r[m.value]) : null;
  const bid = m.bid ? num(r[m.bid]) : null;
  if (value == null && bid == null) return null; // unusable
  const state = (m.state && /^[A-Za-z ]+$/.test(String(r[m.state] || '')) ? r[m.state] : null) || domainState;
  const county = m.county ? r[m.county] : null;
  const owner = m.owner ? String(r[m.owner]).slice(0, 120) : null;
  const lat = m.lat ? num(r[m.lat]) : null;
  const lng = m.lng ? num(r[m.lng]) : null;
  const source = `SOCRATA:${domain}`;
  const liq = liqFor(state, county);
  const sc = scoreDeal({ value, bid, source, ownerName: owner, ...liq });
  const ex = extraScores({ value, bid, liq01: liq.liq01, source, ownerName: owner, hasCoords: !!(lat && lng), acres: m.acres ? num(r[m.acres]) : null });
  const apn = (m.apn && r[m.apn] != null ? String(r[m.apn]).slice(0, 60) : null) || `${dsId}-${idx}`;
  return {
    id: detId(`SOCRATA|${domain}|${apn}`),
    source,
    state: state || 'Unknown',
    county: county || (state ? `${state} (county n/a)` : 'Unknown'),
    apn,
    owner_name: owner,
    owner_address: null,
    property_address: m.address ? String(r[m.address]).slice(0, 200) : null,
    legal_description: null,
    acres: m.acres ? num(r[m.acres]) : null,
    minimum_bid: bid,
    judgment_amount: value,
    sale_date: m.saleDate ? isoDate(r[m.saleDate]) : null,
    case_number: null,
    raw_url: `https://${domain}`,
    scraped_at: new Date().toISOString(),
    lat, lng,
    dd_checked: false,
    final_score: Math.max(0, sc.deal_score - redemptionPenalty(state, source)),
    ...sc, ...ex,
  };
}

async function discover() {
  const seen = new Map(); // id -> {id, domain, name}
  for (const q of SEARCH_TERMS) {
    try {
      const r = await fetch(`https://api.us.socrata.com/api/catalog/v1?q=${encodeURIComponent(q)}&only=dataset&limit=40`, { signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      for (const res of j.results || []) {
        const name = res.resource.name || '';
        const domain = res.metadata.domain;
        const id = res.resource.id;
        if (!NAME_OK.test(name) || NAME_BAD.test(name)) continue;
        if (!seen.has(id)) seen.set(id, { id, domain, name });
      }
    } catch (e) { console.error(`  discover '${q}' hata:`, e.message); }
    await sleep(400);
  }
  return [...seen.values()].slice(0, MAX_DATASETS);
}

async function fetchDataset(ds) {
  const url = `https://${ds.domain}/resource/${ds.id}.json?$limit=${ROWS}`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return [];
  const m = buildMapper(rows[0]);
  if (!m.value && !m.bid) return []; // no money column => skip
  const domainState = stateFromDomain(ds.domain);
  return rows.map((row, i) => mapRow(row, m, ds.domain, domainState, i, ds.id)).filter(Boolean);
}

(async () => {
  console.log('→ Socrata Discovery taranıyor...');
  const datasets = await discover();
  console.log(`  ${datasets.length} aday dataset bulundu.`);

  let all = [];
  for (const ds of datasets) {
    try {
      const rows = await fetchDataset(ds);
      if (rows.length) {
        console.log(`  ✓ ${ds.domain} · "${ds.name.slice(0, 40)}" → ${rows.length} satır`);
        all = all.concat(rows);
      }
    } catch (e) { console.error(`  ✗ ${ds.domain}/${ds.id}: ${e.message}`); }
    await sleep(500);
  }

  if (!all.length) { console.log('Hiç satır toplanamadı.'); return; }

  // Dedupe by stable id; upsert (no delete) so tracking/snapshots persist.
  const seen = new Set();
  all = all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  let inserted = 0;
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    const { error } = await supabase.from('tax_delinquent_properties').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('  insert hata:', error.message);
    else inserted += chunk.length;
  }
  const states = new Set(all.map((r) => r.state).filter((s) => s && s !== 'Unknown'));
  console.log(`✅ ${inserted} Socrata lead yazıldı | ${datasets.length} dataset | ${states.size} eyalet`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
