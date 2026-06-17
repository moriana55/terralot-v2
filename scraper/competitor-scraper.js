/**
 * Competitor scraper — crawls retail land sellers and upserts into Supabase
 * table `competitor_listings`. Feeds the dashboard's Competitor Intel page.
 *
 * Usage:  node competitor-scraper.js
 * Needs:  npm i puppeteer @supabase/supabase-js dotenv
 *         .env -> SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: site selectors below are a starting point. Run once with HEADLESS=0
 * and tune the per-site `parse` functions against the live DOM if a site
 * changes its markup. Each site is isolated, so one breaking won't stop others.
 */
require("dotenv").config();
const puppeteer = require("puppeteer");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env'de olmalı.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HEADLESS = process.env.HEADLESS !== "0";
const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// ── Per-site configuration ──────────────────────────────────────────────────
// Each site exposes: name, listUrl, and an in-page extractor returning rows.
const SITES = [
  {
    name: "Discount Lots",
    // Full inventory served as an HTML table (cols: Title, ID, APN, Size,
    // County, State, Use, Building, Road Access, HOA, Price, Taxes).
    urls: ["https://discountlots.com/property-map-table"],
    extract: () => {
      const tables = Array.from(document.querySelectorAll("table"));
      const t = tables
        .map((tb) => ({ tb, n: tb.querySelectorAll("tbody tr").length, hasPrice: /\$\d/.test(tb.innerText) }))
        .filter((x) => x.hasPrice)
        .sort((a, b) => b.n - a.n)[0];
      if (!t) return [];
      return Array.from(t.tb.querySelectorAll("tbody tr")).map((tr) => {
        const c = Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim());
        return {
          title: c[0] || null,
          apn: c[2] || null,
          acres: c[3] || null,
          county: c[4] || null,
          state: c[5] || null,
          notes: [c[6], c[7], c[8] ? `Road: ${c[8]}` : null].filter(Boolean).join(" · ") || null,
          price: c[10] || null,
          monthly: null,
          down: null,
          url: tr.querySelector("a")?.href || null,
        };
      });
    },
  },
  {
    name: "Rina Land",
    // Listings live on per-state category pages, built with Elementor.
    urls: [
      "arizona", "arkansas", "california", "colorado", "florida", "georgia",
      "nevada", "new-mexico", "south-carolina", "tennessee", "texas",
    ].map((s) => `https://rinaland.com/category/${s}/`),
    extract: () =>
      Array.from(document.querySelectorAll(".make-column-clickable-elementor")).map((col) => {
        const hs = Array.from(col.querySelectorAll(".elementor-heading-title")).map((h) => h.textContent.trim());
        let title = hs[0] || null;
        const price = hs.find((h) => /\$/.test(h)) || null;
        if (title && /out of stock|sold/i.test(title)) title = null; // skip sold listings
        let acres = null, county = null, state = null;
        if (title) {
          const am = title.match(/([\d.]+)\s*acre/i);
          if (am) acres = am[1];
          const lm = title.match(/in\s+([^,]+),\s*([A-Za-z][A-Za-z ]+?)\s*[.,]/i)
            || title.match(/in\s+([^,]+),\s*([A-Za-z][A-Za-z ]+?)\s*$/i);
          if (lm) { county = lm[1].trim(); state = lm[2].trim(); }
        }
        return { title, price, acres, county, state, url: col.querySelector("a")?.href || null };
      }),
  },
  {
    name: "Landio",
    // JS SPA — needs domcontentloaded (networkidle never settles). Cards render
    // as: State | County | N Acres +/- | $price | CODE
    waitUntil: "domcontentloaded",
    urls: ["https://landio.com/land-for-sale/"],
    extract: () => {
      const blocks = Array.from(document.querySelectorAll("div")).filter((d) => {
        const t = d.innerText || "";
        return /\$\d/.test(t) && /Acres/i.test(t) && t.split("\n").filter(Boolean).length >= 4 && t.length < 220;
      });
      const seen = new Set();
      const out = [];
      for (const d of blocks) {
        const lines = d.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
        const code = lines[lines.length - 1];
        if (!code || seen.has(code)) continue;
        seen.add(code);
        const price = lines.find((l) => /\$\d/.test(l)) || null;
        const acresLine = lines.find((l) => /acres/i.test(l)) || null;
        // Location line: "State | County" (and not the price/acres/code lines).
        const locLine = lines.find((l) => /\|/.test(l) && !/\$|acres/i.test(l)) || lines[0] || "";
        const parts = locLine.split("|").map((s) => s.trim());
        const state = parts[0] || null;
        const county = parts[1] ? parts[1].replace(/county/i, "").trim() : null;
        out.push({
          title: [acresLine, county || state].filter(Boolean).join(" — ") || null,
          price,
          acres: acresLine,
          county,
          state,
          apn: code,
          url: null,
        });
      }
      return out;
    },
  },
];

