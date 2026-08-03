#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// COSTILLA (CO) KOORDİNAT BACKFILL
//
// SORUN: `offmarket-co-costilla.mjs` ArcGIS'e `returnGeometry:"false"` ile sorup
// parselleri geometrisiz çekmiş. Sonuç: Costilla'nın 33.153 kaydının yalnız
// 3.184'ünde lat/lng var. Koordinatsız kayıt:
//   • haritada nokta olarak çıkmaz,
//   • geo-enrich (yol/elektrik/su) hiç dokunamaz → B tavanında kalır,
//   • yani A+/A vitrine asla giremez.
//
// ÇÖZÜM: Aynı ArcGIS katmanını bu kez GEOMETRİYLE sor, poligonun ağırlık
// merkezini hesapla, APN eşleşmesiyle offmarket_leads'e yaz.
// Katman zaten WGS84 (wkid 4326) döndürüyor — projeksiyon dönüşümü gerekmiyor.
//
// Merkez hesabı: dış halkanın ALAN AĞIRLIKLI centroid'i (basit köşe ortalaması
// değil — düzensiz parsellerde köşe ortalaması merkezi kaydırır). Dejenere
// poligonda (alan 0) köşe ortalamasına düşer.
//
// Çalıştır:  node scraper/backfill-koordinat-costilla.mjs
//            KURU=1 node scraper/backfill-koordinat-costilla.mjs   (yazmadan dene)
// Tekrar çalıştırılabilir; yalnız lat IS NULL olan kayıtlara yazar.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const LAYER = "https://services7.arcgis.com/qznFlX1g8SfaPebZ/arcgis/rest/services/Costilla_County_FGDB_May_Update/FeatureServer/8/query";
const PAGE = 1000;
const KURU = process.env.KURU === "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Alan ağırlıklı poligon centroid'i (kabuk formülü). Halka WGS84 derece.
function centroid(rings) {
  const ring = rings?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i];
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) return null;
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) {
    // Dejenere/çizgi parsel — köşe ortalamasına düş.
    const n = ring.length;
    const sx = ring.reduce((s, p) => s + p[0], 0) / n;
    const sy = ring.reduce((s, p) => s + p[1], 0) / n;
    return Number.isFinite(sx) && Number.isFinite(sy) ? [sy, sx] : null;
  }
  a *= 0.5;
  return [cy / (6 * a), cx / (6 * a)]; // [lat, lng]
}

async function sayfa(offset) {
  const p = new URLSearchParams({
    where: "1=1",
    outFields: "ParcelNum",
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "ParcelNum ASC",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: "json",
  });
  for (let d = 0; d < 4; d++) {
    try {
      const r = await fetch(`${LAYER}?${p}`, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || "ArcGIS error");
      return j.features ?? [];
    } catch (e) {
      if (d === 3) throw e;
      await sleep(2000 * (d + 1));
    }
  }
}

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();

const eksik = (await client.query(
  `select count(*)::int n from offmarket_leads where state='CO' and county='Costilla' and lat is null`
)).rows[0].n;
console.log(`koordinatsız Costilla kaydı: ${eksik.toLocaleString("en-US")}`);
if (!eksik) { await client.end(); console.log("yapacak iş yok."); process.exit(0); }

// APN → [lat,lng] haritası (ArcGIS'ten tam katman taranır; katman ~50K parsel).
console.log("ArcGIS taranıyor (geometriyle)…");
const konum = new Map();
let offset = 0, bosGeometri = 0;
for (;;) {
  const f = await sayfa(offset);
  if (!f.length) break;
  for (const x of f) {
    const apn = String(x.attributes?.ParcelNum ?? "").trim();
    if (!apn) continue;
    const c = centroid(x.geometry?.rings);
    if (!c) { bosGeometri++; continue; }
    const [lat, lng] = c;
    // Costilla County kabaca 37.0-37.6 N, -105.7..-105.0 W — kaba akıl kontrolü.
    if (lat < 36.5 || lat > 38.2 || lng < -106.5 || lng > -104.5) { bosGeometri++; continue; }
    konum.set(apn, [lat, lng]);
  }
  offset += f.length;
  if (offset % 10000 === 0) console.log(`  ${offset.toLocaleString("en-US")} parsel…`);
  if (f.length < PAGE) break;
  await sleep(200);
}
console.log(`  geometrili parsel: ${konum.size.toLocaleString("en-US")} · atlanan: ${bosGeometri}`);

// Yazılacak kayıtlar
const hedef = (await client.query(
  `select lead_id, apn from offmarket_leads where state='CO' and county='Costilla' and lat is null and apn is not null`
)).rows;

const yaz = [];
let eslesmeyen = 0;
for (const r of hedef) {
  const k = konum.get(String(r.apn).trim());
  if (!k) { eslesmeyen++; continue; }
  yaz.push({ id: r.lead_id, lat: k[0], lng: k[1] });
}
console.log(`eşleşen: ${yaz.length.toLocaleString("en-US")} · APN karşılığı bulunamayan: ${eslesmeyen.toLocaleString("en-US")}`);

if (KURU) {
  console.log("KURU=1 — yazılmadı. Örnek:", yaz.slice(0, 3));
  await client.end();
  process.exit(0);
}

// Toplu update — unnest ile tek sorguda parti parti.
let yazildi = 0;
for (let i = 0; i < yaz.length; i += 2000) {
  const p = yaz.slice(i, i + 2000);
  await client.query(
    `update offmarket_leads o set lat = v.lat, lng = v.lng
     from (select unnest($1::text[]) id, unnest($2::float8[]) lat, unnest($3::float8[]) lng) v
     where o.lead_id = v.id and o.lat is null`,
    [p.map((x) => x.id), p.map((x) => x.lat), p.map((x) => x.lng)]
  );
  yazildi += p.length;
  console.log(`  yazıldı ${yazildi.toLocaleString("en-US")}/${yaz.length.toLocaleString("en-US")}`);
}

const kalan = (await client.query(
  `select count(*)::int n from offmarket_leads where state='CO' and county='Costilla' and lat is null`
)).rows[0].n;
await client.end();

console.log(`\n✔ bitti. Costilla koordinatsız: ${eksik.toLocaleString("en-US")} → ${kalan.toLocaleString("en-US")}`);
console.log("Sonra: node scraper/export-map-points.mjs (harita) + geo-enrich turu (not tavanı kalksın)");
