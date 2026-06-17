require('dotenv').config();
const fetch = require('node-fetch');
const { upsertListing, getStats, db } = require('./db');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const PRICE_DROP_THRESHOLD = parseFloat(process.env.PRICE_DROP_THRESHOLD || 5);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || 1); // default to 1 page (up to 200 listings per location)
const MAX_DETAIL_REQUESTS = parseInt(process.env.MAX_DETAIL_REQUESTS || 5); // protect credits from being drained

// ── Hedef lokasyonları dosyadan oku veya varsayılana dön ─────────────────────
const fs = require('fs');
const path = require('path');

let TARGETS = [
  'Marion County, FL',
  'Alachua County, FL',
  'Bastrop County, TX',
  'McLennan County, TX',
  'Floyd County, GA',
  'Cumberland County, TN',
];

const targetsFilePath = path.join(__dirname, 'targets.txt');
if (fs.existsSync(targetsFilePath)) {
  try {
    const fileContent = fs.readFileSync(targetsFilePath, 'utf-8');
    const loadedTargets = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
    
    if (loadedTargets.length > 0) {
      TARGETS = loadedTargets;
    }
  } catch (err) {
    console.error(`⚠️  targets.txt okuma hatası: ${err.message}`);
  }
}

// ── ZPID ile Detay Bilgilerini Getir (APN ve Description için) ──────────────────
async function fetchListingDetails(zpid) {
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'private-zillow.p.rapidapi.com'
    }
  };

  try {
    const url = `https://private-zillow.p.rapidapi.com/custom_ad/byzpid?zpid=${zpid}`;
    const res = await fetch(url, options);
    if (res.ok) {
      const data = await res.json();
      if (data.propertyDetails) {
        return {
          apn: data.propertyDetails.features?.parcelNumber || data.propertyDetails.parcelNumber || null,
          description: data.propertyDetails.description || null
        };
      }
    } else {
      console.log(`   ⚠️  /custom_ad/byzpid hatası (${res.status}) ZPID: ${zpid}`);
    }
  } catch (err) {
    console.log(`   ❌ Detay çekilemedi (ZPID: ${zpid}): ${err.message}`);
  }
  return { apn: null, description: null };
}

// ── RapidAPI: Lokasyona göre arsa/konut araması (Sayfalı) ─────────────────────────
async function searchListingsForLocation(location, homeType = 'LAND', page = 1) {
  console.log(`🔍 Tarıyor: ${location} (${homeType}) | Sayfa: ${page}`);

  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'private-zillow.p.rapidapi.com'
    }
  };

  try {
    const searchUrl = `https://private-zillow.p.rapidapi.com/search/byaddress?location=${encodeURIComponent(location)}&homeType=${homeType}&page=${page}`;
    const res = await fetch(searchUrl, options);
    
    if (res.ok) {
      const data = await res.json();
      const results = data.searchResults || [];
      const totalPages = data.pagesInfo?.totalPages || 1;
      
      return {
        results,
        totalPages
      };
    } else {
      const errText = await res.text();
      console.log(`   ⚠️  /search/byaddress hatası (${res.status}): ${errText.slice(0, 150)}`);
    }
  } catch (err) {
    console.log(`   ❌ Hata: ${err.message}`);
  }

  return { results: [], totalPages: 1 };
}

// ── Veriyi normalize et ───────────────────────────────────────────────────
function normalizeListing(p, details = {}) {
  let lotSizeAcres = null;
  let lotSizeSqft = 0;
  
  if (p.lotSizeWithUnit) {
    const val = parseFloat(p.lotSizeWithUnit.lotSize || 0);
    const unit = (p.lotSizeWithUnit.lotSizeUnit || '').toLowerCase();
    
    if (unit.includes('acre')) {
      lotSizeAcres = val;
      lotSizeSqft = Math.round(val * 43560);
    } else if (unit.includes('sqft') || unit.includes('sq ft') || unit.includes('sf')) {
      lotSizeSqft = Math.round(val);
      lotSizeAcres = parseFloat((val / 43560).toFixed(4));
    }
  }

  return {
    zpid: String(p.zpid || ''),
    street_address: p.address?.streetAddress || '',
    city: p.address?.city || '',
    state: p.address?.state || '',
    zipcode: p.address?.zipcode || '',
    price: parseInt(p.price?.value || 0),
    area_sqft: p.livingArea || p.livingAreaValue || p.area || null,
    lot_size_sqft: lotSizeSqft,
    lot_size_acres: lotSizeAcres,
    year_built: p.yearBuilt || null,
    days_on_zillow: parseInt(p.daysOnZillow || 0),
    property_type: (p.propertyType || p.homeType || 'LAND').toUpperCase(),
    zestimate: parseInt(p.estimates?.zestimate || 0),
    zillow_url: `https://www.zillow.com/homedetails/${p.zpid}_zpid/`,
    apn: details.apn || null,
    description: details.description || null,
    latitude: p.location?.latitude || null,
    longitude: p.location?.longitude || null,
    bedrooms: p.bedrooms || p.beds || null,
    bathrooms: p.bathrooms || p.baths || null
  };
}

