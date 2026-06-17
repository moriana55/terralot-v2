const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

function importPBFCM() {
  console.log('🚀 PBFCM (Perdue Brandon) örnek verileri tax_sales tablosuna ekleniyor...');
  
  const sampleProperties = [
    // Bexar County (San Antonio, TX)
    {
      tract: '101',
      suit_nbr: '2025-TA-01452',
      address: '742 WOODLAWN AVE',
      city: 'SAN ANTONIO',
      zipcode: '78212',
      min_bid: 18500,
      value: 125000,
      owner: 'RODRIGUEZ MARIA E',
      county: 'BEXAR COUNTY'
    },
    {
      tract: '102',
      suit_nbr: '2025-TA-00982',
      address: '1422 GERALD AVE',
      city: 'SAN ANTONIO',
      zipcode: '78211',
      min_bid: 12000,
      value: 95000,
      owner: 'GARCIA JOSE L & ALICIA',
      county: 'BEXAR COUNTY'
    },
    {
      tract: '103',
      suit_nbr: '2024-TA-03211',
      address: '3819 ROOSEVELT AVE',
      city: 'SAN ANTONIO',
      zipcode: '78214',
      min_bid: 35000,
      value: 210000,
      owner: 'ROOSEVELT HOLDINGS LLC',
      county: 'BEXAR COUNTY'
    },
    {
      tract: '104',
      suit_nbr: '2025-TA-01104',
      address: '8811 CULEBRA RD',
      city: 'SAN ANTONIO',
      zipcode: '78251',
      min_bid: 52000,
      value: 295000,
      owner: 'MARTINEZ CARLOS & ROSA',
      county: 'BEXAR COUNTY'
    },
    {
      tract: '105',
      suit_nbr: '2025-TA-00654',
      address: '519 N ZARZAMORA ST',
      city: 'SAN ANTONIO',
      zipcode: '78207',
      min_bid: 9500,
      value: 65000,
      owner: 'HERNANDEZ RAMIRO',
      county: 'BEXAR COUNTY'
    },
    
    // Collin County (Plano/McKinney, TX)
    {
      tract: '201',
      suit_nbr: 'CC-24-0098-T',
      address: '1802 MUNICIPAL AVE',
      city: 'PLANO',
      zipcode: '75074',
      min_bid: 45000,
      value: 320000,
      owner: 'MCKINNEY CORNERSTONE LTD',
      county: 'COLLIN COUNTY'
    },
    {
      tract: '202',
      suit_nbr: 'CC-25-0145-T',
      address: '908 WILCOX ST',
      city: 'MCKINNEY',
      zipcode: '75069',
      min_bid: 28000,
      value: 195000,
      owner: 'THOMPSON ROBERT & LINDA',
      county: 'COLLIN COUNTY'
    },
    {
      tract: '203',
      suit_nbr: 'CC-24-0341-T',
      address: '408 S STATE HWY 78',
      city: 'FARMERSVILLE',
      zipcode: '75442',
      min_bid: 19000,
      value: 145000,
      owner: 'COLLIN LAND INVESTMENTS',
      county: 'COLLIN COUNTY'
    },
    {
      tract: '204',
      suit_nbr: 'CC-25-0022-T',
      address: '2211 WINDING HOLLOW LN',
      city: 'PLANO',
      zipcode: '75093',
      min_bid: 85000,
      value: 580000,
      owner: 'HARRIS DAVID JR & SUSAN',
      county: 'COLLIN COUNTY'
    }
  ];

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

  let count = 0;
  const transaction = db.transaction((props) => {
    for (const p of props) {
      const discount = Math.round(((p.value - p.min_bid) / p.value) * 100);
      const uid = `PBFCM_TX_${p.county.replace(' COUNTY', '')}_${p.tract}_${p.suit_nbr}`;
      
      insertStmt.run({
        uid,
        state: 'TX',
        county: p.county,
        prop_address_one: p.address,
        prop_city: p.city,
        prop_state: 'TX',
        prop_zipcode: p.zipcode,
        value: p.value,
        minimum_bid: p.min_bid,
        discount_pct: discount,
        sale_type: 'Sheriff Sale',
        status: 'Scheduled for Auction',
        sale_date: '2026-07-07 10:00:00', // Texas Temmuz ihale günü
        sale_date_only: '2026-07-07',
        cause_nbr: p.suit_nbr,
        account_nbr: `ACCT-${p.tract}-${p.zipcode}`,
        owner_name: p.owner,
        source: 'PBFCM'
      });
      count++;
    }
  });

  transaction(sampleProperties);
  console.log(`🎉 Başarılı! ${count} adet Collin & Bexar County (PBFCM) mülkü tax_sales tablosuna eklendi.`);
}

try {
  importPBFCM();
} catch (e) {
  console.error('Import sırasında hata:', e.message);
} finally {
  db.close();
}
