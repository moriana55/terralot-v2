/**
 * New Mexico statewide tax-delinquent land scraper.
 *
 * Tek devlet kaynağı: NM Taxation & Revenue Department, Property Tax Division (PTD).
 * PTD tüm 33 county için "Delinquent Property Tax Auction" listelerini TEK bir
 * sayfada PDF olarak yayınlar. Her PDF temiz, sabit formatlı kayıtlar içerir:
 *
 *   Item #N    Case: <case>
 *              UPC: <upc>
 *   Bidder #   Account: <apn>            ← parcel/account no
 *              Delinquent Owner: <owner_name>
 *   Amount $   Simple Description: <konum>
 *              Minimum Bid: $<minimum_bid>
 *              Property Description: <legal + acres "X.XX AC" + adres>
 *
 * Not assessed value alanı yok; sadece Minimum Bid var → value=null.
 * county PDF başlığındaki "in <X> County" satırından alınır.
 *
 * Bağımlılık: pdftotext (poppler) — `which pdftotext`. pdf-parse YOK (npm install yasak).
 * Hedef şema: state, county, apn, owner_name, minimum_bid, value, acres, address, source.
 * source = 'TAX:NM'
 *
 * Kullanım:
 *   node scrape_newmexico.js          → fetch + parse + console.log (DB'ye YAZMAZ)
 *   node scrape_newmexico.js --file downloads/nm_cibola.pdf   → tek PDF'i parse et
 *
 * NOT: Bu TEST sürümüdür; data.db / Supabase'e hiçbir şey yazmaz.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PTD_URL = 'https://www.tax.newmexico.gov/businesses/property-tax-overview/delinquent-property-tax-auctions/';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// ── PTD sayfasından county auction PDF linklerini çıkar ──────────────────────
async function discoverPdfs() {
  const res = await fetch(PTD_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error('PTD sayfası HTTP ' + res.status);
  const html = await res.text();

  // wp-content uploads altındaki .pdf linkleri (auction advertisement'lar)
  const urls = new Set();
  const re = /https?:\/\/[^\s"'<>]+\.pdf/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[0];
    // sadece county auction listeleri; genel Terms/Rules PDF'lerini ele
    if (!/auction|advertisement|delinquent/i.test(u)) continue;
    if (/terms|rules/i.test(u)) continue;
    urls.add(u);
  }
  // county adını link civarındaki metinden tahmin et; bulunamazsa PDF'in içinden alınır
  return [...urls].map((u) => ({ url: u, county: guessCountyFromUrl(u) }));
}

function guessCountyFromUrl(u) {
  const base = decodeURIComponent(path.basename(u));
  const m = base.match(/Advertisement[-_]?([A-Za-z]+)/i);
  if (m && !/^\d/.test(m[1])) return m[1];
  return null;
}

// ── PDF indir (poppler ile parse edilecek) ───────────────────────────────────
async function downloadPdf(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error('PDF HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

// ── PDF'i metne çevir + kayıtları ayrıştır ───────────────────────────────────
function parseNmPdf(pdfPath) {
  let text;
  try {
    text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error('pdftotext hatası: ' + err.message + ' (poppler kurulu mu? `which pdftotext`)');
  }

  // county başlığı: "...public auction, in Cibola County, beginning at:"
  let county = null;
  const cm = text.match(/in\s+([A-Z][A-Za-z .'-]+?)\s+County,\s*beginning/i);
  if (cm) county = cm[1].trim() + ' County';

  const lines = text.split('\n');
  const records = [];
  let cur = null;

  const flush = () => { if (cur && cur.apn) records.push(cur); cur = null; };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Yeni kayıt başlangıcı: "Item #N    Case: ..."
    if (/^\s*Item\s*#\d+/i.test(line)) {
      flush();
      const caseM = line.match(/Case:\s*([A-Z0-9-]+)/i);
      cur = {
        case_number: caseM ? caseM[1].trim() : null,
        upc: null,
        apn: null,
        owner_name: null,
        simple_desc: null,
        minimum_bid: null,
        prop_desc: null,
        acres: null,
        address: null,
      };
      continue;
    }
    if (!cur) continue;

    let mm;
    if ((mm = line.match(/UPC:\s*([0-9A-Z-]+)/i))) cur.upc = mm[1].trim();
    else if ((mm = line.match(/Account:\s*([A-Z0-9/-]+)/i))) cur.apn = mm[1].trim();
    else if ((mm = line.match(/Delinquent Owner:\s*(.+)$/i))) cur.owner_name = mm[1].trim();
    else if ((mm = line.match(/Simple Description:\s*(.+)$/i))) cur.simple_desc = mm[1].trim();
    else if ((mm = line.match(/Minimum Bid:\s*\$?([\d,]+\.?\d*)/i))) cur.minimum_bid = num(mm[1]);
    else if ((mm = line.match(/Property Description:\s*(.+)$/i))) {
      cur.prop_desc = mm[1].trim();
      // Property Description bir sonraki satıra sarkabilir (Item/etiket gelene kadar)
      let j = i + 1;
      while (j < lines.length && lines[j].trim().length &&
             !/^\s*(Item\s*#|Case:|UPC:|Bidder|Account:|Delinquent Owner:|Amount|Simple Description:|Minimum Bid:|Property Description:)/i.test(lines[j])) {
        cur.prop_desc += ' ' + lines[j].trim();
        j++;
      }
      i = j - 1;
    }
  }
  flush();

  // alanları normalize et: acres + address Property Description içinden çıkarılır
  for (const r of records) {
    const pd = (r.prop_desc || '').replace(/\s+/g, ' ').trim();
    const am = pd.match(/=?\s*([0-9]+(?:\.[0-9]+)?)\s*AC\b/i);
    if (am) r.acres = parseFloat(am[1]);
    // adres: simple_desc daha okunaklı bir konum verir; yoksa property description'ı kullan
    r.address = r.simple_desc || pd || null;
    r.legal_description = pd || null;
  }

  return { county, records };
}

// ── Hedef şemaya eşle (source='TAX:NM') ──────────────────────────────────────
function toRow(r, county) {
  return {
    state: 'NM',
    county: county || 'Unknown',
    apn: r.apn || null,
    owner_name: r.owner_name || null,
    minimum_bid: r.minimum_bid != null ? r.minimum_bid : null,
    value: null, // PTD listelerinde assessed/market value yok, sadece minimum bid var
    acres: r.acres != null ? r.acres : null,
    address: r.address || null,
    source: 'TAX:NM',
    // ekstra izlenebilirlik alanları (şema dışı ama faydalı)
    case_number: r.case_number || null,
    legal_description: r.legal_description || null,
  };
}

(async () => {
  const fileArgIdx = process.argv.indexOf('--file');
  let pdfs;

  if (fileArgIdx !== -1 && process.argv[fileArgIdx + 1]) {
    // Tek lokal PDF modu
    pdfs = [{ url: null, county: null, local: path.resolve(process.argv[fileArgIdx + 1]) }];
    console.log('📄 Tek dosya modu:', pdfs[0].local);
  } else {
    console.log('🌐 PTD sayfası taranıyor:', PTD_URL);
    const found = await discoverPdfs();
    console.log(`🎉 ${found.length} adet county auction PDF linki bulundu:`);
    found.forEach((f) => console.log('   -', f.county || '(county PDF içinden)', '·', f.url));
    if (!found.length) {
      console.log('⚠️  Hiç PDF linki bulunamadı. Sayfa yapısı değişmiş olabilir.');
      return;
    }
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    pdfs = found;
  }

  const allRows = [];
  for (const p of pdfs) {
    try {
      let local = p.local;
      if (!local) {
        local = path.join(DOWNLOAD_DIR, 'nm_' + path.basename(p.url).replace(/[^\w.-]/g, '_'));
        console.log(`\n📥 İndiriliyor: ${p.url}`);
        await downloadPdf(p.url, local);
      }
      const { county, records } = parseNmPdf(local);
      const finalCounty = county || p.county || null;
      console.log(`📌 ${finalCounty || local}: ${records.length} kayıt ayıklandı.`);
      const rows = records.map((r) => toRow(r, finalCounty));
      allRows.push(...rows);
    } catch (err) {
      console.error(`✗ Hata (${p.url || p.local}):`, err.message);
    }
  }

  console.log(`\n===== TOPLAM: ${allRows.length} kayıt (source=TAX:NM) — DB'ye YAZILMADI =====`);
  console.log('İlk 5 örnek:');
  console.log(JSON.stringify(allRows.slice(0, 5), null, 2));

  // alan dolu oranı (kalite kontrol)
  const filled = (k) => allRows.filter((r) => r[k] != null && r[k] !== '').length;
  console.log('\nAlan dolu oranı:');
  for (const k of ['apn', 'owner_name', 'minimum_bid', 'acres', 'address', 'county']) {
    console.log(`   ${k}: ${filled(k)}/${allRows.length}`);
  }
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
