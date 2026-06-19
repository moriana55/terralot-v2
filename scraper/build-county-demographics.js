/**
 * County demografi + piyasa sinyali loader'ı — "Zillow neye bakıyorsa".
 * Tek çalıştırmada 4 ÜCRETSİZ ABD kaynağını çeker, county FIPS/isim ile
 * birleştirir ve `county_demographics` tablosunu doldurur:
 *
 *   1) Census ACS 5-yr      — median income, median age, population, home value
 *                             (CENSUS_API_KEY GEREKLİ — artık keyless çalışmıyor)
 *   2) Census PEP (CSV)     — pop_growth_1y, pop_growth_5y           (keyless)
 *   3) Census BPS (CSV)     — building_permits, permits_growth        (keyless)
 *   4) Zillow Research (CSV)— zhvi, zhvi_yoy, days_to_pending, inventory (keyless)
 *
 * Bu veri Path of Growth + Deal Screener + Lookalike + Underwrite skorlarını besler.
 *
 *   CENSUS_API_KEY=xxxx node build-county-demographics.js
 *
 * ── Census API key (ÜCRETSİZ, zorunlu) ───────────────────────────────────────
 * Census ACS API artık her istekte geçerli bir key ister (keysiz istek
 * "Missing Key" HTML sayfasına 302 yönlenir). 30 saniyede al:
 *   https://api.census.gov/data/key_signup.html
 * .env'e ekle:  CENSUS_API_KEY=...
 *
 * ── Çıktı ────────────────────────────────────────────────────────────────────
 * data/county_demographics.json  keyed "<ST>/<COUNTY NAME UPPER>" (örn "TX/HARRIS COUNTY")
 *
 * ── Supabase'e yazma (opsiyonel) ─────────────────────────────────────────────
 *   1) Tabloyu bir kez oluştur: scraper/sql/county_demographics.sql'i Supabase
 *      SQL Editor'dan çalıştır (Yiğit yapacak — bu script DDL ATMAZ).
 *   2) Upsert:  PUSH_SUPABASE=1 node build-county-demographics.js
 *      .env'de SUPABASE_URL + (SUPABASE_SERVICE_ROLE veya SUPABASE_SERVICE_ROLE_KEY).
 *      (state, county) unique anahtarıyla idempotent.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Config ──────────────────────────────────────────────────────────────────
const ACS_YEAR = process.env.ACS_YEAR || "2023"; // en güncel 5-yr vintage (2019-2023)
const API_KEY = process.env.CENSUS_API_KEY || "";
const ACS_VARS = ["B19013_001E", "B01002_001E", "B01003_001E", "B25077_001E"];

const PEP_CSV =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv";
const BPS_2024 = "https://www2.census.gov/econ/bps/County/co2024a.txt";
const BPS_2022 = "https://www2.census.gov/econ/bps/County/co2022a.txt";
// Zillow Research public CSV'leri (https://www.zillow.com/research/data/)
const ZILLOW = {
  zhvi: "https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  daysToPending: "https://files.zillowstatic.com/research/public_csvs/med_doz_pending/County_med_doz_pending_uc_sfrcondo_sm_month.csv",
  inventory: "https://files.zillowstatic.com/research/public_csvs/invt_fs/County_invt_fs_uc_sfrcondo_sm_month.csv",
};

// FIPS state kodu -> USPS kısaltma (build-permits.js ile aynı).
const FIPS2ABBR = { "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY" };

const ST = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE","District of Columbia":"DC",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY"
};

// ── HTTP (redirect izler) ───────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return resolve(get(res.headers.location));
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

// ACS suppress sentinel'lerini (örn -666666666) temizle.
const cleanNum = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n <= -1) return null;
  return n;
};
const round = (n, d = 4) => (n == null || isNaN(n) ? null : +n.toFixed(d));

// İsim normalizasyonu — county adlarını tüm kaynaklarda hizala.
// "Harris County, Texas" / "Harris County" / "Doña Ana County" -> "HARRIS COUNTY"
const normCounty = (raw) =>
  (raw || "")
    .split(",")[0]
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // aksanları sil (ñ -> n)
    .trim()
    .toUpperCase();

// Minimal CSV parse (tırnaklı virgülleri korur).
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

// ── 1) Census ACS 5-yr ──────────────────────────────────────────────────────
async function fetchACS() {
  if (!API_KEY) {
    console.error(
      "\n⚠️  CENSUS_API_KEY yok. ACS API artık key ZORUNLU (keysiz istek 'Missing Key'e 302 yönlenir).\n" +
      "   Ücretsiz al: https://api.census.gov/data/key_signup.html  →  .env: CENSUS_API_KEY=...\n" +
      "   ACS kolonları (income/age/pop/home_value) bu çalıştırmada BOŞ kalacak; PEP/BPS/Zillow yine de yazılır.\n"
    );
    return {};
  }
  const url =
    `https://api.census.gov/data/${ACS_YEAR}/acs/acs5` +
    `?get=NAME,${ACS_VARS.join(",")}&for=county:*&key=${API_KEY}`;
  console.log("ACS indiriliyor:", url.replace(API_KEY, "***"));
  const raw = await get(url);
  let rows;
  try { rows = JSON.parse(raw); }
  catch { console.error("  ACS JSON parse hatası — yanıt:", raw.slice(0, 200)); return {}; }
  if (!Array.isArray(rows) || rows.length < 2) { console.error("  Beklenmeyen ACS yanıtı."); return {}; }
  const head = rows[0], ix = (k) => head.indexOf(k);
  const iName = ix("NAME"), iInc = ix("B19013_001E"), iAge = ix("B01002_001E"),
        iPop = ix("B01003_001E"), iHome = ix("B25077_001E"),
        iStFips = ix("state"), iCtyFips = ix("county");
  const out = {};
  for (const r of rows.slice(1)) {
    const abbr = FIPS2ABBR[r[iStFips]];
    if (!abbr) continue;
    const county = normCounty(r[iName]);
    if (!county) continue;
    out[`${abbr}/${county}`] = {
      state_fips: r[iStFips],
      county_fips: r[iCtyFips],
      income: cleanNum(r[iInc]),
      medianAge: cleanNum(r[iAge]),
      pop: cleanNum(r[iPop]),
      homeValue: cleanNum(r[iHome]),
    };
  }
  return out;
}

// ── 2) Census PEP (nüfus büyümesi) ──────────────────────────────────────────
async function fetchPEP() {
  console.log("PEP indiriliyor:", PEP_CSV);
  const rows = parseCSV(await get(PEP_CSV));
  const head = rows[0], idx = (k) => head.indexOf(k);
  const iSt = idx("STNAME"), iCty = idx("CTYNAME"), iSum = idx("SUMLEV");
  const iStF = idx("STATE"), iCtyF = idx("COUNTY");
  const p20 = idx("POPESTIMATE2020"), p23 = idx("POPESTIMATE2023"), p24 = idx("POPESTIMATE2024");
  const out = {};
  for (const r of rows.slice(1)) {
    if (r[iSum] !== "050") continue; // sadece county satırları (040 = state)
    const st = ST[r[iSt]];
    if (!st) continue;
    const pop20 = +r[p20], pop23 = +r[p23], pop24 = +r[p24];
    if (!pop20 || !pop24) continue;
    out[`${st}/${normCounty(r[iCty])}`] = {
      state_fips: (r[iStF] || "").padStart(2, "0"),
      county_fips: (r[iCtyF] || "").padStart(3, "0"),
      g5: round((pop24 - pop20) / pop20),
      g1: pop23 ? round((pop24 - pop23) / pop23) : 0,
      popPEP: pop24,
    };
  }
  return out;
}

// ── 3) Census BPS (konut izinleri) ──────────────────────────────────────────
function parseBPS(text) {
  const out = {};
  const lines = text.split(/\r?\n/).slice(3); // 2 başlık + boş satırı atla
  for (const line of lines) {
    const c = line.split(",");
    if (c.length < 17) continue;
    const abbr = FIPS2ABBR[(c[1] || "").trim()];
    const county = normCounty((c[5] || "").trim());
    if (!abbr || !county) continue;
    const units = [7, 10, 13, 16].reduce((s, i) => s + (parseInt(c[i]) || 0), 0);
    out[`${abbr}/${county}`] = units;
  }
  return out;
}
async function fetchBPS() {
  console.log("BPS indiriliyor (2022 + 2024)...");
  const [t24, t22] = await Promise.all([get(BPS_2024), get(BPS_2022)]);
  const u24 = parseBPS(t24), u22 = parseBPS(t22);
  const out = {};
  for (const k of Object.keys(u24)) {
    const a = u24[k], b = u22[k] || 0;
    out[k] = { permits: a, permitsGrowth: b > 0 ? round((a - b) / b, 3) : (a > 0 ? 1 : 0) };
  }
  return out;
}

// ── 4) Zillow Research (değer + likidite + arz) ─────────────────────────────
// Hepsi aynı şema: RegionName, State, StateCodeFIPS, MunicipalCodeFIPS, sonra
// aylık tarih kolonları. FIPS ile join, isimle fallback. Son ay = en sağdaki
// dolu değer; zhvi_yoy = son ay vs 12 ay öncesi.
function lastNonEmpty(cells, firstDateIdx) {
  for (let i = cells.length - 1; i >= firstDateIdx; i--) {
    const n = parseFloat(cells[i]);
    if (cells[i] !== "" && !isNaN(n)) return { val: n, idx: i };
  }
  return null;
}
function parseZillow(text, withYoY) {
  const rows = parseCSV(text);
  const head = rows[0];
  const iName = head.indexOf("RegionName"), iSt = head.indexOf("State"),
        iStF = head.indexOf("StateCodeFIPS"), iMunF = head.indexOf("MunicipalCodeFIPS");
  const firstDate = head.findIndex((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));
  const byFips = {}, byName = {};
  for (const r of rows.slice(1)) {
    const st = (r[iSt] || "").trim();
    const county = normCounty(r[iName]);
    if (!st || !county) continue;
    const last = lastNonEmpty(r, firstDate);
    if (!last) continue;
    const rec = { val: last.val };
    if (withYoY && last.idx - 12 >= firstDate) {
      const prev = parseFloat(r[last.idx - 12]);
      if (!isNaN(prev) && prev > 0) rec.yoy = round((last.val - prev) / prev);
    }
    const sf = (r[iStF] || "").padStart(2, "0");
    const cf = (r[iMunF] || "").padStart(3, "0");
    if (sf !== "00" && cf !== "000") byFips[`${sf}/${cf}`] = rec;
    byName[`${st}/${county}`] = rec;
  }
  return { byFips, byName };
}
async function fetchZillow() {
  console.log("Zillow Research indiriliyor (ZHVI + days-to-pending + inventory)...");
  const [zhviTxt, dtpTxt, invTxt] = await Promise.all([
    get(ZILLOW.zhvi), get(ZILLOW.daysToPending), get(ZILLOW.inventory),
  ]);
  return {
    zhvi: parseZillow(zhviTxt, true),
    daysToPending: parseZillow(dtpTxt, false),
    inventory: parseZillow(invTxt, false),
  };
}
// FIPS join (öncelik) → isim fallback.
function zPick(src, sf, cf, key) {
  if (sf && cf && src.byFips[`${sf}/${cf}`]) return src.byFips[`${sf}/${cf}`];
  return src.byName[key] || null;
}

// ── Birleştir ───────────────────────────────────────────────────────────────
(async () => {
  const [acs, pep, bps, zil] = await Promise.all([
    fetchACS(), fetchPEP(), fetchBPS(), fetchZillow(),
  ]);

  // Tüm kaynaklardaki county anahtarlarının birleşimi.
  const keys = new Set([
    ...Object.keys(acs), ...Object.keys(pep), ...Object.keys(bps),
  ]);
  // Zillow isim-bazlı anahtarlarını da ekle (ACS key yoksa bile değer yazalım).
  for (const s of [zil.zhvi, zil.daysToPending, zil.inventory])
    for (const k of Object.keys(s.byName)) keys.add(k);

  const out = {};
  let withAcs = 0, withZhvi = 0;
  for (const key of keys) {
    const a = acs[key], p = pep[key], b = bps[key];
    // FIPS: ACS > PEP (Zillow join için).
    const sf = a?.state_fips || p?.state_fips || null;
    const cf = a?.county_fips || p?.county_fips || null;
    const z = zPick(zil.zhvi, sf, cf, key);
    const dtp = zPick(zil.daysToPending, sf, cf, key);
    const inv = zPick(zil.inventory, sf, cf, key);
    if (a) withAcs++;
    if (z) withZhvi++;
    out[key] = {
      state_fips: sf,
      county_fips: cf,
      // ACS
      income: a?.income ?? null,
      medianAge: a?.medianAge ?? null,
      pop: a?.pop ?? p?.popPEP ?? null, // ACS yoksa PEP nüfusu
      homeValue: a?.homeValue ?? null,
      // PEP
      g1: p?.g1 ?? null,
      g5: p?.g5 ?? null,
      // BPS
      permits: b?.permits ?? null,
      permitsGrowth: b?.permitsGrowth ?? null,
      // Zillow
      zhvi: z?.val ?? null,
      zhviYoY: z?.yoy ?? null,
      daysToPending: dtp?.val ?? null,
      inventory: inv?.val ?? null,
    };
  }

  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "county_demographics.json"), JSON.stringify(out));
  console.log(
    `\n✅ ${Object.keys(out).length} county yazıldı -> data/county_demographics.json ` +
    `(ACS dolu: ${withAcs}, ZHVI dolu: ${withZhvi})`
  );
  console.log("\n── Örnek satırlar (her kaynaktan alan kanıtı) ──");
  ["TX/HARRIS COUNTY", "AZ/MARICOPA COUNTY", "FL/MARION COUNTY", "GA/BRYAN COUNTY", "TX/WILLIAMSON COUNTY"]
    .forEach((k) => console.log("  ", k, JSON.stringify(out[k])));

  // ── Opsiyonel Supabase upsert (PUSH_SUPABASE=1) ───────────────────────────
  if (process.env.PUSH_SUPABASE === "1") {
    require("dotenv").config();
    const URL = process.env.SUPABASE_URL;
    // .env'de SUPABASE_SERVICE_ROLE (mevcut) ya da SUPABASE_SERVICE_ROLE_KEY destekle.
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!URL || !KEY) {
      console.error("\nPUSH_SUPABASE=1 ama SUPABASE_URL / SUPABASE_SERVICE_ROLE(_KEY) .env'de yok.");
      process.exit(1);
    }
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(URL, KEY);
    const rowsToPush = Object.entries(out).map(([key, v]) => {
      const [state, county] = key.split("/");
      return {
        state, county,
        state_fips: v.state_fips, county_fips: v.county_fips,
        median_household_income: v.income,
        median_age: v.medianAge,
        population: v.pop,
        median_home_value: v.homeValue,
        acs_year: API_KEY ? Number(ACS_YEAR) : null,
        pop_growth_1y: v.g1,
        pop_growth_5y: v.g5,
        building_permits: v.permits,
        permits_growth: v.permitsGrowth,
        zhvi: v.zhvi,
        zhvi_yoy: v.zhviYoY,
        days_to_pending: v.daysToPending,
        inventory: v.inventory,
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
