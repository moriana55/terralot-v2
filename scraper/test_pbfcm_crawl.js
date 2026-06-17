const puppeteer = require('puppeteer');

(async () => {
  console.log('⏳ Puppeteer başlatılıyor...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const targetUrl = 'https://www.pbfcm.com/taxsale.html';
  console.log(`🌐 ${targetUrl} adresine gidiliyor...`);
  
  try {
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle2',
      timeout: 35000 
    });
    
    console.log('📄 Sayfa içeriği analiz ediliyor...');
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText.trim(), href: a.href }))
        .filter(l => l.href.toLowerCase().includes('.pdf') || l.href.includes('county'));
    });
    
    console.log(`🎉 Başarılı! ${links.length} adet potansiyel link bulundu:`);
    console.log(JSON.stringify(links.slice(0, 30), null, 2));
  } catch (err) {
    console.error('Tarama sırasında hata:', err.message);
  } finally {
    await browser.close();
  }
})();
