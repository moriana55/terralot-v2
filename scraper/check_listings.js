const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'zillow_listings.db');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables found:', tables.map(t => t.name));

  if (tables.some(t => t.name === 'tax_sales')) {
    const total = db.prepare("SELECT COUNT(*) as count FROM tax_sales").get().count;
    console.log('Total tax sales:', total);

    const sources = db.prepare("SELECT source, COUNT(*) as count FROM tax_sales GROUP BY source").all();
    console.log('Tax sales by source:', sources);

    const counties = db.prepare("SELECT county, source, COUNT(*) as count FROM tax_sales GROUP BY county, source ORDER BY count DESC LIMIT 15").all();
    console.log('Top counties:\n', counties.map(c => ` - ${c.county} (${c.source}): ${c.count}`).join('\n'));
  } else {
    console.log('tax_sales table not found!');
  }
} catch (e) {
  console.error('Error reading database:', e.message);
}
db.close();
