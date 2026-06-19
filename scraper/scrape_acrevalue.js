/**
 * scrape_acrevalue.js — bölge ($/acre) emsal (COMP) çıkarıcı.
 *
 * AMAÇ: Tax-delinquent kaynaklarımız "assessed value" vermiyor. Bu yüzden
 * deal skorundaki (scoring.js → scoreDeal({ value })) "value" şişiyor/zayıf.
 * Burada state ve state/county bazında MEDIAN $/acre emsali üretip, ileride
 * bir parselin değerini DÜRÜST tahmin ediyoruz:  est_value = acres × $/acre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NEDEN AcreValue DEĞİL (araştırma sonucu):
 *   acrevalue.com/sales/<STATE>/ sayfası Next.js/JS ile render ediliyor; düz
 *   fetch yalnızca iskeleti döndürüyor (613KB HTML ama price/acre verisi YOK,
 *   __NEXT_DATA__ yok). Bulunan tek API'ler /api/data/{user,tilesets,cdl,ndvi}
 *   — yani harita karoları/uydu verisi, $/acre SATIŞ emsali değil. Gerçek
 *   "comparable sales" + parsel value AcreValue Pro aboneliği + login arkasında
 *   (Enterprise için "custom data export" teklif ediliyor). Yani AcreValue
 *   public/keyless olarak $/acre comp VERMİYOR → bloklu.
 *
 * BU YÜZDEN iki ÇALIŞAN, ücretsiz, key-gerektirmeyen kaynak kullanıyoruz:
 *
 *   Kaynak A (BIRINCIL, key yok, install yok) — bizim mevcut Supabase
 *     `competitor_listings` tablosu. Landio/DiscountLots/Rina'dan çekilen
 *     gerçek ASKING fiyat + acres var → $/acre = price / acres. 279 satırın
 *     273'ünde price+acres dolu. State ve state/county median'ı çıkarıyoruz.
 *     (NOT: asking price = retail tavan; piyasa değeri için bir HAIRCUT
 *     uyguluyoruz, aşağıya bak.)
 *
 *   Kaynak B (OPSIYONEL, ücretsiz key) — USDA NASS QuickStats AG LAND
 *     "ASSET VALUE" ($/ACRE), state ve county seviyesinde. Tarım arazisi
 *     değeri; arsa için zemin/taban değer referansı. Key e-posta ile anında
 *     ücretsiz: https://quickstats.nass.usda.gov/api  (.env → NASS_API_KEY=...)
 *     Key yoksa otomatik atlanır (401 unauthorized).
 *
 * KISIT: Paylaşılan Supabase tablolarına YAZMAZ (sadece SELECT). Sadece bu
 *   dosya — diğer scraper'lara dokunulmadı. npm install yok (Node 20+ yerleşik
 *   fetch + mevcut @supabase/supabase-js + dotenv kullanılıyor).
 *
 * KULLANIM:
 *   node scrape_acrevalue.js                 # tümü, console.log
 *   node scrape_acrevalue.js --json          # JSON çıktı
 *   ACREVALUE_HAIRCUT=0.65 node scrape_acrevalue.js   # asking→değer çarpanı
 *   NASS_API_KEY=xxxx node scrape_acrevalue.js        # NASS'i de ekle
 *
 * PROGRAMATİK:
 *   const { buildAcreComps, estimateValue } = require('./scrape_acrevalue');
 *   const comps = await buildAcreComps();
 *   const val = estimateValue(comps, { state:'TX', county:'Presidio', acres:12.5 });
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// scoring.js ile aynı state→abbr eşlemesi (tek kaynak, kopya tutarlılığı).
let stAbbr;
try { ({ stAbbr } = require('./scoring')); }
catch {
  const M = { Texas:'TX',Florida:'FL',Georgia:'GA',Tennessee:'TN','North Carolina':'NC','New York':'NY',Arizona:'AZ','New Mexico':'NM',Colorado:'CO',California:'CA',Arkansas:'AR',Nevada:'NV',Maryland:'MD',Missouri:'MO',Indiana:'IN','South Carolina':'SC',Louisiana:'LA',Alabama:'AL',Mississippi:'MS',Oklahoma:'OK',Kansas:'KS',Kentucky:'KY' };
  stAbbr = (s) => { if(!s) return null; s=String(s).trim(); return /^[A-Za-z]{2}$/.test(s)?s.toUpperCase():(M[s]||null); };
}

// asking fiyat = retail tavan. Piyasa/likidite değeri için indirim.
// 0.60 = "tipik askings, hızlı satış için ~%40 altı". Konservatif tut.
const HAIRCUT = parseFloat(process.env.ACREVALUE_HAIRCUT || '0.60');
const MIN_SAMPLES = parseInt(process.env.ACREVALUE_MIN_SAMPLES || '3', 10);

const cnorm = (c) => (c == null ? null : String(c).replace(/county/i, '').trim().toUpperCase() || null);
const median = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// ── Kaynak A: competitor_listings → asking $/acre (gerçek ilan verisi) ──────
async function fromCompetitorListings() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.warn('competitor_listings atlandı: SUPABASE_URL/KEY yok.'); return { stateRows: [], countyRows: [] }; }
  const supabase = createClient(url, key);
  // SADECE OKUMA.
  const { data, error } = await supabase
    .from('competitor_listings')
    .select('state, county, acres, price')
    .not('price', 'is', null).not('acres', 'is', null).gt('acres', 0).gt('price', 0)
    .limit(5000);
  if (error) { console.warn('competitor_listings SELECT hatası:', error.message); return { stateRows: [], countyRows: [] }; }

  const byState = {}, byCounty = {};
  for (const r of data) {
    const st = stAbbr(r.state); if (!st) continue;
    const ppa = r.price / r.acres;
    if (!isFinite(ppa) || ppa <= 0 || ppa > 5_000_000) continue; // aykırı temizliği
    (byState[st] ||= []).push(ppa);
    const co = cnorm(r.county);
    if (co) (byCounty[`${st}/${co}`] ||= []).push(ppa);
  }
  const stateRows = Object.entries(byState).map(([st, v]) => mk('competitor', st, null, v));
  const countyRows = Object.entries(byCounty).map(([k, v]) => { const [st, co] = k.split('/'); return mk('competitor', st, co, v); });
  return { stateRows, countyRows };
}

// ── Kaynak B: USDA NASS QuickStats AG LAND ASSET VALUE ($/ACRE) ─────────────
// Ücretsiz key gerekir (NASS_API_KEY). Yoksa sessizce atlanır.
async function fromNass(states) {
  const key = process.env.NASS_API_KEY;
  if (!key) { console.warn('NASS atlandı: NASS_API_KEY .env\'de yok (ücretsiz: quickstats.nass.usda.gov/api).'); return { stateRows: [], countyRows: [] }; }
  const base = 'https://quickstats.nass.usda.gov/api/api_GET/';
  const stateRows = [], countyRows = [];
  for (const st of states) {
    for (const level of ['STATE', 'COUNTY']) {
      const p = new URLSearchParams({
        key, source_desc: 'SURVEY', sector_desc: 'ECONOMICS', group_desc: 'FARMS & LAND & ASSETS',
        commodity_desc: 'AG LAND', statisticcat_desc: 'ASSET VALUE', unit_desc: '$ / ACRE',
        agg_level_desc: level, state_alpha: st, format: 'JSON',
      });
      try {
        const r = await fetch(base + '?' + p, { headers: { 'user-agent': 'terralot-comp/1.0' } });
        if (r.status === 401) { console.warn('NASS 401 unauthorized — key geçersiz.'); return { stateRows, countyRows }; }
        if (!r.ok) continue;
        const j = await r.json();
        const rows = Array.isArray(j.data) ? j.data : [];
        // En yeni yılı seç
        let best = {};
        for (const d of rows) {
          const v = parseFloat(String(d.Value).replace(/[,$]/g, ''));
          if (!isFinite(v) || v <= 0) continue;
          const yr = parseInt(d.year, 10) || 0;
          const place = level === 'COUNTY' ? cnorm(d.county_name) : '_';
          if (!place) continue;
          const cur = best[place];
          if (!cur || yr > cur.yr) best[place] = { yr, v };
        }
        for (const [place, { v, yr }] of Object.entries(best)) {
          if (level === 'STATE') stateRows.push(mk('nass', st, null, [v], { year: yr }));
          else countyRows.push(mk('nass', st, place, [v], { year: yr }));
        }
      } catch (e) { console.warn(`NASS ${st}/${level} hata:`, e.message); }
      await new Promise((r) => setTimeout(r, 400)); // nazik ol
    }
  }
  return { stateRows, countyRows };
}

// Tek satır comp kaydı üret. samples=[ $/acre, ... ]
function mk(source, state, county, samples, extra = {}) {
  const med = median(samples);
  return {
    source, state, county: county || null,
    n: samples.length,
    asking_per_acre: med != null ? Math.round(med) : null,
    // competitor = asking (retail tavan) → haircut uygula; nass zaten değer.
    value_per_acre: med != null ? Math.round(source === 'competitor' ? med * HAIRCUT : med) : null,
    min_per_acre: samples.length ? Math.round(Math.min(...samples)) : null,
    max_per_acre: samples.length ? Math.round(Math.max(...samples)) : null,
    ...extra,
  };
}

// ── Birleştirme ────────────────────────────────────────────────────────────
async function buildAcreComps() {
  const a = await fromCompetitorListings();
  const states = [...new Set(a.stateRows.map((r) => r.state))];
  const b = await fromNass(states);

  // İndeksle: key → { competitor, nass }
  const stateIdx = {}, countyIdx = {};
  const idx = (m, rows) => { for (const r of rows) { const k = r.county ? `${r.state}/${r.county}` : r.state; (m[k] ||= {})[r.source] = r; } };
  idx(stateIdx, a.stateRows); idx(stateIdx, b.stateRows);
  idx(countyIdx, a.countyRows); idx(countyIdx, b.countyRows);
  return { stateIdx, countyIdx };
}

// İleride scoring.js value beslemesi için: parsel value tahmini.
// Önce county comp, yoksa state comp. competitor (haircut'lı) önceliklenir,
// yoksa nass taban olarak. Yeterli örnek yoksa null döner → "value yok" dürüst.
function estimateValue(comps, { state, county, acres }) {
  const st = stAbbr(state); if (!st || !acres || acres <= 0) return null;
  const co = cnorm(county);
  // scopeLabel: county fallback'ta tek-örnek competitor'a izin var (lokal sinyal),
  // state fallback'ta DEĞİL — tek ilan tüm eyaleti temsil edemez, çarpıtır.
  const pickPerAcre = (entry, allowThin) => {
    if (!entry) return null;
    const c = entry.competitor;
    if (c && c.n >= MIN_SAMPLES && c.value_per_acre) return { per_acre: c.value_per_acre, basis: `competitor·${c.n}` };
    if (entry.nass && entry.nass.value_per_acre) return { per_acre: entry.nass.value_per_acre, basis: `nass ${entry.nass.year || ''}`.trim() };
    if (allowThin && c && c.value_per_acre) return { per_acre: c.value_per_acre, basis: `competitor·${c.n} (az örnek)` };
    return null;
  };
  let hit = co ? pickPerAcre(comps.countyIdx[`${st}/${co}`], true) : null;
  let scope = 'county';
  if (!hit) { hit = pickPerAcre(comps.stateIdx[st], false); scope = 'state'; }
  if (!hit) return null;
  return { est_value: Math.round(hit.per_acre * acres), per_acre: hit.per_acre, scope, basis: hit.basis, acres };
}

module.exports = { buildAcreComps, estimateValue, fromCompetitorListings, fromNass };

// ── CLI / TEST (DB'ye YAZMAZ) ───────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log('AcreValue $/acre COMP çıkarıcı — kaynaklar: competitor_listings (+ NASS opsiyonel)\n');
    const comps = await buildAcreComps();

    const states = Object.values(comps.stateIdx);
    console.log(`\n══ STATE bazında $/acre (n=ilan sayısı, value=asking×${HAIRCUT} haircut) ══`);
    const stateRows = states.map((e) => e.competitor).filter(Boolean).sort((a, b) => b.n - a.n);
    for (const r of stateRows) {
      const nass = comps.stateIdx[r.state]?.nass;
      console.log(
        `${r.state.padEnd(3)} | n=${String(r.n).padStart(3)} | asking $${(r.asking_per_acre||0).toLocaleString().padStart(9)}/ac` +
        ` → value $${(r.value_per_acre||0).toLocaleString().padStart(9)}/ac` +
        (nass ? ` | NASS ag-land $${nass.value_per_acre.toLocaleString()}/ac (${nass.year})` : '')
      );
    }

    console.log('\n══ COUNTY örnekleri ($/acre, en çok ilanı olanlar) ══');
    const counties = Object.values(comps.countyIdx).map((e) => e.competitor).filter(Boolean).sort((a, b) => b.n - a.n).slice(0, 15);
    for (const r of counties) {
      console.log(`${r.state}/${(r.county||'').padEnd(12)} | n=${String(r.n).padStart(2)} | asking $${(r.asking_per_acre||0).toLocaleString()}/ac → value $${(r.value_per_acre||0).toLocaleString()}/ac`);
    }

    // Parsel value tahmini DEMO — db.js'teki mock off-market lead'lerle.
    console.log('\n══ PARSEL VALUE TAHMİNİ DEMO (acres × $/acre) ══');
    const demos = [
      { state: 'TX', county: 'Presidio', acres: 12.5 },
      { state: 'AZ', county: 'Cochise', acres: 5.0 },
      { state: 'MO', county: 'Douglas', acres: 22.1 },
      { state: 'NM', county: 'Taos', acres: 8.2 },
      { state: 'TN', county: 'Stewart', acres: 17.2 },
      { state: 'CO', county: 'Saguache', acres: 40 },
    ];
    for (const d of demos) {
      const e = estimateValue(comps, d);
      console.log(
        `${d.state}/${d.county} ${d.acres}ac → ` +
        (e ? `est_value $${e.est_value.toLocaleString()} ($${e.per_acre.toLocaleString()}/ac, ${e.scope}, ${e.basis})`
           : 'COMP YOK → value=null (dürüst, skorlamada nötr)')
      );
    }

    if (process.argv.includes('--json')) {
      console.log('\n--- JSON ---');
      console.log(JSON.stringify(comps, null, 2));
    }
    console.log('\nNOT: Paylaşılan DB\'ye HİÇBİR yazma yapılmadı (sadece SELECT).');
  })().catch((e) => { console.error('FATAL:', e); process.exit(1); });
}
