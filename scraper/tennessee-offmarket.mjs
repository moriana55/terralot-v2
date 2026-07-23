#!/usr/bin/env node
/**
 * TENNESSEE OFF-MARKET — 10-eyalet genişlemesi (TN aktivasyonu).
 * Kaynak: tndtax.com — TN county'leri için ortak "Delinquent Tax" portalı
 * (scrape_tennessee.js ile aynı uçlar: index.php → search.php → hits.php).
 * Cloudflare yok, Puppeteer gerekmez; sunucu DataTables JSON döner.
 *
 * DÜRÜSTLÜK NOTLARI:
 *  - Portal POSTA ADRESİ vermez (yalnız sahip adı + mülk adresi) → mailing_*
 *    null, absentee null (bilinmiyor). Sahiplere ulaşım skip-trace ile.
 *  - Assessed value / acres yok → land_value, acres, est_* null (uydurulmaz).
 *  - Yalnız UNPAID satırlar yüklenir; aynı APN'in birden çok makbuz yılı
 *    tek kayda indirgenir (borçlar toplanır, en yeni yıl not edilir).
 *
 * Çalıştır: node scraper/tennessee-offmarket.mjs   (TEST=1 → sadece ilk entity)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8") + "\n" + readFileSync(resolve(HERE, "../dashboard/.env"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const BASE = "https://tndtax.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TEST = process.env.TEST === "1";
const SEEDS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const num = (v) => { const m = String(v ?? "").replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };

function collectCookies(res, jar) {
  let raw = [];
  try { raw = res.headers.getSetCookie?.() ?? []; } catch { /* yok */ }
  for (const line of raw) {
    const kv = line.split(";")[0]; const i = kv.indexOf("=");
    if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

async function searchSeed(initUrl, jar, seed) {
  const form = new URLSearchParams();
  form.set("searchType", "namefields");
  form.set("search[15]", seed);
  form.set("search[76:=:0]", "use");
  form.set("showAll", "1");
  let res = await fetch(`${BASE}/search.php`, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Referer: initUrl, Cookie: cookieHeader(jar) },
    body: form.toString(),
    signal: AbortSignal.timeout(45000),
  });
  collectCookies(res, jar);
  await res.text();
  res = await fetch(`${BASE}/hits.php?sEcho=1&iDisplayStart=0&iDisplayLength=100000`, {
    headers: { "User-Agent": UA, Referer: `${BASE}/search.php`, Cookie: cookieHeader(jar) },
    signal: AbortSignal.timeout(45000),
  });
  let json; try { json = JSON.parse(await res.text()); } catch { return { capped: false, rows: [] }; }
  const rows = Array.isArray(json.aaData) ? json.aaData : [];
  return { capped: (json.iTotalRecords || rows.length) >= 500, rows };
}

async function fetchEntity(entityName) {
  const jar = {};
  const initUrl = `${BASE}/index.php?state=TN&entity=${encodeURIComponent(entityName)}&site=full`;
  const res = await fetch(initUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45000) });
  collectCookies(res, jar);
  await res.text();
  const seen = new Map();
  const add = (rows) => { for (const r of rows) { const k = [r[2], r[3], r[4], r[8], r[0]].map((x) => String(x ?? "")).join("|"); if (!seen.has(k)) seen.set(k, r); } };
  const first = await searchSeed(initUrl, jar, "a");
  add(first.rows);
  if (first.capped) {
    for (const seed of SEEDS) {
      if (seed === "a") continue;
      try { add((await searchSeed(initUrl, jar, seed)).rows); } catch { /* seed atla */ }
      await sleep(250);
    }
  }
  return [...seen.values()];
}

// ── ana akış ─────────────────────────────────────────────────────────────────
let entities = [];
try {
  const r = await fetch(`${BASE}/api.php?option=entityList`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  entities = ((await r.json()) || []).map((e) => e.entityName).filter(Boolean);
} catch (e) { console.error("entityList alınamadı:", e.message); }
if (!entities.length) entities = ["CHESTER", "Sullivan County", "SULLIVAN: Kingsport"];
if (TEST) entities = entities.slice(0, 1);
console.log(`Entity'ler: ${entities.join(" | ")}`);

// county+apn bazında birleştir (aynı parselin birden çok makbuz yılı/entity görünümü)
const byKey = new Map();
for (const ent of entities) {
  let rows;
  try { rows = await fetchEntity(ent); }
  catch (e) { console.error(`✗ ${ent}: ${e.message}`); continue; }
  // "SULLIVAN: Kingsport" → Sullivan ; "Sullivan County" → Sullivan ; "CHESTER" → Chester
  const raw = ent.split(":")[0].replace(/\s*county\s*$/i, "").trim().toLowerCase();
  const county = raw.replace(/\b\w/g, (c) => c.toUpperCase());
  let unpaid = 0;
  for (const r of rows) {
    const status = stripHtml(r[9]).toUpperCase();
    if (status !== "UNPAID") continue;
    unpaid++;
    const apn = [stripHtml(r[2]), stripHtml(r[3]), stripHtml(r[4])].filter(Boolean).join("-");
    if (!apn) continue;
    const owner = stripHtml(r[0]);
    if (!owner) continue;
    const key = `${county}|${apn}`;
    const due = num(r[10]) || 0;
    const year = parseInt(stripHtml(r[8]), 10) || 0;
    const cur = byKey.get(key);
    if (cur) {
      cur.due += due;
      if (year > cur.year) { cur.year = year; cur.owner = owner; cur.situs = stripHtml(r[1]) || cur.situs; }
    } else {
      byKey.set(key, { county, apn, owner, situs: stripHtml(r[1]) || null, due, year });
    }
  }
  console.log(`✓ ${ent}: ${rows.length} satır, UNPAID ${unpaid}`);
  await sleep(500);
}

const recs = [...byKey.values()].map((r) => ({
  lead_id: `TN-${r.county.replace(/\s+/g, "")}-${r.apn}`,
  state: "TN", county: r.county, region: `${r.county} County, TN`,
  apn: r.apn, owner: r.owner,
  mailing_address: null, mailing_city: null, mailing_state: null, mailing_zip: null,
  situs: r.situs,
  use: `Delinquent Tax UNPAID · due $${r.due.toFixed(2)}${r.year ? ` (${r.year})` : ""}`,
  acres: null, land_value: null,
  est_offer: null, est_retail: null, est_margin: null,
  absentee: null, lat: null, lng: null,
  source: "TN:TNDTAX",
}));

console.log(`\nToplam benzersiz parsel: ${recs.length}`);
let written = 0;
for (let i = 0; i < recs.length; i += 500) {
  const part = recs.slice(i, i + 500);
  const { error } = await supa.from("offmarket_leads").upsert(part, { onConflict: "lead_id" });
  if (error) { console.error(`upsert hatası (${i}): ${error.message}`); process.exit(1); }
  written += part.length;
}
const { count } = await supa.from("offmarket_leads").select("*", { count: "exact", head: true }).eq("state", "TN");
console.log(`✔ BİTTİ: ${written} kayıt upsert · Supabase TN toplam ${count}`);
