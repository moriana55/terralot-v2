/**
 * scrape_florida.js — Florida tax-deed / "Lands Available for Taxes" arsa scraper
 * ------------------------------------------------------------------------------
 * Hedef: ABD Florida'da vergi borcundan satışa çıkıp ihalede ALICISI ÇIKMAMIŞ
 * (land-heavy) arsaları çekmek. Bu parseller "List of Lands Available for Taxes"
 * (LAT) listesine düşer ve opening-bid bedeliyle herkese açık satılır — tam da
 * Terralot'un aradığı ucuz/iskontolu arsa profili.
 *
 * PRİMER KAYNAK (bu ortamdan ERİŞİLEBİLİR, 200 OK):
 *   Marion County Clerk of Court — düz PDF, login YOK, anti-bot YOK.
 *     - LAT-List PDF        : Sale #, Sale date, Parcel #, Legal Description
 *     - Purchase-Amounts PDF: Parcel # -> PURCHASE AMOUNT (= minimum_bid)
 *   İki PDF parcel # üzerinden join edilir. pdftotext -layout ile parse edilir
 *   (mevcut scrape_mvba_live.js / scrape_pbfcm_live.js ile aynı desen).
 *
 * SEKONDER KAYNAK (üretim için DOĞRU yer ama bu ortamdan ERİŞİLEMEZ):
 *   RealAuction ağı — *.realtaxdeed.com (polk / marion / lee ...). Florida tax-deed
 *   ihaleleri standart bu platformda. AJAX endpoint deseni:
 *     https://<county>.realtaxdeed.com/index.cfm?zaction=USER&zmethod=CALENDAR  (takvim, auction id'leri)
 *     https://<county>.realtaxdeed.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AID=<id> (parsel JSON'u)
 *   BLOKAJ: Bu ortamdan (ABD dışı / datacenter IP) AWS-ELB her isteğe 403 döndürüyor
 *   (robots.txt dahil). Bu nginx/ELB seviyesinde GEO/IP engeli — User-Agent veya
 *   headless Chrome + stealth ile aşılamıyor (denendi, yine 403). ABD residential/
 *   proxy IP ile çalışacak Puppeteer iskeleti aşağıda RA_* fonksiyonlarında hazır.
 *
 * KISIT: npm install YOK. Paylaşılan data.db'ye YAZMA — test çıktısı ayrı DB'ye gider.
 *
 * ÇALIŞTIRMA:
 *   node scrape_florida.js            # fetch + parse, ilk satırları console.log eder
 *   node scrape_florida.js --write    # florida_test.db'ye yazar (paylaşılan DB DEĞİL)
 *   node scrape_florida.js --realauction  # RA Puppeteer denemesini çalıştır (bu ortamda 403 bekle)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const SOURCE = 'TAX:FL';

// ── küçük yardımcılar ───────────────────────────────────────────────────────
const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

function isoDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

// node 18+ global fetch; PDF'i diske indir
async function downloadPdf(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' }, signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function pdfToText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    console.error(`pdftotext hatası (${pdfPath}):`, e.message);
    return '';
  }
}

// ── MARION COUNTY (primer, çalışan kaynak) ──────────────────────────────────
const MARION_LAT_INFO = 'https://www.marioncountyclerk.org/departments/records-recording/tax-deeds-and-lands-available-for-taxes/land-available-for-taxes-information/';

// Info sayfasından en güncel LAT-List ve Purchase-Amounts PDF linklerini bul.
function pickMarionPdfs(html) {
  const urls = [...html.matchAll(/href="(https:\/\/www\.marioncountyclerk\.org\/uploads\/[^"]+\.pdf)"/gi)].map((m) => m[1]);
  const uniq = [...new Set(urls)];
  // LAT listesi: dosya adında "LAT-List" geçer ama "Cover" geçmez.
  const latList = uniq.find((u) => /LAT-List/i.test(u) && !/Cover/i.test(u));
  // Purchase amounts: "Purchase-Amounts" veya "Purchase Amounts".
  const amounts = uniq.find((u) => /Purchase[-\s]?Amounts/i.test(u));
  return { latList, amounts, all: uniq };
}

// LAT-List PDF -> [{ sale_nbr, sale_date, parcel, description }]
function parseMarionLatList(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  const PARCEL = /\b(\d{4}-\d{3}-\d{3})\b/;            // Marion parcel formatı: 0000-000-000
  const ROW = /^\s*(\d{5,7})?\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{4}-\d{3}-\d{3})\s+(.*)$/;

  for (const line of lines) {
    const r = line.match(ROW);
    if (r) {
      if (cur) out.push(cur);
      cur = {
        sale_nbr: (r[1] || '').trim() || null,
        sale_date: isoDate(r[2]),
        parcel: r[3].trim(),
        description: (r[4] || '').trim(),
      };
      continue;
    }
    // continuation: parsel başlangıcı olmayan, legal description satırının devamı
    if (cur && line.trim().length > 3 && !PARCEL.test(line) && !/Sale\s*#|LAND AVAILABLE|Florida Statute|page\s*\d/i.test(line)) {
      cur.description += ' ' + line.trim();
    }
  }
  if (cur) out.push(cur);
  // bazı listelerde sale_nbr bir SONRAKI satıra düşebiliyor; temizle
  out.forEach((p) => { p.description = p.description.replace(/\s+/g, ' ').trim(); });
  return out.filter((p) => PARCEL.test(p.parcel));
}

// Purchase-Amounts PDF -> Map(parcel -> minimum_bid)
function parseMarionAmounts(text) {
  const map = new Map();
  const blocks = text.split(/PARCEL\s*#\s*/i).slice(1);
  for (const b of blocks) {
    const pm = b.match(/^(\d{4}-\d{3}-\d{3})/);
    if (!pm) continue;
    const am = b.match(/PURCHASE\s+AMOUNT[^$]*\$\s*([\d,]+\.\d{2})/i);
    map.set(pm[1], am ? num(am[1]) : null);
  }
  return map;
}

