#!/usr/bin/env node
/**
 * OKLAHOMA OFF-MARKET — 10-eyalet genişlemesi (OK aktivasyonu).
 * Kaynak: oktaxrolls.com June Tax Resale listeleri (scrape_oklahoma.js çeker).
 * Bu script scrape_oklahoma.js'in ürettiği ok_resale_sample.json dosyasını
 * okuyup offmarket_leads'e yükler.
 *
 * Akış:
 *   1) OK_COUNTIES=74 OK_JSON=1 node scraper/scrape_oklahoma.js   → JSON üret
 *   2) node scraper/oklahoma-offmarket.mjs                        → Supabase'e yükle
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - Resale listelerinde POSTA ADRESİ YOK (sahip adı + legal description var)
 *    → mailing_* null, absentee null. Sahiplere ulaşım skip-trace ile.
 *  - Assessed value yok → land_value/est_* null. minimum_bid (toplam vergi
 *    borcu) `use` alanına not düşülür; acres yalnız legal'den çıkarsa yazılır.
 *  - Aynı APN'in birden çok makbuz satırı tek kayda indirgenir (borç toplanır).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const raw = JSON.parse(readFileSync(resolve(HERE, "ok_resale_sample.json"), "utf8"));
console.log(`ok_resale_sample.json: ${raw.length} ham satır`);

// county+apn bazında birleştir
const byKey = new Map();
for (const r of raw) {
  if (!r.apn || !r.owner_name || r.owner_name === "UNKNOWN OWNER") continue;
  // "ATOKA COUNTY" → "Atoka"
  const county = r.county.replace(/\s*COUNTY\s*$/i, "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const key = `${county}|${r.apn}`;
  const cur = byKey.get(key);
  if (cur) {
    if (r.minimum_bid != null) cur.due = (cur.due || 0) + r.minimum_bid;
    if (cur.acres == null && r.acres != null) cur.acres = r.acres;
  } else {
    byKey.set(key, { county, apn: r.apn, owner: r.owner_name, legal: r.address || null, due: r.minimum_bid, acres: r.acres ?? null });
  }
}

const recs = [...byKey.values()].map((r) => ({
  lead_id: `OK-${r.county.replace(/\s+/g, "")}-${r.apn}`,
  state: "OK", county: r.county, region: `${r.county} County, OK`,
  apn: r.apn, owner: r.owner,
  mailing_address: null, mailing_city: null, mailing_state: null, mailing_zip: null,
  situs: r.legal ? r.legal.slice(0, 300) : null, // legal description (gerçek adres listede yok)
  use: `June Tax Resale${r.due != null ? ` · tax due $${r.due.toFixed(2)}` : ""}`,
  acres: r.acres, land_value: null,
  est_offer: null, est_retail: null, est_margin: null,
  absentee: null, lat: null, lng: null,
  source: "OK:OKTAXROLLS",
}));

console.log(`Benzersiz parsel: ${recs.length}`);
const byCounty = {};
for (const r of recs) byCounty[r.county] = (byCounty[r.county] || 0) + 1;
for (const [c, n] of Object.entries(byCounty)) console.log(`  ${c}: ${n}`);

let written = 0;
for (let i = 0; i < recs.length; i += 500) {
  const part = recs.slice(i, i + 500);
  const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
  if (error) { console.error(`upsert hatası (${i}): ${error.message}`); process.exit(1); }
  written += part.length;
}
const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "OK");
console.log(`✔ BİTTİ: ${written} kayıt upsert · Supabase OK toplam ${count}`);
