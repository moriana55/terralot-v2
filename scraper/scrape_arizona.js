/**
 * Arizona tax-delinquent / tax-deeded land scraper.
 *
 * KAYNAK (Maricopa County, AZ — eyaletin en büyük county'si):
 *   "List of Parcels Currently Held by State by Tax Deed and Eligible for Sale"
 *   https://www.maricopa.gov/DocumentCenter/View/2241/Listing-of-Previously-Offered-Tax-Deeded-Land---NOT-SOLD-PDF
 *
 *   Bu PDF, Maricopa County'nin tax-deed yoluyla devlete geçmiş ve satışa hazır
 *   (over-the-counter / yeniden ihaleye çıkacak) arsalarının resmi listesidir.
 *   Sütunlar: PARCEL NUMBER | YEAR FORECLOSE DONE | PREVIOUS OWNER |
 *             PROPERTY DESCRIPTION | BASE TAX | INTEREST/FEES |
 *             TOTAL TAX AT CONVEYANCE | TOTAL COST TO FORECLOSE |
 *             TOTAL DUE AT CONVEYANCE TO STATE
 *
 * Mevcut PBFCM / MVBA scraper'larıyla aynı desen: indir → `pdftotext -layout`
 * → satır bazlı parse → tax_sales şemasına eşle (state, county, apn, owner_name,
 * minimum_bid, value, acres, address, source).  source = 'TAX:AZ'.
 *
 * KULLANIM:
 *   node scrape_arizona.js          # fetch + parse + console.log (DB'YE YAZMAZ)
 *
 * NOT: Puppeteer (stealth) ile indirir; başarısızsa düz fetch'e düşer.
 *      better-sqlite3 / data.db / zillow_listings.db'ye HİÇBİR YAZMA yoktur.
 *      Migrate aşamasında migrate_to_supabase.js bu satırları TAX:AZ olarak işler.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE = 'TAX:AZ';
const COUNTY = 'MARICOPA COUNTY';
const PDF_URL =
  'https://www.maricopa.gov/DocumentCenter/View/2241/Listing-of-Previously-Offered-Tax-Deeded-Land---NOT-SOLD-PDF';
const DEST = path.join(__dirname, 'downloads', 'maricopa_tax_deeded.pdf');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// ── İndirme: önce düz fetch (hızlı), olmazsa Puppeteer-stealth (bot-block için) ──
async function downloadPdf() {
  fs.mkdirSync(path.dirname(DEST), { recursive: true });

  // 1) Düz fetch (Node 18+ yerleşik)
  try {
    const res = await fetch(PDF_URL, {
      headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.slice(0, 4).toString() === '%PDF') {
        fs.writeFileSync(DEST, buf);
        console.log(`✅ İndirildi (fetch): ${(buf.length / 1024).toFixed(0)} KB`);
        return DEST;
      }
    }
    console.warn(`⚠️  fetch başarısız (HTTP ${res.status}), Puppeteer deneniyor...`);
  } catch (e) {
    console.warn(`⚠️  fetch hata (${e.message}), Puppeteer deneniyor...`);
  }

  // 2) Puppeteer-stealth fallback (Cloudflare / bot-block durumları için)
  let puppeteer;
  try {
    puppeteer = require('puppeteer-extra');
    puppeteer.use(require('puppeteer-extra-plugin-stealth')());
  } catch {
    puppeteer = require('puppeteer');
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    const b64 = await page.evaluate(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result.split(',')[1]);
        fr.onerror = () => reject(new Error('FileReader failed'));
        fr.readAsDataURL(blob);
      });
    }, PDF_URL);
    fs.writeFileSync(DEST, Buffer.from(b64, 'base64'));
    console.log(`✅ İndirildi (Puppeteer): ${(fs.statSync(DEST).size / 1024).toFixed(0)} KB`);
    return DEST;
  } finally {
    await browser.close();
  }
}

// ── Parse: pdftotext -layout çıktısını satır bazlı işler ──
// Veri satırı:  IDX  PARCEL  YEAR  ...OWNER...  ...DESC...  $BASE  $INT  $TOTTAX  $COST  $DUE
// Açıklama, veri satırından önceki/arasındaki sol-girintili satırlarda devam edebilir.
function parsePdf(pdfPath) {
  const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });
  const lines = text.split('\n');
  const rows = [];

  // Satır başında "IDX  PARCEL  YEAR" + sonda en az 3 dolar tutarı olan veri satırı.
  const dataRe =
    /^\s*\d+\s+([0-9]{3}-[0-9]{2}-[0-9]{3}[A-Z]?)\s+(\d{4})\s+(.+?)\s+(\$[\d,]+\.\d{2})\s+(\$[\d,]+\.\d{2})\s+(\$[\d,]+\.\d{2})\s+(\$[\d,]+\.\d{2})\s+(\$[\d,]+\.\d{2})\s*$/;

  let pendingDesc = []; // veri satırından önce biriken açıklama satırları

  for (const line of lines) {
    const m = line.match(dataRe);
    if (m) {
      const [, parcel, year, mid, baseTax, intFees, totTax, cost, due] = m;

      // mid = "OWNER ....  DESCRIPTION...."  → 2+ boşlukla ilk parça owner, gerisi desc
      const parts = mid.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      let owner = parts[0] || 'UNKNOWN OWNER';
      const inlineDesc = parts.slice(1).join(' ');
      const description = [...pendingDesc, inlineDesc].join(' ').replace(/\s+/g, ' ').trim();
      pendingDesc = [];

      // Açıklamadan dönüm (acre) çıkarmaya çalış: "20.00 AC"
      const acreM = description.match(/(\d+(?:\.\d+)?)\s*AC\b/i);
      const acres = acreM ? parseFloat(acreM[1]) : null;

      rows.push({
        state: 'AZ',
        county: COUNTY,
        apn: parcel,
        owner_name: owner.replace(/\s+/g, ' ').trim() || 'UNKNOWN OWNER',
        minimum_bid: num(due), // satışa hazır olmak için devlete ödenmesi gereken toplam
        value: num(totTax), // tax-deed devrindeki toplam vergi (assessed proxy)
        acres,
        address: description || null, // legal description (sokak adresi PDF'te yok)
        source: SOURCE,
        // ── ek alanlar (analiz için, şemaya zarar vermez) ──
        year_foreclose: parseInt(year, 10),
        base_tax: num(baseTax),
        interest_fees: num(intFees),
        cost_to_foreclose: num(cost),
      });
    } else {
      // Veri satırı değil: girintili açıklama devamı olabilir.
      const t = line.trim();
      if (
        t.length > 4 &&
        !/PARCEL|PREVIOUS OWNER|PROPERTY DESCRIPTION|BASE TAX|CONVEYANCE|FORECLOSE|TABLE OF|DISCLAIMER|TREASURER/i.test(t)
      ) {
        pendingDesc.push(t);
      } else {
        pendingDesc = [];
      }
    }
  }
  return rows;
}

(async () => {
  console.log(`→ Arizona (Maricopa) tax-deeded land scraper · source=${SOURCE}`);
  console.log(`  Kaynak: ${PDF_URL}\n`);

  let pdfPath;
  try {
    pdfPath = await downloadPdf();
  } catch (e) {
    console.error(`❌ PDF indirilemedi: ${e.message}`);
    console.error('   Tarayıcıdan manuel indir: ' + PDF_URL);
    process.exit(1);
  }

  let rows;
  try {
    rows = parsePdf(pdfPath);
  } catch (e) {
    console.error(`❌ Parse hatası (pdftotext kurulu mu?): ${e.message}`);
    process.exit(1);
  }

  console.log(`\n🎉 ${rows.length} adet Arizona arsa parse edildi.\n`);

  // Alan doluluk istatistiği
  const filled = (k) => rows.filter((r) => r[k] != null && r[k] !== '').length;
  console.log('Alan doluluğu:');
  for (const k of ['state', 'county', 'apn', 'owner_name', 'minimum_bid', 'value', 'acres', 'address']) {
    console.log(`  ${k.padEnd(12)} ${filled(k)}/${rows.length}`);
  }

  console.log('\nÖrnek 3 satır:');
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));

  // TEST MODU: data.db / Supabase'e YAZMA YOK. Sadece bellek + console.
  console.log('\nℹ️  Test modu: hiçbir veritabanına yazılmadı.');
})();
