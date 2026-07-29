// ─────────────────────────────────────────────────────────────────────────────
// KAYIP VERİ AVI (ADIM 0) — SALT-OKUNUR TEŞHİS.
// src/data/*.json içindeki her off-market satırını, yedekten okunan
// offmarket_leads anahtar kümesiyle karşılaştırır ve DB'de OLMAYANLARI listeler.
// Hiçbir şey yazmaz/silmez; çıktısı scripts/_gecici/kayip-rapor.json.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";

const KOK = path.resolve(import.meta.dirname, "..");
const YEDEK = process.argv[2] || path.resolve(KOK, "../yedek/2026-07-29/offmarket_leads.ndjson.gz");

const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
// APN'ler kaynaklar arasında tire/boşluk/nokta farkı gösterebiliyor → sadeleştirilmiş anahtar da tutulur.
const apnSade = (s) => norm(s).replace(/[^A-Z0-9]/g, "");

// ── 1) DB anahtar kümeleri (yedek NDJSON'dan) ───────────────────────────────
const leadIds = new Set();
const stateApn = new Set();      // STATE|APN(sade)
const apnGlobal = new Set();     // sadece APN(sade) — eyalet etiketi kaymış olabilir
let dbSatir = 0;
const rl = readline.createInterface({ input: fs.createReadStream(YEDEK).pipe(zlib.createGunzip()) });
for await (const line of rl) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  dbSatir++;
  leadIds.add(norm(r.lead_id));
  const a = apnSade(r.apn);
  if (a) { stateApn.add(`${norm(r.state)}|${a}`); apnGlobal.add(a); }
}
console.log("DB anahtar yüklendi:", dbSatir, "satır ·", stateApn.size, "state|apn ·", apnGlobal.size, "apn");

// ── 2) Statik dosyalar ───────────────────────────────────────────────────────
const dataDir = path.join(KOK, "src/data");
// Off-market satır taşıyan dosyalar: rows dizisi + apn alanı olanlar.
const dosyalar = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

// Dosya adından/meta'dan eyalet çıkarımı (meta.state öncelikli).
const ADDAN_EYALET = { "mohave-offmarket.json": "AZ" };
const ADDAN_COUNTY = { "mohave-offmarket.json": "Mohave" };

const rapor = [];
for (const f of dosyalar) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8")); } catch { continue; }
  const rows = Array.isArray(j) ? j : (Array.isArray(j.rows) ? j.rows : null);
  if (!rows || !rows.length) continue;
  if (!("apn" in rows[0])) continue; // off-market satırı değil (ör. buyuk-oyuncular)

  const metaState = norm(j.state || ADDAN_EYALET[f] || "");
  const metaCounty = j.county || ADDAN_COUNTY[f] || "";

  let eslesen = 0, apnYok = 0;
  const eksikler = [];
  for (const r of rows) {
    const st = norm(r.state || metaState);
    const a = apnSade(r.apn);
    if (!a) { apnYok++; continue; }
    if (stateApn.has(`${st}|${a}`)) { eslesen++; continue; }
    if (process.env.KATI !== "1" && apnGlobal.has(a)) { eslesen++; continue; } // eyalet etiketi farklı ama APN var
    eksikler.push({ apn: r.apn, state: st, county: r.county || metaCounty, region: r.region ?? null });
  }
  rapor.push({
    dosya: f, state: metaState, county: metaCounty,
    satir: rows.length, dbdeVar: eslesen, apnsiz: apnYok, dbdeYok: eksikler.length,
    ornekEksik: eksikler.slice(0, 3),
  });
}

rapor.sort((a, b) => b.dbdeYok - a.dbdeYok);
const toplamSatir = rapor.reduce((s, x) => s + x.satir, 0);
const toplamEksik = rapor.reduce((s, x) => s + x.dbdeYok, 0);
const toplamApnsiz = rapor.reduce((s, x) => s + x.apnsiz, 0);

fs.writeFileSync(path.join(KOK, "scripts/_gecici/kayip-rapor.json"), JSON.stringify({ dbSatir, toplamSatir, toplamEksik, toplamApnsiz, rapor }, null, 2));

console.log("\n=== KAYIP VERİ RAPORU ===");
console.log("Statik toplam satır:", toplamSatir, "| DB'de YOK:", toplamEksik, "| APN'siz:", toplamApnsiz);
console.log("\nDB'de eksiği olan dosyalar:");
for (const r of rapor) if (r.dbdeYok > 0) console.log(`  ${r.dosya.padEnd(34)} ${String(r.state).padEnd(3)} satir=${String(r.satir).padEnd(7)} eksik=${r.dbdeYok}`);
console.log("\nTam eşleşen dosya sayısı:", rapor.filter((r) => r.dbdeYok === 0).length, "/", rapor.length);
