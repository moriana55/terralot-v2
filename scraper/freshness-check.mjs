#!/usr/bin/env node
/**
 * PER-SOURCE FRESHNESS / STALENESS CHECK (#ops dead-man's switch, kaynak bazlı)
 *
 * run-all.sh'in sonunda çalışır. Her kaynak için Supabase'den
 *   • satır sayısı (count)
 *   • en son scraped_at / updated_at
 * çeker, bir önceki koşunun snapshot'ıyla (scraper/.freshness-state.json) kıyaslar.
 * Bir kaynak N günden eski ise VEYA satır sayısı önceki snapshot'a göre >X% düştüyse
 * "⚠ STALE/DROP" satırı üretir ve (token varsa) Telegram'a yollar.
 *
 *   node freshness-check.mjs
 *
 * KURALLAR:
 *  • Yeni env GEREKTİRMEZ. Telegram token boşsa sessizce atlar (stdout'a yazar).
 *  • Eksik tablo/kolon olursa o kaynağı "?" yapar, ASLA crash etmez.
 *  • Sadece OKUMA + yerel JSON state dosyası (yeni infra yok).
 *
 * Opsiyonel ayar (env ZORUNLU DEĞİL, yoksa varsayılan kullanılır):
 *   FRESHNESS_STALE_DAYS (vars. 3)   FRESHNESS_DROP_PCT (vars. 25)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, ".freshness-state.json");

const STALE_DAYS = Number(process.env.FRESHNESS_STALE_DAYS) || 3;
const DROP_PCT = Number(process.env.FRESHNESS_DROP_PCT) || 25;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

// Kaynak tanımları: label → tablo + zaman kolonu + (ops.) source LIKE/eq filtresi.
const SOURCES = [
  { key: "TAX",        table: "tax_delinquent_properties", tsCol: "scraped_at",  like: "TAX:%" },
  { key: "SOCRATA",    table: "tax_delinquent_properties", tsCol: "scraped_at",  like: "SOCRATA:%" },
  { key: "ZILLOW",     table: "tax_delinquent_properties", tsCol: "scraped_at",  like: "ZILLOW%" },
  { key: "competitor", table: "competitor_listings",       tsCol: "scraped_at" },
  { key: "govease",    table: "upcoming_sales",            tsCol: "scraped_at",  eq: "GOVEASE" },
  { key: "offmarket",  table: "offmarket_leads",           tsCol: "updated_at" },
];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isMissing(error) {
  const m = (error && error.message) || "";
  return /schema cache|does not exist|could not find|relation .* does not exist|column .* does not exist/i.test(m);
}

// Bir kaynak için { count, maxTs, missing } döndürür. Hata olursa missing=true.
async function probe(s, db) {
  try {
    // count (head:true → satır taşımadan sadece sayar)
    let cq = db.from(s.table).select("*", { count: "exact", head: true });
    if (s.like) cq = cq.like("source", s.like);
    if (s.eq) cq = cq.eq("source", s.eq);
    const { count, error: cErr } = await cq;
    if (cErr) return { missing: isMissing(cErr), error: cErr.message };

    // en son zaman damgası
    let tq = db.from(s.table).select(s.tsCol).order(s.tsCol, { ascending: false, nullsFirst: false }).limit(1);
    if (s.like) tq = tq.like("source", s.like);
    if (s.eq) tq = tq.eq("source", s.eq);
    const { data: tData, error: tErr } = await tq;
    const maxTs = !tErr && tData && tData[0] ? tData[0][s.tsCol] : null;

    return { count: count ?? 0, maxTs, missing: false };
  } catch (e) {
    return { missing: true, error: String((e && e.message) || e) };
  }
}

function loadPrev() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch { /* bozuk state → boş başla */ }
  return {};
}

function fmtAge(maxTs) {
  if (!maxTs) return "hiç";
  const ms = Date.now() - new Date(maxTs).getTime();
  if (Number.isNaN(ms)) return "?";
  const d = ms / 86400000;
  if (d < 1) return `${Math.max(0, Math.round(ms / 3600000))}sa`;
  return `${d.toFixed(1)}g`;
}

async function main() {
  if (!url || !key) {
    console.log("freshness-check: SUPABASE_URL / SERVICE_ROLE_KEY yok — atlanıyor (no-op).");
    return;
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const prev = loadPrev();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const nextState = {};
  const okLines = [];
  const warnLines = [];

  for (const s of SOURCES) {
    const r = await probe(s, db);
    if (r.missing) {
      // Tablo/kolon yok → kaynağı bilinmiyor say, state'i bozma, uyarı üretme.
      okLines.push(`• ${s.key}: ? (tablo/kolon yok)`);
      if (prev[s.key]) nextState[s.key] = prev[s.key];
      continue;
    }

    const p = prev[s.key];
    const flags = [];

    // STALE: en son veri N günden eski (hiç veri yoksa da stale)
    const ageMs = r.maxTs ? now - new Date(r.maxTs).getTime() : Infinity;
    if (!r.maxTs || ageMs > STALE_MS) flags.push("STALE");

    // DROP: satır sayısı önceki snapshot'a göre >X% düştü
    if (p && typeof p.count === "number" && p.count > 0) {
      const dropPct = ((p.count - r.count) / p.count) * 100;
      if (dropPct > DROP_PCT) flags.push(`DROP -${Math.round(dropPct)}%`);
    }

    const line = `${s.key}: ${r.count.toLocaleString("en-US")} satır · ${fmtAge(r.maxTs)} önce`;
    if (flags.length) warnLines.push(`⚠ ${line} [${flags.join(", ")}]`);
    else okLines.push(`• ${line}`);

    nextState[s.key] = { count: r.count, maxTs: r.maxTs, checkedAt: nowIso };
  }

  // State'i yaz (sonraki koşu için kıyas tabanı). Yazılamazsa sessiz geç.
  try {
    writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2));
  } catch (e) {
    console.error("freshness-check: state yazılamadı:", (e && e.message) || e);
  }

  const header = warnLines.length
    ? `⚠ Terralot kaynak tazeliği — ${warnLines.length} sorun (eşik: ${STALE_DAYS}g / -${DROP_PCT}%)`
    : `✅ Terralot kaynak tazeliği — hepsi taze`;
  const body = [header, ...warnLines, ...okLines].join("\n");

  console.log(body);

  // Telegram (token boşsa sessizce atla — heartbeat ile aynı desen)
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (token && chat && warnLines.length) {
    // Sadece sorun varsa bildir (gürültü yok). Heartbeat zaten "bitti" der.
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: body }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) console.error("freshness-check: Telegram", res.status);
    } catch (e) {
      console.error("freshness-check: Telegram gönderilemedi:", (e && e.message) || e);
    }
  }
}

main().catch((e) => {
  // Asla pipeline'ı düşürme — uyar ama 0 dön.
  console.error("freshness-check: beklenmedik hata:", (e && e.message) || e);
});
