const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
    
    console.log(`Found ${links.length} links.`);
    if (links.length > 0) {
      const firstLink = links[0];
      console.log(`Attempting to download ${firstLink.name} via page.evaluate fetch: ${firstLink.url}`);
      
      const base64 = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
          }
          const blob = await res.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return { error: e.message };
        }
      }, firstLink.url);
      
      if (typeof base64 === 'object' && base64.error) {
        console.error('Download error:', base64.error);
      } else {
        const dest = path.join(__dirname, 'downloads', 'test_eval_download.pdf');
        fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
        console.log(`Success! Saved to ${dest}. File size: ${fs.statSync(dest).size} bytes`);
      }
    }
  } catch (err) {
    console.error('General error:', err.message);
  } finally {
    await browser.close();
  }
})();
