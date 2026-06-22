/**
 * Nebraska statewide tax-delinquent real property scraper.
 *
 * Source: Nebraska Dept. of Revenue, Property Assessment Division (PAD).
 * NE publishes a single statewide page that links to ONE Excel (.xlsx) file
 * per county for the current year's "Delinquent Real Property List".
 * Free, no login, no captcha. Predictable URL pattern:
 *   /sites/default/files/doc/pad/delinquent_real_prop/<YEAR>/<NN><County>_delinq<YEAR>.xlsx
 *
 * Flow:
 *   1. GET the PAD list page, scrape every county .xlsx link for the year.
 *   2. Download + parse each workbook (sheetjs). Columns:
 *      COUNTY | COUNTY NUMBER | PARCEL(apn) | OWNERS NAME | SITUS(address) |
 *      LEGAL | TAX DUE.
 *   3. Optional Census geocode on SITUS → lat/lng for the map.
 *   4. Map to shared `tax_delinquent_properties` schema, source = 'TAX:NE'.
 *
 * Usage:
 *   node scrape_nebraska.js --dry              # parse + sample, no DB
 *   NE_COUNTIES=8 node scrape_nebraska.js --dry
 *   node scrape_nebraska.js --write --geocode  # geocode + Supabase upsert
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { liqFor, scoreDeal, extraScores, redemptionPenalty } = require('./scoring');

const BASE = 'https://revenue.nebraska.gov';
const PAGE = `${BASE}/PAD/real-property/nebraska-delinquent-real-property-list`;
const YEAR = process.env.NE_YEAR || String(new Date().getFullYear());
const MAX = parseInt(process.env.NE_COUNTIES || '999', 10);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const WRITE = process.argv.includes('--write') && !process.argv.includes('--dry');
const GEOCODE = process.argv.includes('--geocode');
const DL = path.join(__dirname, 'downloads', 'ne');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detId(key) {
  const h = crypto.createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
const num = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const clean = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
const titleCounty = (s) => clean(s).replace(/\b\w/g, (c) => c.toUpperCase());

async function listCountyFiles() {
  const res = await fetch(PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(35000) });
  if (!res.ok) throw new Error(`PAD page HTTP ${res.status}`);
  const html = await res.text();
  const re = new RegExp(`href="([^"]*delinquent_real_prop/${YEAR}/[^"]*delinq${YEAR}[^"]*\\.xlsx)"`, 'gi');
  const urls = [...new Set([...html.matchAll(re)].map((m) => (m[1].startsWith('http') ? m[1] : BASE + m[1])))];
  return urls;
}

async function fetchWorkbook(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return XLSX.read(buf, { type: 'buffer' });
}

// Locate header row and column indices (column order is stable but be defensive).
function parseWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  let hi = rows.findIndex((r) => r && r.some((c) => /PARCEL/i.test(String(c || ''))) && r.some((c) => /TAX\s*DUE/i.test(String(c || ''))));
  if (hi < 0) hi = 0;
  const header = rows[hi].map((c) => clean(c).toUpperCase());
  const col = (re) => header.findIndex((h) => re.test(h));
  const idx = {
    county: col(/^COUNTY$/), parcel: col(/PARCEL/), owner: col(/OWNER/),
    situs: col(/SITUS/), legal: col(/LEGAL/), tax: col(/TAX\s*DUE/),
  };
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const parcel = clean(r[idx.parcel]);
    const tax = num(r[idx.tax]);
    if (!parcel || tax == null) continue;
    out.push({
      county: titleCounty(r[idx.county]),
      apn: parcel,
      owner: clean(r[idx.owner]) || null,
      situs: clean(r[idx.situs]) || null,
      legal: clean(r[idx.legal]) || null,
      tax,
    });
  }
  return out;
}

async function geocode(addr, county) {
  if (!addr) return null;
  const q = `${addr}, ${county} County, NE`;
  const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=' +
    encodeURIComponent(q) + '&benchmark=Public_AR_Current&format=json';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
    if (m && m.coordinates) return { lat: m.coordinates.y, lng: m.coordinates.x };
  } catch { /* skip */ }
  return null;
}

function acresFromLegal(legal) {
  if (!legal) return null;
  const m = legal.match(/([0-9]+(?:\.[0-9]+)?)\s*AC(?:RES?)?\b/i);
  return m && parseFloat(m[1]) > 0 ? parseFloat(m[1]) : null;
}

