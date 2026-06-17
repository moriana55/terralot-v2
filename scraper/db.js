const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'zillow_listings.db');
const db = new Database(DB_PATH);

// Tabloları oluştur
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zpid TEXT UNIQUE NOT NULL,
    street_address TEXT,
    city TEXT,
    state TEXT,
    zipcode TEXT,
    price INTEGER,
    area_sqft INTEGER,
    lot_size_sqft INTEGER,
    lot_size_acres REAL,
    year_built INTEGER,
    days_on_zillow INTEGER,
    property_type TEXT,
    zestimate INTEGER,
    zillow_url TEXT,
    apn TEXT,
    description TEXT,
    latitude REAL,
    longitude REAL,
    bedrooms INTEGER,
    bathrooms REAL,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    mao_price INTEGER,
    mail_status TEXT,
    first_seen_at TEXT DEFAULT (datetime('now')),
    last_updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zpid TEXT NOT NULL,
    old_price INTEGER,
    new_price INTEGER,
    change_percent REAL,
    recorded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    target_states TEXT,
    max_budget INTEGER,
    property_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS off_market_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apn TEXT UNIQUE NOT NULL,
    owner_name TEXT NOT NULL,
    street_address TEXT,
    city TEXT,
    state TEXT,
    zipcode TEXT,
    county TEXT,
    lot_size_acres REAL,
    unpaid_taxes INTEGER,
    zillow_comp_rate INTEGER,
    mao_price INTEGER,
    owner_phone TEXT,
    owner_email TEXT,
    mail_status TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed mock off-market leads if empty
