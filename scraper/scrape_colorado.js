/**
 * scrape_colorado.js — Colorado tax-lien delinquent-land harvester  (source: TAX:CO)
 *
 * NEDEN / KAYNAK
 * --------------
 * Colorado'da county treasurer'lar her yıl (sonbahar) "Delinquent Real Estate
 * Tax List"i yayınlar ve liens'i SRI Inc. üzerinden www.zeusauction.com'da
 * online açık artırmaya çıkarır. zeusauction/SriServices parsel listesini
 * login arkasında ve sadece sezonda (Ekim-Kasım) açar; AMA her county aynı
 * listeyi kendi sitesinde herkese açık bir PDF olarak yayınlamak ZORUNDADIR
 * (3 hafta gazete + web ilanı, C.R.S. 39-11-102). Bu PDF'ler yıl boyunca
 * erişilebilir kalır ve land-ağırlıklı kırsal county'lerde (Gunnison, Routt,
 * Costilla, Park, Saguache...) "X ACRES IN SECTION..." legal description'lı
 * çok sayıda çıplak arsa içerir — tam hedefimiz.
 *
 * Bu script o açık PDF'leri DOĞRUDAN indirir (browser UA ile https.get),
 * `pdftotext -raw` ile sıralı metne çevirir ve SRI/zeusauction format'ını
 * parse eder. Tarayıcı/JS GEREKMEZ (statik PDF). Eğer bir county PDF'i
 * 403/anti-bot ile bloklarsa Puppeteer fallback'i devrededir (browser context
 * fetch → base64, scrape_pbfcm_live.js'deki downloadFileWithPage deseni).
 *
 * SRI/zeusauction CO format'ı (pdftotext -raw, sıralı kayıt):
 *     R030227 $1,532.92            <- schedule/parcel no + minimum (toplam borç)
 *     BROWN MARK E AND LAURA N FAMILY   <- owner (1-2 satır olabilir)
 *     LOTS 4-6, BLOCK 5, GILL'S ADDITION TO   <- legal description (1-2 satır)
 *     GUNNISON
 * Parsel prefix'leri: R = real estate, M = mobile home, N = severed mineral,
 * P = personal property. Biz land için R (ve mineral hariç) tutuyoruz.
 *
 * TEST MODU: fetch + parse + console.log. data.db'ye / Supabase'e YAZMAZ.
 * Üretimde çıktıyı migrate_to_supabase.js'in tax_sales şemasına map'leyip
 * (state,county,apn,owner_name,minimum_bid,value,acres,address,source) yazarsın.
 *
 *   node scrape_colorado.js                 # varsayılan county seti
 *   node scrape_colorado.js gunnison        # tek county
 *   CO_MAX=500 node scrape_colorado.js      # county başına satır limiti
 */

const https = require('https');
const http = require('http');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SOURCE = 'TAX:CO';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const MAX_PER_COUNTY = parseInt(process.env.CO_MAX || '10000', 10);

// ── Bilinen, herkese açık CO delinquent-tax-list PDF kaynakları ──────────────
// Land-ağırlıklı kırsal county'ler önceliklendirildi. URL'ler treasurer'ın
// resmi ilan PDF'i. (Sezon dışında bir önceki yılın listesi yayında kalır.)
// Not: *.colorado.gov county subdomain'leri curl/UA'yı bazen 403'ler →
// Puppeteer fallback'i bunlar için devreye girer.
const COUNTIES = [
  {
    county: 'Gunnison',
    url: 'https://www.gunnisoncounty.org/DocumentCenter/View/16629/2025-Delinquent-tax-list',
  },
  {
    county: 'Routt',
    url: 'https://www.co.routt.co.us/DocumentCenter/View/19031/2025-Advertising-Delinquent-Taxes',
  },
  {
    county: 'Kit Carson',
    url: 'https://kitcarsoncounty.colorado.gov/sites/kitcarsoncounty/files/documents/DELINQUENT%20TAX%20LIST%20FOR%20THE%20TAX%20YEAR%202024.pdf',
  },
  // NOT: *.colorado.gov (OpenGov) county siteleri PDF dosya yollarını periyodik
  // olarak hash'li dizinlere taşıyor (örn. /sites/g/files/lrnvjt1351/files/...),
  // bu yüzden derin linkler kırılgan. Phillips County GovEase'e geçti →
  // govease-harvest.js zaten kapsıyor. Yeni county eklerken treasurer'ın
  // "Delinquent Tax List" sayfasından güncel PDF linkini al.
];

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const numOrNull = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
};

function hasPdftotext() {
  const r = spawnSync('pdftotext', ['-v'], { encoding: 'utf-8' });
  return !(r.error && r.error.code === 'ENOENT');
}

