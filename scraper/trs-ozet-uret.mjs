#!/usr/bin/env node
/**
 * TRS (Township-Range-Section) ÖZET ÜRETİCİ — "APN + TRS Doğrulama" sayfası için.
 *
 * Girdi: tam Mohave County parsel dökümü (269K satır, layer 38'in ArcGIS'ten
 * CSV export'u). Bu dosya GEÇİCİ/yerel — repo'da DEĞİL (~160MB). Varsayılan yol
 * /tmp/mohave-parcel38.csv; env INPUT ile değiştirilebilir. Yoksa script hata
 * verip çıkar (build/test'i BOZMAZ — trs-ozet.json zaten commit'li, script'i
 * tekrar çalıştırmak isteyen elle indirir).
 *
 * Çıktı: dashboard/src/data/trs-ozet.json — her TRS için önceden hesaplanmış:
 *   toplam/boş parsel sayısı, absentee (eyalet-dışı sahip) sayısı+oranı,
 *   medyan acre + medyan arazi değeri, en çok parselli 5 sahip, son 10 satış,
 *   + bizim 20K off-market lead havuzundan (mohave-offmarket.json) bu TRS'e
 *   düşen lead sayısı (leadPoolCount).
 *
 * Kullanım:
 *   node scraper/trs-ozet-uret.mjs
 *   INPUT=/path/to/parcel38.csv node scraper/trs-ozet-uret.mjs
 */

import { createReadStream, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deedParcelCount, unitPriceEstimate } from "./lib/deed-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const INPUT = process.env.INPUT || "/tmp/mohave-parcel38.csv";
const OUT = resolve(ROOT, "dashboard/src/data/trs-ozet.json");
const OFFMARKET = resolve(ROOT, "dashboard/src/data/mohave-offmarket.json");

if (!existsSync(INPUT)) {
  console.error(`[trs-ozet-uret] Girdi CSV bulunamadı: ${INPUT}`);
  console.error("Mohave County ParcelQueryLayer (layer 38) tam parsel export'unu bu yola koyun,");
  console.error("ya da INPUT=... ile başka bir yol verin. (trs-ozet.json zaten commit'li; bu");
  console.error("script sadece veriyi TAZELEMEK için gerekir.)");
  process.exit(1);
}

/** Basit RFC4180-benzeri CSV satır ayrıştırıcı — tırnaklı alan içindeki virgülü korur. */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** "26n 19w 31", " 26N  19W 31 " gibi varyasyonları kanonik "26N 19W 31" biçimine indirger. */
export function normalizeTrs(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const rl = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });
  let header = null;
  const idx = {};
  let rowNum = 0;

  /** @type {Map<string, { total:number, vacant:number, absentee:number, acres:number[], landValues:number[], owners:Map<string,number>, sales:{apn:string,owner:string,salep:number,saledt:string,recptno:string}[] }>} */
  const byTrs = new Map();

  // PAKET TAPU (bulk deed) düzeltmesi: RECPTNO -> parsel sayısı, tam CSV'nin
  // TAMAMINDA (TRS'ler arası da paylaşılabilir) — tek geçişte biriktirilir,
  // recentSales üretiminde (döngü bittikten SONRA) kullanılır.
  const recptnoCounts = new Map();

  for await (const line of rl) {
    rowNum++;
    if (rowNum === 1) {
      header = parseCsvLine(line).map((h) => h.replace(/^﻿/, ""));
      header.forEach((h, i) => { idx[h] = i; });
      continue;
    }
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const trs = normalizeTrs(f[idx.TWN_RNG_SEC]);
    if (!trs) continue;

    let bucket = byTrs.get(trs);
    if (!bucket) {
      bucket = { total: 0, vacant: 0, absentee: 0, acres: [], landValues: [], owners: new Map(), sales: [] };
      byTrs.set(trs, bucket);
    }
    bucket.total++;

    const impv = Number(f[idx.IMPVALUE]) || 0;
    if (impv === 0) bucket.vacant++;

    const state = (f[idx.STATE] || "").trim().toUpperCase();
    if (state && state !== "AZ") bucket.absentee++;

    const acres = Number(f[idx.PARCEL_SIZE]);
    if (Number.isFinite(acres) && acres > 0) bucket.acres.push(acres);

    const landValue = Number(f[idx.LANDVALUE]);
    if (Number.isFinite(landValue) && landValue >= 0) bucket.landValues.push(landValue);

    const owner = (f[idx.OWNER] || "").trim();
    if (owner) bucket.owners.set(owner, (bucket.owners.get(owner) || 0) + 1);

    const recptno = (f[idx.RECPTNO] || "").trim();
    if (recptno) recptnoCounts.set(recptno, (recptnoCounts.get(recptno) || 0) + 1);

    const salep = Number(f[idx.SALEP]);
    const saledt = f[idx.SALEDT];
    if (Number.isFinite(salep) && salep > 0 && saledt) {
      bucket.sales.push({ apn: f[idx.PARCEL] || "", owner, salep, saledt, recptno });
    }
  }

  // Bizim 20K off-market lead havuzundan TRS başına kaç lead düştüğünü say.
  const leadPoolByTrs = new Map();
  if (existsSync(OFFMARKET)) {
    const parsed = JSON.parse(readFileSync(OFFMARKET, "utf8"));
    const rows = parsed?.rows ?? [];
    for (const r of rows) {
      const trs = normalizeTrs(r.twn_rng_sec);
      if (!trs) continue;
      leadPoolByTrs.set(trs, (leadPoolByTrs.get(trs) || 0) + 1);
    }
  }

  const out = {};
  for (const [trs, b] of byTrs) {
    const topOwners = [...b.owners.entries()]
      .sort((a, b2) => b2[1] - a[1])
      .slice(0, 5)
      .map(([owner, count]) => ({ owner, count }));

    const recentSales = [...b.sales]
      .filter((s) => !Number.isNaN(Date.parse(s.saledt)))
      .sort((a, c) => Date.parse(c.saledt) - Date.parse(a.saledt))
      .slice(0, 10)
      .map((s) => {
        const count = deedParcelCount(s.recptno, recptnoCounts);
        return {
          apn: s.apn,
          owner: s.owner,
          salep: s.salep,
          saledt: s.saledt,
          deedParcelCount: count,
          birimFiyatTahmini: unitPriceEstimate(s.salep, count),
        };
      });

    out[trs] = {
      trs,
      total: b.total,
      vacant: b.vacant,
      absentee: b.absentee,
      absenteePct: b.total > 0 ? Math.round((b.absentee / b.total) * 1000) / 10 : 0,
      medianAcres: median(b.acres),
      medianLandValue: median(b.landValues),
      topOwners,
      recentSales,
      leadPoolCount: leadPoolByTrs.get(trs) || 0,
    };
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), source: `${INPUT} (Mohave County ParcelQueryLayer, layer 38, tam döküm)`, trsCount: Object.keys(out).length, trs: out },
      null,
      0,
    ),
  );
  console.log(`[trs-ozet-uret] ${Object.keys(out).length} TRS yazıldı → ${OUT}`);
}

main().catch((err) => {
  console.error("[trs-ozet-uret] hata:", err);
  process.exit(1);
});
