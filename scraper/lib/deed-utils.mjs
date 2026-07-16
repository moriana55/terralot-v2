#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// PAKET TAPU (TOPLU/BULK DEED) YARDIMCILARI — paylaşılan saf hesaplama + CSV tarama.
//
// SORUN: Mohave County assessor verisinde, aynı RECPTNO (tapu kayıt no) birden
// fazla parseli kapsayan bir "paket/bulk deed" ise, county o RECPTNO'nun
// TOPLAM satış fiyatını (SALEP) HER parselin satırına AYNI şekilde yazıyor.
// Örnek (doğrulanmış): APN 308-22-040 (SIMPLE FOODS LLC), RECPTNO 2020059875,
// SALEP $35.000 — ama aynı RECPTNO'ya bağlı 6 parsel var, yani gerçek
// parsel-başı fiyat ~$5.833 (35000/6), $35.000 DEĞİL.
//
// Bu modül:
//   - RECPTNO -> parsel sayısı haritası çıkarır (tam county CSV taraması).
//   - deedParcelCount(recptno, counts): kayıt sayısı (boş/null RECPTNO -> 1,
//     yani tekil kayıt kabul edilir — bulgu yapay şişirilmez).
//   - unitPriceEstimate(salep, deedParcelCount): SALEP / deedParcelCount.
//
// Saf hesaplama fonksiyonları (deedParcelCount, unitPriceEstimate) network/fs
// İÇERMEZ — birim test edilebilir. computeRecptnoCounts tek fs-bağımlı
// fonksiyondur (tam CSV taraması).
// ─────────────────────────────────────────────────────────────────────────────

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

/** Basit ama tırnak-içi virgülleri doğru işleyen CSV satır ayrıştırıcı (RFC4180-benzeri). */
export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Belirtilen CSV'yi tek geçişte tarar, RECPTNO kolonundaki her DEĞER için kaç
 * satırda (parselde) geçtiğini sayar. Boş RECPTNO satırları sayılmaz (tekil
 * kayıt varsayımı zaten deedParcelCount() içinde "boş -> 1" ile ele alınır).
 *
 * @param {string} csvPath
 * @param {string} [recptnoCol="RECPTNO"]
 * @returns {Promise<Map<string, number>>}
 */
export async function computeRecptnoCounts(csvPath, recptnoCol = "RECPTNO") {
  const counts = new Map();
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity });
  let header = null;
  let idx = -1;
  for await (const raw of rl) {
    if (!raw) continue;
    if (!header) {
      header = parseCsvLine(raw.replace(/^﻿/, ""));
      idx = header.indexOf(recptnoCol);
      continue;
    }
    if (idx < 0) continue;
    const row = parseCsvLine(raw);
    const rec = (row[idx] || "").trim();
    if (!rec) continue;
    counts.set(rec, (counts.get(rec) || 0) + 1);
  }
  return counts;
}

/**
 * Bir RECPTNO'ya bağlı parsel sayısı. Boş/null RECPTNO -> 1 (tekil kayıt
 * kabul edilir — county'de bazı satırlarda kayıt no boş olabiliyor, bunu
 * "paket" gibi yorumlamak yanlış olur).
 * @param {string | null | undefined} recptno
 * @param {Map<string, number>} counts
 * @returns {number}
 */
export function deedParcelCount(recptno, counts) {
  const r = (recptno ?? "").toString().trim();
  if (!r) return 1;
  const n = counts?.get?.(r);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Parsel başına tahmini birim fiyat = SALEP / deedParcelCount.
 * SALEP geçersiz/sıfır/negatifse null döner (uydurma yok).
 * @param {number | string | null | undefined} salep
 * @param {number} count
 * @returns {number | null}
 */
export function unitPriceEstimate(salep, count) {
  const s = typeof salep === "number" ? salep : Number(salep);
  if (!Number.isFinite(s) || s <= 0) return null;
  const c = Number.isFinite(count) && count > 0 ? count : 1;
  return Math.round((s / c) * 100) / 100;
}
