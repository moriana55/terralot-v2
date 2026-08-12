#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET NOT MOTORU — 565K offmarket_leads kaydını A+..F puanlar.
//
//   node scraper/grade-offmarket.mjs
//
// Akış: yardımcı verileri çek (rakip likidite, county growth, sahip kümeleri,
// vergi borçluları) → tüm lead'leri sayfalayarak çek → lokal skorla
// (lib/grade-core.mjs, saf) → percentile eşikleri → harf notu → batch UPDATE.
// IDEMPOTENT: skor+not değişmeyen satır atlanır; tekrar çalıştırılabilir.
// Geo-zenginleştirme (geo-enrich-offmarket.mjs) sonrası TEKRAR çalıştırılır —
// dist_* kolonları dolu kayıtlar cazibe puanını gerçek mesafelerden alır.
// Önce kolonlar: psql -f scraper/sql/offmarket_grades.sql
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { scoreLead, buildScopedThresholds, assignGrade, normCounty } from "./lib/grade-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// DATABASE_URL: dashboard/.env.local'dan; pooler aws-0→aws-1 + pgbouncer param sil
// (2026-07-22'de doğrulanan bağlantı yolu).
export function dbUrl() {
  const env = readFileSync(resolve(__dirname, "../dashboard/.env.local"), "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL bulunamadı (dashboard/.env.local)");
  return m[1].trim().replace("aws-0-", "aws-1-").replace(/\?pgbouncer=true.*$/, "");
}

// Rakip verisindeki eyalet alanı bazen tam ad ("Arizona"), bazen kısaltma.
const STATE_ABBR = {
  ALABAMA: "AL", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO",
  FLORIDA: "FL", GEORGIA: "GA", MICHIGAN: "MI", MISSOURI: "MO", NEVADA: "NV",
  "NEW MEXICO": "NM", "NORTH CAROLINA": "NC", OKLAHOMA: "OK", OREGON: "OR",
  "SOUTH CAROLINA": "SC", TENNESSEE: "TN", TEXAS: "TX",
};
function normSt(s) {
  const t = String(s ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(t)) return t;
  for (const [name, ab] of Object.entries(STATE_ABBR)) if (t.startsWith(name)) return ab;
  return null;
}
const normC = (c) =>
  String(c ?? "").toUpperCase().replace(/,\s*[A-Z]{2}$/, "").replace(/\s+COUNTY$/, "").trim();
const median = (a) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

async function buildContext(client) {
  // 1) Rakip likiditesi — county + eyalet $/acre medyanı (GERÇEK ilanlardan).
  const comp = await client.query(
    "select state, county, price, acres from competitor_listings where price > 0"
  );
  const byCounty = new Map(); // "ST|COUNTY" → [ppa | NaN]
  const byState = new Map();
  for (const r of comp.rows) {
    const st = normSt(r.state);
    if (!st) continue;
    const a = Number(r.acres);
    const ppa = a > 0 ? Number(r.price) / a : NaN;
    const cKey = `${st}|${normC(r.county)}`;
    if (!byCounty.has(cKey)) byCounty.set(cKey, []);
    if (!byState.has(st)) byState.set(st, []);
    byCounty.get(cKey).push(ppa);
    byState.get(st).push(ppa);
  }
  const finish = (m) => {
    const out = new Map();
    for (const [k, arr] of m) {
      const clean = arr.filter(Number.isFinite);
      out.set(k, { n: arr.length, medPpa: clean.length >= 2 ? median(clean) : null });
    }
    return out;
  };
  const liquidity = finish(byCounty);
  const stateLiq = finish(byState);

  // 2) County nüfus büyümesi (Census tabanlı — scraper/data/county_growth.json).
  const growth = new Map();
  try {
    const gj = JSON.parse(readFileSync(resolve(__dirname, "data/county_growth.json"), "utf8"));
    for (const [k, v] of Object.entries(gj)) {
      const [st, cname] = k.split("/");
      growth.set(`${st}|${normC(cname)}`, v);
    }
  } catch { console.warn("uyarı: county_growth.json okunamadı — büyüme puanı atlanır"); }

  // 3) Sahip kümeleri — aynı sahip+posta adresinde 5+ parsel (toplu anlaşma).
  const clusters = await client.query(`
    select upper(trim(owner)) o, upper(trim(coalesce(mailing_address,''))) m, count(*) n
    from offmarket_leads where owner is not null
    group by 1,2 having count(*) >= 5`);
  const ownerCluster = new Map(clusters.rows.map((r) => [`${r.o}|${r.m}`, Number(r.n)]));

  // 4) Vergi borçluları — APN ve sahip adı eşleşmesi (aynı eyalet).
  const tdp = await client.query("select state, apn, owner_name from tax_delinquent_properties");
  const taxDelinq = new Set();
  for (const r of tdp.rows) {
    const st = normSt(r.state);
    if (!st) continue;
    if (r.apn) taxDelinq.add(`${st}|APN|${String(r.apn).toUpperCase()}`);
    const o = String(r.owner_name ?? "").toUpperCase().trim();
    if (o.length >= 8) taxDelinq.add(`${st}|OWN|${o}`); // kısa/generic ad = riskli eşleşme, alma
  }

  console.log(
    `bağlam: rakip county=${liquidity.size} eyalet=${stateLiq.size} · growth=${growth.size} · sahip kümesi=${ownerCluster.size} · vergi anahtarı=${taxDelinq.size}`
  );
  return { liquidity, stateLiq, growth, ownerCluster, taxDelinq };
}

