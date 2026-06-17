/**
 * County demographics enrichment — US Census ACS 5-year (latest) profile per county.
 * Demographics signal where buyers/builders flow: rising income + younger
 * populations + climbing home values = land demand. This feeds the Deal
 * Screener's composite opportunity score on the dashboard.
 *
 *   node build-county-demographics.js
 *
 * Variables pulled (ACS 5-yr Detailed Tables):
 *   B19013_001E  median household income ($)
 *   B01002_001E  median age (years)
 *   B01003_001E  total population
 *   B25077_001E  median home value ($)
 *
 * Output (mirrors build-county-growth.js / build-permits.js):
 *   data/county_demographics.json keyed "<ST>/<COUNTY NAME UPPER>"  e.g. "TX/HARRIS COUNTY"
 *   value: { income, medianAge, pop, homeValue }
 *
 * The Census API works keyless at low volume, but a key avoids throttling.
 * Set one (free: https://api.census.gov/data/key_signup.html):
 *   CENSUS_API_KEY=xxxx node build-county-demographics.js
 *
 * ── Pushing to Supabase (optional) ───────────────────────────────────────────
 * Unlike growth/permits (which stay as static JSON), demographics is read by the
 * dashboard API directly from the `county_demographics` Supabase table. After
 * building the JSON:
 *   1) create the table once — run scraper/sql/county_demographics.sql in the
 *      Supabase SQL Editor.
 *   2) upsert the JSON. Set PUSH_SUPABASE=1 (plus SUPABASE_URL +
 *      SUPABASE_SERVICE_ROLE_KEY in .env) and re-run:
 *        PUSH_SUPABASE=1 node build-county-demographics.js
 *      It upserts on the unique (state, county) key, so re-runs are idempotent.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

// ACS year — bump as new 5-yr vintages land. 2023 = latest 5-yr (2019-2023).
const ACS_YEAR = process.env.ACS_YEAR || "2023";
const API_KEY = process.env.CENSUS_API_KEY || "";
const VARS = ["B19013_001E", "B01002_001E", "B01003_001E", "B25077_001E"];

// FIPS state code -> USPS abbreviation (matches build-permits.js exactly).
const FIPS2ABBR = { "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY" };

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

// Census ACS suppresses unavailable values with large negatives (e.g. -666666666).
const cleanNum = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n <= -1) return null;
  return n;
};

(async () => {
  const keyParam = API_KEY ? `&key=${API_KEY}` : "";
  const url =
    `https://api.census.gov/data/${ACS_YEAR}/acs/acs5` +
    `?get=NAME,${VARS.join(",")}&for=county:*${keyParam}`;
  console.log("İndiriliyor:", url.replace(API_KEY, API_KEY ? "***" : ""));

  const raw = await get(url);
  let rows;
  try {
    rows = JSON.parse(raw);
  } catch (e) {
    console.error("Census JSON parse hatası — yanıt:", raw.slice(0, 300));
    process.exit(1);
  }
  if (!Array.isArray(rows) || rows.length < 2) {
    console.error("Beklenmeyen Census yanıtı.");
    process.exit(1);
  }

  const head = rows[0];
  const ix = (k) => head.indexOf(k);
  const iName = ix("NAME"), iInc = ix("B19013_001E"), iAge = ix("B01002_001E"),
        iPop = ix("B01003_001E"), iHome = ix("B25077_001E"), iStFips = ix("state");

  const out = {};
  let n = 0;
  for (const r of rows.slice(1)) {
    const abbr = FIPS2ABBR[r[iStFips]];
    if (!abbr) continue;
    // NAME = "Harris County, Texas" -> "HARRIS COUNTY"
    const county = (r[iName] || "").split(",")[0].trim().toUpperCase();
    if (!county) continue;
    const key = `${abbr}/${county}`;
    out[key] = {
      income: cleanNum(r[iInc]),
      medianAge: cleanNum(r[iAge]),
      pop: cleanNum(r[iPop]),
      homeValue: cleanNum(r[iHome]),
    };
    n++;
  }

  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "county_demographics.json"), JSON.stringify(out));
  console.log(`✅ ${n} county yazıldı -> data/county_demographics.json (ACS ${ACS_YEAR})`);
  ["TX/HARRIS COUNTY", "AZ/MARICOPA COUNTY", "GA/BRYAN COUNTY"].forEach((k) =>
    console.log("  ", k, JSON.stringify(out[k]))
  );

  // ── Optional Supabase upsert (PUSH_SUPABASE=1) ──────────────────────────────
  if (process.env.PUSH_SUPABASE === "1") {
    require("dotenv").config();
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("PUSH_SUPABASE=1 ama SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env'de yok.");
      process.exit(1);
    }
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const rowsToPush = Object.entries(out).map(([key, v]) => {
      const [state, county] = key.split("/");
      return {
        state,
        county,
        median_household_income: v.income,
        median_age: v.medianAge,
        population: v.pop,
        median_home_value: v.homeValue,
        acs_year: Number(ACS_YEAR),
        updated_at: new Date().toISOString(),
      };
    });
    let pushed = 0;
    for (let i = 0; i < rowsToPush.length; i += 500) {
      const batch = rowsToPush.slice(i, i + 500);
      const { error } = await supabase
        .from("county_demographics")
        .upsert(batch, { onConflict: "state,county" });
      if (error) console.error("  upsert hata:", error.message);
      else pushed += batch.length;
    }
    console.log(`✅ Supabase'e ${pushed} satır upsert edildi (county_demographics).`);
  }
})().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
