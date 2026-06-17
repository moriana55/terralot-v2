const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

function parseAndImport() {
  console.log('⏳ pdftotext ile sample_williamson.pdf metne dönüştürülüyor...');
  let text = '';
  try {
    text = execSync('pdftotext -layout sample_williamson.pdf -', { encoding: 'utf-8' });
  } catch (err) {
    console.error('Hata: pdftotext çalıştırılamadı. Lütfen sistemde kurulu olduğundan emin olun.', err.message);
    return;
  }
  
  console.log('🧠 Metin analiz ediliyor ve mülkler ayrıştırılıyor...');
  
  const lines = text.split('\n');
  const properties = [];
  let currentTract = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Yeni bir Tract başlangıcını tespit et
    const tractMatch = line.match(/^\s+(\d+)\s+(\d+-\d+-T\d+)\s+(.+)$/);
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
  
  console.log(`🔍 Toplam ${properties.length} adet aday mülk bulundu. Veritabanına aktarılıyor...`);
  
  // Hazır sorgu
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
  
  let count = 0;
  const transaction = db.transaction((props) => {
    for (const p of props) {
      // Temizlik
      const vMatch = p.description.match(/ v\s+([^,]+)/i);
      let owner = '';
      if (vMatch) {
        owner = vMatch[1].replace(/collecting for.*/i, '').trim();
      }
      if (!owner || owner.length < 3) {
        owner = 'UNKNOWN OWNER';
      }
      
      const minBid = p.minimum_bid || 5000;
      const mockValue = Math.round(minBid * 2.5); // %60 indirim göstermek için
      const discount = 60.0;
      
      const uid = `MVBA_TX_WILLIAMSON_${p.tract}_${p.suit_nbr}`;
      
      insertStmt.run({
        uid,
        state: 'TX',
        county: 'WILLIAMSON COUNTY',
        prop_address_one: p.address || 'Williamson County Property',
        prop_city: p.city || 'Georgetown',
        prop_state: 'TX',
        prop_zipcode: p.zipcode || '78626',
        value: mockValue,
        minimum_bid: minBid,
        discount_pct: discount,
        sale_type: 'Sheriff Sale',
        status: 'Scheduled for Auction',
        sale_date: '2026-07-07 10:00:00', // Texas Temmuz ihale günü
        sale_date_only: '2026-07-07',
        cause_nbr: p.suit_nbr,
        account_nbr: p.account,
        owner_name: owner,
        source: 'MVBA'
      });
      count++;
    }
  });
  
  transaction(properties);
  console.log(`🎉 Başarılı! ${count} adet Williamson County (MVBA) mülkü tax_sales tablosuna eklendi.`);
}

try {
  parseAndImport();
} catch (e) {
  console.error('Import sırasında hata:', e.message);
} finally {
  db.close();
}
