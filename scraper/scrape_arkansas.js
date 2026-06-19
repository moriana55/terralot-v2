/**
 * Arkansas statewide tax-delinquent land scraper.
 *
 * Source: Arkansas Commissioner of State Lands (COSL) — cosl.org.
 * The Commissioner of State Lands is the single statewide office that disposes
 * of ALL tax-delinquent / forfeited real estate in Arkansas's 75 counties.
 * Its public auction catalog is server-rendered HTML (no JS, no login,
 * no API key) and is the cleanest single source for the whole state.
 *
 * Flow:
 *   1. GET /Home/Contents            → list of upcoming sales as
 *                                      (countyCode, saleDate) pairs.
 *   2. GET /Home/CatalogView?county=&saledate=  → one HTML table per sale,
 *      columns: Sale# | Name(owner) | Legal Description | Interested Parties
 *               | Parcel# | Taxes(delinquent amount).
 *   3. Parse rows → map to the shared `tax_delinquent_properties` schema,
 *      source = 'TAX:AR'.
 *
 * Mirrors the field mapping used by socrata-harvest.js / migrate_to_supabase.js
 * (deterministic id, scoreDeal/extraScores, minimum_bid/judgment_amount, etc).
 *
 * Usage:
 *   node scrape_arkansas.js                # parse + (if --write) upsert Supabase
 *   AR_COUNTIES=6 node scrape_arkansas.js  # limit number of county sales
 *   node scrape_arkansas.js --dry          # parse only, print sample, no DB
 *
 * NOTE: by default this is dry (no DB write) so it never touches the shared
 * data.db / Supabase unless you pass --write and have SUPABASE_* env vars.
 */
require('dotenv').config();
const crypto = require('crypto');
const { liqFor, scoreDeal, extraScores, redemptionPenalty } = require('./scoring');

const BASE = 'https://cosl.org';
const MAX_COUNTIES = parseInt(process.env.AR_COUNTIES || '72', 10);
const WRITE = process.argv.includes('--write') && !process.argv.includes('--dry');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Deterministic UUID from a stable natural key (same as db.js / socrata-harvest.js)
function detId(key) {
  const h = crypto.createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// COSL 4-letter county codes → readable county names.
const COUNTY_NAMES = {
  ARKA: 'Arkansas', ASHL: 'Ashley', BAXT: 'Baxter', BENT: 'Benton', BOON: 'Boone',
  BRAD: 'Bradley', CALH: 'Calhoun', CARR: 'Carroll', CHIC: 'Chicot', CLAR: 'Clark',
  CLAY: 'Clay', CLEB: 'Cleburne', CLEV: 'Cleveland', COLU: 'Columbia', CONW: 'Conway',
  CRAI: 'Craighead', CRAW: 'Crawford', CRIT: 'Crittenden', CROS: 'Cross', DALL: 'Dallas',
  DESH: 'Desha', DREW: 'Drew', FAUL: 'Faulkner', FRAN: 'Franklin', FULT: 'Fulton',
  GARL: 'Garland', GRAN: 'Grant', GREE: 'Greene', HEMP: 'Hempstead', HOTS: 'Hot Spring',
  HOWA: 'Howard', INDE: 'Independence', IZAR: 'Izard', JACK: 'Jackson', JEFF: 'Jefferson',
  JOHN: 'Johnson', LAFA: 'Lafayette', LAWR: 'Lawrence', LEE: 'Lee', LINC: 'Lincoln',
  LITT: 'Little River', LOGA: 'Logan', LONO: 'Lonoke', MADI: 'Madison', MARI: 'Marion',
  MILL: 'Miller', MISS: 'Mississippi', MONR: 'Monroe', MONT: 'Montgomery', NEVA: 'Nevada',
  NEWT: 'Newton', OUAC: 'Ouachita', PERR: 'Perry', PHIL: 'Phillips', PIKE: 'Pike',
  POIN: 'Poinsett', POLK: 'Polk', POPE: 'Pope', PRAI: 'Prairie', PULA: 'Pulaski',
  RAND: 'Randolph', SALI: 'Saline', SCOT: 'Scott', SEAR: 'Searcy', SEBA: 'Sebastian',
  SEVI: 'Sevier', SHAR: 'Sharp', STFR: 'St Francis', STON: 'Stone', UNIO: 'Union',
  VANB: 'Van Buren', WASH: 'Washington', WHIT: 'White', WOOD: 'Woodruff', YELL: 'Yell',
};

const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '');
const decode = (s) =>
  (s || '')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// "M/D/YYYY 10:00:00 AM" → "YYYY-MM-DD"