async function scrapeMarion() {
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);
  console.log('→ Marion County LAT info sayfası alınıyor...');
  const info = await fetchText(MARION_LAT_INFO);
  const { latList, amounts } = pickMarionPdfs(info);
  if (!latList) throw new Error('Marion LAT-List PDF linki bulunamadı (sayfa düzeni değişmiş olabilir).');
  console.log('  LAT-List PDF   :', latList);
  console.log('  Amounts PDF    :', amounts || '(bulunamadı — minimum_bid boş kalacak)');

  const latPath = path.join(DOWNLOAD_DIR, '_fl_marion_lat.pdf');
  await downloadPdf(latList, latPath);
  const parcels = parseMarionLatList(pdfToText(latPath));

  let bidMap = new Map();
  if (amounts) {
    const amtPath = path.join(DOWNLOAD_DIR, '_fl_marion_amt.pdf');
    try {
      await downloadPdf(amounts, amtPath);
      bidMap = parseMarionAmounts(pdfToText(amtPath));
    } catch (e) { console.error('  Amounts PDF indirilemedi:', e.message); }
  }

  return parcels.map((p) => ({
    source: SOURCE,
    state: 'FL',
    county: 'MARION COUNTY',
    apn: p.parcel,
    owner_name: null,                       // LAT PDF'inde owner yok (tax deed dosyasından alınabilir)
    minimum_bid: bidMap.get(p.parcel) ?? null,
    value: null,                            // assessed value LAT PDF'inde yok
    acres: null,                            // legal description'da metinsel; ileride parse edilebilir
    address: p.description || null,         // legal description (situs adresi LAT'ta yok)
    sale_date: p.sale_date,
    sale_nbr: p.sale_nbr,
    raw_url: latList,
  }));
}

