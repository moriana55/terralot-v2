#!/usr/bin/env node
/**
 * KOORDİNAT TAMAMLAMA — NORTH CAROLINA
 *
 * NEDEN (2026-08-12): NC'de 35.9 bin lead'in lat/lng'i yoktu, yani haritada
 * HİÇ görünmüyorlardı. Bunlar gece turunda olmayan ~115 county'den geliyor
 * (gece yalnız Brunswick/Rutherford/Northampton taranıyor); eski bir hasattan
 * kalmışlar ve o hasat geometri almamış.
 *
 * NC OneMap EYALET GENELİ tek katman veriyor ve geometriyi sorunsuz döndürüyor
 * (test edildi) — county county servis aramaya gerek yok. Parsel numarası
 * (`parno`) bizim `apn` alanımızla eşleşiyor.
 *
 * KOORDİNAT ÜRETİLMEZ: eşleşmeyen kayıt null kalır ve sayılır. Poligonun
 * ağırlık merkezi alınır (filtreli-hasat ile aynı yöntem).
 *
 * Kullanım:
 *   node backfill-koordinat-nc.mjs            # tamamı
 *   node backfill-koordinat-nc.mjs --deneme   # ilk 2 parti, YAZMADAN
 *   LIMIT=5000 node backfill-koordinat-nc.mjs # kısıtlı tur
 *
 * Tekrar çalıştırılabilir: yalnız `lat is null` kayıtlar hedeflenir.
 */

import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const KATMAN = "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1/query";
const PARTI = 60;                  // APN / sorgu — where cümlesi çok uzamasın
const LIMIT = Number(process.env.LIMIT || 0) || null;
const DENEME = process.argv.includes("--deneme");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poligon halkasının ağırlık merkezi → [lng, lat]. Üretilmez, geometriden gelir. */
function halkaMerkezi(g) {
  const halka = g?.rings?.[0];
  if (!Array.isArray(halka) || halka.length < 3) return null;
  let sx = 0, sy = 0, n = 0;
  for (const p of halka) {
    if (!Array.isArray(p) || p.length < 2) continue;
    sx += p[0]; sy += p[1]; n++;
  }
  if (!n) return null;
  const lng = sx / n, lat = sy / n;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
}

async function sorgula(apnler) {
  const liste = apnler.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(",");
  const p = new URLSearchParams({
    where: `parno IN (${liste})`,
    outFields: "parno",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
    maxAllowableOffset: "0.0005",
    f: "json",
  });
  for (let deneme = 1; deneme <= 3; deneme++) {
    try {
      const res = await fetch(KATMAN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: p.toString(),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || "arcgis hatası");
      return j.features ?? [];
    } catch (e) {
      if (deneme === 3) throw e;
      await sleep(2000 * deneme);
    }
  }
  return [];
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg boşta hata: ${e.message}`));

  const { rows } = await pool.query(
    `select lead_id, apn from offmarket_leads
      where state='NC' and lat is null and apn is not null and apn <> ''
      order by lead_id ${LIMIT ? `limit ${LIMIT}` : ""}`
  );
  console.log(`koordinatsız NC kaydı: ${rows.length.toLocaleString("tr-TR")}`);
  if (!rows.length) { await pool.end(); return; }

  // Aynı APN birden çok satırda olabilir → tek sorguyla hepsini doldur.
  const apnHaritasi = new Map();
  for (const r of rows) {
    const a = String(r.apn).trim();
    if (!apnHaritasi.has(a)) apnHaritasi.set(a, []);
    apnHaritasi.get(a).push(r.lead_id);
  }
  const apnler = [...apnHaritasi.keys()];
  console.log(`tekil APN: ${apnler.length.toLocaleString("tr-TR")} · parti boyu ${PARTI}`);

  let eslesen = 0, yazilan = 0, hata = 0;
  const t0 = Date.now();
  for (let i = 0; i < apnler.length; i += PARTI) {
    if (DENEME && i >= PARTI * 2) { console.log("--deneme: 2 parti sonrası durdu, YAZILMADI."); break; }
    const dilim = apnler.slice(i, i + PARTI);
    let ozellikler = [];
    try {
      ozellikler = await sorgula(dilim);
    } catch (e) {
      hata++;
      console.warn(`parti ${i / PARTI + 1} atlandı: ${e.message}`);
      continue;
    }

    const guncellemeler = [];
    for (const f of ozellikler) {
      const parno = String(f?.attributes?.parno ?? "").trim();
      const c = halkaMerkezi(f?.geometry);
      if (!parno || !c) continue;
      for (const leadId of apnHaritasi.get(parno) ?? []) {
        guncellemeler.push({ leadId, lng: c[0], lat: c[1] });
      }
    }
    eslesen += guncellemeler.length;

    if (guncellemeler.length && !DENEME) {
      // Tek sorguda toplu güncelleme (satır satır UPDATE ağır kalıyor).
      const degerler = [];
      const yer = guncellemeler.map((g, k) => {
        degerler.push(g.leadId, g.lat, g.lng);
        return `($${k * 3 + 1}, $${k * 3 + 2}::double precision, $${k * 3 + 3}::double precision)`;
      });
      await pool.query(
        `update offmarket_leads o set lat = v.lat, lng = v.lng
           from (values ${yer.join(",")}) as v(lead_id, lat, lng)
          where o.lead_id = v.lead_id and o.lat is null`,
        degerler
      );
      yazilan += guncellemeler.length;
    }

    const gecen = (Date.now() - t0) / 1000;
    const ilerleme = Math.min(i + PARTI, apnler.length);
    process.stdout.write(
      `\rAPN ${ilerleme}/${apnler.length} · eşleşen ${eslesen} · yazılan ${yazilan} · hata ${hata} · ` +
      `${Math.round(ilerleme / (gecen / 60))} APN/dk   `
    );
    await sleep(150);
  }

  console.log(
    `\nbitti: ${eslesen.toLocaleString("tr-TR")} kayıt eşleşti, ` +
    `${yazilan.toLocaleString("tr-TR")} güncellendi, ${hata} parti hata verdi.`
  );
  console.log("eşleşmeyen kayıtların lat'i NULL kaldı — koordinat uydurulmadı.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
