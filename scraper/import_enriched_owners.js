const Database = require('better-sqlite3');
const fs = require('fs');

async function main() {
  const db = new Database('zillow_listings.db');

  console.log('⏳ Veritabanı şeması güncelleniyor (mail kolonları ekleniyor)...');
  // Yeni kolonları ekle (varsa hata fırlatmaz)
  try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_address TEXT;"); } catch(e){}
  try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_city TEXT;"); } catch(e){}
  try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_state TEXT;"); } catch(e){}
  try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_zip TEXT;"); } catch(e){}

  console.log('⏳ Enriched Harris County verisi okunuyor...');
  const data = JSON.parse(fs.readFileSync('harris_lgbs_enriched.json', 'utf-8'));
  console.log(`✅ ${data.length} adet Harris County kaydı yüklendi.`);

  let updatedCount = 0;
  const updateStmt = db.prepare(`
    UPDATE tax_sales 
    SET owner_name = @owner_name,
        mail_address = @mail_address,
        mail_city = @mail_city,
        mail_state = @mail_state,
        mail_zip = @mail_zip,
        value = CASE WHEN value IS NULL OR value = 0 THEN @market_value ELSE value END,
        cad_checked = 1
    WHERE account_nbr = @account
       OR account_nbr = @account_raw
  `);

  const transaction = db.transaction((rows) => {
    for (const r of rows) {
      // account_nbr formatı veritabanında bazen sol sıfırsız olabilir, bu yüzden iki türlü de eşleştiriyoruz
      const account_raw = String(parseInt(r.account));
      const res = updateStmt.run({
        owner_name: r.owner_name,
        mail_address: r.mail_address,
        mail_city: r.mail_city,
        mail_state: r.mail_state,
        mail_zip: r.mail_zip,
        market_value: r.market_value,
        account: r.account,
        account_raw: account_raw
      });
      if (res.changes > 0) {
        updatedCount += res.changes;
      }
    }
  });

  transaction(data);
  console.log(`🎉 Başarılı! Veritabanında ${updatedCount} adet Harris County mülkü sahiplik ve adres bilgileriyle güncellendi!`);
  
  // Kontrol et
  const sample = db.prepare(`
    SELECT account_nbr, owner_name, mail_address, mail_city, mail_state, mail_zip, value, cad_checked 
    FROM tax_sales 
    WHERE state = 'TX' AND county LIKE '%HARRIS%' AND cad_checked = 1 
    LIMIT 3
  `).all();
  console.log('Sample updated records in DB:', sample);
}

main().catch(console.error);
