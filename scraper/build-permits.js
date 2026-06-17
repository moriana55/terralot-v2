/**
 * Census Building Permits Survey (BPS) — county residential permit intensity.
 * Surging construction permits = builders betting on a county = land demand.
 * Keyless bulk files. Outputs data/county_permits.json keyed "ST/COUNTY NAME".
 *
 *   node build-permits.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const FIPS2ABBR = { "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY" };

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.headers.location) return resolve(get(res.headers.location));
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

// parse a BPS county file -> { "ST/COUNTY NAME": totalUnits }
function parseUnits(text) {
  const out = {};
  const lines = text.split(/\r?\n/).slice(3); // skip 2 header rows + blank
  for (const line of lines) {
    const c = line.split(",");
    if (c.length < 17) continue;
    const abbr = FIPS2ABBR[(c[1] || "").trim()];
    const county = (c[5] || "").trim();
    if (!abbr || !county) continue;
    const units = [7, 10, 13, 16].reduce((s, i) => s + (parseInt(c[i]) || 0), 0);
    out[`${abbr}/${county.toUpperCase()}`] = units;
  }
  return out;
}

(async () => {
  console.log("BPS indiriliyor (2022 + 2024)...");
  const [t24, t22] = await Promise.all([
    get("https://www2.census.gov/econ/bps/County/co2024a.txt"),
    get("https://www2.census.gov/econ/bps/County/co2022a.txt"),
  ]);
  const u24 = parseUnits(t24), u22 = parseUnits(t22);
  const out = {};
  for (const k of Object.keys(u24)) {
    const a = u24[k], b = u22[k] || 0;
    // growth (2yr) + raw 2024 units; growth normalized later in scoring
    out[k] = { units: a, g: b > 0 ? +(((a - b) / b)).toFixed(3) : (a > 0 ? 1 : 0) };
  }
  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "county_permits.json"), JSON.stringify(out));
  console.log(`✅ ${Object.keys(out).length} county yazıldı -> data/county_permits.json`);
  ["TX/WILLIAMSON COUNTY", "AZ/MARICOPA COUNTY", "GA/BRYAN COUNTY"].forEach((k) => console.log("  ", k, JSON.stringify(out[k])));
})().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
