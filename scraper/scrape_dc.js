/**
 * Washington DC statewide tax-lien scraper.
 *
 * Source: DC Office of Tax and Revenue (OTR) — otr.cfo.dc.gov.
 * DC is a single jurisdiction with ONE central, free, public PDF list of
 * every real property going to the annual tax-lien sale. No login, no
 * captcha, no per-county fan-out — the cleanest single target in the country.
 *
 * Flow:
 *   1. GET the Tax Sale resources page, find the newest
 *      "20XX Tax Lien Sale List as of M.D.YYYY" PDF link.
 *   2. Download the PDF, convert with `pdftotext -layout` (fixed-width table).
 *   3. Parse columns: Square-Suffix-Lot(APN) | Improved | Primary Owner |
 *      Secondary Owner | Premise# | Street | Quadrant | Unit# | Parking | Taxes.
 *   4. Build a full DC street address (Premise + Street + Quadrant,
 *      Washington DC) → optional Census geocode → lat/lng for the map.
 *   5. Map to the shared `tax_delinquent_properties` schema, source = 'TAX:DC'.
 *
 * Requires the `pdftotext` binary (poppler) on PATH.
 *
 * Usage:
 *   node scrape_dc.js --dry            # parse + print sample, no geocode, no DB
 *   node scrape_dc.js --geocode --dry  # also geocode (slow), still no DB
 *   node scrape_dc.js --write --geocode  # geocode + Supabase upsert (additive)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { liqFor, scoreDeal, extraScores, redemptionPenalty } = require('./scoring');

const BASE = 'https://otr.cfo.dc.gov';
const PAGE = `${BASE}/page/real-property-tax-lien-sale-and-resources`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const WRITE = process.argv.includes('--write') && !process.argv.includes('--dry');
const GEOCODE = process.argv.includes('--geocode');
const DL_DIR = path.join(__dirname, 'downloads', 'dc');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detId(key) {
  const h = crypto.createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

// 1) Find the newest "Tax Lien Sale List" PDF on the OTR resources page.
async function findListPdf() {
  const res = await fetch(PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`OTR page HTTP ${res.status}`);
  const html = await res.text();
  const links = [...html.matchAll(/href="([^"]+\.pdf)"[^>]*>([^<]*)/gi)]
    .map((m) => ({ href: m[1], text: clean(m[2]) }))
    .filter((l) => /tax\s*(lien\s*)?sale\s*list/i.test(l.text) || /Tax_Sale.*List/i.test(l.href));
  // Prefer "Tax Lien Sale List" with the latest year, skip discount/results.
  const ranked = links
    .filter((l) => !/discount|result|sold|bid.?back|buyers|faq/i.test(l.text + ' ' + l.href))
    .map((l) => ({ ...l, year: (l.text.match(/20\d\d/) || l.href.match(/20\d\d/) || ['0'])[0] }))
    .sort((a, b) => b.year - a.year);
  if (!ranked.length) throw new Error('Tax Lien Sale List PDF bulunamadı');
  const best = ranked[0];
  const url = best.href.startsWith('http') ? best.href : BASE + best.href;
  return { url, label: best.text || best.href };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// 2+3) pdftotext -layout, then slice fixed-width columns using header positions.
function parsePdf(pdfPath) {
  const txt = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString();
  const lines = txt.split('\n');

  // The OTR list is a fixed-width table; header labels are centered while data
  // is left-aligned, so we key off measured DATA column boundaries (verified
  // against the 2026 list, rows are ~214 cols wide). The &IMP flag sits @24.
  const C = {
    apn: [3, 23], imp: [23, 33], primary: [33, 78], secondary: [78, 119],
    premise: [119, 131], street: [131, 157], quad: [157, 169], unit: [169, 187], taxes: [196, 9999],
  };
  const slice = (line, [a, b]) => clean(line.slice(a, b));

  const rows = [];
  for (const line of lines) {
    // Data rows start (after leading spaces) with the 4-digit square or "PAR -"/"R -".
    if (!/^\s*([A-Z]{0,3}\s*-?\s*\d{4}-|\d{4}-|PAR\s*-)/.test(line)) continue;
    const apn = slice(line, C.apn);
    if (!/\d{4}-/.test(apn)) continue;
    const improved = /&IMP/i.test(slice(line, C.imp));
    const primary = slice(line, C.primary);
    const secondary = slice(line, C.secondary);
    const premise = slice(line, C.premise);
    const street = slice(line, C.street);
    const quad = slice(line, C.quad);
    const unit = slice(line, C.unit);
    const taxes = num(slice(line, C.taxes));
    if (!apn || taxes == null) continue;
    rows.push({ apn, improved, primary, secondary, premise, street, quad, unit, taxes });
  }
  return rows;
}

// Build a geocodable DC street address from premise + street + quadrant.
function buildAddress(r) {
  const street = clean(`${r.premise} ${r.street} ${r.quad}`);
  if (!/[A-Z]/i.test(r.street)) return null;
  if (!r.premise) return null; // no house number → not reliably geocodable; keep address null
  return clean(`${street}, Washington, DC`);
}

async function geocode(addr) {
  if (!addr) return null;
  const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=' +
    encodeURIComponent(addr) + '&benchmark=Public_AR_Current&format=json';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
    if (m && m.coordinates) return { lat: m.coordinates.y, lng: m.coordinates.x };
  } catch { /* skip */ }
  return null;
}