function mapRow(r, g, url) {
  const source = 'TAX:NE';
  const state = 'NE';
  const owner = r.owner ? r.owner.slice(0, 120) : null;
  const bid = r.tax; // delinquent tax due = certificate / lien amount
  const value = null; // list has no assessed value
  const acres = acresFromLegal(r.legal);
  const liq = liqFor(state, r.county);
  const sc = scoreDeal({ value, bid, source, ownerName: owner, ...liq });
  const ex = extraScores({ value, bid, liq01: liq.liq01, source, ownerName: owner, hasCoords: !!g, acres });
  return {
    id: detId(`TAX|NE|${r.county}|${r.apn}`),
    source, state, county: r.county || null,
    apn: r.apn,
    owner_name: owner,
    owner_address: null,
    property_address: r.situs || null,
    legal_description: r.legal ? r.legal.slice(0, 400) : null,
    acres,
    minimum_bid: bid,
    judgment_amount: value,
    sale_date: null,
    case_number: null,
    raw_url: url,
    scraped_at: new Date().toISOString(),
    lat: g ? g.lat : null,
    lng: g ? g.lng : null,
    dd_checked: false,
    final_score: Math.max(0, sc.deal_score - redemptionPenalty(state, source)),
    ...sc, ...ex,
  };
}

(async () => {
  console.log(`→ Nebraska PAD ${YEAR} delinquent real property listeleri taranıyor...`);
  fs.mkdirSync(DL, { recursive: true });

  // NE_LOCAL=1 reads previously-downloaded workbooks from downloads/ne/ instead
  // of fetching (useful where the host's DNS can't resolve revenue.nebraska.gov;
  // pre-fetch via: curl --resolve revenue.nebraska.gov:443:<fastly-ip> ...).
  const LOCAL = process.env.NE_LOCAL === '1';
  let files;
  if (LOCAL) {
    files = fs.readdirSync(DL).filter((f) => /delinq\d{4}.*\.xlsx$/i.test(f)).map((f) => path.join(DL, f)).slice(0, MAX);
    console.log(`  (LOCAL) ${files.length} indirilmiş Excel dosyası kullanılıyor.`);
  } else {
    files = (await listCountyFiles()).slice(0, MAX);
    console.log(`  ${files.length} county Excel dosyası bulundu (uzaktan).`);
  }

  let all = [];
  for (const url of files) {
    const cty = (String(url).match(/\/?(\d{2})([A-Za-z]+)_delinq/) || [, '', '?'])[2];
    try {
      const wb = LOCAL ? XLSX.readFile(url) : await fetchWorkbook(url);
      const srcUrl = LOCAL ? `${BASE}/sites/default/files/doc/pad/delinquent_real_prop/${YEAR}/${path.basename(url)}` : url;
      const rows = parseWorkbook(wb).map((r) => mapRow(r, null, srcUrl));
      if (rows.length) { console.log(`  ✓ ${cty} → ${rows.length} parsel`); all = all.concat(rows); }
      else console.log(`  · ${cty} → 0 parsel`);
    } catch (e) {
      console.error(`  ✗ ${cty}: ${e.message}`);
    }
    if (!LOCAL) await sleep(300);
  }

  // Dedupe.
  const byId = new Map();
  for (const m of all) byId.set(m.id, m);
  all = [...byId.values()];
  console.log(`\n📊 Toplam ${all.length} benzersiz Nebraska parsel.`);

  if (GEOCODE) {
    let geo = 0;
    for (let i = 0; i < all.length; i++) {
      if (!all[i].property_address) continue;
      const g = await geocode(all[i].property_address, all[i].county);
      if (g) { all[i].lat = g.lat; all[i].lng = g.lng; all[i].confidence = Math.min(100, all[i].confidence + 25); geo++; }
      if (i % 50 === 0) process.stdout.write(`\r  geocode ${i}/${all.length} (hit ${geo})   `);
      await sleep(60);
    }
    console.log(`\n  ${geo}/${all.length} koordinatlandı.`);
  }

  console.log('— Örnek 3 kayıt —');
  for (const r of all.slice(0, 3)) console.log(JSON.stringify({ county: r.county, apn: r.apn, owner_name: r.owner_name, property_address: r.property_address, minimum_bid: r.minimum_bid, acres: r.acres, lat: r.lat }));
  const cov = (k) => all.filter((r) => r[k] != null && r[k] !== '').length;
  console.log('\n— Alan doluluk —');
  for (const k of ['apn', 'owner_name', 'property_address', 'minimum_bid', 'acres', 'lat']) console.log(`  ${k}: ${cov(k)}/${all.length}`);

  if (!WRITE) { console.log('\n(DRY) DB yazımı atlandı. Supabase için: node scrape_nebraska.js --write --geocode'); return; }

  const { createClient } = require('@supabase/supabase-js');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('HATA: SUPABASE_* env gerekli.'); process.exit(1); }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let inserted = 0;
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    const { error } = await supabase.from('tax_delinquent_properties').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('  insert hata:', error.message); else inserted += chunk.length;
  }
  console.log(`✅ ${inserted} Nebraska parsel Supabase'e yazıldı (TAX:NE).`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
