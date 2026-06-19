/**
 * Michigan statewide tax-foreclosure auction harvester — tax-sale.info (Title-Check, LLC).
 *
 * Title-Check, LLC tüm Michigan county'lerinin "deed" (tapu) bazlı arsa/parsel
 * ihalelerini TEK arayüzde (tax-sale.info) yayınlar. ~75 county, ucuz arsa için
 * ideal kaynak. Sayfalar server-rendered HTML olduğu için Puppeteer GEREKMEZ —
 * native fetch + regex yeterli (anti-bot yok).
 *
 * Akış:
 *   1. /auctions            → her county için catalog ID + isim + satış tarihi
 *   2. /listings/catalog/ID → o county'deki tüm lot ID'leri
 *   3. /lot/showPreview/id/ID → parsel detayı (min bid, SEV, adres, parcel, acres)
 *
 * Çıkış alanları (migrate hedefi ile uyumlu):
 *   state, county, apn, owner_name, minimum_bid, value, acres, address, source
 *   source = 'TAX:MI'
 *
 * KULLANIM:
 *   node scrape_michigan.js                 # ~3 county örnekle, sadece console.log
 *   MI_CATALOGS=2880,2831 node scrape_michigan.js   # belirli catalog ID'leri
 *   MI_MAX_CATALOGS=5 MI_MAX_LOTS=40 node scrape_michigan.js
 *
 * NOT: Bu script TEST amaçlıdır — data.db / Supabase'e YAZMAZ, sadece parse edip
 * console'a basar. DB entegrasyonu migrate_to_supabase.js deseniyle eklenebilir.
 */

const BASE = 'https://www.tax-sale.info';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAX_CATALOGS = parseInt(process.env.MI_MAX_CATALOGS || '3', 10);
const MAX_LOTS = parseInt(process.env.MI_MAX_LOTS || '8', 10); // catalog başına test edilecek lot
const ONLY_CATALOGS = (process.env.MI_CATALOGS || '').split(',').map((s) => s.trim()).filter(Boolean);

// ── HTTP yardımcısı (redirect takipli) ──────────────────────────────────────
async function get(path, depth = 0) {
  const url = path.startsWith('http') ? path : BASE + path;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.text();
}

// ── Parse yardımcıları ──────────────────────────────────────────────────────
const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// "Label: <...>value</li>" kalıbından <li> içindeki etiket-değerini çeker.
// Tüm <li>'leri düz metne indirip "Label: value" eşleştirir (en sağlam yöntem).
function fieldsFromLis(html) {
  const lis = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 2 && t.length < 400);
  const out = {};
  for (const t of lis) {
    const m = t.match(/^([A-Za-z][A-Za-z .]+?):\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      if (!(key in out)) out[key] = m[2].trim();
    }
  }
  return out;
}

// Legal description içinden "ACRES = 6.06" gibi alanı yakala.
function acresFromText(...texts) {
  for (const t of texts) {
    if (!t) continue;
    const m = String(t).match(/ACRES?\s*[=:]?\s*([\d.]+)/i) || String(t).match(/([\d.]+)\s*ACRES?/i);
    if (m) { const a = parseFloat(m[1]); if (a > 0 && a < 100000) return a; }
  }
  return null;
}

