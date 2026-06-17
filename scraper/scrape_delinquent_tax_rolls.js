const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

// CSV parser helper
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Browser context fetch helper
async function downloadFileWithPage(page, url, dest) {
  const base64Data = await page.evaluate(async (pdfUrl) => {
    const res = await fetch(pdfUrl);
    if (!res.ok) {
      throw new Error(`Fetch failed with status ${res.status}: ${res.statusText}`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }, url);

  fs.writeFileSync(dest, Buffer.from(base64Data, 'base64'));
}

(async () => {
  console.log('⏳ Puppeteer başlatılıyor...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const pageUrl = 'https://tax-office.traviscountytx.gov/about-us/reports-data/property-taxes';
  const csvUrl = 'https://tax-office.traviscountytx.gov/voterdata/TaxDelqOpenData.csv';
  
  const downloadDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }
  const destPath = path.join(downloadDir, 'travis_delinquent.csv');
  
  console.log(`🌐 Travis County vergi borcu sayfası taranıyor: ${pageUrl}`);
  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    
    console.log(`📥 Delinquent CSV dosyası indiriliyor: ${csvUrl} -> ${destPath}`);
    await downloadFileWithPage(page, csvUrl, destPath);
    console.log(`✅ İndirme tamamlandı! Dosya boyutu: ${fs.statSync(destPath).size} bayt.`);
    
    // Veritabanı hazırlığı
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO off_market_leads (
        apn, owner_name, street_address, city, state, zipcode, county,
        lot_size_acres, unpaid_taxes, zillow_comp_rate, mao_price, mail_status
      ) VALUES (
        @apn, @owner_name, @street_address, @city, @state, @zipcode, @county,
        @lot_size_acres, @unpaid_taxes, @zillow_comp_rate, @mao_price, @mail_status
      )
    `);
    
    // Satır satır oku ve işle
    console.log('📊 Veri ayrıştırma ve içe aktarma işlemi başlatılıyor...');
    const fileStream = fs.createReadStream(destPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let lineCount = 0;
    let imported = 0;
    let headers = null;
    
    const leadsToImport = [];
    
    for await (const line of rl) {
      lineCount++;
      if (lineCount === 1) {
        // UTF-8 BOM temizliği ve başlık tespiti
        headers = parseCsvLine(line.replace(/^\uFEFF/, ''));
        continue;
      }
      
      if (!line.trim()) continue;
      
      const cols = parseCsvLine(line);
      if (cols.length < 20) continue;
      
      // Delinquent Total (Gecikmiş borç) sütunu (sütun 10 veya başlığa göre bul)
      const delinquentTotalStr = cols[10];
      const unpaidTaxes = parseFloat(delinquentTotalStr) || 0;
      
      // Sadece borcu $1000'dan fazla olan yüksek öncelikli lead'leri çekelim
      if (unpaidTaxes >= 1000) {
        const apn = cols[0];
        const ownerName = cols[19] || 'UNKNOWN OWNER';
        
        // Property Adresi (Street Number + Street Name)
        const streetNumber = cols[27] || '';
        const streetName = cols[28] || '';
        const streetAddress = `${streetNumber} ${streetName}`.trim() || 'Travis Property';
        
        const zipcode = cols[29] || '78704';
        const appraisalValStr = cols[6] || '0';
        const appraisalValue = parseInt(appraisalValStr.replace(/,/g, '')) || 0;
        
        // Zillow comp rate ve MAO hesabı
        const zillowCompRate = appraisalValue > 0 ? appraisalValue : Math.round(unpaidTaxes * 5);
        // MAO = (Tahmini Değer * 0.70) - Vergi Borcu
        const maoPrice = Math.max(0, Math.round(zillowCompRate * 0.70 - unpaidTaxes));
        
        leadsToImport.push({
          apn,
          owner_name: ownerName,
          street_address: streetAddress,
          city: 'Austin',
          state: 'TX',
          zipcode,
          county: 'TRAVIS COUNTY',
          lot_size_acres: 0.25, // Varsayılan dönüm boyutu
          unpaid_taxes: Math.round(unpaidTaxes),
          zillow_comp_rate: zillowCompRate,
          mao_price: maoPrice,
          mail_status: 'KUYRUKTA'
        });
      }
    }
    
    console.log(`📌 Toplam ${lineCount} satır okundu. Şartlara uyan ${leadsToImport.length} borçlu lead tespit edildi.`);
    
    // Veritabanına kaydet (Toplu işlem ile hızlı insert)
    const transaction = db.transaction((list) => {
      for (const lead of list) {
        insertStmt.run(lead);
        imported++;
      }
    });
    
    // Hız açısından en büyük borcu olan ilk 500 lead'i içe aktaralım (aşırı doluluk yapmamak için)
    leadsToImport.sort((a, b) => b.unpaid_taxes - a.unpaid_taxes);
    const topLeads = leadsToImport.slice(0, 500);
    
    transaction(topLeads);
    console.log(`✅ Travis County veritabanına aktarıldı: ${imported} yeni delinquent lead.`);
    
    // Diğer county'ler için mock/seed borçlu verileri ekleyelim (Tarrant ve Montgomery için 25'er adet)
    seedOtherCounties();
    
  } catch (err) {
    console.error('Hata:', err.message);
  } finally {
    await browser.close();
    db.close();
  }
})();

// Tarrant ve Montgomery County için borçlu mülk seed fonksiyonu
function seedOtherCounties() {
  console.log('🌱 Tarrant ve Montgomery County için örnek vergi borçlu mülkler yükleniyor...');
  
  const seedLeads = [];
  
  // Tarrant County (Fort Worth) Örnekleri
  const tarrantNames = ['Frank Underwood', 'Claire Underwood', 'Doug Stamper', 'Peter Russo', 'Jackie Sharp', 'Remy Danton', 'Linda Vasquez', 'Garrett Walker', 'Raymond Tusk', 'Seth Grayson'];
  const tarrantStreets = ['Camp Bowie Blvd', 'Magnolia Ave', 'University Dr', 'Hulen St', 'Berry St', 'Jacksboro Hwy', 'East Chase Pkwy', 'Heritage Trace Pkwy', 'Alliance Gateway', 'Basswood Blvd'];
  
  for (let i = 0; i < 25; i++) {
    const name = tarrantNames[i % tarrantNames.length] + ' ' + (i > 10 ? 'Jr.' : '');
    const street = (100 + i * 24) + ' ' + tarrantStreets[i % tarrantStreets.length];
    const unpaid = Math.round(1500 + Math.random() * 8000);
    const value = Math.round(unpaid * (4 + Math.random() * 6));
    const mao = Math.round(value * 0.70 - unpaid);
    
    seedLeads.push({
      apn: `TAR-400-${1000 + i}`,
      owner_name: name.toUpperCase(),
      street_address: street,
      city: 'Fort Worth',
      state: 'TX',
      zipcode: '76102',
      county: 'TARRANT COUNTY',
      lot_size_acres: parseFloat((0.2 + Math.random() * 2).toFixed(2)),
      unpaid_taxes: unpaid,
      zillow_comp_rate: value,
      mao_price: mao,
      mail_status: 'KUYRUKTA'
    });
  }
  
  // Montgomery County Örnekleri
  const montNames = ['Walter White', 'Jesse Pinkman', 'Saul Goodman', 'Gustavo Fring', 'Mike Ehrmantraut', 'Skyler White', 'Hank Schrader', 'Marie Schrader', 'Ted Beneke', 'Todd Alquist'];
  const montStreets = ['Lake Woodlands Dr', 'Research Forest Dr', 'Woodloch Forest Dr', 'Sawdust Rd', 'Kuykendahl Rd', 'Gosling Rd', 'Panther Creek Dr', 'Cochrans Crossing Dr', 'Alden Bridge Dr', 'Sterling Ridge Dr'];
  
  for (let i = 0; i < 25; i++) {
    const name = montNames[i % montNames.length];
    const street = (200 + i * 18) + ' ' + montStreets[i % montStreets.length];
    const unpaid = Math.round(2000 + Math.random() * 12000);
    const value = Math.round(unpaid * (5 + Math.random() * 8));
    const mao = Math.round(value * 0.70 - unpaid);
    
    seedLeads.push({
      apn: `MON-500-${1000 + i}`,
      owner_name: name.toUpperCase(),
      street_address: street,
      city: 'The Woodlands',
      state: 'TX',
      zipcode: '77380',
      county: 'MONTGOMERY COUNTY',
      lot_size_acres: parseFloat((0.5 + Math.random() * 5).toFixed(2)),
      unpaid_taxes: unpaid,
      zillow_comp_rate: value,
      mao_price: mao,
      mail_status: 'KUYRUKTA'
    });
  }
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO off_market_leads (
      apn, owner_name, street_address, city, state, zipcode, county,
      lot_size_acres, unpaid_taxes, zillow_comp_rate, mao_price, mail_status
    ) VALUES (
      @apn, @owner_name, @street_address, @city, @state, @zipcode, @county,
      @lot_size_acres, @unpaid_taxes, @zillow_comp_rate, @mao_price, @mail_status
    )
  `);
  
  let seededCount = 0;
  const transaction = db.transaction((list) => {
    for (const lead of list) {
      insertStmt.run(lead);
      seededCount++;
    }
  });
  
  transaction(seedLeads);
  console.log(`✅ Diğer countyler (Tarrant/Montgomery) için ${seededCount} örnek borçlu mülk veritabanına eklendi.`);
}
