require('dotenv').config();
const { getAllListings, getStats, db } = require('./db');

const args = process.argv.slice(2);
const cmd = args[0] || 'list';

switch(cmd) {
  case 'list':
    const listings = getAllListings();
    if (listings.length === 0) {
      console.log('📭 Henüz ilan yok. Önce scraper çalıştır: node scraper.js');
      break;
    }
    console.log(`\n🏠 Toplam ${listings.length} arsa ilanı:\n`);
    listings.forEach((l, i) => {
      console.log(`${i+1}. ${l.street_address || 'Adres Yok'}, ${l.city}, ${l.state}`);
      const sizeStr = l.lot_size_acres 
        ? `${l.lot_size_acres} acres` 
        : (l.lot_size_sqft ? `${l.lot_size_sqft.toLocaleString()} sqft` : 'Boyut bilinmiyor');
      console.log(`   💰 $${l.price?.toLocaleString()} | 📐 ${sizeStr}`);
      console.log(`   🆔 APN/Parsel: ${l.apn || 'Yok'}`);
      console.log(`   🔗 ${l.zillow_url}`);
      console.log(`   📅 İlk görüldü: ${l.first_seen_at}\n`);
    });
    break;

  case 'stats':
    const stats = getStats();
    console.log('\n📊 İSTATİSTİKLER\n');
    console.log(`Toplam ilan: ${stats.total}`);
    console.log(`Ortalama fiyat: $${stats.avgPrice ? Math.round(stats.avgPrice).toLocaleString() : 'N/A'}`);
    console.log('\nEyalete göre:');
    stats.byState.forEach(s => console.log(`  ${s.state}: ${s.count} ilan`));
    console.log('\nSon fiyat düşüşleri:');
    if (stats.recentDrops.length === 0) {
      console.log('  Henüz fiyat düşüşü yok');
    } else {
      stats.recentDrops.forEach(d => {
        console.log(`  🔥 ${d.street_address || 'Adres Yok'}, ${d.city} → %${d.change_percent.toFixed(1)} düştü`);
        console.log(`     $${d.old_price.toLocaleString()} → $${d.new_price.toLocaleString()} (${d.recorded_at})`);
      });
    }
    break;

  case 'drops':
    const drops = db.prepare(`
      SELECT l.street_address, l.city, l.state, l.zillow_url, l.lot_size_acres, l.apn,
             ph.old_price, ph.new_price, ph.change_percent, ph.recorded_at
      FROM price_history ph
      JOIN listings l ON l.zpid = ph.zpid
      ORDER BY ph.change_percent DESC
    `).all();
    
    if (drops.length === 0) {
      console.log('Henüz fiyat düşüşü kaydedilmedi');
    } else {
      console.log(`\n🔥 TÜM FİYAT DÜŞÜŞLERİ (${drops.length}):\n`);
      drops.forEach(d => {
        console.log(`${d.street_address || 'Adres Yok'}, ${d.city}, ${d.state}`);
        console.log(`  📐 Boyut: ${d.lot_size_acres ? d.lot_size_acres + ' acres' : 'Bilinmiyor'} | APN: ${d.apn || 'Yok'}`);
        console.log(`  📉 %${d.change_percent.toFixed(1)} düşüş: $${d.old_price.toLocaleString()} → $${d.new_price.toLocaleString()}`);
        console.log(`  📅 ${d.recorded_at}`);
        console.log(`  🔗 ${d.zillow_url}\n`);
      });
    }
    break;

  case 'export':
    const all = getAllListings();
    const csv = [
      'ZPID,Adres,Sehir,Eyalet,Posta Kodu,Fiyat,Boyut (Acres),Boyut (Sqft),APN,Zillow URL,Ilk Goruldu',
      ...all.map(l => {
        const addr = (l.street_address || '').replace(/"/g, '""');
        const apnVal = (l.apn || '').replace(/"/g, '""');
        return `${l.zpid},"${addr}",${l.city || ''},${l.state || ''},${l.zipcode || ''},${l.price || 0},${l.lot_size_acres || ''},${l.lot_size_sqft || 0},"${apnVal}","${l.zillow_url || ''}",${l.first_seen_at || ''}`;
      })
    ].join('\n');
    
    const fs = require('fs');
    const filename = `listings_${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv, 'utf-8');
    console.log(`✅ ${all.length} ilan dışa aktarıldı: ${filename}`);
    break;

  default:
    console.log(`
Kullanım:
  node manage.js list    → Tüm ilanları listele
  node manage.js stats   → İstatistikleri göster  
  node manage.js drops   → Fiyat düşüşlerini göster
  node manage.js export  → CSV olarak dışa aktar
    `);
}