function isoDate(v) {
  if (!v) return null;
  const s = String(v);
  // "August 03, 2026"
  const MON = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  let m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);
  if (m) { const mm = MON[m[1].slice(0, 3).toLowerCase()]; if (mm) return `${m[3]}-${mm}-${String(m[2]).padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  return null;
}

// ── 1) Auction takviminden catalog ID + county + tarih ──────────────────────
async function getCatalogs() {
  const html = await get('/auctions');
  // /auctions sayfasında catalog linkleri: <a href="/listings/catalog/2831">Arenac</a>
  // Linkin metni county adını verir; tarih en yakın auction satırından gelir.
  const cats = [];
  const seen = new Set();
  const re = /<a[^>]*href="\/listings\/catalog\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    let name = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    name = name.replace(/\bDNR\b/i, 'DNR').trim() || `Catalog ${id}`;
    cats.push({ id, county: name });
  }
  return cats;
}

// ── 2) Catalog sayfasından lot ID listesi ───────────────────────────────────
async function getLotIds(catalogId) {
  const html = await get(`/listings/catalog/${catalogId}`);
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const countyName = title.replace(/Listings.*/i, '').replace(/-.*/, '').trim() || `Catalog ${catalogId}`;
  const ids = [...new Set([...html.matchAll(/\/lot\/show(?:Preview)?\/id\/(\d+)/g)].map((x) => x[1]))];
  return { countyName, ids };
}

// ── 3) Lot detayı parse ─────────────────────────────────────────────────────
async function parseLot(lotId, county) {
  const html = await get(`/lot/showPreview/id/${lotId}`);
  const f = fieldsFromLis(html);

  const minBid = num((html.match(/Minimum Bid:\s*<\/span>\s*([^<]+)/i) || [])[1] || f['minimum bid']);
  const value = num(f['sev']); // SEV = State Equalized Value ≈ assessed value (×2 ≈ market)
  const apn = (f['parcel id'] || f['parcel number'] || null);
  const address = f['address'] || null;
  const legal = f['legal description'] || null;
  const acres = acresFromText(legal, f['acres']);
  const h2 = (html.match(/<h2[^>]*>([^<]+)<\/h2>/i) || [])[1] || '';
  // başlık "...Acres, Standish" → şehir son virgülden sonra
  const city = (h2.match(/,\s*([A-Za-z .'-]+)\s*$/) || [])[1] || null;

  return {
    state: 'MI',
    county,
    apn,
    owner_name: 'County Foreclosure', // tax-sale.info eski sahip ismini yayınlamaz (devlet el koymuş)
    minimum_bid: minBid,
    value,
    acres,
    address: address || (city ? `${city}, MI` : null),
    source: 'TAX:MI',
    lot_id: lotId,
    raw_url: `${BASE}/lot/showPreview/id/${lotId}`,
  };
}

// ── Ana akış ────────────────────────────────────────────────────────────────
(async () => {
  console.log('→ tax-sale.info (Michigan / Title-Check) taranıyor...\n');

  let catalogs = await getCatalogs();
  console.log(`  /auctions: ${catalogs.length} county catalog bulundu.`);
  if (ONLY_CATALOGS.length) {
    catalogs = catalogs.filter((c) => ONLY_CATALOGS.includes(c.id));
  }
  catalogs = catalogs.slice(0, MAX_CATALOGS);
  console.log(`  Test edilecek catalog: ${catalogs.map((c) => `${c.county}(${c.id})`).join(', ')}\n`);

  const rows = [];
  for (const cat of catalogs) {
    try {
      const { countyName, ids } = await getLotIds(cat.id);
      const county = (cat.county && cat.county !== `Catalog ${cat.id}`) ? cat.county : countyName;
      const slice = ids.slice(0, MAX_LOTS);
      console.log(`  ▸ ${county} (catalog ${cat.id}): ${ids.length} lot → ${slice.length} tanesi test ediliyor`);
      for (const lotId of slice) {
        try {
          const row = await parseLot(lotId, county);
          rows.push(row);
        } catch (e) {
          console.error(`    ✗ lot ${lotId}: ${e.message}`);
        }
        await sleep(300); // nazik ol
      }
    } catch (e) {
      console.error(`  ✗ catalog ${cat.id}: ${e.message}`);
    }
    await sleep(500);
  }

  // ── Sonuç raporu (DB'ye YAZILMAZ) ─────────────────────────────────────────
  console.log(`\n========== SONUÇ: ${rows.length} parsel parse edildi ==========\n`);
  const sample = rows.slice(0, 6);
  for (const r of sample) {
    const disc = (r.value && r.minimum_bid) ? Math.round((1 - r.minimum_bid / r.value) * 100) : null;
    console.log(JSON.stringify({
      state: r.state, county: r.county, apn: r.apn, owner_name: r.owner_name,
      minimum_bid: r.minimum_bid, value: r.value, acres: r.acres, address: r.address,
      source: r.source, discount_pct: disc,
    }, null, 0));
  }

  // İstatistik
  const withBid = rows.filter((r) => r.minimum_bid != null).length;
  const withVal = rows.filter((r) => r.value != null).length;
  const withApn = rows.filter((r) => r.apn).length;
  const withAcres = rows.filter((r) => r.acres != null).length;
  const cheap = rows.filter((r) => r.minimum_bid != null && r.minimum_bid < 2000).length;
  console.log(`\n  Doluluk → minimum_bid:${withBid}/${rows.length} · value(SEV):${withVal} · apn:${withApn} · acres:${withAcres}`);
  console.log(`  Ucuz parsel (min bid < $2000): ${cheap}`);
  console.log('\n  NOT: Test modu — hiçbir veri data.db/Supabase\'e yazılmadı.');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
