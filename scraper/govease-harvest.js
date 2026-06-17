/**
 * GovEase harvester — nationwide UPCOMING tax-sale calendar.
 * GovEase publishes its live/upcoming auctions via a public Awesome Table
 * (Google Sheet). We read it directly (no anti-bot) and store the calendar in
 * Supabase `upcoming_sales`: which county/state has a sale, when, sale type,
 * and a link to that auction's parcel list.
 *
 *   node govease-harvest.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SHEET_ID = '1Slyxj3HwCgnKv60z8DijQPzgUrIRH1xQNeUKjr5mnYs';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);

function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (q && text[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { row.push(cur); cur = ''; }
    else if ((c === '\n' || c === '\r') && !q) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function isoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  return null;
}
const numOrNull = (v) => { const n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };

(async () => {
  console.log('→ GovEase takvimi indiriliyor...');
  const res = await fetch(CSV_URL, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) { console.error('CSV HTTP', res.status); process.exit(1); }
  const rows = parseCSV(await res.text());
  // header row 0, config row 1 (filter metadata) — data from row 2
  const out = [];
  for (const r of rows.slice(2)) {
    const county = (r[2] || '').trim();
    const state = (r[3] || '').trim().toUpperCase();
    if (!STATES.has(state) || !county || /hidden/i.test(county)) continue;
    out.push({
      source: 'GOVEASE',
      county,
      state,
      registration_date: isoDate(r[4]),
      sale_date: isoDate(r[7]),
      sale_type: (r[9] || '').trim() || null,
      parcel_list_url: (r[10] || '').trim() || null,
      address: (r[14] || '').trim() || null,
      lat: numOrNull(r[15]),
      lng: numOrNull(r[16]),
      scraped_at: new Date().toISOString(),
    });
  }
  console.log(`  ${out.length} yaklaşan satış parse edildi.`);
  if (!out.length) return;

  await supabase.from('upcoming_sales').delete().eq('source', 'GOVEASE');
  let n = 0;
  for (let i = 0; i < out.length; i += 200) {
    const { error } = await supabase.from('upcoming_sales').insert(out.slice(i, i + 200));
    if (error) console.error('  insert hata:', error.message);
    else n += out.slice(i, i + 200).length;
  }
  const states = new Set(out.map((r) => r.state));
  const upcoming = out.filter((r) => r.sale_date && r.sale_date >= new Date().toISOString().slice(0, 10)).length;
  console.log(`✅ ${n} satış yazıldı | ${states.size} eyalet | ${upcoming} yaklaşan (gelecek tarihli)`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