try {
  const countLeads = db.prepare("SELECT COUNT(*) as count FROM off_market_leads").get().count;
  if (countLeads === 0) {
    const insertLead = db.prepare(`
      INSERT INTO off_market_leads (apn, owner_name, street_address, city, state, zipcode, lot_size_acres, unpaid_taxes, zillow_comp_rate, mao_price, mail_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertLead.run('104-02-114', 'Harvey Specter', 'Presidio Ranch Rd', 'Presidio', 'TX', '79845', 12.5, 1850, 1200, 10500, 'KUYRUKTA');
    insertLead.run('405-12-009', 'Louis Litt', 'Fort Apache Rd', 'Cochise', 'AZ', '85602', 5.0, 950, 3500, 12250, 'GÖNDERİLDİ');
    insertLead.run('912-88-231', 'Donna Paulsen', 'Ozark Hills Dr', 'Douglas', 'MO', '65608', 22.1, 3200, 2800, 43300, 'KUYRUKTA');
    insertLead.run('302-04-188', 'Jessica Pearson', 'Hobart Station Rd', 'Lake', 'IN', '46342', 2.5, 4100, 26000, 45500, 'KUYRUKTA');
    insertLead.run('112-99-045', 'Rachel Zane', 'Taos Valley Way', 'Taos', 'NM', '87571', 8.2, 1400, 4500, 25800, 'KUYRUKTA');
    console.log('🌱 Mock Off-Market ilanları veritabanına başarıyla tohumlandı!');
  }
} catch (e) {
  console.error('⚠️ Off-market seed hatası:', e.message);
}

// Veritabanı sütun migrasyonları (Eski DB varsa çalıştır)
try { db.exec("ALTER TABLE listings ADD COLUMN lot_size_acres REAL;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN apn TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN description TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN latitude REAL;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN longitude REAL;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN bedrooms INTEGER;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN bathrooms REAL;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN owner_name TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN owner_phone TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN owner_email TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN mao_price INTEGER;"); } catch(e){}
try { db.exec("ALTER TABLE listings ADD COLUMN mail_status TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE off_market_leads ADD COLUMN county TEXT;"); } catch(e){}

// Yeni ilan ekle veya güncelle
function upsertListing(listing) {
  const existing = db.prepare('SELECT * FROM listings WHERE zpid = ?').get(listing.zpid);

  if (!existing) {
    // Yeni ilan
    db.prepare(`
      INSERT INTO listings (zpid, street_address, city, state, zipcode, price, 
        area_sqft, lot_size_sqft, lot_size_acres, year_built, days_on_zillow, property_type, 
        zestimate, zillow_url, apn, description, latitude, longitude, bedrooms, bathrooms)
      VALUES (@zpid, @street_address, @city, @state, @zipcode, @price,
        @area_sqft, @lot_size_sqft, @lot_size_acres, @year_built, @days_on_zillow, @property_type,
        @zestimate, @zillow_url, @apn, @description, @latitude, @longitude, @bedrooms, @bathrooms)
    `).run({
      zpid: listing.zpid || '',
      street_address: listing.street_address || '',
      city: listing.city || '',
      state: listing.state || '',
      zipcode: listing.zipcode || '',
      price: listing.price || 0,
      area_sqft: listing.area_sqft || null,
      lot_size_sqft: listing.lot_size_sqft || 0,
      lot_size_acres: listing.lot_size_acres || null,
      year_built: listing.year_built || null,
      days_on_zillow: listing.days_on_zillow || null,
      property_type: listing.property_type || 'LAND',
      zestimate: listing.zestimate || null,
      zillow_url: listing.zillow_url || '',
      apn: listing.apn || null,
      description: listing.description || null,
      latitude: listing.latitude || null,
      longitude: listing.longitude || null,
      bedrooms: listing.bedrooms || null,
      bathrooms: listing.bathrooms || null
    });
    return { isNew: true, priceDrop: false };
  }

  // Fiyat değişimi kontrolü
  let priceDrop = false;
  if (existing.price && listing.price && listing.price < existing.price) {
    const changePercent = ((existing.price - listing.price) / existing.price) * 100;
    
    db.prepare(`
      INSERT INTO price_history (zpid, old_price, new_price, change_percent)
      VALUES (?, ?, ?, ?)
    `).run(listing.zpid, existing.price, listing.price, changePercent);
    
    priceDrop = { oldPrice: existing.price, newPrice: listing.price, changePercent };
  }

  // Güncelle
  db.prepare(`
    UPDATE listings SET 
      price = COALESCE(@price, price),
      days_on_zillow = COALESCE(@days_on_zillow, days_on_zillow),
      zestimate = COALESCE(@zestimate, zestimate),
      lot_size_acres = COALESCE(lot_size_acres, @lot_size_acres),
      apn = COALESCE(apn, @apn),
      description = COALESCE(description, @description),
      latitude = COALESCE(latitude, @latitude),
      longitude = COALESCE(longitude, @longitude),
      area_sqft = COALESCE(area_sqft, @area_sqft),
      year_built = COALESCE(year_built, @year_built),
      bedrooms = COALESCE(bedrooms, @bedrooms),
      bathrooms = COALESCE(bathrooms, @bathrooms),
      property_type = COALESCE(property_type, @property_type),
      last_updated_at = datetime('now')
    WHERE zpid = @zpid
  `).run({
    zpid: listing.zpid,
    price: listing.price || null,
    days_on_zillow: listing.days_on_zillow || null,
    zestimate: listing.zestimate || null,
    lot_size_acres: listing.lot_size_acres || null,
    apn: listing.apn || null,
    description: listing.description || null,
    latitude: listing.latitude || null,
    longitude: listing.longitude || null,
    area_sqft: listing.area_sqft || null,
    year_built: listing.year_built || null,
    bedrooms: listing.bedrooms || null,
    bathrooms: listing.bathrooms || null,
    property_type: listing.property_type || null
  });

  return { isNew: false, priceDrop };
}

// İstatistikler
function getStats() {
  return {
    total: db.prepare('SELECT COUNT(*) as count FROM listings').get().count,
    byState: db.prepare('SELECT state, COUNT(*) as count FROM listings GROUP BY state').all(),
    avgPrice: db.prepare('SELECT AVG(price) as avg FROM listings WHERE price > 0').get().avg,
    recentDrops: db.prepare(`
      SELECT l.street_address, l.city, l.state, ph.old_price, ph.new_price, ph.change_percent, ph.recorded_at
      FROM price_history ph
      JOIN listings l ON l.zpid = ph.zpid
      ORDER BY ph.recorded_at DESC
      LIMIT 10
    `).all()
  };
}

function getAllListings() {
  return db.prepare('SELECT * FROM listings ORDER BY last_updated_at DESC').all();
}

function updateListingOwnerInfo(zpid, ownerName, ownerPhone, ownerEmail) {
  return db.prepare(`
    UPDATE listings 
    SET owner_name = ?, owner_phone = ?, owner_email = ? 
    WHERE zpid = ?
  `).run(ownerName, ownerPhone, ownerEmail, zpid);
}

function updateListingMao(zpid, maoPrice) {
  return db.prepare(`
    UPDATE listings 
    SET mao_price = ? 
    WHERE zpid = ?
  `).run(maoPrice, zpid);
}

function updateListingMailStatus(zpid, status) {
  return db.prepare(`
    UPDATE listings 
    SET mail_status = ? 
    WHERE zpid = ?
  `).run(status, zpid);
}

function addBuyer(buyer) {
  return db.prepare(`
    INSERT INTO buyers (name, email, phone, target_states, max_budget, property_type)
    VALUES (@name, @email, @phone, @target_states, @max_budget, @property_type)
  `).run(buyer);
}

function getBuyers() {
  return db.prepare('SELECT * FROM buyers ORDER BY created_at DESC').all();
}

function deleteBuyer(id) {
  return db.prepare('DELETE FROM buyers WHERE id = ?').run(id);
}

function getOffMarketLeads() {
  return db.prepare('SELECT * FROM off_market_leads ORDER BY created_at DESC').all();
}

function updateOffMarketOwnerInfo(id, phone, email) {
  return db.prepare(`
    UPDATE off_market_leads 
    SET owner_phone = ?, owner_email = ? 
    WHERE id = ?
  `).run(phone, email, id);
}

function updateOffMarketMailStatus(id, status) {
  return db.prepare(`
    UPDATE off_market_leads 
    SET mail_status = ? 
    WHERE id = ?
  `).run(status, id);
}

function addOffMarketLead(lead) {
  return db.prepare(`
    INSERT OR IGNORE INTO off_market_leads (apn, owner_name, street_address, city, state, zipcode, county, lot_size_acres, unpaid_taxes, zillow_comp_rate, mao_price, mail_status)
    VALUES (@apn, @owner_name, @street_address, @city, @state, @zipcode, @county, @lot_size_acres, @unpaid_taxes, @zillow_comp_rate, @mao_price, @mail_status)
  `).run(lead);
}

function deleteOffMarketLead(id) {
  return db.prepare('DELETE FROM off_market_leads WHERE id = ?').run(id);
}

module.exports = { 
  upsertListing, 
  getStats, 
  getAllListings, 
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
  deleteOffMarketLead,
  db 
};
