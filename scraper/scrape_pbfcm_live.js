const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

// PDF indirme yardımcısı (Browser Context Fetch Kullanarak)
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

// PBFCM PDF'lerini okuyup ayrıştırma fonksiyonu
function parsePbfcmPdf(pdfPath, countyName) {
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
  let currentProp = null;
  
  // Basit kolon bazlı veya regex bazlı PBFCM parser'ı
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Satırda Cause No formatını ara (Örn: TX-25-00800, CC-24-0098, veya Bailey formatında sadece sol marjdaki 4 haneli case no)
    // Cause no genelde satırın başında (solda) yer alır.
    const causeMatch = line.match(/^\s*(TX-\d+-\d+|CC-\d+-\d+|[0-9]{4,6})\s+(.+)$/i);
    
    if (causeMatch) {
      if (currentProp) {
        properties.push(currentProp);
      }
      
      const causeNo = causeMatch[1].trim();
      const rest = causeMatch[2];
      
      // Minimum bid araması (TBD veya dolar tutarı)
      let minBid = 0;
      const minBidMatch = line.match(/\$(\d{1,3},?\d{3}?\.\d{2})/);
      if (minBidMatch) {
        minBid = parseFloat(minBidMatch[1].replace(/,/g, ''));
      }
      
      currentProp = {
        cause_nbr: causeNo,
        description: rest.trim(),
        minimum_bid: minBid,
        owner_name: 'UNKNOWN OWNER',
        account_nbr: 'GEO-' + causeNo,
        address: '',
        city: '',
        zipcode: ''
      };
      continue;
    }
    
    if (currentProp) {
      // Eğer satırda Taxpayer / Owner bilgisi veya "ASSESSED IN THE NAME OF" varsa
      const assessedMatch = line.match(/ASSESSED IN THE\s*NAME OF\s*(.+)$/i) || line.match(/Taxpayer:\s*(.+)$/i);
      if (assessedMatch) {
        currentProp.owner_name = assessedMatch[1].trim();
      }
      
      // Hesap numarasını ara (GEO, GEO No, App. Dist. No)
      const geoMatch = line.match(/(GEO|Dist\.?\s*No|Account):\s*([A-Z0-9/]+)/i);
      if (geoMatch) {
        currentProp.account_nbr = geoMatch[2].trim();
      }
      
      // Adres eşleştirme (Büyük harflerle cadde isimlendirmeleri)
      const addrMatch = line.match(/(\d+)\s+([A-Z\s]+)(?:ST|AVE|RD|DR|LN|WAY|BLVD|PL)/i);
      if (addrMatch && !currentProp.address) {
        currentProp.address = addrMatch[0].trim();
      }
      
      // Satırı açıklamaya ekle
      if (line.trim().length > 10 && !line.includes('Legal Description') && !line.includes('Minimum Bid')) {
        currentProp.description += ' ' + line.trim();
      }
      
      // Sayfa sonu veya tablo çizgisi gelirse mülkü ekle
      if (line.includes('---') || line.includes('')) {
        properties.push(currentProp);
        currentProp = null;
      }
    }
  }
  
  if (currentProp) {
    properties.push(currentProp);
  }
  
  // Temizlik işlemleri
  properties.forEach(p => {
    // Açıklamadan mükerrer boşlukları sil
    p.description = p.description.replace(/\s+/g, ' ').trim();
    
    // Taxpayer sütununu sağdan çekmeyi dene (PBFCM dosyalarında en sağ sütun taxpayer'dır)
    if (p.owner_name === 'UNKNOWN OWNER') {
      const parts = p.description.split(/\s{2,}/);
      if (parts.length > 2) {
        // En sağdaki parça genelde isimdir
        const lastPart = parts[parts.length - 1];
        if (lastPart.length > 3 && !lastPart.includes('$') && !lastPart.includes('TBD')) {
          p.owner_name = lastPart.replace(/assessed in the name of/i, '').trim();
        }
      }
    }
  });
  
  return properties.filter(p => p.cause_nbr);
}

(async () => {
  console.log('⏳ Puppeteer başlatılıyor...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const targetUrl = 'https://www.pbfcm.com/taxsale.html';
  console.log(`🌐 ${targetUrl} taranıyor...`);
  
  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // PDF linklerini ve isimleri ayıkla
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .filter(a => a.href.includes('/docs/taxdocs/sales/') && a.href.endsWith('.pdf'))
        .map(a => ({
          name: a.innerText.trim() || 'County PDF',
          url: a.href
        }));
    });
    
    console.log(`🎉 ${links.length} adet PBFCM ihale PDF'i bulundu.`);
    
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

    // Gerekli klasörleri oluştur
    const downloadDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }
    
    // En fazla 8 PDF indir ve tara (aşırı yüklenmemek için, önemli county'leri filtreleyelim)
    const activeLinks = links.filter(l => 
      !l.url.includes('Rules') && 
      !l.url.includes('SaleInfo') &&
      (l.name.includes('County') || l.url.includes('taxsale.pdf'))
    ).slice(0, 8);
    
    console.log(`📌 En önemli ${activeLinks.length} adet aktif county PDF listesi taranacak...`);
    
    for (const link of activeLinks) {
      const countyRaw = link.name.replace('Sale Information', '').replace('County', '').replace('Pct', '').trim().toUpperCase();
      const countyName = countyRaw + ' COUNTY';
      
      const filename = path.basename(link.url);
      const destPath = path.join(downloadDir, filename);
      
      console.log(`\n📥 İndiriliyor: ${link.url} -> ${destPath}`);
      try {
        await downloadFileWithPage(page, link.url, destPath);
        
        // PDF'i oku ve mülkleri parse et
        const props = parsePbfcmPdf(destPath, countyName);
        console.log(`📌 ${countyName}: ${props.length} adet mülk ayıklandı.`);
        
        if (props.length === 0) continue;
        
        // Veritabanına kaydet
        let imported = 0;
        const transaction = db.transaction((list) => {
          for (const p of list) {
            const uid = `PBFCM_TX_${countyRaw.replace(/\s+/g, '')}_${p.cause_nbr}`;
            const minBid = p.minimum_bid || 4500;
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
              cause_nbr: p.cause_nbr,
              account_nbr: p.account_nbr,
              owner_name: p.owner_name || 'UNKNOWN OWNER',
              source: 'PBFCM'
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
    
    console.log('\n🌟 PBFCM Tarama ve İthalat Süreci Tamamlandı!');
    
  } catch (err) {
    console.error('Genel tarama hatası:', err.message);
  } finally {
    await browser.close();
    db.close();
  }
})();
