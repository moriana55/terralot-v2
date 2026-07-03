// ─────────────────────────────────────────────────────────────────────────────
// RAKİP RADAR — günlük snapshot + diff koşusu (cron/launchd için).
//
// competitor_listings'in ŞU ANKİ halini snapshot'lar ve önceki izlenen durumla
// diff'ler (NEW / PRICE_CHANGED / STATUS_CHANGED / DISAPPEARED / REAPPEARED).
// API route ile aynı motoru kullanır (src/lib/rakip-radar-store.ts) — Node 23+
// TS'i doğrudan import edebilir.
//
// Kullanım (dashboard/ kökünden):
//   node --env-file=.env.local scripts/rakip-radar-refresh.mjs
//
// Tam zincir (önce kaynak tabloyu tazele, sonra diff'le):
//   (cd ../scraper && node competitor-scraper.js) && \
//   node --env-file=.env.local scripts/rakip-radar-refresh.mjs
//
// Günlük otomasyon örneği README'de ("Rakip Radar" bölümü).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { runRefresh } from "../src/lib/rakip-radar-store.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("HATA: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (--env-file=.env.local).");
  process.exit(1);
}

const supabase = createClient(url, key);

try {
  const r = await runRefresh(supabase);
  console.log(`[rakip-radar] ${r.runAt} — kaynak: ${r.sourceCount} ilan, olay: ${r.totalEvents}`);
  for (const [type, n] of Object.entries(r.events)) console.log(`  ${type}: ${n}`);
  if (r.firstRun) console.log("  (İlk koşu — hepsi NEW. Tarih birikiyor; ilk gerçek diff yarınki koşuda.)");
} catch (e) {
  console.error("[rakip-radar] HATA:", e.message || e);
  process.exit(1);
}