// ── Telegram bildirimi ────────────────────────────────────────────────────
async function sendTelegramAlert(listing, priceDrop) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) return;

  const mapsLink = listing.latitude && listing.longitude 
    ? `\n🛰️ Uydudan İncele: https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}` 
    : '';

  const msg = `🔥 FİYAT DÜŞTÜ!

📍 ${listing.street_address || 'Adres Yok'}, ${listing.city}, ${listing.state}
📐 Boyut: ${listing.lot_size_acres ? listing.lot_size_acres + ' acres' : 'Bilinmiyor'}
💰 Eski: $${priceDrop.oldPrice.toLocaleString()}
✅ Yeni: $${priceDrop.newPrice.toLocaleString()}
📉 Düşüş: %${priceDrop.changePercent.toFixed(1)}
ℹ️ APN/Parsel: ${listing.apn || 'Yok'}${mapsLink}

🔗 ${listing.zillow_url}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg })
    });
    console.log(`   📱 Telegram bildirimi gönderildi`);
  } catch (err) {
    console.error(`   ⚠️  Telegram hatası: ${err.message}`);
  }
}

// ── Ana scraper fonksiyonu ────────────────────────────────────────────────
async function runScraper() {
  console.log('═'.repeat(50));
  console.log('🏠 Zillow Arazi ve Konut Scraper Başladı (V3)');
  console.log(`⏰ ${new Date().toLocaleString('tr-TR')}`);
  console.log('═'.repeat(50));

  let totalNew = 0;
  let totalUpdated = 0;
  let totalPriceDrops = 0;
  let detailRequestsCount = 0;

  const propertyTypes = [
    { type: 'LAND', label: 'Arsa' },
    { type: 'SINGLE_FAMILY', label: 'Müstakil Ev' },
    { type: 'MULTI_FAMILY', label: 'Çoklu Konut' },
    { type: 'CONDO', label: 'Condo' },
    { type: 'TOWNHOUSE', label: 'Townhouse' }
  ];

  for (const location of TARGETS) {
    for (const propType of propertyTypes) {
      console.log(`\n📍 Hedef Bölge: ${location} (${propType.label})`);
      
      let currentPage = 1;
      let hasMorePages = true;

      while (currentPage <= MAX_PAGES && hasMorePages) {
        const { results, totalPages } = await searchListingsForLocation(location, propType.type, currentPage);
        
        if (results.length === 0) {
          hasMorePages = false;
          break;
        }

        console.log(`   📋 Sayfa ${currentPage}/${totalPages} | ${results.length} ilan işleniyor...`);

        for (const item of results) {
          const p = item.property;
          if (!p || !p.zpid) continue;

          const zpid = String(p.zpid);

          // Veritabanında var mı kontrol et
          const existing = db.prepare('SELECT id, price, apn FROM listings WHERE zpid = ?').get(zpid);
          
          let details = { apn: null, description: null };
          let shouldFetchDetails = false;

          if (!existing) {
            // Tamamen yeni ilan
            if (detailRequestsCount < MAX_DETAIL_REQUESTS) {
              shouldFetchDetails = true;
              console.log(`   🆕 Yeni ilan: Detaylar (APN/Açıklama vb.) alınıyor...`);
            } else {
              console.log(`   🆕 Yeni ilan (ZPID: ${zpid}) DB'ye ekleniyor (APN detayı sonraki taramalara ertelendi - limit koruması)`);
            }
          } else if (p.price?.value && p.price.value < existing.price) {
            // Fiyat düşmüş
            if (!existing.apn && detailRequestsCount < MAX_DETAIL_REQUESTS) {
              shouldFetchDetails = true;
              console.log(`   🔥 Fiyat düşüşü + APN eksik! Detaylar alınıyor...`);
            }
          }

          if (shouldFetchDetails) {
            detailRequestsCount++;
            details = await fetchListingDetails(zpid);
            // API rate limit / aşırı istekleri önlemek için bekle
            await new Promise(r => setTimeout(r, 1000));
          }

          const listing = normalizeListing(p, details);
          const { isNew, priceDrop } = upsertListing(listing);

          if (isNew) {
            totalNew++;
            console.log(`      ➕ EKLEDİ: ${listing.street_address || 'Adres Yok'} - $${listing.price?.toLocaleString()}${listing.apn ? ' | APN: ' + listing.apn : ''}`);
          } else {
            totalUpdated++;
          }

          if (priceDrop && priceDrop.changePercent >= PRICE_DROP_THRESHOLD) {
            totalPriceDrops++;
            console.log(`      🔥 FİYAT DÜŞTÜ: ${listing.street_address || 'Adres Yok'} | %${priceDrop.changePercent.toFixed(1)} düşüş ($${priceDrop.oldPrice.toLocaleString()} -> $${priceDrop.newPrice.toLocaleString()})`);
            await sendTelegramAlert(listing, priceDrop);
          }
        }

        if (currentPage >= totalPages) {
          hasMorePages = false;
        } else {
          currentPage++;
          // Sayfalar arası rate limit beklemesi
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  // Özet
  const stats = getStats();
  console.log('\n' + '═'.repeat(50));
  console.log('📊 GENEL ÖZET');
  console.log('═'.repeat(50));
  console.log(`✅ Yeni eklenen ilan: ${totalNew}`);
  console.log(`🔄 Güncellenen ilan: ${totalUpdated}`);
  console.log(`🔥 Fiyat düşen ilan: ${totalPriceDrops}`);
  console.log(`📞 Yapılan Detay Sorgusu (APN için): ${detailRequestsCount} / ${MAX_DETAIL_REQUESTS}`);
  console.log(`📦 Toplam DB'de: ${stats.total} ilan`);
  
  if (stats.byState.length > 0) {
    console.log('\n📍 Eyaletlere göre dağılım:');
    stats.byState.forEach(s => console.log(`   ${s.state}: ${s.count} ilan`));
  }
  
  if (stats.avgPrice) {
    console.log(`💰 Ortalama arsa fiyatı: $${Math.round(stats.avgPrice).toLocaleString()}`);
  }

  console.log('\n✅ Tarama ve güncelleme tamamlandı!');
}

runScraper().catch(console.error);
