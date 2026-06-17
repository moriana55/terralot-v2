const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');

async function main() {
  console.log('⏳ LGBS Harris County hesapları okunuyor...');
  // harris_lgbs_owners.csv dosyasından hesap numaralarını oku
  const csvContent = fs.readFileSync('harris_lgbs_owners.csv', 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',');
  
  const lgbsMap = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 8) continue;
    const acct = cols[0].trim();
    // 13 karakter uzunluğa tamamla (gerekirse soluna 0 ekle)
    const paddedAcct = acct.padStart(13, '0');
    lgbsMap.set(paddedAcct, {
      rawAcct: acct,
      address: cols[1],
      county: cols[2],
      value: cols[3],
      min_bid: cols[4],
      status: cols[5],
      cause_nbr: cols[6],
      owner_name: cols[7]
    });
  }
  console.log(`✅ ${lgbsMap.size} adet Harris County hesabı yüklendi.`);

  console.log('⏳ Zip dosyasından real_acct.txt akışı başlatılıyor...');
  
  // unzip -p hcad_real_acct_owner.zip real_acct.txt komutunu çalıştır
  const unzipProcess = spawn('unzip', ['-p', 'hcad_real_acct_owner.zip', 'real_acct.txt']);
  
  const rl = readline.createInterface({
    input: unzipProcess.stdout,
    crlfDelay: Infinity
  });

  let headerCols = [];
  let lineCount = 0;
  let matchCount = 0;
  const enrichedResults = [];

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) {
      headerCols = line.split('\t').map(c => c.trim());
      console.log('📋 Kolonlar:', headerCols.join(', ').slice(0, 300) + '...');
      continue;
    }

    const cols = line.split('\t').map(c => c.trim());
    if (cols.length < headerCols.length) continue;

    // acct ilk kolondur, ama emin olmak için header index bulalım
    const acctVal = cols[0];
    const paddedAcctVal = acctVal.padStart(13, '0');

    if (lgbsMap.has(paddedAcctVal)) {
      matchCount++;
      const lgbsData = lgbsMap.get(paddedAcctVal);
      
      // Detaylı HCAD verilerini topla
      const mailto = cols[headerCols.indexOf('mailto')] || '';
      const mail_addr_1 = cols[headerCols.indexOf('mail_addr_1')] || '';
      const mail_addr_2 = cols[headerCols.indexOf('mail_addr_2')] || '';
      const mail_city = cols[headerCols.indexOf('mail_city')] || '';
      const mail_state = cols[headerCols.indexOf('mail_state')] || '';
      const mail_zip = cols[headerCols.indexOf('mail_zip')] || '';
      
      const land_val = cols[headerCols.indexOf('land_val')] || '0';
      const bld_val = cols[headerCols.indexOf('bld_val')] || '0';
      const tot_mkt_val = cols[headerCols.indexOf('tot_mkt_val')] || '0';
      const tot_appr_val = cols[headerCols.indexOf('assessed_val')] || cols[headerCols.indexOf('tot_appr_val')] || '0';
      const new_own_dt = cols[headerCols.indexOf('new_own_dt')] || '';
      
      const lgl1 = cols[headerCols.indexOf('lgl_1')] || '';
      const lgl2 = cols[headerCols.indexOf('lgl_2')] || '';
      const lgl3 = cols[headerCols.indexOf('lgl_3')] || '';
      const lgl4 = cols[headerCols.indexOf('lgl_4')] || '';
      const legal_desc = [lgl1, lgl2, lgl3, lgl4].filter(Boolean).join(' ');

      enrichedResults.push({
        account: lgbsData.rawAcct,
        owner_name: lgbsData.owner_name,
        mailto: mailto || lgbsData.owner_name,
        mail_address: [mail_addr_1, mail_addr_2].filter(Boolean).join(' '),
        mail_city,
        mail_state,
        mail_zip,
        property_address: lgbsData.address,
        min_bid: lgbsData.min_bid,
        status: lgbsData.status,
        cause_nbr: lgbsData.cause_nbr,
        land_value: parseInt(land_val),
        building_value: parseInt(bld_val),
        market_value: parseInt(tot_mkt_val),
        assessed_value: parseInt(tot_appr_val),
        new_owner_date: new_own_dt,
        legal_description: legal_desc
      });
      
      if (matchCount % 50 === 0) {
        console.log(`   🔥 Eşleşen sayısı: ${matchCount} | Son bulunan: ${lgbsData.owner_name}`);
      }
    }
  }

  console.log(`\n🎉 Tarama Bitti! Toplam satır: ${lineCount}, Toplam eşleşen: ${matchCount}`);

  // Enriched JSON yaz
  fs.writeFileSync('harris_lgbs_enriched.json', JSON.stringify(enrichedResults, null, 2));
  console.log('💾 harris_lgbs_enriched.json dosyası yazıldı.');

  // Enriched CSV yaz
  const csvHeaders = [
    'account', 'owner_name', 'mailto', 'mail_address', 'mail_city', 'mail_state', 'mail_zip',
    'property_address', 'min_bid', 'status', 'cause_nbr', 'land_value', 'building_value', 
    'market_value', 'assessed_value', 'new_owner_date', 'legal_description'
  ];
  
  const csvLines = [csvHeaders.join(',')];
  for (const r of enrichedResults) {
    const line = csvHeaders.map(h => {
      let val = String(r[h] || '');
      // Virgül ve tırnak işaretlerini kaçır (escape)
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
    csvLines.push(line);
  }
  
  fs.writeFileSync('harris_lgbs_enriched.csv', csvLines.join('\n'));
  console.log('💾 harris_lgbs_enriched.csv dosyası yazıldı.');
}

main().catch(console.error);
