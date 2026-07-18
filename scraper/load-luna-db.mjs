#!/usr/bin/env node
/**
 * LUNA COUNTY (NM) OFF-MARKET LEAD'LERİNİ SUPABASE'E YAZAR (REST / service_role).
 * Kaynak: dashboard/src/data/import-propstream-nm-luna.json (157 kayıt, hepsi mektup-atılır).
 * Şema import-propstream JSON'da BİREBİR offmarket_leads kolonlarıyla aynı → doğrudan upsert.
 * Ayrım: county='Luna' / source='PROPSTREAM:NM-Luna'. Mohave ile AYNI tabloya yazılır.
 *
 * ÖNCE: scraper/sql/offmarket_leads.sql Supabase'de çalışmış olmalı (tablo kurulu).
 * Çalıştır: node scraper/load-luna-db.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// dashboard/.env.local'dan Supabase kimliğini oku (scraper .env yerine).
function loadEnvLocal() {
  const p = resolve(ROOT, "dashboard/.env.local");
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("HATA: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok (dashboard/.env.local)");
  process.exit(1);
}
const s = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const path = resolve(ROOT, "dashboard/src/data/import-propstream-nm-luna.json");
  if (!existsSync(path)) { console.error("HATA: import-propstream-nm-luna.json yok"); process.exit(1); }
  const data = JSON.parse(readFileSync(path, "utf8"));
  const rows = data.rows || [];
  if (!rows.length) { console.error("HATA: boş rows"); process.exit(1); }

  // Rows zaten offmarket_leads şemasıyla birebir aynı → alanları güvenle map'le.
  const recs = rows.map((r) => ({
    lead_id: r.lead_id,
    state: r.state, county: r.county, region: r.region,
    apn: r.apn, owner: r.owner,
    mailing_address: r.mailing_address, mailing_city: r.mailing_city,
    mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    situs: r.situs, use: r.use,
    acres: r.acres ?? null, land_value: r.land_value ?? null,
    est_offer: r.est_offer ?? null, est_retail: r.est_retail ?? null, est_margin: r.est_margin ?? null,
    absentee: r.absentee ?? !!(r.mailing_state && r.mailing_state !== r.state),
    lat: r.lat ?? null, lng: r.lng ?? null,
    source: r.source || data.source || "PROPSTREAM:NM-Luna",
  }));

  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const part = recs.slice(i, i + CHUNK);
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) {
      if (/Could not find the table|does not exist|schema cache/i.test(error.message)) {
        console.error("\n❌ Tablo YOK. Önce scraper/sql/offmarket_leads.sql'i Supabase SQL Editor'da çalıştır.");
        process.exit(2);
      }
      console.error("\nupsert hatası:", error.message); process.exit(1);
    }
    total += part.length;
    process.stdout.write(`\r  Luna: ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
  }
  console.log(`\n✓ ${total} Luna kaydı upsert edildi.`);

  const { count: lunaCount, error: cErr } = await s
    .from("offmarket_leads").select("*", { count: "exact", head: true }).eq("county", "Luna");
  if (cErr) { console.error("count hatası:", cErr.message); process.exit(1); }
  const { count: allCount } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`✅ Supabase'de county='Luna' → ${lunaCount} kayıt (tablo toplam: ${allCount}).`);
}
main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
