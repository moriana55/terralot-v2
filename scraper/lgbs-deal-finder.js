const fs = require('fs');

const properties = JSON.parse(fs.readFileSync('lgbs_all_properties.json'));

// En iyi deal'leri bul: (value - minimum_bid) / value = discount %
const withDiscount = properties
  .filter(p => p.value && p.minimum_bid && parseFloat(p.value) > 1000 && parseFloat(p.minimum_bid) > 0)
  .map(p => {
    const value = parseFloat(p.value);
    const bid = parseFloat(p.minimum_bid);
    const discount = ((value - bid) / value * 100).toFixed(1);
    const savings = (value - bid).toFixed(0);
    return { ...p, discount: parseFloat(discount), savings: parseFloat(savings) };
  })
  .sort((a, b) => b.discount - a.discount);

console.log('💎 EN İYİ DEAL\'LER (Değerinin En Az %70 Altında Satılanlar)\n');
console.log('='.repeat(90));

// Top 30 deal
const top30 = withDiscount.slice(0, 30);
top30.forEach((p, i) => {
  const addr = [p.prop_address_one, p.prop_city, p.prop_state, p.prop_zipcode].filter(Boolean).join(', ') || 'Adres yok';
  console.log(`\n#${i+1} | %${p.discount} İNDİRİM | $${parseInt(p.savings).toLocaleString()} TASARRUF`);
  console.log(`  Değer:  $${parseFloat(p.value).toLocaleString()}`);
  console.log(`  Teklif: $${parseFloat(p.minimum_bid).toLocaleString()}`);
  console.log(`  Adres:  ${addr}`);
  console.log(`  County: ${p.county}, ${p.state}`);
  console.log(`  Tip:    ${p.sale_type} | Durum: ${p.status}`);
  if (p.sale_date) console.log(`  Tarih:  ${p.sale_date_only}`);
  if (p.geometry) console.log(`  GPS:    ${p.geometry.coordinates[1]}, ${p.geometry.coordinates[0]}`);
});

// Scheduled satışların en iyi deal'leri
console.log('\n\n🎯 YAKLAŞAN SATIŞLARDA EN İYİ DEAL\'LER (Önümüzdeki 60 Gün)\n');
console.log('='.repeat(90));

const scheduledDeals = withDiscount.filter(p => {
  if (!p.sale_date) return false;
  const saleDate = new Date(p.sale_date);
  const now = new Date();
  const diffDays = (saleDate - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 60 && p.status !== 'Cancelled';
}).sort((a, b) => b.discount - a.discount);

console.log(`Toplam ${scheduledDeals.length} yaklaşan satış:\n`);
scheduledDeals.slice(0, 20).forEach((p, i) => {
  const addr = [p.prop_address_one, p.prop_city, p.prop_state, p.prop_zipcode].filter(Boolean).join(', ') || 'Adres yok';
  console.log(`\n#${i+1} | 📅 ${p.sale_date_only} | %${p.discount} İNDİRİM`);
  console.log(`  Değer: $${parseFloat(p.value).toLocaleString()} → Teklif: $${parseFloat(p.minimum_bid).toLocaleString()}`);
  console.log(`  ${addr}`);
  console.log(`  ${p.county}, ${p.state} | ${p.sale_type} | ${p.status}`);
  if (p.county_sale_list) console.log(`  Liste: ${p.county_sale_list}`);
});

// CSV olarak kaydet
function toCSV(arr) {
  if (!arr.length) return '';
  const headers = Object.keys(arr[0]).filter(k => k !== 'geometry');
  const lines = [headers.join(',')];
  arr.forEach(p => {
    const row = headers.map(h => {
      const val = p[h] ?? '';
      const str = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
      return (str.includes(',') || str.includes('"')) ? `"${str}"` : str;
    });
    lines.push(row.join(','));
  });
  return lines.join('\n');
}

fs.writeFileSync('lgbs_best_deals.csv', toCSV(withDiscount.slice(0, 500)));
fs.writeFileSync('lgbs_scheduled_deals.csv', toCSV(scheduledDeals));
fs.writeFileSync('lgbs_best_deals.json', JSON.stringify(withDiscount.slice(0, 100), null, 2));

console.log('\n\n📊 GENEL İSTATİSTİKLER:\n');
const avgDiscount = withDiscount.reduce((s, p) => s + p.discount, 0) / withDiscount.length;
const medianBid = [...withDiscount].sort((a,b) => parseFloat(a.minimum_bid) - parseFloat(b.minimum_bid));
const mid = Math.floor(medianBid.length/2);

console.log(`  Toplam deal analiz edildi: ${withDiscount.length}`);
console.log(`  Ortalama indirim: %${avgDiscount.toFixed(1)}`);
console.log(`  Medyan teklif fiyatı: $${parseFloat(medianBid[mid].minimum_bid).toLocaleString()}`);
console.log(`  %90+ indirimli mülkler: ${withDiscount.filter(p => p.discount >= 90).length}`);
console.log(`  %80+ indirimli mülkler: ${withDiscount.filter(p => p.discount >= 80).length}`);
console.log(`  %70+ indirimli mülkler: ${withDiscount.filter(p => p.discount >= 70).length}`);
console.log(`  Yaklaşan satış deal\'leri: ${scheduledDeals.length}`);

console.log('\n💾 Kaydedilen dosyalar:');
console.log('  - lgbs_best_deals.csv (Top 500 deal)');
console.log('  - lgbs_scheduled_deals.csv (Yaklaşan satışlar)');
console.log('  - lgbs_best_deals.json');
