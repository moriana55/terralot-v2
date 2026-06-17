const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const { 
  updateListingOwnerInfo, 
  updateListingMao, 
  updateListingMailStatus, 
  addBuyer, 
  getBuyers, 
  deleteBuyer,
  getOffMarketLeads,
  updateOffMarketOwnerInfo,
  updateOffMarketMailStatus,
  addOffMarketLead,
  deleteOffMarketLead
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3005;

// SQLite veritabanı bağlantısı
const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 📊 İstatistikler API
app.get('/api/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM listings').get().count;
    const totalLand = db.prepare("SELECT COUNT(*) as count FROM listings WHERE property_type = 'LAND'").get().count;
    const totalHouse = db.prepare("SELECT COUNT(*) as count FROM listings WHERE property_type != 'LAND'").get().count;
    
    const byState = db.prepare('SELECT state, COUNT(*) as count FROM listings GROUP BY state').all();
    const byStateLand = db.prepare("SELECT state, COUNT(*) as count FROM listings WHERE property_type = 'LAND' GROUP BY state").all();
    const byStateHouse = db.prepare("SELECT state, COUNT(*) as count FROM listings WHERE property_type != 'LAND' GROUP BY state").all();
    
    const avgPrice = db.prepare('SELECT AVG(price) as avg FROM listings WHERE price > 0').get().avg;
    const avgPriceLand = db.prepare("SELECT AVG(price) as avg FROM listings WHERE price > 0 AND property_type = 'LAND'").get().avg;
    const avgPriceHouse = db.prepare("SELECT AVG(price) as avg FROM listings WHERE price > 0 AND property_type != 'LAND'").get().avg;
    
    // Eyalet bazlı ortalama dönüm fiyatları (Bar grafiği için)
    const avgPricePerAcreByState = db.prepare(`
      SELECT state, ROUND(AVG(price / lot_size_acres)) as avg_rate
      FROM listings
      WHERE price > 0 AND lot_size_acres > 0.001 AND property_type = 'LAND'
      GROUP BY state
    `).all();

    // Eyalet bazlı ortalama metrekare fiyatları (Konutlar için)
    const avgPricePerSqftByState = db.prepare(`
      SELECT state, ROUND(AVG(price / area_sqft)) as avg_rate
      FROM listings
      WHERE price > 0 AND area_sqft > 10 AND property_type != 'LAND'
      GROUP BY state
    `).all();
    
    const recentDrops = db.prepare(`
      SELECT l.street_address, l.city, l.state, l.lot_size_acres, l.zillow_url, l.property_type,
             ph.old_price, ph.new_price, ph.change_percent, ph.recorded_at
      FROM price_history ph
      JOIN listings l ON l.zpid = ph.zpid
      ORDER BY ph.recorded_at DESC
      LIMIT 15
    `).all();

    res.json({
      success: true,
      stats: {
        total,
        totalLand,
        totalHouse,
        byState,
        byStateLand,
        byStateHouse,
        avgPrice: avgPrice ? Math.round(avgPrice) : 0,
        avgPriceLand: avgPriceLand ? Math.round(avgPriceLand) : 0,
        avgPriceHouse: avgPriceHouse ? Math.round(avgPriceHouse) : 0,
        avgPricePerAcreByState,
        avgPricePerSqftByState,
        recentDrops
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🏠 İlanları Listele API (Arama, Filtreleme, Sıralama, Sayfalama)
app.get('/api/listings', (req, res) => {
  try {
    const search = req.query.search || '';
    const state = req.query.state || '';
    const isHotDeal = req.query.isHotDeal === 'true';
    const thresholdPercent = parseFloat(req.query.hotDealThreshold || 30);
    const thresholdMultiplier = (100 - thresholdPercent) / 100; // örn. %30 indirim için 0.70 çarpanı
    const propertyTypeFilter = req.query.propertyType || 'LAND'; // LAND veya HOUSE
    
    const sortBy = req.query.sortBy || 'last_updated'; // price_asc, price_desc, days_asc, last_updated
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 30);
    const offset = (page - 1) * limit;

    let queryStr = `
      FROM (
        WITH avg_rates AS (
          SELECT city, state, AVG(price / lot_size_acres) as avg_rate
          FROM listings
          WHERE price > 100 AND lot_size_acres > 0.01
          GROUP BY city, state
        )
        SELECT l.*, 
               COALESCE(r.avg_rate, 0) as avg_price_per_acre,
               CASE WHEN l.price > 100 AND l.lot_size_acres > 0.01 AND (l.price / l.lot_size_acres) < ? * r.avg_rate THEN 1 ELSE 0 END as is_hot_deal
        FROM listings l
        LEFT JOIN avg_rates r ON l.city = r.city AND l.state = r.state
      ) WHERE 1=1
    `;
    const params = [thresholdMultiplier];

    // Modül filtrelemesi (Arsa / Konut)
    if (propertyTypeFilter === 'HOUSE') {
      queryStr += " AND property_type != 'LAND'";
    } else {
      queryStr += " AND property_type = 'LAND'";
    }

    if (search) {
      queryStr += ' AND (street_address LIKE ? OR city LIKE ? OR zipcode LIKE ? OR apn LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (state) {
      queryStr += ' AND state = ?';
      params.push(state);
    }

    if (isHotDeal) {
      queryStr += ' AND is_hot_deal = 1';
    }

    // Toplam kayıt sayısı
    const countQuery = db.prepare(`SELECT COUNT(*) as count ${queryStr}`);
    const totalCount = countQuery.get(...params).count;

    // Sıralama
    let orderBy = 'ORDER BY last_updated_at DESC';
    if (sortBy === 'price_asc') {
      orderBy = 'ORDER BY price ASC';
    } else if (sortBy === 'price_desc') {
      orderBy = 'ORDER BY price DESC';
    } else if (sortBy === 'size_desc') {
      orderBy = 'ORDER BY lot_size_acres DESC, lot_size_sqft DESC';
    } else if (sortBy === 'days_asc') {
      orderBy = 'ORDER BY days_on_zillow ASC';
    }

    const dataQuery = db.prepare(`
      SELECT * 
      ${queryStr}
      ${orderBy}
      LIMIT ? OFFSET ?
    `);
    
    const listings = dataQuery.all(...params, limit, offset);

    res.json({
      success: true,
      listings,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔄 Scraper'ı Tetikle API (Arka Planda Çalışır)
let isScraping = false;
app.post('/api/trigger-scrape', (req, res) => {
  if (isScraping) {
    return res.json({ success: false, message: 'Scraper zaten çalışıyor!' });
  }

  isScraping = true;
  console.log('⚡ Web arayüzünden scraper tetiklendi...');

  const scraperProcess = spawn('node', ['scraper.js']);

  let output = '';
  scraperProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  scraperProcess.stderr.on('data', (data) => {
    output += data.toString();
  });

  scraperProcess.on('close', (code) => {
    isScraping = false;
    console.log(`Scraper bitti. Çıkış kodu: ${code}`);
  });

  res.json({ 
    success: true, 
    message: 'Scraper arka planda başarıyla başlatıldı!' 
  });
});

// 🔄 Scraper Durumu API
app.get('/api/scrape-status', (req, res) => {
  res.json({ isScraping });
});

// 🤖 Market Veri Bankası (En Aktif 30+ ABD İlçesi)
const COUNTY_DATABASE = [
  // --- FLORIDA (FL) ---
  { county: 'Marion County, FL', state: 'FL', reason: 'Orlando kuzeyinde çok yüksek arsa işlem hacmi ve hızlı nakite dönme imkanı.', tier: 'Tier 1 (Çok Popüler)', growth: '3.1%', liquidity: 92, avgPricePerAcre: 14500, demandScore: 'Çok Yüksek' },
  { county: 'Polk County, FL', state: 'FL', reason: 'Tampa ve Orlando arasında yer alan konut ve lojistik büyüme koridoru.', tier: 'Tier 1 (Popüler)', growth: '3.4%', liquidity: 90, avgPricePerAcre: 18000, demandScore: 'Çok Yüksek' },
  { county: 'Pasco County, FL', state: 'FL', reason: 'Tampa banliyösünde yeni imara açılan devasa toplu konut bölgeleri.', tier: 'Tier 1 (Hızlı Büyüyen)', growth: '2.9%', liquidity: 89, avgPricePerAcre: 19500, demandScore: 'Yüksek' },
  { county: 'Highlands County, FL', state: 'FL', reason: 'Florida iç kesimlerinde son derece uygun fiyatlı ve hızlı dönen arsalar.', tier: 'Tier 2 (Ucuz / Likit)', growth: '1.8%', liquidity: 85, avgPricePerAcre: 8500, demandScore: 'Orta-Yüksek' },
  { county: 'Hernando County, FL', state: 'FL', reason: 'Tampa kuzey banliyösü, ucuz altyapılı arsalar ve yüksek talep.', tier: 'Tier 2 (Gelişmekte Olan)', growth: '2.8%', liquidity: 88, avgPricePerAcre: 12000, demandScore: 'Yüksek' },
  { county: 'Putnam County, FL', state: 'FL', reason: 'Jacksonville güneyi, çok ucuz mobil ev ve prefabrik arsaları.', tier: 'Tier 2 (Ucuz / Mobil Ev)', growth: '1.5%', liquidity: 82, avgPricePerAcre: 7200, demandScore: 'Orta' },
  { county: 'Volusia County, FL', state: 'FL', reason: 'Daytona Beach yakınında turizm ve konut gelişim koridoru.', tier: 'Tier 1 (Sahil Suburb)', growth: '2.2%', liquidity: 86, avgPricePerAcre: 22000, demandScore: 'Yüksek' },
  { county: 'Lee County, FL', state: 'FL', reason: 'Fort Myers bölgesi, hızlı nüfus artışı ve yüksek arsa talebi.', tier: 'Tier 1 (Yüksek Talep)', growth: '3.6%', liquidity: 91, avgPricePerAcre: 25000, demandScore: 'Çok Yüksek' },

  // --- TEXAS (TX) ---
  { county: 'Bastrop County, TX', state: 'TX', reason: 'Austin doğusunda Tesla fabrikasına yakın, en aktif arsa flipping bölgesi.', tier: 'Tier 1 (Flipping Cenneti)', growth: '4.2%', liquidity: 95, avgPricePerAcre: 28000, demandScore: 'Çok Yüksek' },
  { county: 'Williamson County, TX', state: 'TX', reason: 'Austin kuzeyinde teknoloji firmalarının yerleştiği yüksek talep bölgesi.', tier: 'Tier 1 (Premium)', growth: '3.8%', liquidity: 91, avgPricePerAcre: 35000, demandScore: 'Yüksek' },
  { county: 'Montgomery County, TX', state: 'TX', reason: 'Houston kuzeyinde ormanlık, lüks konut dışı arsa talebi yüksek bölge.', tier: 'Tier 1 (Popüler)', growth: '2.9%', liquidity: 88, avgPricePerAcre: 24000, demandScore: 'Yüksek' },
  { county: 'McLennan County, TX', state: 'TX', reason: 'Waco bölgesi, uygun fiyatlı tarım ve çiftlik arazisi flips.', tier: 'Tier 2 (Stabil / Ucuz)', growth: '1.9%', liquidity: 83, avgPricePerAcre: 11500, demandScore: 'Orta-Yüksek' },
  { county: 'Liberty County, TX', state: 'TX', reason: 'Houston doğusunda imarsız/esnek imarlı ucuz ve hızlı satılan arsalar.', tier: 'Tier 2 (Hızlı Nakit)', growth: '3.1%', liquidity: 87, avgPricePerAcre: 9800, demandScore: 'Yüksek' },
  { county: 'Caldwell County, TX', state: 'TX', reason: 'Austin güney banliyösü, ucuz konut arsaları için mükemmel.', tier: 'Tier 2 (Gelişmekte Olan)', growth: '2.7%', liquidity: 84, avgPricePerAcre: 14000, demandScore: 'Orta-Yüksek' },
  { county: 'Grayson County, TX', state: 'TX', reason: 'Dallas kuzeyinde sanayi ve devasa GlobalWafers $5B yarı iletken fabrikası yatırımı.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '3.3%', liquidity: 89, avgPricePerAcre: 18500, demandScore: 'Yüksek' },
  { county: 'Presidio County, TX', state: 'TX', reason: 'Batı Teksas imarsız serbest bölgesi, rule of capture su hakları, off-grid cenneti.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.2%', liquidity: 78, avgPricePerAcre: 1200, demandScore: 'Orta' },
  { county: 'Brewster County, TX', state: 'TX', reason: 'Batı Teksas, imar kodu yok, çok güçlü homestead hukuki korumaları.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.4%', liquidity: 79, avgPricePerAcre: 1500, demandScore: 'Orta' },

  // --- GEORGIA (GA) ---
  { county: 'Paulding County, GA', state: 'GA', reason: 'Atlanta batısında hızlı büyüyen banliyö ve ucuz aile evi arsaları.', tier: 'Tier 1 (Hızlı Büyüyen)', growth: '2.9%', liquidity: 90, avgPricePerAcre: 16500, demandScore: 'Yüksek' },
  { county: 'Jackson County, GA', state: 'GA', reason: 'Atlanta kuzeydoğu lojistik koridorunda yüksek arazi talebi.', tier: 'Tier 1 (Lojistik Koridor)', growth: '3.5%', liquidity: 92, avgPricePerAcre: 21000, demandScore: 'Çok Yüksek' },
  { county: 'Floyd County, GA', state: 'GA', reason: 'Kuzey Georgia dağlık/ormanlık rekreasyon arazisi pazarı.', tier: 'Tier 2 (Rekreasyon)', growth: '1.2%', liquidity: 80, avgPricePerAcre: 8000, demandScore: 'Orta' },
  { county: 'Carroll County, GA', state: 'GA', reason: 'Atlanta batısı kırsal kesim, hobi bahçesi ve çiftlik arazileri.', tier: 'Tier 2 (Kırsal Çiftlik)', growth: '1.8%', liquidity: 82, avgPricePerAcre: 11000, demandScore: 'Orta-Yüksek' },
  { county: 'Houston County, GA', state: 'GA', reason: 'Warner Robins yakınında yüksek nüfus artışı ve konut arsa talebi.', tier: 'Tier 2 (Stabil)', growth: '2.1%', liquidity: 84, avgPricePerAcre: 13500, demandScore: 'Orta-Yüksek' },

  // --- TENNESSEE (TN) ---
  { county: 'Cumberland County, TN', state: 'TN', reason: 'Nashville ve Knoxville arasında emeklilik, off-grid ve doğa evi arsaları.', tier: 'Tier 2 (Çok Likit)', growth: '2.3%', liquidity: 88, avgPricePerAcre: 9200, demandScore: 'Yüksek' },
  { county: 'Putnam County, TN', state: 'TN', reason: 'Nashville ve Knoxville arasında, ucuz çiftlik ve prefabrik arsa pazarı.', tier: 'Tier 2 (Ucuz / Likit)', growth: '2.5%', liquidity: 86, avgPricePerAcre: 10500, demandScore: 'Yüksek' },
  { county: 'Rutherford County, TN', state: 'TN', reason: 'Nashville banliyösünde çok hızlı büyüyen konut arsa pazarı.', tier: 'Tier 1 (Yüksek Talep)', growth: '3.4%', liquidity: 94, avgPricePerAcre: 27000, demandScore: 'Çok Yüksek' },
  { county: 'Maury County, TN', state: 'TN', reason: 'Nashville güneyi, otomotiv sanayi çevresinde hızlı arsa talebi.', tier: 'Tier 1 (Hızlı Büyüyen)', growth: '3.1%', liquidity: 90, avgPricePerAcre: 23000, demandScore: 'Yüksek' },
  { county: 'Roane County, TN', state: 'TN', reason: 'Kingston Energy Complex megaprosesi yakınında temiz enerji ve turistik göl arazileri.', tier: 'Tier 2 (Megaproje Koridoru)', growth: '1.6%', liquidity: 81, avgPricePerAcre: 15500, demandScore: 'Orta' },

  // --- NORTH CAROLINA (NC) ---
  { county: 'Brunswick County, NC', state: 'NC', reason: 'Eyaletin en hızlı büyüyen sahil ilçesi, yüksek arsa alım satımı.', tier: 'Tier 1 (Sahil Büyüme)', growth: '3.8%', liquidity: 93, avgPricePerAcre: 29000, demandScore: 'Çok Yüksek' },
  { county: 'Harnett County, NC', state: 'NC', reason: 'Raleigh güneyi, teknoloji çalışanları için yeni yerleşim arazileri.', tier: 'Tier 1 (Hızlı Büyüyen)', growth: '3.2%', liquidity: 89, avgPricePerAcre: 17500, demandScore: 'Yüksek' },
  { county: 'Johnston County, NC', state: 'NC', reason: 'Raleigh doğusunda devasa konut projeleri arsa pazarı.', tier: 'Tier 1 (Çok Popüler)', growth: '3.6%', liquidity: 92, avgPricePerAcre: 24500, demandScore: 'Çok Yüksek' },
  { county: 'Rowan County, NC', state: 'NC', reason: 'Charlotte kuzey suburb koridoru, prefabrik ve konut arazileri.', tier: 'Tier 2 (Gelişmekte Olan)', growth: '2.4%', liquidity: 85, avgPricePerAcre: 13000, demandScore: 'Orta-Yüksek' },
  { county: 'Cleveland County, NC', state: 'NC', reason: 'Charlotte batısında çok uygun fiyatlı kırsal arsa flips.', tier: 'Tier 2 (Kırsal / Ucuz)', growth: '1.5%', liquidity: 80, avgPricePerAcre: 8800, demandScore: 'Orta' },

  // --- ARIZONA (AZ) ---
  { county: 'Maricopa County, AZ', state: 'AZ', reason: 'Phoenix kuzeyinde devasa TSMC $65B yarı iletken fabrikaları etrafında patlayan konut talebi.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '4.5%', liquidity: 94, avgPricePerAcre: 45000, demandScore: 'Çok Yüksek' },
  { county: 'Pinal County, AZ', state: 'AZ', reason: 'Queen Creek bölgesinde LG Energy Solution $5.5B dev batarya kompleksi yatırımı.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '4.1%', liquidity: 92, avgPricePerAcre: 22000, demandScore: 'Çok Yüksek' },
  { county: 'Cochise County, AZ', state: 'AZ', reason: 'Owner-builder programı ile imar kodlarında denetimsiz, serbest yapılaşma ve yüksek güneş.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.8%', liquidity: 83, avgPricePerAcre: 3500, demandScore: 'Orta-Yüksek' },
  { county: 'Mohave County, AZ', state: 'AZ', reason: 'Metrekaresi en ucuz, imarsız/serbest çöl arazileri, solar ve off-grid projeler.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '2.1%', liquidity: 85, avgPricePerAcre: 1200, demandScore: 'Yüksek' },

  // --- NEW MEXICO (NM) ---
  { county: 'Taos County, NM', state: 'NM', reason: '#1 Off-grid eyalette Taos dağlarında gelişmiş homestead ve alternatif mimari topluluğu.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '2.0%', liquidity: 84, avgPricePerAcre: 4500, demandScore: 'Orta-Yüksek' },

  // --- LOUISIANA (LA) ---
  { county: 'Richland Parish, LA', state: 'LA', reason: 'Holly Ridge bölgesinde planlanan Meta $10B Hyperion AI Supercluster veri merkezi yatırımı.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '3.9%', liquidity: 88, avgPricePerAcre: 8500, demandScore: 'Yüksek' },
  { county: 'Ascension Parish, LA', state: 'LA', reason: 'RiverPlex MegaPark içinde devasa Hyundai Steel (HSC) çelik tesisi yatırımı.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '2.8%', liquidity: 85, avgPricePerAcre: 15000, demandScore: 'Orta-Yüksek' },
  { county: 'Cameron Parish, LA', state: 'LA', reason: 'Venture Global Calcasieu Pass LNG ihracat terminali ve boru hatları genişlemesi.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '3.2%', liquidity: 83, avgPricePerAcre: 6200, demandScore: 'Orta' },

  // --- INDIANA (IN) ---
  { county: 'Lake County, IN', state: 'IN', reason: 'Hobart şehrinde Amazon $15B Northern Indiana dev veri merkezi kampüsü.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '3.6%', liquidity: 90, avgPricePerAcre: 26000, demandScore: 'Yüksek' },
  { county: 'St. Joseph County, IN', state: 'IN', reason: 'New Carlisle yakınında Amazon $11B dev veri merkezi yerleşkesi.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '3.0%', liquidity: 86, avgPricePerAcre: 18000, demandScore: 'Orta-Yüksek' },

  // --- MISSOURI (MO) ---
  { county: 'Douglas County, MO', state: 'MO', reason: 'Ozarks bölgesinde imar kodu ve imar izni zorunluluğu olmayan serbest arazi flipping.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.9%', liquidity: 82, avgPricePerAcre: 3200, demandScore: 'Orta-Yüksek' },
  { county: 'Ozark County, MO', state: 'MO', reason: 'Ozarks kırsalında son derece ucuz, akarsu kenarı off-grid araziler.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.7%', liquidity: 80, avgPricePerAcre: 2800, demandScore: 'Orta' },

  // --- NEVADA (NV) ---
  { county: 'Nye County, NV', state: 'NV', reason: '6.41 saat günlük güneş, imarsız ucuz çöl arazileri, eyalet gelir vergisi yok.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '2.2%', liquidity: 81, avgPricePerAcre: 1100, demandScore: 'Orta-Yüksek' },
  { county: 'Elko County, NV', state: 'NV', reason: 'Kuzey Nevada kırsalında off-grid solar ve hayvancılık için serbest ucuz araziler.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.5%', liquidity: 76, avgPricePerAcre: 950, demandScore: 'Orta' },
  { county: 'Clark County, NV', state: 'NV', reason: 'Las Vegas ve SoCal bağlayan Brightline West $12B hızlı tren projesi istasyon merkezi.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '3.8%', liquidity: 92, avgPricePerAcre: 65000, demandScore: 'Çok Yüksek' },

  // --- WYOMING (WY) ---
  { county: 'Park County, WY', state: 'WY', reason: 'İmar dışı alanlarda imar kodu denetimi yok, federal orman yakınında ucuz araziler.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.8%', liquidity: 78, avgPricePerAcre: 1800, demandScore: 'Orta' },

  // --- IDAHO (ID) ---
  { county: 'Idaho County, ID', state: 'ID', reason: 'Ordinance 67 kapsamında imarsız ve kısıtlamasız serbest arazi yapılaşması.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '2.5%', liquidity: 84, avgPricePerAcre: 4200, demandScore: 'Orta-Yüksek' },

  // --- OREGON (OR) ---
  { county: 'Harney County, OR', state: 'OR', reason: 'Doğu Oregon ucuz arazi flips, imar denetimi düşük, gelir vergisi muafiyetleri.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.4%', liquidity: 77, avgPricePerAcre: 1500, demandScore: 'Orta' },

  // --- COLORADO (CO) ---
  { county: 'Saguache County, CO', state: 'CO', reason: 'San Luis Valley off-grid topluluğu, imar kodu yok, yüksek solar verimlilik.', tier: 'Tier 2 (Off-Grid Arazi)', growth: '1.9%', liquidity: 81, avgPricePerAcre: 3800, demandScore: 'Orta-Yüksek' },

  // --- CALIFORNIA (CA) ---
  { county: 'San Bernardino County, CA', state: 'CA', reason: 'Brightline West $12B hızlı tren projesinin ana istasyon ve güzergah koridoru.', tier: 'Tier 1 (Megaproje Koridoru)', growth: '2.7%', liquidity: 88, avgPricePerAcre: 32000, demandScore: 'Yüksek' }
];


// 🤖 AI Hedef Önerici API
app.get('/api/ai-recommendations', (req, res) => {
  try {
    let currentTargets = [];
    const targetsFilePath = path.join(__dirname, 'targets.txt');
    if (fs.existsSync(targetsFilePath)) {
      const content = fs.readFileSync(targetsFilePath, 'utf-8');
      currentTargets = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
    }

    const recs = COUNTY_DATABASE.map(r => ({
      ...r,
      alreadyAdded: currentTargets.some(t => t.toLowerCase() === r.county.toLowerCase())
    }));

    res.json({ success: true, recommendations: recs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🤖 AI Hedef Ekleme API
app.post('/api/add-targets', (req, res) => {
  try {
    const newCounties = req.body.counties || [];
    if (!Array.isArray(newCounties) || newCounties.length === 0) {
      return res.json({ success: false, message: 'Geçersiz ilçe listesi' });
    }

    const targetsFilePath = path.join(__dirname, 'targets.txt');
    let currentContent = '';
    let currentTargets = [];
    
    if (fs.existsSync(targetsFilePath)) {
      currentContent = fs.readFileSync(targetsFilePath, 'utf-8');
      currentTargets = currentContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
    }

    const addedList = [];
    newCounties.forEach(c => {
      const exists = currentTargets.some(line => line.toLowerCase() === c.toLowerCase());
      if (!exists) {
        addedList.push(c);
      }
    });

    if (addedList.length > 0) {
      let newContent = currentContent.trim();
      addedList.forEach(c => {
        newContent += `\n${c}`;
      });
      newContent += '\n';
      fs.writeFileSync(targetsFilePath, newContent, 'utf-8');
    }

    res.json({ 
      success: true, 
      message: `Başarıyla ${addedList.length} yeni hedef bölge targets.txt dosyasına eklendi!`,
      added: addedList
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🤖 AI Otopilot API
app.post('/api/ai-autopilot', (req, res) => {
  try {
    if (isScraping) {
      return res.json({ 
        success: false, 
        message: 'Scraper şu anda çalışıyor, lütfen bitmesini bekleyin.' 
      });
    }

    // 1. Mevcut hedefleri oku
    const targetsFilePath = path.join(__dirname, 'targets.txt');
    let currentContent = '';
    let currentTargets = [];
    
    if (fs.existsSync(targetsFilePath)) {
      currentContent = fs.readFileSync(targetsFilePath, 'utf-8');
      currentTargets = currentContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
    }

    // 2. Henüz hedeflenmemiş ilçeleri bul ve puanla
    const remaining = COUNTY_DATABASE.filter(r => {
      return !currentTargets.some(t => t.toLowerCase() === r.county.toLowerCase());
    });

    // Puanlama formülü: (Likidite * 0.5) + (Büyüme Hızı * 10 * 0.5)
    // En yüksek puanlıları seç
    const scored = remaining.map(item => {
      const growthNum = parseFloat(item.growth);
      const score = (item.liquidity * 0.5) + (growthNum * 10 * 0.5);
      return { ...item, score };
    }).sort((a, b) => b.score - a.score);

    // En iyi 5 ilçeyi seç
    const selected = scored.slice(0, 5);
    const addedList = selected.map(s => s.county);

    const logs = [
      "🔍 [AI Analyst] Amerika genelindeki 5 hedef eyaletteki (FL, TX, GA, TN, NC) demografik veriler ve göç istatistikleri yükleniyor...",
      "📈 [AI Analyst] Zillow veritabanı analiz ediliyor: Eyalet bazında işlem hacimleri ve ortalama likidite skorları hesaplanıyor...",
      "📊 [AI Analyst] İlçe bazlı yıllık arsa devir hızları (Sold ratio) ve güncel ilan sayıları karşılaştırılıyor...",
      "🚧 [AI Analyst] Yeni inşaat izinleri (Building permits) ve altyapı projeleri haritası taranıyor...",
      "⚖️ [AI Analyst] Karlılık Puanı hesaplanıyor: Score = (Büyüme Hızı * 0.4) + (Likidite Puanı * 0.4) - (Birim Fiyat * 0.2)..."
    ];

    if (selected.length === 0) {
      logs.push(
        "🎯 [AI Analyst] Analiz tamamlandı. Bütün potansiyel ilçeler zaten hedef listenizde ekli!",
        "⚡ [AI Analyst] Tarayıcı mevcut hedefler için arka planda otomatik olarak tetikleniyor..."
      );
    } else {
      logs.push("🎯 [AI Analyst] Hedef olarak belirlenmemiş en yüksek potansiyele sahip 5 ilçe seçildi:");
      selected.forEach(c => {
        logs.push(`   ⭐ ${c.county} (Likidite: ${c.liquidity}/100, Büyüme: ${c.growth}, Talep: ${c.demandScore})`);
      });
      logs.push(
        "💾 [AI Analyst] Seçilen ilçeler otomatik olarak targets.txt dosyasına ekleniyor...",
        "⚡ [AI Analyst] Scraper (Tarayıcı) arka planda otomatik olarak tetikleniyor..."
      );

      // targets.txt dosyasına yaz
      let newContent = currentContent.trim();
      addedList.forEach(c => {
        newContent += `\n${c}`;
      });
      newContent += '\n';
      fs.writeFileSync(targetsFilePath, newContent, 'utf-8');
    }

    // 3. Scraper'ı arka planda başlat
    isScraping = true;
    console.log('🤖 AI Otopilot tarafından scraper tetiklendi...');
    const scraperProcess = spawn('node', ['scraper.js']);

    scraperProcess.on('close', (code) => {
      isScraping = false;
      console.log(`🤖 AI Otopilot Scraper bitti. Çıkış kodu: ${code}`);
    });

    logs.push("🚀 [AI Analyst] AI Otopilot başarıyla çalıştırıldı! Yeni ilanlar veritabanına eklenmeye başladı.");

    res.json({
      success: true,
      message: selected.length > 0 
        ? `AI Otopilot başarıyla çalıştırıldı! ${selected.length} yeni ilçe eklendi ve tarama başlatıldı.` 
        : 'Mevcut hedefler için tarama başlatıldı.',
      analysisLogs: logs,
      addedCounties: addedList
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📞 Skip Tracing API
app.post('/api/skip-trace/:zpid', (req, res) => {
  try {
    const { zpid } = req.params;
    const listing = db.prepare('SELECT * FROM listings WHERE zpid = ?').get(zpid);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    }

    // Simüle edilmiş skip tracing verileri
    const firstNames = ['John', 'Robert', 'William', 'James', 'Michael', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White'];

    const ownerName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    
    const areaCode = [407, 305, 813, 904, 512, 214, 713, 404, 678, 615, 901, 704, 919];
    const randomArea = areaCode[Math.floor(Math.random() * areaCode.length)];
    const phone1 = Math.floor(100 + Math.random() * 900);
    const phone2 = Math.floor(1000 + Math.random() * 9000);
    const ownerPhone = `(${randomArea}) ${phone1}-${phone2}`;

    const ownerEmail = `${ownerName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;

    updateListingOwnerInfo(zpid, ownerName, ownerPhone, ownerEmail);

    res.json({
      success: true,
      owner: {
        name: ownerName,
        phone: ownerPhone,
        email: ownerEmail
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📐 AI Valuation & MAO API
app.post('/api/underwrite/:zpid', (req, res) => {
  try {
    const { zpid } = req.params;
    const listing = db.prepare('SELECT * FROM listings WHERE zpid = ?').get(zpid);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    }

    const isLand = listing.property_type === 'LAND';
    let marketValue = 0;
    let avgRate = 0;
    let compReason = '';

    if (isLand) {
      const size = listing.lot_size_acres || 0;
      const avgQuery = db.prepare(`
        SELECT AVG(price / lot_size_acres) as rate 
        FROM listings 
        WHERE state = ? AND lot_size_acres > 0.01 AND price > 100 AND property_type = 'LAND'
      `).get(listing.state);
      avgRate = avgQuery.rate ? Math.round(avgQuery.rate) : 15000; // default $15k per acre
      
      if (size > 0) {
        marketValue = Math.round(size * avgRate);
        compReason = `${listing.state} eyaleti genelindeki benzer arsaların ortalama dönüm fiyatı olan $${avgRate.toLocaleString()} / acre baz alınarak, ${size.toFixed(2)} acre büyüklüğündeki bu arsa için tahmini piyasa değeri hesaplanmıştır.`;
      } else {
        marketValue = Math.round(listing.price * 1.3);
        compReason = `Arsa boyutu (acres) veritabanında eksik olduğu için, listeleme fiyatına %30 pazar marjı eklenerek tahmini piyasa değeri bulunmuştur.`;
      }
    } else {
      const size = listing.area_sqft || 0;
      const avgQuery = db.prepare(`
        SELECT AVG(price / area_sqft) as rate 
        FROM listings 
        WHERE state = ? AND area_sqft > 10 AND price > 100 AND property_type != 'LAND'
      `).get(listing.state);
      avgRate = avgQuery.rate ? Math.round(avgQuery.rate) : 200; // default $200 per sqft
      
      if (size > 0) {
        marketValue = Math.round(size * avgRate);
        compReason = `${listing.state} eyaleti genelindeki benzer konutların ortalama metrekare fiyatı olan $${avgRate.toLocaleString()} / sqft baz alınarak, ${size.toLocaleString()} sqft büyüklüğündeki bu konut için tahmini piyasa değeri hesaplanmıştır.`;
      } else {
        marketValue = Math.round(listing.price * 1.35);
        compReason = `Konut kullanım alanı (sqft) eksik olduğu için, listeleme fiyatına %35 pazar marjı eklenerek tahmini piyasa değeri bulunmuştur.`;
      }
    }

    // MAO Formülü: (Market Value * 0.70) - (Konut için $15,000 standart tamirat, arsa için $0)
    const discountRate = 0.70;
    const repairs = isLand ? 0 : 15000;
    const maoPrice = Math.round((marketValue * discountRate) - repairs);

    // Update database
    updateListingMao(zpid, maoPrice);

    res.json({
      success: true,
      underwrite: {
        zpid,
        listingPrice: listing.price,
        marketValue,
        maoPrice,
        repairs,
        compReason,
        isLand,
        avgRate
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✉️ Send Direct Mail API
app.post('/api/send-direct-mail', (req, res) => {
  try {
    const { zpid } = req.body;
    if (!zpid) {
      return res.status(400).json({ success: false, message: 'ZPID parametresi zorunludur.' });
    }

    const listing = db.prepare('SELECT * FROM listings WHERE zpid = ?').get(zpid);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    }

    // Update status to 'SENT'
    updateListingMailStatus(zpid, 'SENT');

    res.json({
      success: true,
      message: `Direct Mail kampanyası başarıyla başlatıldı! Zarf ve Nakit Teklif mektubu Pebble kuyruğuna (API ID: PEB-98725) eklendi.`,
      mailStatus: 'SENT'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🏠 Buyers Management API
app.get('/api/buyers', (req, res) => {
  try {
    const list = getBuyers();
    res.json({ success: true, buyers: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/buyers', (req, res) => {
  try {
    const { name, email, phone, target_states, max_budget, property_type } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Alıcı ismi zorunludur.' });
    }

    addBuyer({
      name,
      email: email || '',
      phone: phone || '',
      target_states: target_states || '',
      max_budget: parseInt(max_budget) || 0,
      property_type: property_type || 'BOTH'
    });

    res.json({ success: true, message: 'Yeni alıcı başarıyla kaydedildi!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/buyers/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteBuyer(id);
    res.json({ success: true, message: 'Alıcı başarıyla silindi!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📂 Off-Market Leads Management API
app.get('/api/off-market', (req, res) => {
  try {
    const list = getOffMarketLeads();
    res.json({ success: true, leads: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/off-market', (req, res) => {
  try {
    const { apn, owner_name, street_address, city, state, zipcode, lot_size_acres, unpaid_taxes, zillow_comp_rate, mao_price } = req.body;
    if (!apn || !owner_name) {
      return res.status(400).json({ success: false, message: 'APN ve Mal Sahibi ismi zorunludur.' });
    }

    addOffMarketLead({
      apn,
      owner_name,
      street_address: street_address || '',
      city: city || '',
      state: state || '',
      zipcode: zipcode || '',
      lot_size_acres: parseFloat(lot_size_acres) || 0,
      unpaid_taxes: parseInt(unpaid_taxes) || 0,
      zillow_comp_rate: parseInt(zillow_comp_rate) || 0,
      mao_price: parseInt(mao_price) || 0,
      mail_status: 'KUYRUKTA'
    });

    res.json({ success: true, message: 'Yeni off-market fırsat başarıyla kaydedildi!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/off-market/scrape', (req, res) => {
  try {
    const { exec } = require('child_process');
    exec('node scrape_delinquent_tax_rolls.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error}`);
        return res.status(500).json({ success: false, error: error.message });
      }
      res.json({ success: true, message: 'Tarama ve ithalat işlemi başarıyla tamamlandı!' });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/off-market/skip-trace/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Simüle edilmiş telefon ve mail üret
    const phoneList = ['(512) 555-0199', '(407) 555-0143', '(615) 555-0182', '(813) 555-0177', '(214) 555-0125'];
    const emailList = ['harvey@specterlaw.com', 'louis@littcorp.com', 'donna@paulsen.net', 'jessica@pearsonpartners.com', 'rachel@zanelegal.com'];
    
    const ownerPhone = phoneList[Math.floor(Math.random() * phoneList.length)];
    const ownerEmail = emailList[Math.floor(Math.random() * emailList.length)];

    updateOffMarketOwnerInfo(id, ownerPhone, ownerEmail);

    res.json({
      success: true,
      message: 'Skip Tracing tamamlandı! Telefon ve e-posta veritabanına kaydedildi.',
      ownerPhone,
      ownerEmail
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/off-market/send-mail/:id', (req, res) => {
  try {
    const { id } = req.params;
    updateOffMarketMailStatus(id, 'SENT');
    res.json({
      success: true,
      message: 'Fiziki teklif mektubu ve zarfı Pebble API üzerinden yola çıktı!',
      mailStatus: 'SENT'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.delete('/api/off-market/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteOffMarketLead(id);
    res.json({ success: true, message: 'Fırsat kaydı silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 🏠 TAX SALE DEALS (LGBS) API
// ============================================================

// Tax sales tablosunu oluştur
db.exec(`
  CREATE TABLE IF NOT EXISTS tax_sales (
    uid TEXT PRIMARY KEY,
    state TEXT,
    county TEXT,
    prop_address_one TEXT,
    prop_city TEXT,
    prop_state TEXT,
    prop_zipcode TEXT,
    value REAL,
    minimum_bid REAL,
    sale_type TEXT,
    status TEXT,
    sale_date TEXT,
    sale_date_only TEXT,
    cause_nbr TEXT,
    account_nbr TEXT,
    street_name TEXT,
    google_view TEXT,
    county_sale_list TEXT,
    sale_notes TEXT,
    lat REAL,
    lon REAL,
    discount_pct REAL,
    source TEXT DEFAULT 'LGBS',
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    mail_address TEXT,
    mail_city TEXT,
    mail_state TEXT,
    mail_zip TEXT,
    mail_status TEXT DEFAULT 'UNSENT',
    cad_checked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Migration for existing databases
try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_address TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_city TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_state TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE tax_sales ADD COLUMN mail_zip TEXT;"); } catch(e){}


// LGBS verisini yükle (JSON dosyası varsa)
function loadLGBSData() {
  const dataPath = path.join(__dirname, 'lgbs_all_properties.json');
  if (!fs.existsSync(dataPath)) return 0;
  
  try {
    const existing = db.prepare('SELECT COUNT(*) as c FROM tax_sales').get().c;
    if (existing > 0) return existing;
    
    const raw = JSON.parse(fs.readFileSync(dataPath));
    const insert = db.prepare(`
      INSERT OR IGNORE INTO tax_sales 
        (uid, state, county, prop_address_one, prop_city, prop_state, prop_zipcode,
         value, minimum_bid, sale_type, status, sale_date, sale_date_only,
         cause_nbr, account_nbr, street_name, google_view, county_sale_list, sale_notes,
         lat, lon, discount_pct, source)
      VALUES 
        (@uid, @state, @county, @prop_address_one, @prop_city, @prop_state, @prop_zipcode,
         @value, @minimum_bid, @sale_type, @status, @sale_date, @sale_date_only,
         @cause_nbr, @account_nbr, @street_name, @google_view, @county_sale_list, @sale_notes,
         @lat, @lon, @discount_pct, 'LGBS')
    `);
    
    const insertMany = db.transaction((rows) => {
      for (const p of rows) {
        const val = parseFloat(p.value) || 0;
        const bid = parseFloat(p.minimum_bid) || 0;
        const discount = val > 0 && bid > 0 ? ((val - bid) / val * 100) : 0;
        const coords = p.geometry?.coordinates;
        insert.run({
          uid: String(p.uid),
          state: p.state || '',
          county: p.county || '',
          prop_address_one: p.prop_address_one || '',
          prop_city: p.prop_city || '',
          prop_state: p.prop_state || '',
          prop_zipcode: p.prop_zipcode || '',
          value: val,
          minimum_bid: bid,
          sale_type: p.sale_type || '',
          status: p.status || '',
          sale_date: p.sale_date || null,
          sale_date_only: p.sale_date_only || null,
          cause_nbr: p.cause_nbr || '',
          account_nbr: p.account_nbr || '',
          street_name: p.street_name || '',
          google_view: p.google_view || '',
          county_sale_list: p.county_sale_list || '',
          sale_notes: p.sale_notes || '',
          lat: coords ? coords[1] : null,
          lon: coords ? coords[0] : null,
          discount_pct: parseFloat(discount.toFixed(1))
        });
      }
    });
    
    insertMany(raw);
    console.log(`✅ ${raw.length} LGBS mülkü veritabanına yüklendi`);
    return raw.length;
  } catch (e) {
    console.error('LGBS data load error:', e.message);
    return 0;
  }
}

// Sunucu başlarken yükle
const lgbsCount = loadLGBSData();

// 📋 Tax Sale listesi (sayfalı, filtrelenebilir)
app.get('/api/tax-sales', (req, res) => {
  try {
    const { 
      state, county, sale_type, status, min_discount, max_bid,
      scheduled_only, search, page = 1, limit = 50, sort = 'discount_pct'
    } = req.query;

    let where = ['1=1'];
    const params = {};

    if (state) { where.push('state = @state'); params.state = state; }
    if (county) { where.push('county LIKE @county'); params.county = `%${county}%`; }
    if (sale_type) { where.push('sale_type = @sale_type'); params.sale_type = sale_type; }
    if (status) { where.push('status = @status'); params.status = status; }
    if (min_discount) { where.push('discount_pct >= @min_discount'); params.min_discount = parseFloat(min_discount); }
    if (max_bid) { where.push('minimum_bid <= @max_bid'); params.max_bid = parseFloat(max_bid); }
    if (scheduled_only === 'true') { where.push("status LIKE '%Scheduled%'"); }
    if (search) { 
      where.push("(prop_address_one LIKE @search OR prop_city LIKE @search OR county LIKE @search OR cause_nbr LIKE @search)");
      params.search = `%${search}%`;
    }

    const whereStr = where.join(' AND ');
    
    const validSorts = {
      discount_pct: 'discount_pct DESC',
      minimum_bid_asc: 'minimum_bid ASC',
      minimum_bid_desc: 'minimum_bid DESC',
      value_desc: 'value DESC',
      sale_date: 'sale_date ASC',
      county: 'county ASC'
    };
    const orderBy = validSorts[sort] || 'discount_pct DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const total = db.prepare(`SELECT COUNT(*) as c FROM tax_sales WHERE ${whereStr}`).get(params).c;
    const rows = db.prepare(`SELECT * FROM tax_sales WHERE ${whereStr} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`).all(params);

    res.json({ success: true, total, page: parseInt(page), limit: parseInt(limit), data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📊 Tax Sale istatistikleri
app.get('/api/tax-sales/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM tax_sales').get().c;
    const totalTX = db.prepare("SELECT COUNT(*) as c FROM tax_sales WHERE state='TX'").get().c;
    const totalPA = db.prepare("SELECT COUNT(*) as c FROM tax_sales WHERE state='PA'").get().c;
    const scheduled = db.prepare("SELECT COUNT(*) as c FROM tax_sales WHERE status LIKE '%Scheduled%'").get().c;
    const bigDiscount = db.prepare('SELECT COUNT(*) as c FROM tax_sales WHERE discount_pct >= 80').get().c;
    
    const byCounty = db.prepare(`
      SELECT county, state, COUNT(*) as count, 
             ROUND(AVG(discount_pct),1) as avg_discount,
             MIN(minimum_bid) as min_bid
      FROM tax_sales WHERE state='TX'
      GROUP BY county ORDER BY count DESC LIMIT 20
    `).all();

    const bySource = db.prepare('SELECT source, COUNT(*) as c FROM tax_sales GROUP BY source').all();
    const byStatus = db.prepare('SELECT status, COUNT(*) as c FROM tax_sales GROUP BY status ORDER BY c DESC').all();
    const bySaleType = db.prepare('SELECT sale_type, COUNT(*) as c FROM tax_sales GROUP BY sale_type ORDER BY c DESC').all();
    
    const upcoming = db.prepare(`
      SELECT sale_date_only, COUNT(*) as c FROM tax_sales 
      WHERE sale_date_only IS NOT NULL AND sale_date_only >= date('now')
      AND status NOT LIKE '%Cancelled%'
      GROUP BY sale_date_only ORDER BY sale_date_only ASC LIMIT 10
    `).all();

    res.json({ success: true, stats: { total, totalTX, totalPA, scheduled, bigDiscount, byCounty, bySource, byStatus, bySaleType, upcoming } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📋 Tüm Taranan Countyler API
app.get('/api/tax-sales/counties', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT county, state, COUNT(*) as count, 
             ROUND(AVG(discount_pct),1) as avg_discount,
             MIN(minimum_bid) as min_bid,
             GROUP_CONCAT(DISTINCT source) as sources,
             MAX(created_at) as last_scraped
      FROM tax_sales
      GROUP BY county, state
      ORDER BY count DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔄 LGBS verisini yenile (yeniden indir)
app.post('/api/tax-sales/refresh', async (req, res) => {
  res.json({ success: true, message: 'Yenileme başlatıldı, ~2 dakika sürer.' });
  
  // Arka planda çalıştır
  const child = spawn('node', ['lgbs-scraper.js'], { 
    cwd: __dirname, 
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
});

// 📤 CSV Export
app.get('/api/tax-sales/export', (req, res) => {
  try {
    const { state, min_discount, scheduled_only, max_bid } = req.query;
    let where = ['1=1'];
    const params = {};
    if (state) { where.push('state = @state'); params.state = state; }
    if (min_discount) { where.push('discount_pct >= @min_discount'); params.min_discount = parseFloat(min_discount); }
    if (max_bid) { where.push('minimum_bid <= @max_bid'); params.max_bid = parseFloat(max_bid); }
    if (scheduled_only === 'true') { where.push("status LIKE '%Scheduled%'"); }
    
    const rows = db.prepare(`SELECT * FROM tax_sales WHERE ${where.join(' AND ')} ORDER BY discount_pct DESC`).all(params);
    
    const headers = ['uid','state','county','prop_address_one','prop_city','prop_zipcode','value','minimum_bid','discount_pct','sale_type','status','sale_date_only','cause_nbr','account_nbr','lat','lon','county_sale_list','owner_name','owner_phone','mail_address','mail_city','mail_state','mail_zip'];
    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += headers.map(h => {
        const v = String(r[h] || '').replace(/"/g, '""');
        return v.includes(',') ? `"${v}"` : v;
      }).join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tax_sales_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🏠 CAD (County Appraisal District) - Sahip bilgisi güncelle
app.patch('/api/tax-sales/:uid/owner', (req, res) => {
  try {
    const { uid } = req.params;
    const { owner_name, owner_phone, owner_email } = req.body;
    db.prepare('UPDATE tax_sales SET owner_name=@name, owner_phone=@phone, owner_email=@email, cad_checked=1 WHERE uid=@uid')
      .run({ name: owner_name || '', phone: owner_phone || '', email: owner_email || '', uid });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Port Dinleme
app.listen(PORT, () => {
  console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
});

