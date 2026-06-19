// Mevcut parselleri TAZE demografikle (county_demographics.json) yeniden skorlar.
// liqFor'u bypass eder: county adını normalize ederek (suffix/case) eşleştirir,
// likidite (pop büyüme + inşaat izni) → liq01 → scoreDeal/extraScores.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { scoreDeal, extraScores, redemptionPenalty } = require('./scoring');
// $/acre emsal (COMP) motoru — competitor_listings medyanından gerçek piyasa
// değeri tahmini. judgment_amount şişik/eksik olduğunda skoru DÜRÜST besler.
const { buildAcreComps, estimateValue } = require('./scrape_acrevalue');

const SB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const norm = (c) => String(c || '').replace(/\s+county$/i, '').toUpperCase().trim();

const demoObj = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'county_demographics.json'), 'utf8'));
const M = new Map();
for (const [key, v] of Object.entries(demoObj)) {
  // key = "OH/CUYAHOGA COUNTY" → county adını normalize et (suffix sök)
  const slash = key.indexOf('/');
  const st = key.slice(0, slash);
  const cty = key.slice(slash + 1);
  M.set(`${st.toUpperCase()}/${norm(cty)}`, v);
}

function liqFor(state, county) {
  const d = M.get(`${String(state || '').toUpperCase()}/${norm(county)}`);
  if (!d) return { liq01: 0.33, g5: null, matched: false };
  const g5 = d.g5;
  const popLiq = (g5 != null) ? Math.max(0, Math.min(1, (g5 + 0.05) / 0.15)) : null;
  const units = d.permits;
  const permitLiq = (units != null) ? Math.max(0, Math.min(1, Math.log10((units || 0) + 1) / Math.log10(20000))) : null;
  let liq01;
  if (popLiq != null && permitLiq != null) liq01 = 0.6 * popLiq + 0.4 * permitLiq;
  else liq01 = popLiq != null ? popLiq : (permitLiq != null ? permitLiq : 0.33);
  return { liq01, g5: g5 != null ? g5 : null, matched: true };
}

(async () => {
  const LIMIT = process.env.RESCORE_LIMIT ? +process.env.RESCORE_LIMIT : Infinity;
  // COMP tablosunu bir kez kur (state/county → $/acre). Hata olursa skor eski
  // davranışa (judgment_amount = value) düşer — kırılmaz.
  let comps = null;
  try {
    comps = await buildAcreComps();
    const nStates = Object.keys(comps.stateIdx || {}).length;
    const nCounties = Object.keys(comps.countyIdx || {}).length;
    console.log(`COMP yüklendi: ${nStates} eyalet, ${nCounties} county $/acre emsali.`);
  } catch (e) {
    console.warn('COMP kurulamadı, judgment_amount fallback:', e.message);
  }
  let from = 0, total = 0, matched = 0, compHits = 0;
  const PAGE = 1000;
  for (;;) {
    const want = Math.min(PAGE, LIMIT - total);
    if (want <= 0) break;
    const { data, error } = await SB.from('tax_delinquent_properties')
      .select('id,state,county,source,owner_name,minimum_bid,judgment_amount,acres')
      .range(from, from + want - 1);
    if (error) { console.error('SELECT:', error.message); process.exit(1); }
    if (!data.length) break;
    const ups = data.map((r) => {
      const { liq01, g5, matched: m } = liqFor(r.state, r.county);
      if (m) matched++;
      // COMP değer = acres × bölge $/acre (competitor_listings medyanı, haircut'lı).
      // Varsa skoru gerçek piyasa değeriyle besle (discount/savings dürüstleşir);
      // yoksa judgment_amount'a düş. acres → confidence sinyali.
      const comp = (comps && r.acres > 0) ? estimateValue(comps, { state: r.state, county: r.county, acres: r.acres }) : null;
      const value = (comp && comp.est_value > 0) ? comp.est_value : r.judgment_amount;
      if (comp && comp.est_value > 0) compHits++;
      const sc = scoreDeal({ value, bid: r.minimum_bid, source: r.source || '', ownerName: r.owner_name, liq01, g5 });
      const ex = extraScores({ value, bid: r.minimum_bid, liq01, source: r.source || '', ownerName: r.owner_name, hasCoords: false, acres: r.acres || null });
      return {
        id: r.id, state: r.state, county: r.county, source: r.source,
        owner_name: r.owner_name, minimum_bid: r.minimum_bid, judgment_amount: r.judgment_amount,
        final_score: Math.max(0, sc.deal_score - redemptionPenalty(r.state, r.source || '')),
        ...sc, ...ex,
      };
    });
    for (let i = 0; i < ups.length; i += 200) {
      const { error: ue } = await SB.from('tax_delinquent_properties').upsert(ups.slice(i, i + 200), { onConflict: 'id' });
      if (ue) { console.error('UPSERT:', ue.message); process.exit(1); }
    }
    total += data.length;
    process.stdout.write(`\r  ${total} işlendi, ${matched} demografik · ${compHits} COMP eşleşti  `);
    if (data.length < want) break;
    from += data.length;
  }
  console.log(`\n✅ ${total} parsel re-score edildi, ${matched} demografik, ${compHits} COMP ($/acre) eşleşti.`);
})();
