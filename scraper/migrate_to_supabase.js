const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');
const { liqFor, scoreDeal, extraScores, redemptionPenalty } = require('./scoring');
require('dotenv').config();

// Deterministic UUID from a stable natural key → same deal keeps the same id
// across runs, so deal_tracking / snapshots survive nightly refreshes.
function detId(key) {
  const h = crypto.createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env dosyasında tanımlı olmalı.');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const dbPath = path.join(__dirname, 'zillow_listings.db');
console.log('SQLite:', dbPath);
const db = new Database(dbPath);

const BATCH = 200;
// Upsert on stable id (no delete) so tracking/snapshots persist. De-dupe by id.
async function insertAll(rows, label) {
  const seen = new Set();
  rows = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('tax_delinquent_properties').upsert(rows.slice(i, i + BATCH), { onConflict: 'id' });
    if (error) console.error(`  ${label} batch ${i / BATCH + 1} hata:`, error.message);
    else n += rows.slice(i, i + BATCH).length;
  }
  console.log(`  ${label}: ${n}/${rows.length} yazıldı (upsert)`);
}

// ── Zillow listings → tax_delinquent_properties (source: ZILLOW_*) ──────────
async function migrateListings() {
  const listings = db.prepare('SELECT * FROM listings').all();
  const mapped = listings.map((l) => {
    const source = l.property_type === 'LAND' ? 'ZILLOW_LAND' : 'ZILLOW_HOUSE';
    const addr = [l.street_address, l.city, l.state, l.zipcode].filter(Boolean).join(', ') || 'No address';
    const value = l.zestimate || null;
    const bid = l.price || null;
    const owner = l.owner_name || 'Absentee Owner';
    const liq = liqFor(l.state, l.county || l.city);
    const acres = l.lot_size_acres || (l.lot_size_sqft ? +(l.lot_size_sqft / 43560).toFixed(4) : null);
    const sc = scoreDeal({ value: value || bid, bid, source, ownerName: owner, ...liq });
    const ex = extraScores({ value: value || bid, bid, liq01: liq.liq01, source, ownerName: owner, hasCoords: !!(l.latitude && l.longitude), acres });
    return {
      id: detId('ZILLOW|' + l.zpid),
      source,
      state: l.state || 'Unknown',
      county: l.city || 'Unknown',
      apn: l.apn || `ZPID-${l.zpid}`,
      owner_name: owner,
      owner_address: l.owner_email || null,
      property_address: addr,
      acres,
      minimum_bid: bid,
      judgment_amount: value || bid || null,
      sale_date: null,
      case_number: `ZPID-${l.zpid}`,
      raw_url: l.zillow_url || `https://www.zillow.com/homedetails/${l.zpid}_zpid/`,
      scraped_at: l.first_seen_at || new Date().toISOString(),
      lat: l.latitude || null,
      lng: l.longitude || null,
      dd_checked: false,
      final_score: Math.max(0, sc.deal_score - redemptionPenalty(l.state, source)),
      ...sc,
      ...ex,
    };
  });
  // Stable-id upsert (no delete) — preserves deal_tracking / snapshots.
  await insertAll(mapped, 'Zillow');
}

// ── Tax sales → tax_delinquent_properties (source: TAX:<firm>:<type>) ────────
async function migrateTaxSales() {
  let rows;
  try {
    rows = db.prepare('SELECT * FROM tax_sales').all();
  } catch {
    console.log('  tax_sales tablosu yok, atlanıyor');
    return;
  }
  const mapped = rows.map((r) => {
    const propAddr = [r.prop_address_one, r.prop_city, r.prop_state, r.prop_zipcode].filter(Boolean).join(', ') || null;
    const mailAddr = [r.mail_address, r.mail_city, r.mail_state, r.mail_zip].filter(Boolean).join(', ') || null;
    const source = `TAX:${r.source || 'UNKNOWN'}:${r.sale_type || ''}`;
    const liq = liqFor(r.state, r.county);
    const sc = scoreDeal({ value: r.value, bid: r.minimum_bid, source, ownerName: r.owner_name, ...liq });
    const ex = extraScores({ value: r.value, bid: r.minimum_bid, liq01: liq.liq01, source, ownerName: r.owner_name, hasCoords: !!(r.lat && r.lon), acres: null });
    return {
      id: detId('TAX|' + (r.cause_nbr || '') + '|' + (r.account_nbr || '') + '|' + (r.county || '') + '|' + (r.uid || '')),
      // Encode firm + sale_type so the dashboard can score (struck-off etc.)
      source,
      state: r.state || 'TX',
      county: r.county || null,
      apn: r.account_nbr || null,
      owner_name: r.owner_name || null,
      owner_address: mailAddr,
      property_address: propAddr,
      legal_description: [r.status, sc.discount_pct != null ? `${sc.discount_pct}% disc` : null].filter(Boolean).join(' · ') || null,
      acres: null,
      minimum_bid: r.minimum_bid || null,
      judgment_amount: r.value || null, // assessed/market value
      sale_date: r.sale_date_only || r.sale_date || null,
      case_number: r.cause_nbr || null,
      raw_url: null,
      scraped_at: r.created_at || new Date().toISOString(),
      lat: r.lat || null,
      lng: r.lon || null,
      dd_checked: false,
      final_score: Math.max(0, sc.deal_score - redemptionPenalty(r.state, source)),
      ...sc,
      ...ex,
    };
  });
  await insertAll(mapped, 'TaxSales');
}

(async () => {
  console.log('→ Supabase migrate başlıyor...');
  await migrateListings();
  await migrateTaxSales();
  console.log('✅ Migrate tamam.');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