// PDF'i basit https/http GET ile indir (browser UA + redirect takibi).
function downloadHttp(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/pdf,*/*' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(downloadHttp(next, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const ct = res.headers['content-type'] || '';
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve({ contentType: ct })));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

// Anti-bot fallback: Puppeteer browser-context fetch → base64 → dosya.
// (scrape_pbfcm_live.js'deki downloadFileWithPage deseni.)
async function downloadWithPuppeteer(url, dest) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new Error('puppeteer yüklü değil — fallback yapılamadı');
  }
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    const origin = new URL(url).origin;
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    const b64 = await page.evaluate(async (pdfUrl) => {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error('fetch ' + res.status);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result.split(',')[1]);
        r.onerror = () => reject(new Error('FileReader'));
        r.readAsDataURL(blob);
      });
    }, url);
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
  } finally {
    await browser.close();
  }
}

function pdfToText(pdfPath) {
  // -raw = okuma sırası (çok sütunlu CO listelerinde -layout'tan daha temiz)
  return execSync(`pdftotext -raw "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

// ── SRI / zeusauction CO format parser'ı ─────────────────────────────────────
// CO county listeleri iki farklı düzende gelir; parser ikisini de destekler:
//
//  Format A (Gunnison): parsel ve tutar AYNI satırda, sonra owner + legal
//      R030227 $1,532.92
//      BROWN MARK E AND LAURA N FAMILY TRUST THE
//      LOTS 4-6, BLOCK 5, GILL'S ADDITION TO GUNNISON
//
//  Format B (Routt, Kit Carson): parsel TEK satır (owner'a yapışık olabilir),
//      tutar ayrı bir "Total Due:" satırında kaydı kapatır
//      R000781
//      AMBROSE-FIKES SUSAN
//      Tract: 32.12AC TR IN N2NE4  S:12 T:9 R:51
//      TotalDue:$703.36
//
//  PARCEL: R/M/N/P + 5-8 rakam (R=real estate, M=mobile, N=mineral, P=personal)
const PARCEL_RE = /^([RMNPrmnp]\d{5,8})\b\s*(.*)$/; // satır başında parsel + (yapışık owner)
const AMOUNT_RE = /([\d,]+\.\d{2})/;
const TOTALDUE_RE = /Total\s*Due:\s*\$?\s*([\d,]+\.\d{2})/i;
const INLINE_AMT_RE = /\$\s*([\d,]+\.\d{2})/; // parsel satırındaki tutar
const ACRES_RE = /([\d,]+(?:\.\d+)?)\s*AC(?:RES?)?\b/i; // "71.52 ACRES" veya "32.12AC"
const ZIP_LINE_RE = /,?\s*[A-Z]{2}\s+\d{5}(-\d{4})?\b/; // adres satırı (ZIP içerir)
const NOISE_RE = /PUBLIC NOTICE|TAX (SALE|LIEN)|DELINQUENT|PUBLICATION|REAL PROPERTY$|SEVERED MINERAL|PERSONAL PROPERTY$|POSSESSORY/i;

function parseColoradoText(text, county) {
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const records = [];
  let cur = null;

  const flush = () => {
    if (!cur) return;
    if (cur.amount != null || cur.body.length) {
      const owner = (cur.body[0] || '').trim() || 'UNKNOWN OWNER';
      let address = '';
      const legalParts = [];
      for (const b of cur.body.slice(1)) {
        if (/^Total\s*Due/i.test(b)) continue;
        if (!address && ZIP_LINE_RE.test(b)) address = b;
        else legalParts.push(b);
      }
      let legal = legalParts.join(' ').replace(/\s+/g, ' ').trim();
      // Routt: legal'in sonundaki "Tax $.. Interest $.. Penalty $.. Other $.." vergi
      // dökümünü ayıkla (parsel tutarı zaten minimum_bid'de).
      legal = legal.replace(/\bTax\s*\$.*$/i, '').trim();
      const am = (cur.body.join(' ')).match(ACRES_RE);
      const acres = am ? numOrNull(am[1]) : null;
      records.push({
        state: 'CO',
        county,
        apn: cur.parcel,
        owner_name: owner,
        minimum_bid: cur.amount, // CO toplam borç = tax+interest+adv = min. açılış teklifi
        value: null,             // assessed value ilanlarda yok (DD'de zenginleştirilir)
        acres,
        address: address || null,
        legal_description: legal || null,
        parcel_type: cur.type,
        source: SOURCE,
      });
    }
    cur = null;
  };

  for (const line of lines) {
    if (!line) continue;
    const m = line.match(PARCEL_RE);
    if (m) {
      flush();
      const parcel = m[1].toUpperCase();
      const rest = (m[2] || '').trim();
      const inlineAmt = rest.match(INLINE_AMT_RE); // Format A
      cur = {
        parcel,
        amount: inlineAmt ? numOrNull(inlineAmt[1]) : null,
        type: { R: 'real_estate', M: 'mobile_home', N: 'severed_mineral', P: 'personal_property' }[parcel[0]] || 'other',
        body: [],
      };
      // parsel satırında tutar sonrası / yapışık owner metni varsa body'e ekle
      const leftover = inlineAmt ? rest.slice(rest.indexOf(inlineAmt[0]) + inlineAmt[0].length).trim() : rest;
      if (leftover && !NOISE_RE.test(leftover)) cur.body.push(leftover);
      continue;
    }
    if (cur) {
      const td = line.match(TOTALDUE_RE); // Format B: tutar + kaydı kapat
      if (td) {
        if (cur.amount == null) cur.amount = numOrNull(td[1]);
        flush();
        continue;
      }
      if (NOISE_RE.test(line)) continue;
      if (cur.body.length < 6) cur.body.push(line);
    }
  }
  flush();
  return records;
}

// ── Çalıştırma ───────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🏔️  Colorado tax-lien land harvester  (source=${SOURCE})\n`);

  if (!hasPdftotext()) {
    console.error('❌ pdftotext bulunamadı. Gerekli: poppler (brew install poppler).');
    console.error('   Parser pdftotext -raw çıktısına dayanıyor; kurulmadan çalışamaz.');
    process.exit(2);
  }

  const argCounty = process.argv[2] ? process.argv[2].toLowerCase() : null;
  const targets = argCounty ? COUNTIES.filter((c) => c.county.toLowerCase().includes(argCounty)) : COUNTIES;
  if (!targets.length) {
    console.error(`County bulunamadı: "${argCounty}". Mevcut: ${COUNTIES.map((c) => c.county).join(', ')}`);
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'co-tax-'));
  const allSamples = [];
  let grandTotal = 0;
  const perCounty = [];
  const blocked = [];

  for (const t of targets) {
    const dest = path.join(tmpDir, `${t.county.replace(/\W+/g, '_')}.pdf`);
    let ok = false;
    let via = 'http';
    try {
      const { contentType } = await downloadHttp(t.url, dest);
      if (!/pdf/i.test(contentType) && fs.statSync(dest).size < 2000) throw new Error('not a pdf (anti-bot html)');
      ok = true;
    } catch (e) {
      // Fallback: Puppeteer browser-context fetch
      try {
        await downloadWithPuppeteer(t.url, dest);
        if (fs.statSync(dest).size < 2000) throw new Error('puppeteer da pdf alamadı');
        ok = true; via = 'puppeteer';
      } catch (e2) {
        blocked.push({ county: t.county, url: t.url, reason: `${e.message} / fallback: ${e2.message}` });
        console.error(`  ✗ ${t.county}: indirilemedi (${e.message}; fallback: ${e2.message})`);
        continue;
      }
    }

    let records;
    try {
      const text = pdfToText(dest);
      records = parseColoradoText(text, t.county).slice(0, MAX_PER_COUNTY);
    } catch (e) {
      blocked.push({ county: t.county, url: t.url, reason: 'pdftotext/parse: ' + e.message });
      console.error(`  ✗ ${t.county}: parse hatası (${e.message})`);
      continue;
    }

    const land = records.filter((r) => r.parcel_type === 'real_estate');
    const withAcres = records.filter((r) => r.acres != null);
    console.log(`  ✓ ${t.county} (${via}): ${records.length} kayıt | ${land.length} real-estate | ${withAcres.length} acreage'lı`);
    perCounty.push({ county: t.county, total: records.length, real_estate: land.length, acreage: withAcres.length });
    grandTotal += records.length;
    // Land + acreage öncelikli örnekler
    allSamples.push(...withAcres.filter((r) => r.parcel_type === 'real_estate').slice(0, 3));
  }

  console.log(`\n📊 TOPLAM: ${grandTotal} kayıt / ${perCounty.length} county taranabildi.`);
  if (blocked.length) {
    console.log(`\n🚧 Bloke/erişilemeyen kaynaklar (${blocked.length}):`);
    for (const b of blocked) console.log(`   - ${b.county}: ${b.reason}`);
    console.log('   → Bunlar *.colorado.gov anti-bot olabilir; sezonda zeusauction login + Puppeteer gerekir.');
  }

  console.log(`\n🔎 ÖRNEK ÇIKTI (land + acreage, alanlar: state,county,apn,owner_name,minimum_bid,value,acres,address,source):`);
  console.log(JSON.stringify(allSamples.slice(0, 8), null, 2));

  console.log('\nℹ️  TEST MODU: hiçbir DB/Supabase yazımı YAPILMADI. Üretimde tax_sales şemasına map edip yaz.');

  // temizlik
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
