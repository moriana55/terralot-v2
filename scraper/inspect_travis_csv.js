const puppeteer = require('puppeteer');

const csvUrl = 'https://tax-office.traviscountytx.gov/voterdata/TaxDelqOpenData.csv';

(async () => {
  console.log('⏳ Puppeteer başlatılıyor...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log(`🌐 ${csvUrl} taranıyor...`);
  try {
    await page.goto('https://tax-office.traviscountytx.gov/about-us/reports-data/property-taxes', { waitUntil: 'networkidle2' });
    
    console.log('Browser context fetch ile ilk 5000 karakter indiriliyor...');
    const base64Data = await page.evaluate(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob.slice(0, 5000));
      });
    }, csvUrl);
    
    const text = Buffer.from(base64Data, 'base64').toString('utf-8');
    console.log('\n--- CSV DOSYASININ İLK SATIRLARI ---');
    console.log(text);
    console.log('---------------------------------');
  } catch (err) {
    console.error('Hata:', err.message);
  } finally {
    await browser.close();
  }
})();