function isoDate(raw) {
  const s = decodeURIComponent(raw || '');
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

// Pull acreage out of the legal description, e.g. "... 0.27 ACRE" / "1.5 ACRES".
function acresFromLegal(legal) {
  if (!legal) return null;
  const m = legal.match(/([0-9]+(?:\.[0-9]+)?)\s*ACRES?\b/i);
  if (!m) return null;
  const a = parseFloat(m[1]);
  return a > 0 ? a : null;
}

// Leading "123 STREET NAME ..." street address embedded at the start of the legal desc.
function addressFromLegal(legal) {
  if (!legal) return null;
  const cleaned = legal.replace(/^\*/, '').trim();
  const m = cleaned.match(/^(\d{1,6}\s+[A-Z0-9'.\- ]{3,40}?(?:ST|AVE|RD|DR|LN|WAY|BLVD|PL|CIR|CT|HWY|TRL|LOOP|PKWY|TER))\b/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

// 1) Discover all upcoming (county, saleDate) sales from the auction contents page.
async function discoverSales() {
  const res = await fetch(`${BASE}/Home/Contents`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Contents HTTP ${res.status}`);
  const html = await res.text();
  const re = /CatalogView\?county=([A-Z]{4})&(?:amp;)?saledate=([^"'&]+)/g;
  const seen = new Set();
  const sales = [];
  let m;
  while ((m = re.exec(html))) {
    const key = `${m[1]}|${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sales.push({ code: m[1], saledateRaw: m[2] });
  }
  return sales;
}

// 2) Fetch + parse a single county sale catalog → array of raw row objects.
async function fetchCatalog(sale) {
  const url = `${BASE}/Home/CatalogView?county=${sale.code}&saledate=${sale.saledateRaw}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let tr;
  while ((tr = trRe.exec(html))) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 6) continue; // skip header / cancelled / spacer rows
    const saleNo = decode(stripTags(cells[0]));
    const name = decode(stripTags(cells[1]));
    const legal = decode(stripTags(cells[2]));
    const parcel = decode(stripTags(cells[4])); // visible link text = real APN
    const taxes = num(cells[5]);
    if (!/^\d+$/.test(saleNo)) continue;        // must be a numbered sale line
    if (!name || /ENTRY CANCELLED/i.test(name)) continue;
    if (taxes == null) continue;                // need the delinquent amount
    rows.push({ saleNo, name, legal, parcel, taxes });
  }
  return { url, saleDate: isoDate(sale.saledateRaw), rows };
}

// 3) Map a parsed row to the shared tax_delinquent_properties schema.
function mapRow(r, county, saleDate, url) {
  const source = 'TAX:AR';
  const state = 'AR';
  const bid = r.taxes;            // COSL minimum bid = delinquent taxes + costs
  const value = null;            // COSL catalog does not publish assessed value
  const owner = r.name ? r.name.slice(0, 120) : null;
  const acres = acresFromLegal(r.legal);
  const apn = (r.parcel && r.parcel.length > 2 ? r.parcel : null)
    || `AR-${county.code}-${saleDate || 'NA'}-${r.saleNo}`;

  const liq = liqFor(state, county.name);
  const sc = scoreDeal({ value, bid, source, ownerName: owner, ...liq });
  const ex = extraScores({ value, bid, liq01: liq.liq01, source, ownerName: owner, hasCoords: false, acres });

  return {
    id: detId(`AR|${county.code}|${apn}|${r.saleNo}`),
    source,
    state,
    county: county.name,
    apn,
    owner_name: owner,
    owner_address: null,
    property_address: addressFromLegal(r.legal),
    legal_description: r.legal ? r.legal.slice(0, 400) : null,
    acres,
    minimum_bid: bid,
    judgment_amount: value,
    sale_date: saleDate,
    case_number: r.saleNo,
    raw_url: url,
    scraped_at: new Date().toISOString(),
    lat: null,
    lng: null,
    dd_checked: false,
    final_score: Math.max(0, sc.deal_score - redemptionPenalty(state, source)),
    ...sc,
    ...ex,
  };
}

(async () => {
  console.log('→ Arkansas COSL (cosl.org) tax-delinquent katalog taranıyor...');
  const sales = (await discoverSales()).slice(0, MAX_COUNTIES);
  console.log(`  ${sales.length} county satışı bulundu (örnek: ${sales.slice(0, 4).map((s) => s.code).join(', ')})`);

  let all = [];
  for (const sale of sales) {
    const county = { code: sale.code, name: COUNTY_NAMES[sale.code] || sale.code };
    try {
      const { url, saleDate, rows } = await fetchCatalog(sale);
      const mapped = rows.map((r) => mapRow(r, county, saleDate, url));
      if (mapped.length) {
        console.log(`  ✓ ${county.name} (${sale.code}) ${saleDate || ''} → ${mapped.length} parsel`);
        all = all.concat(mapped);
      } else {
        console.log(`  · ${county.name} (${sale.code}) → 0 parsel`);
      }
    } catch (e) {
      console.error(`  ✗ ${county.name} (${sale.code}): ${e.message}`);
    }
    await sleep(400);
  }

  // Dedupe by stable id.
  const seen = new Set();
  all = all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  console.log(`\n📊 Toplam ${all.length} benzersiz Arkansas parsel parse edildi.`);
  console.log('— Örnek 3 kayıt —');
  for (const r of all.slice(0, 3)) {
    console.log(JSON.stringify({
      county: r.county, apn: r.apn, owner_name: r.owner_name,
      minimum_bid: r.minimum_bid, judgment_amount: r.judgment_amount,
      acres: r.acres, property_address: r.property_address,
      sale_date: r.sale_date, source: r.source,
      legal_description: (r.legal_description || '').slice(0, 60),
    }, null, 0));
  }

  // Field-coverage diagnostics.
  const cov = (k) => all.filter((r) => r[k] != null && r[k] !== '').length;
  console.log('\n— Alan doluluk (dolu/toplam) —');
  for (const k of ['apn', 'owner_name', 'minimum_bid', 'judgment_amount', 'acres', 'property_address', 'legal_description', 'sale_date', 'county']) {
    console.log(`  ${k}: ${cov(k)}/${all.length}`);
  }

  if (!WRITE) {
    console.log('\n(DRY) DB yazımı atlandı. Supabase upsert için: node scrape_arkansas.js --write');
    return;
  }

  // Optional Supabase upsert (same target table + onConflict as the other scrapers).
  const { createClient } = require('@supabase/supabase-js');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('HATA: --write için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
    process.exit(1);
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let inserted = 0;
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    const { error } = await supabase.from('tax_delinquent_properties').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('  insert hata:', error.message);
    else inserted += chunk.length;
  }
  console.log(`✅ ${inserted} Arkansas lead Supabase'e yazıldı (TAX:AR).`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
