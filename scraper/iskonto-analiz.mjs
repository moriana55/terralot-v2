#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// İSKONTO ANALİZİ — "yatırımcı piyasaya göre ne kadar ucuza alıyor?"
//
//   node scraper/iskonto-analiz.mjs
//
// YÖNTEM: parcel_owners içindeki NİTELİKLİ (kol satışı, QUAL_CD1 01/02) alımları
// alıcı tipine göre ikiye ayırır:
//   • PERAKENDE = alıcı gerçek kişi   → piyasa fiyatı (son kullanıcı ne ödüyor)
//   • TOPTAN    = alıcı tüzel kişi    → yatırımcı ne ödüyor
// Aynı county + aynı DÖNÜM BANDI içinde kıyaslanır. Elmayla elma.
//
// NEDEN BÖYLE: county medyan $/dönümüne kıyaslamak yanıltıcı olurdu, çünkü
// o medyan zaten yatırımcı alımlarını da içeriyor (kendi kendini seyreltir).
// Ayrıca küçük parsel dönüm başına daha pahalıdır — banda ayırmadan kıyas
// yapmak sistematik hata üretir.
//
// ⚠️ SINIR: "tüzel kişi = yatırımcı" varsayımı ev üreticilerini de kapsar;
// onlar inşaat marjını kaptıkları için daha fazla ödeyebilir. Bu yüzden
// üretici/yatırımcı ayrımı ayrıca raporlanır.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";
import { classify, normOwner } from "./rakip-derin-analiz.mjs";

// Dönüm bantları — ABD kırsal arsa pazarının doğal kırılımları.
const BANDS = [
  { ad: "0-0,25 ac", lo: 0.001, hi: 0.25 },
  { ad: "0,25-0,5", lo: 0.25, hi: 0.5 },
  { ad: "0,5-1,5", lo: 0.5, hi: 1.5 },
  { ad: "1,5-5", lo: 1.5, hi: 5 },
  { ad: "5-40", lo: 5, hi: 40 },
];
const MIN_N = 5; // banda güvenmek için her tarafta en az bu kadar işlem

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const usd = (v) => (v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US"));

/** SAF: perakende/toptan medyanlarından iskonto oranı. */
export function iskonto(perakende, toptan) {
  if (!perakende || !toptan || perakende <= 0) return null;
  return 1 - toptan / perakende;
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg: ${e.message}`));

  const { rows } = await pool.query(`
    select county, owner, acres::float8 acres, last_sale_price::float8 fiyat, last_sale_year yil
    from parcel_owners
    where qual_code in ('01','02') and last_sale_price > 1000 and acres > 0`);

  console.log(`nitelikli alım: ${rows.length}\n`);

  // county × bant × alıcı tipi
  const kova = new Map();
  for (const r of rows) {
    const b = BANDS.find((x) => r.acres > x.lo && r.acres <= x.hi);
    if (!b) continue;
    const tip = classify(normOwner(r.owner));
    const grup = tip === "sahis" ? "perakende" : (tip === "uretici" ? "uretici" : "toptan");
    const k = `${r.county}|${b.ad}`;
    if (!kova.has(k)) kova.set(k, { county: r.county, bant: b.ad, perakende: [], toptan: [], uretici: [] });
    kova.get(k)[grup].push(r.fiyat);
  }

  const satirlar = [];
  for (const v of kova.values()) {
    if (v.perakende.length < MIN_N || v.toptan.length < MIN_N) continue;
    const p = med(v.perakende), t = med(v.toptan), u = med(v.uretici);
    satirlar.push({ ...v, p, t, u, isk: iskonto(p, t), nu: v.uretici.length });
  }
  satirlar.sort((a, b) => b.isk - a.isk);

  console.log("COUNTY × DÖNÜM BANDI — PERAKENDE (şahıs alıcı) vs TOPTAN (şirket alıcı)");
  console.log("COUNTY       BANT         PERAKENDE   TOPTAN   İSKONTO   ÜRETİCİ    n(per/top)");
  for (const s of satirlar) {
    console.log("  " + s.county.padEnd(12) + s.bant.padEnd(12) +
      usd(s.p).padStart(10) + usd(s.t).padStart(10) +
      ((s.isk * 100).toFixed(0) + "%").padStart(9) +
      (s.u ? usd(s.u) : "—").padStart(10) +
      `   ${s.perakende.length}/${s.toptan.length}`);
  }

  const gecerli = satirlar.filter((s) => s.isk != null);
  const ortIsk = med(gecerli.map((s) => s.isk));
  console.log(`\nMEDYAN İSKONTO (${gecerli.length} county×bant): %${(ortIsk * 100).toFixed(0)}`);

  // Üretici karşılaştırması — daha mı fazla ödüyorlar?
  const uretVar = satirlar.filter((s) => s.u && s.nu >= MIN_N);
  if (uretVar.length) {
    const uIsk = med(uretVar.map((s) => iskonto(s.p, s.u)));
    console.log(`ÜRETİCİ İSKONTOSU (${uretVar.length} bantta ≥${MIN_N} işlem): %${(uIsk * 100).toFixed(0)}` +
      `  → üretici ${uIsk < ortIsk ? "DAHA FAZLA ödüyor (beklendiği gibi)" : "daha az ödüyor"}`);
  }

  // Bizim teklif stratejimiz için hedef
  console.log("\n═══ BİZİM İÇİN ANLAMI ═══");
  for (const s of satirlar.slice(0, 5)) {
    const hedef = s.t * 0.85; // rakibin ödediğinin %15 altı = kazanan teklif
    console.log(`  ${s.county} ${s.bant}: piyasa ${usd(s.p)} · rakip ${usd(s.t)} · ` +
      `bizim hedef teklif ≈ ${usd(hedef)} (rakibin %15 altı)`);
  }

  await pool.end();
}

if (process.argv[1]?.endsWith("iskonto-analiz.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
