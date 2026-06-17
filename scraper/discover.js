// API Endpoint Keşif Aracı
require('dotenv').config();
const fetch = require('node-fetch');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'private-zillow.p.rapidapi.com';

const options = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'X-RapidAPI-Host': HOST
  }
};

// Denenecek endpoint + parametre kombinasyonları
const tests = [
  `/search?location=Ocala%2C+FL&home_type=Land`,
  `/search?location=Ocala%2C+FL`,
  `/search?q=Ocala+FL+land`,
  `/propertySearch?location=Ocala+FL`,
  `/searchByLocation?location=Ocala+FL`,
  `/propertiesForSaleSearch?location=Ocala+FL`,
  `/propertiesForSaleSearch?location=Ocala+FL&home_type=Land`,
  `/getSearchResults?location=Ocala+FL`,
  `/searchLand?location=Ocala+FL`,
  `/searchForSale?location=Ocala+FL`,
  `/getListings?location=Ocala+FL`,
  `/land?location=Ocala+FL`,
];

async function discover() {
  console.log('🔍 Endpoint keşfi başlıyor...\n');
  
  for (const endpoint of tests) {
    const url = `https://${HOST}${endpoint}`;
    try {
      const res = await fetch(url, options);
      const text = await res.text().catch(() => '');
      const status = res.status;
      
      const preview = text.slice(0, 150).replace(/\n/g, ' ');
      const icon = status === 200 ? '✅' : status === 404 ? '❌' : '⚠️';
      
      console.log(`${icon} [${status}] ${endpoint}`);
      if (status !== 404) {
        console.log(`      → ${preview}`);
      }
    } catch (err) {
      console.log(`❌ [ERR] ${endpoint}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

discover();
