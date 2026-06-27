#!/usr/bin/env node
/**
 * PROPSTREAM (veya herhangi bir parsel/sahip) CSV → Terralot offmarket_leads.
 * PropStream'in public API'si YOK; web'den CSV export edip bunu çalıştırırsın.
 * Kolon adları sağlayıcıya göre değişir → ESNEK otomatik eşleme (owner/mailing/situs/apn/acres/value/use).
 *
 * Kullanım:
 *   node scraper/import-propstream-csv.mjs <dosya.csv> [SOURCE_ETIKETI]
 *   örn: node scraper/import-propstream-csv.mjs ~/Downloads/propstream-nm.csv "PROPSTREAM:NM"
 *
 * Tabloyu kurmak için önce: scraper/sql/offmarket_leads.sql (Supabase SQL Editor).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const file = process.argv[2];
const sourceLabel = process.argv[3] || `PROPSTREAM:${basename(file || "import").replace(/\.csv$/i, "")}`;
if (!file) { console.error("Kullanım: node scraper/import-propstream-csv.mjs <dosya.csv> [SOURCE]"); process.exit(1); }

// ── Basit RFC4180 CSV parse (tırnaklı alan + kaçış destekli) ──
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* atla */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ── Esnek başlık eşleme: birden çok varyantı yakalar ──
const FIELD_PATTERNS = {
  owner: [/owner.*name/i, /^owner$/i, /owner.*full/i, /^name$/i],
  owner2: [/owner.*2/i, /co.?owner/i, /second.*owner/i],
  mailing_address: [/mail.*addr/i, /owner.*addr/i, /mailing.*street/i, /^mail$/i],
  mailing_city: [/mail.*city/i, /owner.*city/i],
  mailing_state: [/mail.*state/i, /owner.*state/i],
  mailing_zip: [/mail.*zip/i, /owner.*zip/i, /mail.*postal/i],
  situs: [/property.*addr/i, /situs/i, /site.*addr/i, /^address$/i],
  property_city: [/property.*city/i, /site.*city/i],
  property_state: [/property.*state/i, /site.*state/i, /^state$/i],
  county: [/county/i],
  apn: [/\bapn\b/i, /parcel.*number/i, /parcel.*id/i, /parcel\s*#/i, /^account/i, /parcel.*no/i],
  acres: [/acre/i, /lot.*size.*acre/i, /^acreage$/i],
  land_value: [/assessed.*value/i, /market.*value/i, /land.*value/i, /est.*value/i, /^value$/i, /total.*value/i],
  use: [/land.*use/i, /property.*type/i, /use.*code/i, /^use$/i, /^type$/i],
};
function matchHeaders(headers) {
  const map = {};
  const norm = headers.map((h) => h.trim());
  for (const [field, pats] of Object.entries(FIELD_PATTERNS)) {
    for (let i = 0; i < norm.length; i++) {
      if (map[field] != null) break;
      if (pats.some((p) => p.test(norm[i]))) map[field] = i;
    }
  }
  return map;
}

const num = (s) => { const n = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null; };

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("HATA: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok"); process.exit(1); }
  const s = createClient(url, key, { auth: { persistSession: false } });

  const rows = parseCsv(readFileSync(resolve(file), "utf8"));
  if (rows.length < 2) { console.error("CSV boş/başlıksız"); process.exit(1); }
  const headers = rows[0];
  const m = matchHeaders(headers);
  console.log("Tespit edilen kolonlar:", Object.fromEntries(Object.entries(m).map(([f, i]) => [f, headers[i]])));
  if (m.owner == null || m.mailing_address == null) {
    console.error("\n❌ 'owner' veya 'mailing address' kolonu bulunamadı. Başlıklar:", headers.join(" | "));
    process.exit(2);
  }

  const get = (r, f) => (m[f] != null ? String(r[m[f]] ?? "").trim() : "");
  const recs = [], seen = new Set();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const owner = get(r, "owner");
    const apn = get(r, "apn") || `${i}`;
    const propState = (get(r, "property_state") || "").toUpperCase().slice(0, 2) || "US";
    const lead_id = `${propState}-${apn}`;
    if (!owner || !get(r, "mailing_address") || seen.has(lead_id)) continue;
    seen.add(lead_id);
    const mailState = (get(r, "mailing_state") || "").toUpperCase().slice(0, 2);
    recs.push({
      lead_id, state: propState, county: get(r, "county") || null, region: get(r, "county") || propState,
      apn, owner: [owner, get(r, "owner2")].filter(Boolean).join(" & "),
      mailing_address: get(r, "mailing_address"), mailing_city: get(r, "mailing_city"),
      mailing_state: mailState, mailing_zip: get(r, "mailing_zip"),
      situs: get(r, "situs"), use: get(r, "use"),
      acres: num(get(r, "acres")), land_value: num(get(r, "land_value")),
      est_offer: null, est_retail: null, est_margin: null,
      absentee: !!(mailState && propState && mailState !== propState),
      lat: null, lng: null, source: sourceLabel,
    });
  }
  console.log(`\n${recs.length} mektup-atılır kayıt hazır (kaynak: ${sourceLabel}).`);
  if (!recs.length) { console.error("Eşleşen kayıt yok."); process.exit(2); }

  // JSON snapshot (dashboard için)
  const snap = resolve(ROOT, `dashboard/src/data/import-${sourceLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`);
  mkdirSync(dirname(snap), { recursive: true });
  writeFileSync(snap, JSON.stringify({ generatedAt: new Date().toISOString(), count: recs.length, source: sourceLabel, rows: recs }, null, 2));

  // Supabase upsert (500'lük partiler)
  let done = 0;
  for (let i = 0; i < recs.length; i += 500) {
    const part = recs.slice(i, i + 500).map(({ region, ...rest }) => ({ region, ...rest }));
    const { error } = await s.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
    if (error) {
      if (/Could not find the table|schema cache/i.test(error.message)) { console.error("\n❌ offmarket_leads tablosu yok — önce scraper/sql/offmarket_leads.sql çalıştır."); process.exit(2); }
      console.error("upsert hatası:", error.message); process.exit(1);
    }
    done += part.length; process.stdout.write(`\r  Supabase: ${done}/${recs.length}`);
  }
  const { count } = await s.from("offmarket_leads").select("*", { count: "exact", head: true });
  console.log(`\n✅ İçe aktarıldı. Supabase toplam offmarket_leads: ${count}. Snapshot: ${snap}`);
}
main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
