const https = require('https');
const http = require('http');
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchHTML(url, options = {}) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...options.headers
      }
    }, res => {
      // follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return fetchHTML(res.headers.location, options).then(resolve);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ error: 'timeout' }); });
  });
}

function fetchJSON(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, raw: d.substring(0, 1000) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ error: 'timeout' }); });
  });
}

// LGBS'den "Available for Future Sale" mülkleri yükle
function loadTargetProperties() {
  const raw = JSON.parse(fs.readFileSync('lgbs_all_properties.json'));
  const targets = raw.filter(p => 
    p.status === 'Available for Future Sale' && 
    p.state === 'TX' &&
    p.value > 0
  ).sort((a, b) => parseFloat(b.value) - parseFloat(a.value)); // En değerliden başla
  
  console.log(`📊 Hedef mülk: ${targets.length} (TX, Available for Future Sale)`);
  return targets;
}

// HCAD (Harris County Appraisal District) - Account numarasından sahip bul
async function lookupHCAD(accountNbr, address) {
  // HCAD public search API
  // Account number formatı: Ondalık basamaklar varsa düzelt
  const acct = accountNbr?.replace(/\D/g, '').padStart(13, '0');
  
  try {
    // HCAD property details
    const url = `https://public.hcad.org/records/details.asp?crypt=${acct}&taxyear=2024&type=real`;
    const r = await fetchHTML(url);
    
    if (r.status === 200 && r.body) {
      // Owner name parse et
      const ownerMatch = r.body.match(/Owner[:\s]*<[^>]+>([^<]{5,80})/i) ||
                        r.body.match(/Owner Name[:\s]*<\/[^>]+>[^<]*<[^>]+>([^<]{5,80})/i) ||
                        r.body.match(/<td[^>]*>Owner[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      
      const ownerName = ownerMatch ? ownerMatch[1].trim() : null;
      return ownerName;
    }
  } catch(e) {}
  
  return null;
}

// Harris County Tax Office - Delinquent arama
async function searchHarrisTaxDelinquent(accountNbr) {
  try {
    const url = `https://www.hctax.net/Property/PropertyTax?acct=${accountNbr}`;
    const r = await fetchHTML(url);
    if (r.status === 200) {
      const delinqMatch = r.body.match(/delinquent|Delinquent|DELINQUENT/);
      const amountMatch = r.body.match(/\$[\d,]+\.\d{2}/g);
      return { isDelinquent: !!delinqMatch, amounts: amountMatch?.slice(0, 3) };
    }
  } catch(e) {}
  return null;
}

// Texas Comptroller - Statewide delinquent taxpayer search
async function searchComptrollerDelinquent() {
  console.log('\n🔍 Texas Comptroller Delinquent Taxpayer listesi...');
  
  const endpoints = [
    'https://comptroller.texas.gov/taxes/property-tax/delinquent/',
    'https://data.texas.gov/api/views?q=delinquent+tax',
    'https://data.texas.gov/api/views?q=property+tax+delinquent',
  ];
  
  for (const url of endpoints) {
    const r = await fetchJSON(url);
    if (r.status === 200) {
      console.log(`✅ ${url}`);
      console.log(`   ${JSON.stringify(r.data).substring(0, 300)}`);
    } else {
      const h = await fetchHTML(url);
      if (h.status === 200) {
        const text = h.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500);
        console.log(`✅ HTML: ${url}\n   ${text}`);
      }
    }
    await sleep(500);
  }
}

// HCAD Bulk Data - Tüm delinquent sahipleri
async function downloadHCADBulk() {
  console.log('\n📥 HCAD Bulk Data indirme noktaları...');
  
  const dataUrls = [
    'https://hcad.org/hcad-resources/hcad-appraisal-data/appraisal-data/',
    'https://pdata.hcad.org/',
    'https://public.hcad.org/records/',
  ];
  
  for (const url of dataUrls) {
    const r = await fetchHTML(url);
    if (r.status === 200) {
      // CSV ve zip linkleri bul
      const links = [...r.body.matchAll(/href="([^"]+\.(?:csv|zip|txt|xlsx)[^"]*)"/gi)]
        .map(m => m[1]);
      const csvLinks = [...r.body.matchAll(/href="([^"]+(?:delinquent|tax)[^"]*\.(?:csv|pdf|zip)[^"]*)"/gi)]
        .map(m => m[1]);
      
      if (links.length > 0 || csvLinks.length > 0) {
        console.log(`✅ ${url}`);
        links.slice(0, 10).forEach(l => console.log(`   📄 ${l}`));
        csvLinks.forEach(l => console.log(`   🎯 DELINQUENT: ${l}`));
      }
    }
    await sleep(500);
  }
}

// County Tax Office - Delinquent Roll sayfaları
async function checkCountyTaxOffices() {
  console.log('\n\n🏛️ Texas County Tax Office Delinquent Sayfaları...\n');
  
  const taxOffices = [
    // Harris County (Houston)
    { name: 'Harris County', urls: [
      'https://www.hctax.net/Property/DelinquentList',
      'https://www.hctax.net/Delinquent',
      'https://tax.co.harris.tx.us/delinquent',
    ]},
    // Dallas County
    { name: 'Dallas County', urls: [
      'https://www.dallascounty.org/departments/tax/delinquent.php',
      'https://www.dallasact.com/delinquent',
    ]},
    // Travis County (Austin)
    { name: 'Travis County', urls: [
      'https://tax-office.traviscountytx.gov/delinquent',
      'https://www.traviscountytax.org/delinquent',
    ]},
    // Tarrant County (Fort Worth)
    { name: 'Tarrant County', urls: [
      'https://www.tarrantcounty.com/en/tax/delinquent-tax-sale.html',
      'https://www.tarrantcountytx.gov/departments/tax/delinquent.html',
    ]},
    // Bexar County (San Antonio)
    { name: 'Bexar County', urls: [
      'https://www.bexar.org/3094/Delinquent-Tax-Sales',
    ]},
  ];
  
  const results = [];
  
  for (const office of taxOffices) {
    console.log(`📍 ${office.name}...`);
    for (const url of office.urls) {
      const r = await fetchHTML(url);
      if (r.status === 200 && r.body.length > 500) {
        const text = r.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const hasList = text.match(/delinquent|tax sale|property list|parcel|account/i);
        const pdfLinks = [...r.body.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map(m => m[1]).slice(0, 5);
        const csvLinks = [...r.body.matchAll(/href="([^"]+\.(?:csv|xlsx|xls)[^"]*)"/gi)].map(m => m[1]).slice(0, 5);
        
        console.log(`  ✅ ${url} [${r.status}]`);
        console.log(`     İçerik: ${text.substring(0, 300)}`);
        if (pdfLinks.length > 0) console.log(`     PDFs: ${pdfLinks.join(', ')}`);
        if (csvLinks.length > 0) console.log(`     CSVs: ${csvLinks.join(', ')}`);
        
        results.push({ county: office.name, url, hasList: !!hasList, pdfLinks, csvLinks });
        break;
      } else {
        console.log(`  ❌ ${url} [${r.status || r.error}]`);
      }
      await sleep(300);
    }
    await sleep(500);
  }
  
  return results;
}

// HCAD API - Property search by owner or address
async function testHCADApi() {
  console.log('\n\n🔬 HCAD API Endpoint Keşfi...\n');
  
  const endpoints = [
    'https://public.hcad.org/records/search.asp?searchtype=real&searchval=&taxyear=2024&jur=',
    'https://public.hcad.org/api/search',
    'https://public.hcad.org/api/property',
    'https://esearch.hcad.org/',
    'https://ifile.hcad.org/',
    // HCAD iQuery - online search portal
    'https://hcad.org/online-inquiry/',
  ];
  
  for (const url of endpoints) {
    const r = await fetchHTML(url);
    if (r.status === 200) {
      const text = r.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 300);
      console.log(`✅ ${url}`);
      console.log(`   ${text}\n`);
    } else {
      console.log(`❌ ${url}: ${r.status || r.error}`);
    }
    await sleep(300);
  }
}

// Texas Open Data Portal - Property tax delinquents
async function checkTexasOpenData() {
  console.log('\n\n📊 Texas Open Data Portal...\n');
  
  const searches = [
    'https://data.texas.gov/api/views.json?method=getByName&name=delinquent+property+tax',
    'https://data.texas.gov/resource/view.json?name=delinquent',
    'https://opendata.texas.gov/search?q=tax+delinquent',
    'https://data.texas.gov/api/catalog/v1?q=delinquent+tax&resultsPerPage=10',
  ];
  
  for (const url of searches) {
    const r = await fetchJSON(url);
    if (r.status === 200) {
      console.log(`✅ ${url}`);
      console.log(`   ${JSON.stringify(r.data).substring(0, 400)}\n`);
    } else {
      console.log(`❌ ${url}: ${r.status || r.error}`);
    }
    await sleep(300);
  }
}

async function main() {
  console.log('🎯 Pre-Foreclosure Tax Delinquent Property Finder');
  console.log('================================================\n');
  
  // Hedef mülkleri yükle
  const targets = loadTargetProperties();
  console.log(`\nTop 10 hedef (Available for Future Sale, TX, değerine göre):`);
  targets.slice(0, 10).forEach((p, i) => {
    const addr = [p.prop_address_one, p.prop_city, p.prop_zipcode].filter(Boolean).join(', ') || 'Adres yok';
    console.log(`  ${i+1}. ${addr} | ${p.county} | Değer: $${parseFloat(p.value).toLocaleString()} | Bid: $${parseFloat(p.minimum_bid).toLocaleString()}`);
    console.log(`     Account: ${p.account_nbr} | Cause: ${p.cause_nbr}`);
  });
  
  // Paralel araştırma
  await Promise.all([
    checkCountyTaxOffices(),
    checkTexasOpenData(),
    downloadHCADBulk(),
    testHCADApi(),
  ]);
  
  await searchComptrollerDelinquent();
  
  console.log('\n\n✅ Araştırma tamamlandı!');
  console.log('Sonraki adım: Bulunan delinquent listelerini LGBS verisiyle birleştir');
}

main().catch(console.error);
