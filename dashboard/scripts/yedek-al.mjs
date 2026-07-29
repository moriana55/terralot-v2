// ─────────────────────────────────────────────────────────────────────────────
// YEDEK AL — herhangi bir DB yazımından ÖNCE çalıştırılır.
// offmarket_leads tablosunun TAMAMINI NDJSON(gzip) olarak diske yazar; yanına
// satır sayısı + eyalet/county kırılımını JSON koyar.
// SALT-OKUNUR: hiçbir DELETE/DROP/TRUNCATE yok.
// Sayfalama keyset (lead_id > son) — derin OFFSET Postgres'te zaman aşımına uğruyor.
// Kullanım: node scripts/yedek-al.mjs [YYYY-AA-GG]
// ─────────────────────────────────────────────────────────────────────────────
import { sb } from "./_gecici/db.mjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const TARIH = process.argv[2] || new Date().toISOString().slice(0, 10);
const DIZIN = path.resolve(import.meta.dirname, "../../yedek", TARIH);
fs.mkdirSync(DIZIN, { recursive: true });

const { count: toplam } = await sb.from("offmarket_leads").select("*", { count: "exact", head: true });
console.log("Yedeklenecek satır:", toplam);

const gz = zlib.createGzip();
const out = fs.createWriteStream(path.join(DIZIN, "offmarket_leads.ndjson.gz"));
gz.pipe(out);

const SAYFA = 2000;
let imlec = "", yazilan = 0;
const byState = {}, byStateCounty = {}, bySource = {};

for (;;) {
  let q = sb.from("offmarket_leads").select("*").order("lead_id", { ascending: true }).limit(SAYFA);
  if (imlec) q = q.gt("lead_id", imlec);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (!data.length) break;
  for (const r of data) {
    if (!gz.write(JSON.stringify(r) + "\n")) await new Promise((res) => gz.once("drain", res));
    const st = r.state ?? "(bos)", co = r.county ?? "(bos)";
    byState[st] = (byState[st] || 0) + 1;
    byStateCounty[`${st}|${co}`] = (byStateCounty[`${st}|${co}`] || 0) + 1;
    bySource[r.source ?? "(bos)"] = (bySource[r.source ?? "(bos)"] || 0) + 1;
  }
  imlec = data[data.length - 1].lead_id;
  yazilan += data.length;
  if (yazilan % 50000 < SAYFA) console.log("  ...", yazilan);
}
gz.end();
await new Promise((res) => out.on("close", res));

const ozet = {
  tarih: new Date().toISOString(),
  tablo: "offmarket_leads",
  toplamSatir: toplam,
  yedeklenenSatir: yazilan,
  eyaletSayisi: Object.keys(byState).length,
  stateCountySayisi: Object.keys(byStateCounty).length,
  byState: Object.fromEntries(Object.entries(byState).sort((a, b) => b[1] - a[1])),
  byStateCounty: Object.fromEntries(Object.entries(byStateCounty).sort((a, b) => b[1] - a[1])),
  bySource: Object.fromEntries(Object.entries(bySource).sort((a, b) => b[1] - a[1])),
};
fs.writeFileSync(path.join(DIZIN, "offmarket_leads-ozet.json"), JSON.stringify(ozet, null, 2));
console.log("YEDEK TAMAM:", yazilan, "satır →", DIZIN);
console.log("Eyalet:", ozet.eyaletSayisi, "| state|county:", ozet.stateCountySayisi);
