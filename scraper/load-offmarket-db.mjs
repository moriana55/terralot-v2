#!/usr/bin/env node
/**
 * OFF-MARKET LEAD'LERİNİ SUPABASE'E KALICI YAZAR (REST / service_role — silinmez).
 * ÖNCE: scraper/sql/offmarket_leads.sql'i Supabase SQL Editor'da çalıştır (tabloyu kurar).
 * SONRA: node scraper/load-offmarket-db.mjs  → tüm *-offmarket.json'ları upsert eder.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FILES = ["mohave-offmarket.json", "colorado-offmarket.json"];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("HATA: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok (.env)"); process.exit(1); }
const s = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let total = 0;
  for (const fname of FILES) {
    const path = resolve(ROOT, "dashboard/src/data", fname);
    if (!existsSync(path)) { console.log(`atlandı (yok): ${fname}`); continue; }
    const data = JSON.parse(readFileSync(path, "utf8"));
    const rows = data.rows || [];
    if (!rows.length) { console.log(`boş: ${fname}`); continue; }
    const st = data.state || (fname.startsWith("mohave") ? "AZ" : "?");
    const source = data.source || fname;

    const recs = rows.map((r) => ({
      lead_id: `${st}-${r.apn}`,
      state: st, county: r.region, region: r.region, apn: r.apn, owner: r.owner,
      mailing_address: r.mailing_address, mailing_city: r.mailing_city,
      mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
      situs: r.situs, use: r.use, acres: r.acres ?? null, land_value: r.land_value ?? null,
      est_offer: r.est_offer ?? null, est_retail: r.est_retail ?? null, est_margin: r.est_margin ?? null,
      absentee: !!(r.mailing_state && r.mailing_state !== st),
      lat: r.lat ?? null, lng: r.lng ?? null, source,
    }));

    const CHUNK = 500;
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
      process.stdout.write(`\r  ${fname}: ${Math.min(i + CHUNK, recs.length)}/${recs.length}`);
    }
    console.log(` ✓ ${fname} (${recs.length})`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ Supabase'de toplam ${count} lead — KALICI, silinmez.`);
}
main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