function mapRow(r, g, listUrl) {
  const source = 'TAX:DC';
  const state = 'DC';
  const county = 'District of Columbia';
  const owner = r.primary ? r.primary.slice(0, 120) : null;
  const bid = r.taxes; // delinquent taxes owed = the lien amount / opening bid
  const value = null;  // OTR list does not publish assessed value
  const fullStreet = clean(`${r.premise} ${r.street} ${r.quad}`.trim());
  const liq = liqFor(state, county);
  const sc = scoreDeal({ value, bid, source, ownerName: owner, ...liq });
  const ex = extraScores({ value, bid, liq01: liq.liq01, source, ownerName: owner, hasCoords: !!g, acres: null });
  return {
    id: detId(`TAX|DC|${r.apn}`),
    source, state, county,
    apn: r.apn,
    owner_name: owner,
    owner_address: null,
    property_address: fullStreet || null,
    legal_description: r.improved ? 'Improved' : 'Vacant/Unimproved',
    acres: null,
    minimum_bid: bid,
    judgment_amount: value,
    sale_date: null,
    case_number: null,
    raw_url: listUrl,
    scraped_at: new Date().toISOString(),
    lat: g ? g.lat : null,
    lng: g ? g.lng : null,
    dd_checked: false,
    final_score: Math.max(0, sc.deal_score - redemptionPenalty(state, source)),
    ...sc, ...ex,
  };
}

(async () => {
  console.log('→ DC OTR tax-lien listesi aranıyor...');
  const { url, label } = await findListPdf();
  console.log(`  Liste: "${label}"`);
  const dest = path.join(DL_DIR, 'dc_tax_lien_list.pdf');
  const bytes = await download(url, dest);
  console.log(`  İndirildi: ${(bytes / 1024).toFixed(0)} KB`);

  const raw = parsePdf(dest);
  console.log(`  ${raw.length} parsel satırı parse edildi.`);

  // Geocode (optional, sequential + polite).
  let geo = 0;
  const mapped = [];
  for (let i = 0; i < raw.length; i++) {
    let g = null;
    if (GEOCODE) {
      const addr = buildAddress(raw[i]);
      g = await geocode(addr);
      if (g) geo++;
      if (i % 50 === 0) process.stdout.write(`\r  geocode ${i}/${raw.length} (hit ${geo})   `);
      await sleep(60);
    }
    mapped.push(mapRow(raw[i], g, url));
  }
  if (GEOCODE) console.log(`\n  ${geo}/${raw.length} parsel koordinatlandı.`);

  // Dedupe by id.
  const byId = new Map();
  for (const m of mapped) byId.set(m.id, m);
  const all = [...byId.values()];
  console.log(`\n📊 Toplam ${all.length} benzersiz DC parsel (${all.length - mapped.length + byId.size} sonrası dedupe: ${all.length}).`);

  console.log('— Örnek 3 kayıt —');
  for (const r of all.slice(0, 3)) {
    console.log(JSON.stringify({ apn: r.apn, owner_name: r.owner_name, property_address: r.property_address, minimum_bid: r.minimum_bid, lat: r.lat, lng: r.lng, source: r.source }));
  }
  const cov = (k) => all.filter((r) => r[k] != null && r[k] !== '').length;
  console.log('\n— Alan doluluk —');
  for (const k of ['apn', 'owner_name', 'property_address', 'minimum_bid', 'lat']) console.log(`  ${k}: ${cov(k)}/${all.length}`);

  if (!WRITE) { console.log('\n(DRY) DB yazımı atlandı. Supabase için: node scrape_dc.js --write --geocode'); return; }

  const { createClient } = require('@supabase/supabase-js');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.'); process.exit(1);
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let inserted = 0;
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    const { error } = await supabase.from('tax_delinquent_properties').upsert(chunk, { onConflict: 'id' });
    if (error) { console.error('  insert hata:', error.message); }
    else inserted += chunk.length;
  }
  console.log(`✅ ${inserted} DC parsel Supabase'e yazıldı (TAX:DC).`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
