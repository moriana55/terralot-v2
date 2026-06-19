/**
 * Tennessee delinquent property-tax scraper  (source = 'TAX:TN')
 * ----------------------------------------------------------------------------
 * KAYNAK: tndtax.com — birden çok TN county için ortak "Tennessee Delinquent
 * Tax" arama portalı (Sullivan County Chancery Court sayfasından linklenir).
 * Sunucu-taraflı DataTables JSON ucu (`hits.php`) yapısal veri döner; PDF
 * parse / OCR gerekmez, Cloudflare / geo-block YOK, Puppeteer GEREKMEZ.
 *
 * Akış (her entity için):
 *   1) index.php?state=TN&entity=<NAME>&site=full   → oturum çerezini al
 *   2) search.php  (POST, geniş arama: owner_name="a")  → DataTable kabuğu
 *   3) hits.php?iDisplayLength=1000                  → tüm satırlar (JSON aaData)
 *
 * aaData kolon sırası (portal thead'inden doğrulandı):
 *   [0] Owner  [1] PropertyAddress  [2] ControlMap  [3] Group  [4] Parcel
 *   [5] SI  [6] Subdivision  [7] Lot  [8] ReceiptYear  [9] Status  [10] AmountDue
 *
 * Hedef şema (migrate_to_supabase.js / tax_sales ile uyumlu):
 *   state, county, apn, owner_name, minimum_bid, value, acres, address, source
 *
 * KULLANIM:
 *   node scrape_tennessee.js            # TEST: fetch + parse + console.log (DB'ye YAZMAZ)
 *   node scrape_tennessee.js --write    # zillow_listings.db -> tax_sales tablosuna yazar
 *
 * NOT: --write olmadan veritabanına HİÇBİR ŞEY yazılmaz (görev gereği test modu).
 */

'use strict';

