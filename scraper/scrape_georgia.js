/**
 * Georgia tax-sale scraper  (source: TAX:GA)
 * ------------------------------------------------------------------
 * Georgia counties run monthly tax-deed / judicial-in-rem sales on the
 * first Tuesday of the month. County tax commissioners publish the sale
 * list as a fixed-column PDF. This scraper downloads each county's PDF,
 * runs `pdftotext -layout`, and parses out:
 *
 *   state, county, apn, owner_name, minimum_bid, value, acres, address, source
 *
 * It mirrors the pattern of scrape_pbfcm_live.js / scrape_mvba_live.js
 * (Puppeteer is available but Georgia PDFs are plain HTTPS, so a simple
 * fetch is enough — no anti-bot). Rows are written into the SQLite
 * `tax_sales` table, which migrate_to_supabase.js later maps to
 * `tax_delinquent_properties` with source TAX:GA:<sale_type>.
 *
 * Run normally (writes to DB):   node scrape_georgia.js
 * TEST mode (fetch+parse only):  node scrape_georgia.js --dry-run
 *
 * Notes / TODO:
 *  - Clayton County PDF is the verified, cleanly-parseable source. Other
 *    counties are listed in COUNTY_SOURCES; add their stable PDF URLs as
 *    they are confirmed. Each entry declares a `parser` so different
 *    county layouts can coexist.
 *  - Georgia tax-sale PDFs rarely carry acreage (they list Fair Market
 *    Value + Cry-Out/minimum bid + situs address). `acres` is therefore
 *    usually null; enrichment (dd-enrich.js) can backfill later.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--test');
const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads', 'georgia');

// ── County sources ──────────────────────────────────────────────────────────
// Add counties here as their PDF URLs are confirmed. `pdfUrl` may be a
// direct link; `discover` (optional) can resolve the current month's PDF
// from a listing page via Puppeteer if a county rotates filenames.
const COUNTY_SOURCES = [
  {
    county: 'CLAYTON COUNTY',
    saleType: 'Tax Deed Sale',          // GA redeemable tax deed (12-mo redemption)
    landingUrl: 'https://publicaccess.claytoncountyga.gov/content/home.htm',
    // Clayton publishes a per-month PDF; the upcoming one is referenced here.
    // Update the filename monthly, or wire up discoverClaytonPdf() (below).
    pdfUrl: 'https://publicaccess.claytoncountyga.gov/content/PDF/feb_tax_sale_listing_2026.pdf',
    parser: 'clayton',
  },
  // Fallback: prior verified month (used if the current month 404s)
  {
    county: 'CLAYTON COUNTY',
    saleType: 'Tax Deed Sale',
    landingUrl: 'https://publicaccess.claytoncountyga.gov/content/home.htm',
    pdfUrl: 'https://publicaccess.claytoncountyga.gov/content/PDF/AUGUST%202025%20TAX%20SALE%20LISTING.pdf',
    parser: 'clayton',
    fallbackOnly: true,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const num = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
};

function isoFromUsDate(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

async function downloadPdf(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('not a PDF');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function pdfToText(pdfPath) {
  return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

// ── Clayton County parser ────────────────────────────────────────────────────
// Layout (fixed columns, -layout):
//   Date  Parcel#/Name  Property Location  Years  Fair Market Value  Cry-Out Bid
// A record starts on a line beginning with MM/DD/YYYY. Parcel# and owner
// (after the "/") frequently wrap onto the next 1-2 lines.
function parseClayton(text, countyName, saleType) {
  const lines = text.split('\n');
  const records = [];
  let cur = null;

  const flush = () => {
    if (!cur) return;
    // Owner: everything after the first "/" in the accumulated parcel/name blob.
    let owner = 'UNKNOWN OWNER';
    const slash = cur.nameBlob.indexOf('/');
    if (slash !== -1) {
      owner = cur.nameBlob.slice(slash + 1).replace(/\s+/g, ' ').trim();
    }
    // APN: the token(s) before the "/" (Georgia parcel id e.g. "13186C A001").
    let apn = null;
    if (slash !== -1) {
      apn = cur.nameBlob.slice(0, slash).replace(/\s+/g, ' ').trim() || null;
    }
    records.push({
      county: countyName,
      saleType,
      apn,
      owner_name: owner || 'UNKNOWN OWNER',
      address: cur.address.replace(/\s+/g, ' ').trim() || null,
      value: cur.value,
      minimum_bid: cur.bid,
      acres: null,
      sale_date: cur.saleDate,
    });
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const start = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)$/);
    if (start) {
      flush();
      const saleDate = isoFromUsDate(start[1]);
      let body = start[2];

      // Trailing money columns: ... <Fair Market Value> <Cry-Out Bid>
      // Bid has 2 decimals; value is an integer (with optional commas).
      const money = body.match(/([\d,]+(?:\.\d+)?)\s+([\d,]+\.\d{2})\s*$/);
      let value = null, bid = null;
      if (money) {
        value = num(money[1]);
        bid = num(money[2]);
        body = body.slice(0, money.index).replace(/\s+$/, '');
      }
      // Strip the "Years" column (comma-separated 4-digit years, possibly wrapped).
      body = body.replace(/\b(?:\d{4})(?:\s*,\s*\d{4})*\s*,?\s*$/, '').replace(/\s+$/, '');

      // Address: heuristically the right-hand chunk = situs (digits + street),
      // name blob = left chunk. Split on the largest run of spaces.
      const STREET = /\b(RD|DR|ST|AVE|BLVD|LN|CT|PKWY|WAY|TRCE|PL|HWY|CIR|LOOP|TER|RUN)\b/i;
      const segs = body.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      let nameBlob = body, address = '';
      if (segs.length === 1) {
        // Columns collapsed: situs is embedded in the blob. Pull out the
        // "<number> ... <STREET-SUFFIX>" run as the address; rest = parcel/owner.
        const am = segs[0].match(/(\d+\s+[A-Z0-9 ]*?\b(?:RD|DR|ST|AVE|BLVD|LN|CT|PKWY|WAY|TRCE|PL|HWY|CIR|LOOP|TER|RUN)\b)/i);
        if (am) {
          address = am[1].trim();
          nameBlob = (segs[0].slice(0, am.index) + ' ' + segs[0].slice(am.index + am[1].length)).replace(/\s+/g, ' ').trim();
        } else {
          nameBlob = segs[0];
        }
      } else if (segs.length >= 2) {
        // The address segment is the one that looks like a street (has a digit
        // or ends in a road suffix); the rest is parcel#/owner.
        const addrIdx = segs.findIndex((s) =>
          (/\d/.test(s) && STREET.test(s)) || /^\d+\s+[A-Z]/.test(s));
        if (addrIdx > 0) {
          address = segs.slice(addrIdx).join(' ');
          nameBlob = segs.slice(0, addrIdx).join(' ');
        } else {
          // No clear address; keep last seg as address fallback.
          address = segs[segs.length - 1];
          nameBlob = segs.slice(0, -1).join(' ');
        }
      }
      cur = { nameBlob, address, value, bid, saleDate };
      continue;
    }

    // Continuation lines (wrapped parcel#/owner or address).
    if (cur && line.trim()) {
      // Drop any wrapped "Years" run (e.g. "...   2016,2017,2018,2019,2022").
      let t = line.replace(/\s{2,}\d{4}(\s*,\s*\d{4})*\s*,?\s*$/, '').trim();
      t = t.replace(/\b\d{4}(\s*,\s*\d{4})*\s*,?\s*$/, '').trim();
      if (!t) continue;
      const STREET2 = /\b(RD|DR|ST|AVE|BLVD|LN|CT|PKWY|WAY|TRCE|PL|HWY|CIR|LOOP|TER|RUN)\b/i;
      // A continuation may carry both the wrapped owner (left, often "/NAME")
      // and a wrapped street suffix (right). Split on the column gap.
      const parts = line.replace(/\s{2,}\d{4}(\s*,\s*\d{4})*\s*,?\s*$/, '')
        .split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      let consumed = false;
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        // Pure street-suffix fragment (e.g. "TRCE", "RD") → append to address.
        if (STREET2.test(last) && !/\d/.test(last) && cur.address && /\d/.test(cur.address)) {
          cur.address += ' ' + last;
          const rest = parts.slice(0, -1).join(' ').trim();
          if (rest) cur.nameBlob += ' ' + rest;
          consumed = true;
        }
      }
      if (!consumed) {
        if (STREET2.test(t) && /\d/.test(t.split(STREET2)[0] || '') && /^\d/.test(t)) {
          cur.address = (cur.address ? cur.address + ' ' : '') + t;
        } else {
          cur.nameBlob += ' ' + t;
        }
      }
    }
  }
  flush();
  return records.filter((r) => r.apn || r.owner_name !== 'UNKNOWN OWNER');
}

const PARSERS = { clayton: parseClayton };

// ── DB write (mirrors scrape_pbfcm_live.js tax_sales schema) ─────────────────
function writeRows(db, county, rows) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO tax_sales (
      uid, state, county, prop_address_one, prop_city, prop_state, prop_zipcode,
      value, minimum_bid, discount_pct, sale_type, status, sale_date, sale_date_only,
      cause_nbr, account_nbr, owner_name, source, created_at
    ) VALUES (
      @uid, @state, @county, @prop_address_one, @prop_city, @prop_state, @prop_zipcode,
      @value, @minimum_bid, @discount_pct, @sale_type, @status, @sale_date, @sale_date_only,
      @cause_nbr, @account_nbr, @owner_name, @source, datetime('now')
    )
  `);
  const tx = db.transaction((list) => {
    for (const r of list) {
      const discount = r.value && r.minimum_bid && r.value > 0
        ? +(100 * (1 - r.minimum_bid / r.value)).toFixed(1) : null;
      insert.run({
        uid: `GA_${county.replace(/\s+/g, '')}_${r.apn || r.owner_name}`.slice(0, 120),
        state: 'GA',
        county,
        prop_address_one: r.address || null,
        prop_city: null,
        prop_state: 'GA',
        prop_zipcode: null,
        value: r.value,
        minimum_bid: r.minimum_bid,
        discount_pct: discount,
        sale_type: r.saleType,
        status: 'Scheduled for Auction',
        sale_date: r.sale_date ? `${r.sale_date} 10:00:00` : null,
        sale_date_only: r.sale_date,
        cause_nbr: null,
        account_nbr: r.apn,
        owner_name: r.owner_name,
        source: 'TAX:GA',
      });
    }
  });
  tx(rows);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`→ Georgia tax-sale scraper başlıyor${DRY_RUN ? ' (DRY-RUN, DB yazılmaz)' : ''}...`);
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  let db = null;
  if (!DRY_RUN) db = new Database(DB_PATH);

  const haveCounty = new Set();
  let total = 0;

  for (const src of COUNTY_SOURCES) {
    if (src.fallbackOnly && haveCounty.has(src.county)) continue; // skip fallback if primary worked
    const dest = path.join(DOWNLOAD_DIR, `${src.county.replace(/\s+/g, '_')}_${path.basename(src.pdfUrl).replace(/%20/g, '_')}`);
    console.log(`\n📥 ${src.county} ← ${src.pdfUrl}`);
    try {
      const bytes = await downloadPdf(src.pdfUrl, dest);
      console.log(`   indirildi: ${bytes} bayt`);
      const text = pdfToText(dest);
      const parser = PARSERS[src.parser];
      const rows = parser(text, src.county, src.saleType);
      console.log(`   ✓ ${rows.length} mülk ayıklandı`);

      // Örnek satırları göster
      rows.slice(0, process.env.SHOW_ALL ? rows.length : 5).forEach((r, i) => {
        console.log(`     [${i + 1}] apn=${r.apn} | owner=${r.owner_name} | bid=$${r.minimum_bid} | value=$${r.value} | acres=${r.acres} | addr="${r.address}" | date=${r.sale_date}`);
      });

      if (rows.length) {
        haveCounty.add(src.county);
        total += rows.length;
        if (!DRY_RUN) {
          writeRows(db, src.county, rows);
          console.log(`   💾 ${rows.length} satır tax_sales tablosuna yazıldı (source=TAX:GA)`);
        }
      }
    } catch (err) {
      console.error(`   ✗ ${src.county} hata: ${err.message}`);
    }
  }

  if (db) db.close();
  console.log(`\n🌟 Bitti. Toplam ${total} GA mülk · ${haveCounty.size} county.${DRY_RUN ? ' (yazılmadı)' : ''}`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