// Split "County, ST" style location strings.
function splitLocation(loc) {
  if (!loc) return { county: null, state: null };
  const parts = loc.split(",").map((s) => s.trim());
  const state = parts[parts.length - 1]?.match(/^[A-Z]{2}$/) ? parts.pop() : null;
  const county = parts.join(", ").replace(/county/i, "").trim() || null;
  return { county, state };
}

function normalize(siteName, raw) {
  // Prefer explicit county/state (table sites); fall back to parsing a
  // combined location string (card sites).
  const fromLoc = splitLocation(raw.location);
  const county = raw.county || fromLoc.county;
  const state = raw.state || fromLoc.state;
  return {
    competitor: siteName,
    title: raw.title || null,
    state,
    county,
    acres: num(raw.acres),
    price: num(raw.price),
    down_payment: num(raw.down),
    monthly_payment: num(raw.monthly),
    term_months: null,
    doc_fee: null,
    apn: raw.apn || null,
    notes: raw.notes || null,
    // our_source_cost is left null — never fabricated; enriched later from
    // tax-auction / direct-mail comps.
    our_source_cost: null,
    raw_url: raw.url || null,
    scraped_at: new Date().toISOString(),
  };
}

async function scrapeSite(browser, site) {
  const urls = site.urls || (site.listUrl ? [site.listUrl] : []);
  const waitUntil = site.waitUntil || "networkidle2";
  let rows = [];
  for (const url of urls) {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    );
    try {
      console.log(`→ ${site.name}: ${url}`);
      await page.goto(url, { waitUntil, timeout: 60000 });
      await new Promise((r) => setTimeout(r, 3500));
      const raw = await page.evaluate(site.extract);
      const parsed = raw
        .map((r) => normalize(site.name, r))
        .filter((r) => r.title && (r.price || r.monthly_payment));
      console.log(`  ${url.replace(/^https?:\/\/[^/]+/, "")}: ${parsed.length} parsed`);
      rows = rows.concat(parsed);
    } catch (e) {
      console.error(`  ${url} FAILED: ${e.message}`);
    } finally {
      await page.close();
    }
  }
  console.log(`  ${site.name}: ${rows.length} listing total`);
  return rows;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let all = [];
  for (const site of SITES) {
    const rows = await scrapeSite(browser, site);
    all = all.concat(rows);
  }
  await browser.close();

  if (!all.length) {
    console.log("Hiç listing parse edilemedi. Selektörleri HEADLESS=0 ile kontrol et.");
    return;
  }

  // Refresh strategy: for each competitor that returned rows, replace its
  // existing rows with the fresh crawl. Idempotent, no unique constraint needed.
  const byComp = all.reduce((m, r) => ((m[r.competitor] ||= []).push(r), m), {});
  let inserted = 0;

  for (const [competitor, rows] of Object.entries(byComp)) {
    const { error: delErr } = await supabase.from("competitor_listings").delete().eq("competitor", competitor);
    if (delErr) { console.error(`${competitor} silme hatası:`, delErr.message); continue; }
    // insert in chunks to stay well under payload limits
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabase.from("competitor_listings").insert(chunk);
      if (error) console.error(`${competitor} insert hatası:`, error.message);
      else inserted += chunk.length;
    }
  }

  console.log(`✅ ${inserted} competitor listing Supabase'e yazıldı.`);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
