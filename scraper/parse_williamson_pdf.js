const { execSync } = require('child_process');
const fs = require('fs');

function parsePdf() {
  console.log('⏳ pdftotext ile PDF metne dönüştürülüyor...');
  const text = execSync('pdftotext -layout sample_williamson.pdf -', { encoding: 'utf-8' });
  
  console.log('🧠 Metin analiz ediliyor ve mülkler ayrıştırılıyor...');
  
  const lines = text.split('\n');
  const properties = [];
  
  let currentTract = null;
  
  // Basit satır bazlı ayrıştırıcı
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Yeni bir Tract başlangıcını tespit et (örn: "   3    24-0193-T480")
    const tractMatch = line.match(/^\s+(\d+)\s+(\d+-\d+-T\d+)\s+(.+)$/);
    if (tractMatch) {
      if (currentTract) {
        properties.push(currentTract);
      }
      
      const tractNo = tractMatch[1];
      const suitNo = tractMatch[2];
      const rest = tractMatch[3].trim();
      
      // Min Bid satırın sağ tarafındadır, e.g. "$7,000.00"
      const minBidMatch = line.match(/\$(\d{1,3},?\d{3}?\.\d{2})/);
      const minBid = minBidMatch ? minBidMatch[0] : 'N/A';
      
      currentTract = {
        tract: tractNo,
        suit_nbr: suitNo,
        defendant: '',
        description: '',
        account: '',
        minimum_bid: minBid,
        address: ''
      };
      
      // Davalı ismini bulmaya çalış (genelde suit no'nun altındaki satırlarda yazar)
      // "style" sütunundan davalıyı parse et
      continue;
    }
    
    if (currentTract) {
      // Hesap numarasını ara (örn: "Account #R006251")
      const acctMatch = line.match(/Account\s+#([A-Z0-9/]+)/i);
      if (acctMatch) {
        currentTract.account = acctMatch[1].trim();
      }
      
      // Adres bilgisini çekmeye çalış (TAYLOR, Texas 76574 veya ROUND ROCK, Texas 78681 gibi)
      const addrMatch = line.match(/([^,\(]+),\s*([A-Za-z\s]+),\s*Texas\s*(\d{5})/i);
      if (addrMatch) {
        currentTract.address = (addrMatch[0] || '').trim();
      }
      
      // Satır içeriğini açıklamaya ekle (GIS veya legal açıklama)
      if (line.trim().length > 10 && !line.includes('STYLE') && !line.includes('PROPERTY DESCRIPTION')) {
        currentTract.description += line.trim() + ' ';
      }
      
      // Eğer bir sonraki Tract'e geçtiysek veya sayfa sonu geldiyse
      if (line.includes('PROPERTY DESCRIPTION, APPROXIMATE')) {
        properties.push(currentTract);
        currentTract = null;
      }
    }
  }
  
  if (currentTract) {
    properties.push(currentTract);
  }
  
  // Veriyi temizle
  properties.forEach(p => {
    // Davalı ismini description içinden "v [Name]" şeklinde ayıkla
    const vMatch = p.description.match(/ v\s+([^,]+)/i);
    if (vMatch) {
      p.defendant = vMatch[1].replace(/collecting for.*/i, '').trim();
    }
    
    // Temizlik
    p.description = p.description.replace(/\s+/g, ' ').trim();
  });
  
  console.log(`\n🎉 Başarılı! PDF'den ${properties.length} adet ihalelik mülk verisi çekildi.\n`);
  console.log('İlk 3 mülk verisi:');
  console.log(JSON.stringify(properties.slice(0, 3), null, 2));
}

parsePdf();
