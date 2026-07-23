#!/usr/bin/env node
/**
 * HARİTA NOKTA EXPORT — offmarket_leads'teki TÜM koordinatlı kayıtları (15 eyalet,
 * ~555K) kompakt bir gz dosyasına yazar. Dashboard'daki
 * /api/admin/offmarket-map-clusters bu dosyayı okuyup supercluster indeksi kurar.
 *
 * Format (gzip'li JSON):
 *   { generatedAt, states: ["AZ","NM",...], byState: {AZ: 19942, ...},
 *     pts: [[lat*1e5|0, lng*1e5|0, stateIdx], ...] }
 * 1e-5 derece ≈ 1.1 m — harita noktası için fazlasıyla yeterli hassasiyet.
 *
 * Çalıştır: node scraper/export-map-points.mjs
 * Tekrar çalıştırılabilir (dosyanın üzerine yazar). Kayıt ATLANMAZ:
 * lead_id sıralı keyset paging, sadece lat IS NOT NULL filtresi.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { gzipSync } from "zlib";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const OUT = resolve(HERE, "../dashboard/src/data/offmarket-map-points.json.gz");
const STATES = ["AZ", "NM", "CO", "TX", "FL", "AR", "NC", "GA", "TN", "OK", "NV", "OR", "MO", "MI", "SC"];
const PAGE = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(afterId) {
  for (let attempt = 0; ; attempt++) {
    let q = supa
      .from("offmarket_leads")
      .select("lead_id, state, lat, lng")
      .not("lat", "is", null)
      .order("lead_id")
      .limit(PAGE);
    if (afterId) q = q.gt("lead_id", afterId);
    const { data, error } = await q;
    if (!error) return data ?? [];
    if (attempt >= 4) throw new Error(error.message);
    console.log(`  … sayfa hatası (${error.message.slice(0, 60)}) — ${attempt + 1}. tekrar`);
    await sleep(2500 * (attempt + 1));
  }
}

const t0 = Date.now();
const pts = [];
const byState = Object.fromEntries(STATES.map((s) => [s, 0]));
let skipped = 0;
let afterId = null;
let n = 0;

for (;;) {
  const rows = await page(afterId);
  if (!rows.length) break;
  for (const r of rows) {
    const si = STATES.indexOf(r.state);
    const lat = Number(r.lat), lng = Number(r.lng);
    if (si < 0 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { skipped++; continue; }
    pts.push([Math.round(lat * 1e5), Math.round(lng * 1e5), si]);
    byState[r.state]++;
  }
  afterId = rows[rows.length - 1].lead_id;
  n += rows.length;
  if (n % 20000 === 0) console.log(`  ${n.toLocaleString("en-US")} kayıt okundu…`);
}

const payload = { generatedAt: new Date().toISOString(), states: STATES, byState, pts };
const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
writeFileSync(OUT, gz);

console.log(`✔ BİTTİ (${Math.round((Date.now() - t0) / 1000)} sn): ${pts.length.toLocaleString("en-US")} nokta → ${OUT}`);
console.log(`  gz boyut: ${(gz.length / 1024 / 1024).toFixed(1)} MB · atlanan (geçersiz): ${skipped}`);
console.log(`  eyalet kırılımı: ${STATES.map((s) => `${s}=${byState[s]}`).join(" ")}`);