const BASE = 'https://tndtax.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const WRITE = process.argv.includes('--write');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── küçük yardımcılar ───────────────────────────────────────────────────────
const stripHtml = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// Set-Cookie başlıklarından basit bir Cookie değeri toplayıcı (PHPSESSID vs.)
function collectCookies(res, jar) {
  // node-fetch v2: res.headers.raw()['set-cookie'] ; global fetch: getSetCookie()
  let raw = [];
  try {
    if (typeof res.headers.getSetCookie === 'function') raw = res.headers.getSetCookie();
    else if (typeof res.headers.raw === 'function') raw = res.headers.raw()['set-cookie'] || [];
    else { const sc = res.headers.get('set-cookie'); if (sc) raw = [sc]; }
  } catch { /* ignore */ }
  for (const line of raw) {
    const kv = line.split(';')[0];
    const i = kv.indexOf('=');
    if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

// fetch'i çöz (Node 18+ global fetch yoksa node-fetch'e düş)
let _fetch = global.fetch;
if (typeof _fetch !== 'function') {
  try { _fetch = require('node-fetch'); } catch { /* fetch yok */ }
}

// Portal tek bir aramada en çok 500 satır döndürür. Büyük county'lerde tam
// kapsama için owner_name'i birden çok harf "seed"i ile sorgulayıp birleştiririz.
const SEARCH_SEEDS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

// Tek bir seed için arama yapıp ham satırları döndür (oturum tekrar kullanılır).
async function searchSeed(initUrl, jar, seed) {
  const form = new URLSearchParams();
  form.set('searchType', 'namefields');
  form.set('search[15]', seed);       // owner_name içinde geçen
  form.set('search[76:=:0]', 'use');  // gizli portal alanı
  form.set('showAll', '1');
  let res = await _fetch(`${BASE}/search.php`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': initUrl,
      'Cookie': cookieHeader(jar),
    },
    body: form.toString(),
  });
  collectCookies(res, jar);
  await res.text();

  res = await _fetch(`${BASE}/hits.php?sEcho=1&iDisplayStart=0&iDisplayLength=100000`, {
    headers: { 'User-Agent': UA, 'Referer': `${BASE}/search.php`, 'Cookie': cookieHeader(jar) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { return { capped: false, rows: [] }; }
  const rows = Array.isArray(json.aaData) ? json.aaData : [];
  return { capped: (json.iTotalRecords || rows.length) >= 500, rows };
}

// ── tek bir entity'yi çek (seed birleştirme + APN dedup) ────────────────────
async function fetchEntity(entityName) {
  const jar = {};
  const initUrl = `${BASE}/index.php?state=TN&entity=${encodeURIComponent(entityName)}&site=full`;

  // 1) Oturum + entity seçimi
  let res = await _fetch(initUrl, { headers: { 'User-Agent': UA } });
  collectCookies(res, jar);
  await res.text();

  // 2) Önce tek seed ("a"); 500'e takılmazsa o yeterli, takılırsa tüm seed'leri tara
  const seen = new Map(); // dedupKey -> rawRow
  const addRows = (rows) => {
    for (const r of rows) {
      const key = [r[2], r[3], r[4], r[8], r[0]].map((x) => String(x || '')).join('|'); // map|grp|parcel|yr|owner
      if (!seen.has(key)) seen.set(key, r);
    }
  };

  const first = await searchSeed(initUrl, jar, 'a');
  addRows(first.rows);
  if (first.capped) {
    // 500 sınırına dayandı → daha geniş kapsama için kalan seed'leri tara
    for (const seed of SEARCH_SEEDS) {
      if (seed === 'a') continue;
      try {
        const { rows } = await searchSeed(initUrl, jar, seed);
        addRows(rows);
      } catch { /* seed atla */ }
      await sleep(250);
    }
  }

  const rows = [...seen.values()];
  return { total: rows.length, rows, capped: first.capped };
}

// aaData satırını hedef şemaya çevir
function mapRow(r, entityName) {
  const owner = stripHtml(r[0]);
  const address = stripHtml(r[1]);
  const map = stripHtml(r[2]);
  const group = stripHtml(r[3]);
  const parcel = stripHtml(r[4]);
  const year = stripHtml(r[8]);
  const status = stripHtml(r[9]).toUpperCase();
  const amountDue = num(r[10]);

  // APN = ControlMap-Group-Parcel (TN parsel kimliği bu üçlüdür)
  const apn = [map, group, parcel].filter(Boolean).join('-') || null;

  // County adı: "SULLIVAN: Kingsport" / "Sullivan County" / "CHESTER" → normalize
  const county = entityName.replace(/\s*county\s*$/i, '').trim().toUpperCase() + ' COUNTY';

  return {
    state: 'TN',
    county,
    apn,
    owner_name: owner || 'UNKNOWN OWNER',
    minimum_bid: amountDue,   // delinquent tax due = açılış / minimum bid eşdeğeri
    value: null,              // portal piyasa değeri vermiyor (enrichment ayrı adım)
    acres: null,              // portalda yok
    address: address || null,
    source: 'TAX:TN',
    // ek alanlar (DB yazımı için faydalı, hedef şemanın dışında):
    _receipt_year: year,
    _status: status,
  };
}

// ── opsiyonel DB yazımı (--write) ───────────────────────────────────────────
function writeToDb(records) {
  const path = require('path');
  const Database = require('better-sqlite3');
  const db = new Database(path.join(__dirname, 'zillow_listings.db'));

  // tax_sales tablosu yoksa oluştur (diğer scrape_*_live.js ile aynı şema)
  db.exec(`CREATE TABLE IF NOT EXISTS tax_sales (
    uid TEXT PRIMARY KEY, state TEXT, county TEXT,
    prop_address_one TEXT, prop_city TEXT, prop_state TEXT, prop_zipcode TEXT,
    value INTEGER, minimum_bid REAL, discount_pct REAL,
    sale_type TEXT, status TEXT, sale_date TEXT, sale_date_only TEXT,
    cause_nbr TEXT, account_nbr TEXT, owner_name TEXT, source TEXT, created_at TEXT
  )`);

  const stmt = db.prepare(`INSERT OR REPLACE INTO tax_sales (
    uid, state, county, prop_address_one, prop_city, prop_state, prop_zipcode,
    value, minimum_bid, discount_pct, sale_type, status, sale_date, sale_date_only,
    cause_nbr, account_nbr, owner_name, source, created_at
  ) VALUES (
    @uid, @state, @county, @prop_address_one, @prop_city, @prop_state, @prop_zipcode,
    @value, @minimum_bid, @discount_pct, @sale_type, @status, @sale_date, @sale_date_only,
    @cause_nbr, @account_nbr, @owner_name, @source, datetime('now')
  )`);

  const tx = db.transaction((list) => {
    for (const p of list) {
      stmt.run({
        uid: `TNDTAX_TN_${p.county.replace(/\s+/g, '')}_${p.apn || 'NA'}_${p._receipt_year || ''}`,
        state: 'TN',
        county: p.county,
        prop_address_one: p.address || `${p.county} Property`,
        prop_city: null,
        prop_state: 'TN',
        prop_zipcode: null,
        value: p.value,
        minimum_bid: p.minimum_bid,
        discount_pct: null,
        sale_type: 'Delinquent Tax Sale',
        status: p._status === 'UNPAID' ? 'Delinquent (Unpaid)' : 'Paid/Redeemed',
        sale_date: null,
        sale_date_only: null,
        cause_nbr: p._receipt_year ? `RCT-${p._receipt_year}` : null,
        account_nbr: p.apn,
        owner_name: p.owner_name,
        source: 'TAX:TN',
      });
    }
  });
  tx(records);
  db.close();
  return records.length;
}

// ── ana akış ────────────────────────────────────────────────────────────────
(async () => {
  if (typeof _fetch !== 'function') {
    console.error('HATA: global fetch yok ve node-fetch bulunamadı.');
    process.exit(1);
  }

  console.log('→ Tennessee delinquent-tax scraper (tndtax.com)');
  console.log(`  Mod: ${WRITE ? 'WRITE (DB) ' : 'TEST (sadece console.log, DB YAZILMAZ)'}\n`);

  // Portalın yayınladığı entity listesini al
  let entities = [];
  try {
    const r = await _fetch(`${BASE}/api.php?option=entityList`, { headers: { 'User-Agent': UA } });
    const j = await r.json();
    entities = (j || []).map((e) => e.entityName).filter(Boolean);
  } catch (e) {
    console.error('  entityList alınamadı:', e.message);
  }
  if (!entities.length) {
    // güvenli geri-düşüş (gözlemlenen entity'ler)
    entities = ['CHESTER', 'Sullivan County', 'SULLIVAN: Kingsport'];
  }
  console.log(`  Bulunan entity sayısı: ${entities.length} → ${entities.join(' | ')}\n`);

  let all = [];
  for (const ent of entities) {
    try {
      const { total, rows, capped } = await fetchEntity(ent);
      const mapped = rows.map((r) => mapRow(r, ent));
      const unpaid = mapped.filter((m) => m._status === 'UNPAID').length;
      console.log(`  ✓ ${ent}: ${rows.length} benzersiz satır${capped ? ' (a–z/0-9 seed taraması)' : ''} | UNPAID: ${unpaid}`);
      all = all.concat(mapped);
    } catch (e) {
      console.error(`  ✗ ${ent}: ${e.message}`);
    }
    await sleep(600);
  }

  console.log(`\n  TOPLAM toplanan: ${all.length} kayıt`);

  // Örnek çıktı (ilk 8) — hedef şema alanları
  console.log('\n  ── Örnek kayıtlar (hedef şema) ──');
  for (const p of all.slice(0, 8)) {
    console.log('  ' + JSON.stringify({
      state: p.state, county: p.county, apn: p.apn, owner_name: p.owner_name,
      minimum_bid: p.minimum_bid, value: p.value, acres: p.acres, address: p.address,
      source: p.source, status: p._status, year: p._receipt_year,
    }));
  }

  if (WRITE) {
    const n = writeToDb(all);
    console.log(`\n✅ DB'ye yazıldı: ${n} kayıt (tax_sales, source=TAX:TN).`);
    console.log('   Supabase\'e taşımak için: node migrate_to_supabase.js');
  } else {
    console.log('\n⚠️  TEST modu: veritabanına HİÇBİR ŞEY yazılmadı (--write ile yazabilirsin).');
  }
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
