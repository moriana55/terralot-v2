#!/usr/bin/env node
/**
 * Competitor scraper v2 — coordinate-aware refresh of `competitor_listings`.
 *
 * Supersedes competitor-scraper.js (puppeteer). All three sources turned out to
 * be reachable with plain fetch:
 *
 *   1. Discount Lots — https://discountlots.com/property-map-table
 *      Inertia (Laravel+Vue) `data-page` JSON → props.points: FULL inventory
 *      (~180) with latitude/longitude, cash price, down/monthly/term, APN.
 *      Listing URL = https://discountlots.com/property/{APN}.
 *   2. Landio — https://landio.com/api/properties
 *      Open JSON API, full LIVE inventory (~100) with latitude/longitude,
 *      price, acres, county, state, parcelNumber.
 *      Listing URL = https://landio.com/property/{id}.
 *   3. Rina Land — per-state Elementor category pages (11 states, no
 *      pagination) → per-listing detail pages, which expose a literal
 *      "GPS: <lat>,<lng>" icon-box. Detail fetches throttled (1.5s).
 *
 * Writes to Supabase `competitor_listings` (now with lat/lng columns, added
 * 2026-07-22). Refresh strategy identical to v1: per-competitor delete +
 * chunked insert, so a broken source never wipes the others.
 *
 * Usage: node competitor-scraper-v2.mjs
 * Needs: .env -> SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env'de olmalı.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

async function get(url, asJson = false) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asJson ? res.json() : res.text();
}

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const stateName = (s) => (s && STATE_NAMES[String(s).trim().toUpperCase()]) || (s ? String(s).trim() : null);

const validCoord = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat > 17 && lat < 72 && lng > -180 && lng < -60;

// ── 1. Discount Lots ────────────────────────────────────────────────────────
async function scrapeDiscountLots() {
  const html = await get("https://discountlots.com/property-map-table");
  const m = html.match(/data-page="([^"]+)"/);
  if (!m) throw new Error("Discount Lots: data-page JSON bulunamadı (markup değişmiş olabilir)");
  const unescape = (s) =>
    s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const page = JSON.parse(unescape(m[1]));
  const points = page?.props?.points || [];
  return points
    .filter((p) => p.is_available !== false)
    .map((p) => {
      const lat = num(p.latitude);
      const lng = num(p.longitude);
      return {
        competitor: "Discount Lots",
        title: p.title || p.name || null,
        state: stateName(p.state),
        county: p.county || null,
        acres: num(p.acreage),
        price: num(p.cash_price_current) ?? num(p.cash_total) ?? num(p.original_cash_price),
        down_payment: num(p.down_payment),
        monthly_payment: num(p.payment_1),
        term_months: num(p.term_1),
        doc_fee: num(p.document_fee),
        apn: p.apn || null,
        notes: [p.zoning, p.road_access ? `Road: ${p.road_access}` : null].filter(Boolean).join(" · ") || null,
        our_source_cost: null,
        raw_url: p.apn ? `https://discountlots.com/property/${p.apn}` : null,
        lat: validCoord(lat, lng) ? lat : null,
        lng: validCoord(lat, lng) ? lng : null,
        scraped_at: new Date().toISOString(),
      };
    });
}

// ── 2. Landio ───────────────────────────────────────────────────────────────
async function scrapeLandio() {
  const props = await get("https://landio.com/api/properties", true);
  return (Array.isArray(props) ? props : [])
    .filter((p) => (p.status || "LIVE") === "LIVE" && p.isActive !== false)
    .map((p) => {
      const lat = num(p.latitude);
      const lng = num(p.longitude);
      return {
        competitor: "Landio",
        title: p.title || p.headline || null,
        state: stateName(p.state),
        county: p.county || null,
        acres: num(p.acres),
        price: num(p.price),
        down_payment: num(p.downPayment),
        monthly_payment: null,
        term_months: null,
        doc_fee: null,
        apn: p.parcelNumber || p.landioPropertyId || null,
        notes: [p.propertyType, p.ownerFinancing ? "Owner financing" : null].filter(Boolean).join(" · ") || null,
        our_source_cost: null,
        raw_url: p.id ? `https://landio.com/property/${p.id}` : null,
        lat: validCoord(lat, lng) ? lat : null,
        lng: validCoord(lat, lng) ? lng : null,
        scraped_at: new Date().toISOString(),
      };
    });
}

// ── 3. Rina Land ────────────────────────────────────────────────────────────
const RINA_STATES = [
  "arizona", "arkansas", "california", "colorado", "florida", "georgia",
  "nevada", "new-mexico", "south-carolina", "tennessee", "texas",
];

function parseRinaCards(html) {
  // Each card: <div class="make-column-clickable-elementor" ... data-column-clickable="URL">
  // Headings inside carry title + price.
  const cards = [];
  const re = /data-column-clickable="([^"]+)"([\s\S]*?)(?=data-column-clickable="|$)/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    const seg = m[2];
    const hs = [...seg.matchAll(/elementor-heading-title[^>]*>(?:<[^>]+>)*([^<]+)</g)].map((x) =>
      x[1].replace(/&#8217;/g, "'").replace(/&amp;/g, "&").trim()
    );
    const title = hs.find((h) => !/\$/.test(h) && h.length > 10) || null;
    const price = hs.find((h) => /\$\s?\d/.test(h)) || null;
    if (!url.includes("/properties/")) continue;
    if (title && /out of stock|sold|coming soon/i.test(title)) continue;
    cards.push({ url, title, price });
  }
  return cards;
}

function parseRinaDetail(html) {
  // GPS icon-box: ...<span>GPS</span>...<p class="elementor-icon-box-description">35.85,-114.14</p>
  const txt = html.replace(/<[^>]+>/g, "\n");
  const gm = txt.match(/GPS[\s\n]*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)/i);
  const lat = gm ? parseFloat(gm[1]) : null;
  const lng = gm ? parseFloat(gm[2]) : null;
  const am = txt.match(/(?:Parcel Size|Size|Acreage)[\s\n]*([\d.]+)\s*(?:acre|ac)/i) || txt.match(/([\d.]+)\s*acres?/i);
  // "Mohave County" gibi net kalıp — serbest metin paragraflarını YAKALAMAZ.
  // Not: site footer'ında "Zagreb"/"Zagorje" (Hırvatistan şirket adresi) geçiyor —
  // bunlar asla ABD county'si değildir.
  const cm = txt.match(/\b(?!Zagreb|Zagorje)([A-Z][A-Za-z]{2,20}(?: [A-Z][A-Za-z]{2,20})?) County\b/);
  const pm = txt.match(/\$\s?([\d,]{4,})/);
  return {
    lat: validCoord(lat, lng) ? lat : null,
    lng: validCoord(lat, lng) ? lng : null,
    acres: am ? num(am[1]) : null,
    county: cm ? cm[1].trim() : null,
    price: pm ? num(pm[1]) : null,
  };
}

async function scrapeRina() {
  const cards = [];
  for (const st of RINA_STATES) {
    try {
      const html = await get(`https://rinaland.com/category/${st}/`);
      const found = parseRinaCards(html);
      console.log(`  rina/${st}: ${found.length} kart`);
      for (const c of found) cards.push({ ...c, catState: st });
    } catch (e) {
      console.error(`  rina/${st} FAILED: ${e.message}`);
    }
    await sleep(1200);
  }
  // Dedupe by URL
  const byUrl = new Map();
  for (const c of cards) if (!byUrl.has(c.url)) byUrl.set(c.url, c);

  const rows = [];
  let i = 0;
  for (const c of byUrl.values()) {
    i++;
    let d = { lat: null, lng: null, acres: null, county: null, price: null };
    try {
      d = parseRinaDetail(await get(c.url));
    } catch (e) {
      console.error(`  rina detay FAILED (${c.url}): ${e.message}`);
    }
    const title = c.title;
    const acresFromTitle = title ? num((title.match(/([\d.]+)\s*acres?/i) || [])[1]) : null;
    // Eyalet: kategori sayfası otoritedir (detay metninden eyalet parse etme —
    // "United States" gibi metinler yanlış eşleşiyordu).
    const catStateName = stateName(
      { "new-mexico": "NM", "south-carolina": "SC" }[c.catState] || c.catState.replace(/-/g, " ")
    );
    const catStateTitle = catStateName
      ? catStateName.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
      : null;
    // Konum: başlıktaki şehir ("in Meadview, Arizona") önceliklidir — detay
    // metnindeki county eşleşmesi footer gürültüsüne açık.
    const cityFromTitle = title ? (title.match(/in\s+([A-Z][A-Za-z .]+?),/) || [])[1] : null;
    rows.push({
      competitor: "Rina Land",
      title,
      state: catStateTitle,
      county: cityFromTitle || d.county || null,
      acres: d.acres ?? acresFromTitle,
      price: num(c.price) ?? d.price,
      down_payment: null,
      monthly_payment: null,
      term_months: null,
      doc_fee: null,
      apn: null,
      notes: null,
      our_source_cost: null,
      raw_url: c.url,
      lat: d.lat,
      lng: d.lng,
      scraped_at: new Date().toISOString(),
    });
    if (i % 10 === 0) console.log(`  rina detay: ${i}/${byUrl.size}`);
    await sleep(1500); // WordPress sitesine saygılı ol
  }
  return rows;
}

// ── main ────────────────────────────────────────────────────────────────────
const t0 = Date.now();
// ONLY="Rina Land" node competitor-scraper-v2.mjs → tek kaynağı tazele.
const sources = [
  ["Discount Lots", scrapeDiscountLots],
  ["Landio", scrapeLandio],
  ["Rina Land", scrapeRina],
].filter(([n]) => !process.env.ONLY || n === process.env.ONLY);

let grandTotal = 0;
for (const [name, fn] of sources) {
  let rows = [];
  try {
    console.log(`→ ${name}`);
    rows = await fn();
  } catch (e) {
    console.error(`  ${name} FAILED: ${e.message} — mevcut satırlar korunuyor.`);
    continue;
  }
  rows = rows.filter((r) => r.title && (r.price || r.monthly_payment));
  const withCoords = rows.filter((r) => r.lat != null).length;
  console.log(`  ${name}: ${rows.length} ilan (${withCoords} koordinatlı)`);
  if (!rows.length) continue; // boş sonuçla asla silme

  const { error: delErr } = await supabase.from("competitor_listings").delete().eq("competitor", name);
  if (delErr) { console.error(`  ${name} silme hatası: ${delErr.message}`); continue; }
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("competitor_listings").insert(chunk);
    if (error) console.error(`  ${name} insert hatası: ${error.message}`);
    else grandTotal += chunk.length;
  }
}

console.log(`✅ ${grandTotal} competitor listing yazıldı (${((Date.now() - t0) / 1000).toFixed(0)}s).`);
