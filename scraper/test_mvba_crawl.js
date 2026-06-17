const puppeteer = require('puppeteer');

(async () => {
  console.log('⏳ Puppeteer başlatılıyor...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('🌐 http://mvbalaw.com/tax-sales/month-sales/ adresine gidiliyor...');
  try {
    await page.goto('http://mvbalaw.com/tax-sales/month-sales/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('📄 Sayfa içeriği analiz ediliyor...');
    console.log('📄 Sayfa içeriği analiz ediliyor...');
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText.trim(), href: a.href }));
    });
    
    console.log(`🎉 Toplam ${links.length} adet link bulundu:`);
    console.log(JSON.stringify(links.filter(l => l.text.length > 0), null, 2));
  } catch (err) {
    console.error('Tarama sırasında hata:', err.message);
  } finally {
    await browser.close();
  }
})();
