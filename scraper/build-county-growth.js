/**
 * Builds a static county population-growth lookup from the Census PEP bulk CSV
 * (no API key needed). Run once; commits data/county_growth.json.
 *
 *   node build-county-growth.js
 *
 * Output key: "<ST>/<COUNTYNAME UPPER>"  e.g. "TX/HARRIS COUNTY"
 * Value: { g5, g1, pop }  (5yr & 1yr growth ratios, latest population)
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const CSV_URL =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv";

const ST = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.headers.location) return resolve(get(res.headers.location));
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

// minimal CSV parse (handles quoted commas)
function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cells = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (c === "," && !q) { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

(async () => {
  console.log("İndiriliyor:", CSV_URL);
  const text = await get(CSV_URL);
  const rows = parseCSV(text);
  const head = rows[0];
  const idx = (k) => head.indexOf(k);
  const iSt = idx("STNAME"), iCty = idx("CTYNAME"), iSum = idx("SUMLEV");
  const p20 = idx("POPESTIMATE2020"), p23 = idx("POPESTIMATE2023"), p24 = idx("POPESTIMATE2024");

  const out = {};
  let n = 0;
  for (const r of rows.slice(1)) {
    if (r[iSum] !== "050") continue; // county-level rows only (040 = state)
    const st = ST[r[iSt]];
    if (!st) continue;
    const pop20 = +r[p20], pop23 = +r[p23], pop24 = +r[p24];
    if (!pop20 || !pop24) continue;
    const key = `${st}/${r[iCty].toUpperCase()}`;
    out[key] = {
      g5: +(((pop24 - pop20) / pop20)).toFixed(4),
      g1: pop23 ? +(((pop24 - pop23) / pop23)).toFixed(4) : 0,
      pop: pop24,
    };
    n++;
  }
  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "county_growth.json"), JSON.stringify(out));
  console.log(`✅ ${n} county yazıldı -> data/county_growth.json`);
  // örnek
  ["TX/HARRIS COUNTY", "FL/MARION COUNTY", "TX/LOVING COUNTY"].forEach((k) =>
    console.log("  ", k, JSON.stringify(out[k]))
  );
})().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
