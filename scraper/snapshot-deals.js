/**
 * Drift tracking (#5) — snapshots the bid/status of tracked + top deals each run.
 * Compares to the prior snapshot and flags changes (price drop, gone, redeemed).
 * Runs nightly after migrate; value accrues over time. Stable ids make this work.
 *
 *   node snapshot-deals.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // watch set = tracked deals + top 200 by final_score
  const { data: tracked } = await supabase.from('deal_tracking').select('lead_id');
  const trackedIds = new Set((tracked || []).map((t) => t.lead_id));
  const { data: top } = await supabase
    .from('tax_delinquent_properties')
    .select('id,minimum_bid,legal_description')
    .order('final_score', { ascending: false, nullsFirst: false })
    .limit(200);

  const ids = new Set([...trackedIds, ...((top || []).map((r) => r.id))]);
  // current values for all watched ids
  const { data: cur } = await supabase
    .from('tax_delinquent_properties')
    .select('id,minimum_bid,legal_description')
    .in('id', [...ids]);
  const curMap = new Map((cur || []).map((r) => [r.id, r]));

  // last snapshot per id
  const { data: lastSnaps } = await supabase
    .from('deal_snapshots')
    .select('lead_id,minimum_bid,captured_at')
    .in('lead_id', [...ids])
    .order('captured_at', { ascending: false });
  const lastMap = new Map();
  for (const s of lastSnaps || []) if (!lastMap.has(s.lead_id)) lastMap.set(s.lead_id, s);

  const now = new Date().toISOString();
  const rows = [];
  let drops = 0, gone = 0;
  for (const id of ids) {
    const c = curMap.get(id);
    const prev = lastMap.get(id);
    if (!c) { // deal no longer present (sold/removed) — flag if tracked
      if (trackedIds.has(id) && prev) gone++;
      continue;
    }
    if (prev && prev.minimum_bid != null && c.minimum_bid != null && c.minimum_bid < prev.minimum_bid) drops++;
    rows.push({ lead_id: id, minimum_bid: c.minimum_bid, status_note: c.legal_description, captured_at: now });
  }

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('deal_snapshots').insert(rows.slice(i, i + 200));
    if (error) console.error('snapshot insert hata:', error.message);
  }
  console.log(`✅ ${rows.length} snapshot alındı | fiyat düşen: ${drops} | takipte kaybolan: ${gone}`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