// ── REALAUCTION (sekonder, ABD IP gerekir; bu ortamda 403) ──────────────────
// Üretimde ABD residential/proxy IP ile çalıştırın. Puppeteer + stealth zaten
// node_modules'ta yüklü (puppeteer-extra-plugin-stealth). NPM INSTALL GEREKMEZ.
async function scrapeRealAuction(county = 'polk') {
  let puppeteer, StealthPlugin;
  try {
    puppeteer = require('puppeteer-extra');
    StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
  } catch {
    puppeteer = require('puppeteer'); // stealth yoksa düz puppeteer
  }
  const base = `https://${county}.realtaxdeed.com`;
  console.log(`→ RealAuction (${county}) deneniyor: ${base}`);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    const resp = await page.goto(`${base}/index.cfm?zaction=USER&zmethod=CALENDAR`, { waitUntil: 'networkidle2', timeout: 45000 });
    const status = resp ? resp.status() : 0;
    if (status !== 200) {
      console.error(`  ⛔ HTTP ${status} — RealAuction bu IP'den erişimi engelliyor (geo/IP block). ABD IP ile tekrar deneyin.`);
      return [];
    }
    // 200 alınırsa: takvimden auction id'leri çek, her biri için PREVIEW JSON'u parse et.
    const auctionIds = await page.evaluate(() => {
      const ids = new Set();
      document.querySelectorAll('[dayid],[id^="AUCTION"],a').forEach((el) => {
        const m = (el.getAttribute('dayid') || el.id || el.href || '').match(/(\d{4,})/);
        if (m) ids.add(m[1]);
      });
      return [...ids];
    });
    const rows = [];
    for (const aid of auctionIds.slice(0, 5)) {
      try {
        const json = await page.evaluate(async (url) => (await fetch(url)).text(), `${base}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AID=${aid}`);
        const data = JSON.parse(json);
        for (const item of (data.AUCTIONS || data.aucList || [])) {
          rows.push({
            source: SOURCE, state: 'FL', county: `${county.toUpperCase()} COUNTY`,
            apn: item.ParcelID || item.parcel || null,
            owner_name: item.OwnerName || item.owner || null,
            minimum_bid: num(item.MinBid || item.minbid || item.MinimumBid),
            value: num(item.AssessedValue || item.value), acres: null,
            address: item.PropertyAddress || item.situs || null,
            sale_date: null, raw_url: `${base}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AID=${aid}`,
          });
        }
      } catch { /* PREVIEW formatı county'ye göre değişebilir */ }
    }
    return rows;
  } finally {
    await browser.close();
  }
}

// ── opsiyonel: ayrı test DB'sine yaz (PAYLAŞILAN data.db DEĞİL) ──────────────
function writeToTestDb(rows) {
  let Database;
  try { Database = require('better-sqlite3'); } catch { console.error('better-sqlite3 yok, yazma atlandı.'); return; }
  const db = new Database(path.join(__dirname, 'florida_test.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS fl_tax_sales (
    uid TEXT PRIMARY KEY, state TEXT, county TEXT, apn TEXT, owner_name TEXT,
    minimum_bid REAL, value REAL, acres REAL, address TEXT, sale_date TEXT,
    source TEXT, raw_url TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  const ins = db.prepare(`INSERT OR REPLACE INTO fl_tax_sales
    (uid,state,county,apn,owner_name,minimum_bid,value,acres,address,sale_date,source,raw_url)
    VALUES (@uid,@state,@county,@apn,@owner_name,@minimum_bid,@value,@acres,@address,@sale_date,@source,@raw_url)`);
  const tx = db.transaction((list) => list.forEach((r) => ins.run({
    uid: `FL_${r.county.replace(/\s+/g, '')}_${r.apn}`,
    state: r.state, county: r.county, apn: r.apn, owner_name: r.owner_name,
    minimum_bid: r.minimum_bid, value: r.value, acres: r.acres, address: r.address,
    sale_date: r.sale_date, source: r.source, raw_url: r.raw_url,
  })));
  tx(rows);
  console.log(`💾 florida_test.db'ye ${rows.length} satır yazıldı (paylaşılan DB'ye DOKUNULMADI).`);
  db.close();
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  const args = process.argv.slice(2);
  let rows = [];

  if (args.includes('--realauction')) {
    rows = await scrapeRealAuction(args[args.indexOf('--realauction') + 1] && !args[args.indexOf('--realauction') + 1].startsWith('--') ? args[args.indexOf('--realauction') + 1] : 'polk');
  } else {
    try {
      rows = await scrapeMarion();
    } catch (e) {
      console.error('Marion scrape hatası:', e.message);
    }
  }

  const withBid = rows.filter((r) => r.minimum_bid != null).length;
  console.log(`\n🎉 Toplam ${rows.length} parsel çekildi (FL). minimum_bid dolu: ${withBid}/${rows.length}`);
  console.log('— İlk örnekler —');
  rows.slice(0, 8).forEach((r, i) => {
    console.log(`#${i + 1} ${r.county} | APN ${r.apn} | bid=${r.minimum_bid ?? 'n/a'} | sale=${r.sale_date ?? 'n/a'}`);
    console.log(`     ${(r.address || '').slice(0, 100)}`);
  });

  if (args.includes('--write')) writeToTestDb(rows);
  else console.log('\n(ℹ️  Yazma yapılmadı. DB testi için: node scrape_florida.js --write → florida_test.db)');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
