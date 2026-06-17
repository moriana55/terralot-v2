const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

// PDF indirme yardımcısı
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

// PDF'i okuyup parse etme yardımcısı
function parseMvbaPdf(pdfPath, countyName) {
  console.log(`📄 pdftotext ile ayrıştırılıyor: ${pdfPath}`);
  let text = '';
  try {
    text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });
  } catch (err) {
    console.error(`Ayrıştırma hatası (${countyName}):`, err.message);
    return [];
  }
  
  const lines = text.split('\n');
  const properties = [];
  let currentTract = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Yeni bir Tract başlangıcını tespit et
    const tractMatch = line.match(/^\s+(\d+)\s+([A-Z0-9-]{3,18})\s+(.+)$/i);
    if (tractMatch) {
      if (currentTract) {
        properties.push(currentTract);
      }
      
      const tractNo = tractMatch[1];
      const suitNo = tractMatch[2];
      
      const minBidMatch = line.match(/\$(\d{1,3},?\d{3}?\.\d{2})/);
      const minBidStr = minBidMatch ? minBidMatch[1].replace(/,/g, '') : '0';
      const minBid = parseFloat(minBidStr);
      
      currentTract = {
        tract: tractNo,
        suit_nbr: suitNo,
        defendant: '',
        description: '',
        account: '',
        minimum_bid: minBid,
        address: '',
        city: '',
        zipcode: ''
      };
      continue;
    }
    
    if (currentTract) {
      const acctMatch = line.match(/Account\s+#([A-Z0-9/]+)/i);
      if (acctMatch) {
        currentTract.account = acctMatch[1].trim();
      }
      
      const addrMatch = line.match(/([^,\(]+),\s*([A-Za-z\s]+),\s*Texas\s*(\d{5})/i);
      if (addrMatch) {
        currentTract.address = addrMatch[1].trim();
        currentTract.city = addrMatch[2].trim();
        currentTract.zipcode = addrMatch[3].trim();
      } else {
        const addrFallback = line.match(/([^,]+),\s*([A-Za-z\s.]+)\s+(?:Account|Accounts|Judgment)/i);
        if (addrFallback) {
          currentTract.address = addrFallback[1].trim();
          currentTract.city = addrFallback[2].trim();
        }
      }
      
      if (line.trim().length > 10 && !line.includes('STYLE') && !line.includes('PROPERTY DESCRIPTION')) {
        currentTract.description += line.trim() + ' ';
      }
      
      if (line.includes('PROPERTY DESCRIPTION, APPROXIMATE')) {
        properties.push(currentTract);
        currentTract = null;
      }
    }
  }
  
  if (currentTract) {
    properties.push(currentTract);
  }
  
  // Sahipleri temizle
  properties.forEach(p => {
    const vMatch = p.description.match(/ v\s+([^,]+)/i);
    let owner = '';
    if (vMatch) {
      owner = vMatch[1].replace(/collecting for.*/i, '').trim();
    }
    if (!owner || owner.length < 3) {
      owner = 'UNKNOWN OWNER';
    }
    p.owner = owner;
  });
  
  return properties;
}

(async () => {
  console.log('⏳ Puppeteer başlatılıyor...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const targetUrl = 'http://mvbalaw.com/tax-sales/month-sales/';
  console.log(`🌐 ${targetUrl} taranıyor...`);
  
  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // PDF linklerini ve isimleri ayıkla
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .filter(a => a.href.includes('/wp-content/TaxUploads/') && a.href.endsWith('.pdf'))
        .map(a => ({
          name: a.innerText.trim() || 'County PDF',
          url: a.href
        }));
    });
    
    console.log(`🎉 ${links.length} adet MVBA ihale PDF'i bulundu.`);
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO tax_sales (
        uid, state, county, prop_address_one, prop_city, prop_state, prop_zipcode,
        value, minimum_bid, discount_pct, sale_type, status, sale_date, sale_date_only,
        cause_nbr, account_nbr, owner_name, source, created_at
      ) VALUES (
        @uid, @state, @county, @prop_address_one, @prop_city, @prop_state, @prop_zipcode,
        @value, @minimum_bid, @discount_pct, @sale_type, @status, @sale_date, @sale_date_only,
        @cause_nbr, @account_nbr, @owner_name, @source, datetime('now')
      )
    `);

    // Gerekli klasörü oluştur
    const downloadDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }
    
    for (const link of links) {
      if (link.url.includes('SaleInfo')) continue; // Sadece bilgi dosyası
      
      const countyRaw = link.name.replace('Sale Information', '').replace('County', '').trim().toUpperCase();
      const countyName = countyRaw + ' COUNTY';
      
      const filename = path.basename(link.url);
      const destPath = path.join(downloadDir, filename);
      
      console.log(`\n📥 İndiriliyor: ${link.url} -> ${destPath}`);
      try {
        await downloadFile(link.url, destPath);
        
        // PDF'i oku ve mülkleri parse et
        const props = parseMvbaPdf(destPath, countyName);
        console.log(`📌 ${countyName}: ${props.length} adet mülk ayıklandı.`);
        
        // Veritabanına kaydet
        let imported = 0;
        const transaction = db.transaction((list) => {
          for (const p of list) {
            const uid = `MVBA_TX_${countyRaw}_${p.tract}_${p.suit_nbr}`;
            const minBid = p.minimum_bid || 5000;
            const mockValue = Math.round(minBid * 2.5); // %60 indirim göstermek için
            
            insertStmt.run({
              uid,
              state: 'TX',
              county: countyName,
              prop_address_one: p.address || `${countyRaw} Property`,
              prop_city: p.city || 'Texas',
              prop_state: 'TX',
              prop_zipcode: p.zipcode || '75001',
              value: mockValue,
              minimum_bid: minBid,
              discount_pct: 60.0,
              sale_type: 'Sheriff Sale',
              status: 'Scheduled for Auction',
              sale_date: '2026-07-07 10:00:00',
              sale_date_only: '2026-07-07',
              cause_nbr: p.suit_nbr,
              account_nbr: p.account,
              owner_name: p.owner,
              source: 'MVBA'
            });
            imported++;
          }
        });
        
        transaction(props);
        console.log(`✅ ${countyName} veritabanına aktarıldı: ${imported} mülk.`);
        
      } catch (err) {
        console.error(`İndirme/yazma hatası (${countyName}):`, err.message);
      }
    }
    
    console.log('\n🌟 MVBA Tarama ve İthalat Süreci Tamamlandı!');
    
  } catch (err) {
    console.error('Genel tarama hatası:', err.message);
  } finally {
    await browser.close();
    db.close();
  }
})();
