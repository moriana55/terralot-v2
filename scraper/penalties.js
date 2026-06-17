/**
 * State redemption-risk penalties for tax-sale acquisitions.
 * In tax-deed/lien states the prior owner can "redeem" (buy back) the property
 * within a window — real risk that you don't actually keep the land. Applied
 * only to tax-sale sources (not retail Zillow listings).
 *
 * Shared by migrate_to_supabase.js (base final_score) and dd-enrich.js.
 */
const REDEMPTION = {
  // state: { months, penalty(0-12), label }
  TX: { months: 6, penalty: 8, label: "6ay–2yıl (homestead/tarım)" },
  GA: { months: 12, penalty: 8, label: "12 ay" },
  TN: { months: 12, penalty: 6, label: "1 yıl" },
  CO: { months: 36, penalty: 6, label: "3 yıl (lien)" },
  AZ: { months: 36, penalty: 6, label: "3 yıl (lien)" },
  AR: { months: 24, penalty: 6, label: "~2 yıl" },
  NV: { months: 24, penalty: 4, label: "~2 yıl" },
  NC: { months: 0, penalty: 4, label: "upset-bid dönemi" },
  NY: { months: 0, penalty: 5, label: "değişken" },
  FL: { months: 0, penalty: 2, label: "deed sonrası yok (minimal)" },
  NM: { months: 0, penalty: 2, label: "deed, redemption yok" },
};

function stAbbr(s) {
  if (!s) return null;
  s = String(s).trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const M = { Texas: "TX", Florida: "FL", Georgia: "GA", Tennessee: "TN", "North Carolina": "NC", "New York": "NY", Arizona: "AZ", "New Mexico": "NM", Colorado: "CO", Arkansas: "AR", Nevada: "NV" };
  return M[s] || null;
}

// Penalty points only for tax-sale sources.
function redemptionPenalty(state, source) {
  if (!/^TAX:|STRUCK/i.test(source || "")) return 0;
  const r = REDEMPTION[stAbbr(state)];
  return r ? r.penalty : 4; // unknown tax state => small default
}

function redemptionInfo(state) {
  return REDEMPTION[stAbbr(state)] || null;
}

module.exports = { redemptionPenalty, redemptionInfo };