const COLS = `lead_id, state, county, region, apn, owner, mailing_address, mailing_state,
  phone,
  situs, acres, land_value, est_offer, est_retail, est_margin, absentee,
  dist_road_m, dist_power_m, dist_water_m, dist_town_m, geo_enriched_at,
  grade, grade_score, grade_reason, (grade_breakdown is not null) as has_breakdown`;

async function main() {
  const client = new pg.Client({ connectionString: dbUrl() });
  await client.connect();
  const ctx = await buildContext(client);

  // ── Tüm lead'leri keyset sayfalamayla çek + skorla.
  // ineligible (garbage-in): grade=null + grade_reason; F verilmez.
  const results = []; // { id, st, county, score, flags, cap, breakdown, reason, old* }
  let last = "";
  const PAGE = 20000;
  for (;;) {
    const { rows } = await client.query(
      `select ${COLS} from offmarket_leads where lead_id > $1 order by lead_id limit ${PAGE}`,
      [last]
    );
    if (!rows.length) break;
    for (const r of rows) {
      const st = String(r.state ?? "").toUpperCase();
      const { score, flags, grade_cap, breakdown, ineligible } = scoreLead(r, ctx);
      results.push({
        id: r.lead_id, st, county: normCounty(st, r.county, r.region),
        score, flags, cap: grade_cap, breakdown,
        reason: ineligible?.reason ?? null,
        oldGrade: r.grade, oldScore: r.grade_score == null ? null : Number(r.grade_score),
        oldReason: r.grade_reason ?? null, hasBreakdown: r.has_breakdown === true,
      });
    }
    last = rows[rows.length - 1].lead_id;
    process.stdout.write(`\rskorlandı: ${results.length}`);
  }
  console.log("");

  // ── NORMALİZASYON: county-içi (yoksa eyalet, yoksa global) percentile eşikleri.
  const eligible = results.filter((r) => r.reason == null);
  const scoped = buildScopedThresholds(eligible.map((r) => ({ st: r.st, county: r.county, score: r.score })));
  console.log(`eşik kapsamı: county=${scoped.countyN} eyalet=${scoped.stateN} (+global fallback) · N/A=${results.length - eligible.length}`);
  const updates = [];
  for (const r of results) {
    const grade = r.reason != null ? null : assignGrade(r.score, scoped.resolve(r.st, r.county), r.cap);
    // idempotent atla — breakdown'ı olmayan eski satır atlanmaz (açıklanabilirlik backfill'i)
    const bdOk = r.reason != null ? true : r.hasBreakdown;
    if (r.oldGrade === grade && r.oldScore === r.score && r.oldReason === r.reason && bdOk) continue;
    updates.push({ id: r.id, grade, score: r.score, flags: r.flags, reason: r.reason, breakdown: r.breakdown });
  }
  console.log(`güncellenecek: ${updates.length} / ${results.length}`);

  // ── Batch UPDATE (VALUES join) — 2000 satır/istek.
  const B = 2000;
  for (let i = 0; i < updates.length; i += B) {
    const part = updates.slice(i, i + B);
    const vals = [];
    const params = [];
    part.forEach((u, j) => {
      const o = j * 6;
      vals.push(`($${o + 1}, $${o + 2}, $${o + 3}::numeric, $${o + 4}::jsonb, $${o + 5}, $${o + 6}::jsonb)`);
      params.push(u.id, u.grade, u.score, JSON.stringify(u.flags), u.reason, u.breakdown ? JSON.stringify(u.breakdown) : null);
    });
    await client.query(
      `update offmarket_leads l set grade = v.g, grade_score = v.s, grade_flags = v.f,
         grade_reason = v.r, grade_breakdown = v.b
       from (values ${vals.join(",")}) as v(id, g, s, f, r, b) where l.lead_id = v.id`,
      params
    );
    process.stdout.write(`\rgüncellendi: ${Math.min(i + B, updates.length)} / ${updates.length}`);
  }
  console.log("");

  // ── Özet tabloyu tazele (UI RPC'si buradan okur — offmarket_grade_matrix).
  await client.query(`begin;
    delete from offmarket_grade_summary;
    insert into offmarket_grade_summary(state, grade, n, geo_n)
      select state, grade, count(*), count(*) filter (where geo_enriched_at is not null)
      from offmarket_leads group by 1,2;
    commit;`);

  // ── Özet: eyalet × not dağılımı (N/A = grade null, derecelendirilemedi).
  const dist = await client.query("select state, grade, n from offmarket_grade_summary");
  const grades = ["A+", "A", "B", "C", "D", "F", "N/A"];
  const byState = new Map();
  for (const r of dist.rows) {
    if (!byState.has(r.state)) byState.set(r.state, {});
    byState.get(r.state)[r.grade ?? "N/A"] = Number(r.n);
  }
  console.log("\nEYALET × NOT DAĞILIMI");
  console.log(["ST", ...grades, "toplam"].map((s) => String(s).padStart(8)).join(""));
  const tot = {};
  for (const [st, g] of [...byState.entries()].sort()) {
    const row = grades.map((x) => g[x] ?? 0);
    grades.forEach((x, i) => (tot[x] = (tot[x] ?? 0) + row[i]));
    console.log([st, ...row, row.reduce((a, b) => a + b, 0)].map((s) => String(s).padStart(8)).join(""));
  }
  console.log(["TOP", ...grades.map((x) => tot[x] ?? 0), results.length].map((s) => String(s).padStart(8)).join(""));

  await client.end();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
