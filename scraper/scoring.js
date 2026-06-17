/**
 * Shared deal-scoring used by migrate_to_supabase.js and socrata-harvest.js.
 * Keeps every data source scored identically.
 */
const { redemptionPenalty } = require('./penalties');

let GROWTH = {};
try { GROWTH = require('./data/county_growth.json'); } catch { console.warn('county_growth.json yok — likidite nötr.'); }
let PERMITS = {};
try { PERMITS = require('./data/county_permits.json'); } catch { /* opsiyonel */ }

const FULL2ABBR = { Texas: 'TX', Florida: 'FL', Georgia: 'GA', Tennessee: 'TN', 'North Carolina': 'NC', 'New York': 'NY', Arizona: 'AZ', 'New Mexico': 'NM', Colorado: 'CO', California: 'CA', Arkansas: 'AR', Nevada: 'NV', Maryland: 'MD', Illinois: 'IL', Ohio: 'OH', Michigan: 'MI', Missouri: 'MO', Indiana: 'IN', Pennsylvania: 'PA', Virginia: 'VA', Washington: 'WA', Oregon: 'OR', Utah: 'UT', Idaho: 'ID', Kansas: 'KS', Oklahoma: 'OK', Alabama: 'AL', Mississippi: 'MS', Louisiana: 'LA', Kentucky: 'KY', "South Carolina": 'SC', Wisconsin: 'WI', Minnesota: 'MN', Iowa: 'IA' };
function stAbbr(s) { if (!s) return null; s = String(s).trim(); if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase(); return FULL2ABBR[s] || null; }

// Demand = population trend (Census PEP) blended with construction activity
// (Census building permits). { liq01: 0..1, g5: 5yr pop growth }.
function liqFor(state, county) {
  const a = stAbbr(state);
  if (!a || !county) return { liq01: 0.33, g5: null };
  const key = `${a}/${String(county).toUpperCase().trim()}`;
  const g = GROWTH[key];
  const popLiq = g ? Math.max(0, Math.min(1, (g.g5 + 0.05) / 0.15)) : null; // -5%→0, 0%→.33, +10%→1
  const p = PERMITS[key];
  // permit activity: 20k+ annual units => fully hot (active build market)
  const permitLiq = p ? Math.max(0, Math.min(1, Math.log10((p.units || 0) + 1) / Math.log10(20000))) : null;
  let liq01;
  if (popLiq != null && permitLiq != null) liq01 = 0.6 * popLiq + 0.4 * permitLiq;
  else liq01 = popLiq ?? permitLiq ?? 0.33;
  return { liq01, g5: g ? g.g5 : null };
}

// Core deal_score (0–100): discount(35)+savings(25)+buyability(15)+owner(10)+liquidity(15)
function scoreDeal({ value, bid, source, ownerName, liq01 = 0.33, g5 = null }) {
  const liquidity_score = Math.round(liq01 * 100);
  if (!value || !bid || value <= 0 || bid <= 0) {
    return { deal_score: 0, discount_pct: null, savings: null, liquidity_score, county_pop_growth: g5 };
  }
  const discount = Math.max(0, (value - bid) / value);
  const savings = value - bid;
  const discPts = Math.min(discount, 1) * 35;
  const savePts = Math.min(Math.log10(Math.max(savings, 1)) / Math.log10(500000), 1) * 25;
  let buyPts = 3;
  if (/STRUCK/i.test(source)) buyPts = 15;
  else if (/^TAX:|^SOCRATA:/.test(source)) buyPts = 8;
  const realOwner = ownerName && !/absentee|unknown|county tax/i.test(ownerName);
  const ownPts = realOwner ? 10 : 0;
  const liqPts = liq01 * 15;
  return {
    deal_score: Math.round(discPts + savePts + buyPts + ownPts + liqPts),
    discount_pct: Math.round(discount * 100),
    savings: Math.round(savings),
    liquidity_score,
    county_pop_growth: g5,
  };
}

// Strategy-specific scores + data confidence.
function extraScores({ value, bid, liq01 = 0.33, source = '', ownerName, hasCoords, acres }) {
  const ok = value > 0 && bid > 0;
  const discount = ok ? Math.max(0, (value - bid) / value) : 0;
  const savings = ok ? value - bid : 0;
  const struck = /STRUCK/i.test(source);
  const realOwner = ownerName && !/absentee|unknown|county tax/i.test(ownerName);
  const flip = Math.round(
    Math.min(discount, 1) * 35 +
    Math.min(Math.log10(Math.max(savings, 1)) / Math.log10(500000), 1) * 30 +
    liq01 * 25 + (struck ? 10 : 0)
  );
  const afford = bid > 0 ? Math.max(0, 1 - Math.min(bid, 50000) / 50000) : 0;
  const ownerfinance = Math.round(afford * 35 + liq01 * 30 + Math.min(discount, 1) * 20 + (realOwner ? 15 : 0));
  const confidence = Math.min(100,
    (value > 0 ? 30 : 0) + (acres ? 20 : 0) + (hasCoords ? 25 : 0) + (realOwner ? 15 : 0) + 10
  );
  return { flip_score: flip, ownerfinance_score: ownerfinance, confidence };
}

module.exports = { liqFor, scoreDeal, extraScores, redemptionPenalty, stAbbr };
