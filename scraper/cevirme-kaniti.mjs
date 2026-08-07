#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ÇEVİRME KANITI — "kaça aldılar, kaça sattılar?" (FL, boş arsa)
//
//   node scraper/cevirme-kaniti.mjs            # rapor + CSV
//
// FL kadastro katmanı her parselin SON İKİ satışını taşıyor (SALE_PRC1/2,
// SALE_YR1/2, SALE_MO1/2, QUAL_CD1/2, VI_CD1/2). İkisi de gerçek piyasa satışı
// olan parseller = aynı arsanın ALIM ve SATIM fiyatı yan yana.
//
// ── ÜÇ TUZAK (üçü de ölçülerek bulundu, varsayım değil) ─────────────────────
// 1) SIRA GARANTİ DEĞİL: "1 = en son satış" YANLIŞ. Canlı örnek: SALE_YR1=2024,
//    SALE_YR2=2025 — ikinci slot daha yeni. Alım/satım YIL+AY ile sıralanır.
// 2) QUAL KODU: 11 = quit-claim / vergi tapusu / düzeltme tapusu; oradaki
//    rakam piyasa bedeli DEĞİL. Mohave ve Gokce'de tam bu yüzden yanıldık.
//    Yalnız İKİ satışı da '01' (qualified) olan parsel alınır.
// 3) BOŞ ARSA: yılları FARKLI olan çiftler neredeyse tamamen VI='I' (üzerinde
//    ev var) çıkıyor. Boş arsada (VI='V') iki satış AYNI YIL içinde oluyor —
//    yani arsa yatırımcısı yıllarca tutmuyor, aynı yıl çeviriyor. Bu yüzden
//    "yıl farkı" şartı KOYULMAZ; ay farkı elde tutma süresini verir.
//
// Rapor rakip firma adı vermez — kim olduğu tapu adından çıkmaz, çıkarmaya
// çalışmak iki kez elimizde patladı. Söylediği tek şey: bu county'de boş arsa
// şu sürede şu çarpanla el değiştiriyor.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { FL_COUNTY } from "./satis-kaniti.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CIKTI = resolve(HERE, "..", "deliverables");
const URL_FL = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query";
const SAYFA = 500; // 2000 boş gövde döndürüyordu (servis ağır sorguda kesiyor)
const MIN_ORNEK = 5;

const med = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * SAF: iki satış slotundan ALIM ve SATIM ayrımı. Yıl, eşitse ay ile sıralanır.
 * Aynı yıl VE aynı ay ise sıra belirsizdir → null (uydurma sıralama yapma).
 */
export function alimSatim(a) {
  const s1 = { yil: a.SALE_YR1, ay: a.SALE_MO1 ?? 0, fiyat: a.SALE_PRC1 };
  const s2 = { yil: a.SALE_YR2, ay: a.SALE_MO2 ?? 0, fiyat: a.SALE_PRC2 };
  if (s1.yil === s2.yil && s1.ay === s2.ay) return null;
  const [alim, satim] = (s1.yil < s2.yil || (s1.yil === s2.yil && s1.ay < s2.ay)) ? [s1, s2] : [s2, s1];
  if (!(alim.fiyat > 0) || !(satim.fiyat > 0)) return null;
  const ayFark = (satim.yil - alim.yil) * 12 + (satim.ay - alim.ay);
  return { alim, satim, carpan: satim.fiyat / alim.fiyat, ayFark };
}

async function sayfaCek(offset) {
  const p = new URLSearchParams({
    where: "QUAL_CD1 = '01' AND QUAL_CD2 = '01' AND VI_CD1 = 'V' AND VI_CD2 = 'V' AND SALE_PRC1 > 1000 AND SALE_PRC2 > 1000 AND SALE_YR1 >= 2020 AND SALE_YR2 >= 2020",
    outFields: "CO_NO,PARCEL_ID,SALE_PRC1,SALE_YR1,SALE_MO1,SALE_PRC2,SALE_YR2,SALE_MO2,LND_SQFOOT",
    returnGeometry: "false", resultOffset: String(offset), resultRecordCount: String(SAYFA), f: "json",
  });
  // Servis ağır sorguda BOŞ GÖVDE döndürebiliyor (JSON.parse patlıyordu) —
  // metin olarak al, çözülemezse geri çekilip tekrar dene.
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      const r = await fetch(`${URL_FL}?${p}`, { signal: AbortSignal.timeout(180000) });
      const t = await r.text();
      if (!t.trim()) throw new Error("boş gövde");
      const j = JSON.parse(t);
      if (j?.error) throw new Error(j.error.message || "servis hatası");
      return j?.features ?? [];
    } catch (e) {
      if (deneme === 2) { console.warn(`\n  uyarı: offset ${offset} atlandı — ${e.message}`); return []; }
      await sleep(4000 * (deneme + 1));
    }
  }
  return [];
}

async function main() {
  const cift = [];
  let offset = 0, belirsiz = 0;
  for (let tur = 0; tur < 60; tur++) {
    const fs = await sayfaCek(offset);
    if (!fs.length) break;
    for (const f of fs) {
      const r = alimSatim(f.attributes);
      if (!r) { belirsiz++; continue; }
      cift.push({
        county: FL_COUNTY[Number(f.attributes.CO_NO)] ?? `FL-${f.attributes.CO_NO}`,
        apn: f.attributes.PARCEL_ID,
        acres: (f.attributes.LND_SQFOOT ?? 0) / 43560,
        ...r,
      });
    }
    offset += fs.length;
    process.stdout.write(`\r  çekilen ${offset} · çift ${cift.length} · sırası belirsiz ${belirsiz}`);
    if (fs.length < SAYFA) break;
    await sleep(300);
  }
  console.log(`\n`);
  if (!cift.length) { console.log("çift bulunamadı."); return; }

  const carpanlar = cift.map((c) => c.carpan).sort((a, b) => a - b);
  const zarar = cift.filter((c) => c.carpan < 1).length;
  console.log("── TÜM FL (boş arsa, iki satışı da piyasa satışı) ──");
  console.log(`  çift sayısı        : ${cift.length.toLocaleString("tr-TR")}`);
  console.log(`  medyan çarpan      : x${med(carpanlar).toFixed(2)}`);
  console.log(`  P25 / P75          : x${carpanlar[Math.floor(carpanlar.length * 0.25)].toFixed(2)} / x${carpanlar[Math.floor(carpanlar.length * 0.75)].toFixed(2)}`);
  console.log(`  ZARARINA satılan   : %${((zarar / cift.length) * 100).toFixed(0)}  (çarpan < 1)`);
  console.log(`  medyan elde tutma  : ${med(cift.map((c) => c.ayFark)).toFixed(0)} ay`);
  console.log(`  sırası belirsiz (aynı yıl+ay, hariç tutuldu): ${belirsiz.toLocaleString("tr-TR")}\n`);

  const kova = new Map();
  for (const c of cift) {
    if (!kova.has(c.county)) kova.set(c.county, []);
    kova.get(c.county).push(c);
  }
  const rapor = [...kova.entries()]
    .filter(([, a]) => a.length >= MIN_ORNEK)
    .map(([county, a]) => ({
      county, n: a.length,
      medCarpan: med(a.map((x) => x.carpan)),
      medAlim: med(a.map((x) => x.alim.fiyat)),
      medSatim: med(a.map((x) => x.satim.fiyat)),
      medAy: med(a.map((x) => x.ayFark)),
      zararPay: a.filter((x) => x.carpan < 1).length / a.length,
    }))
    .sort((a, b) => b.n - a.n);

  console.log("COUNTY            ÇİFT   MED ALIM     MED SATIM    ÇARPAN   AY   ZARAR");
  for (const r of rapor.slice(0, 20)) {
    console.log(`  ${r.county.padEnd(16).slice(0, 16)}${String(r.n).padStart(5)}  ${usd(r.medAlim).padStart(11)}  ${usd(r.medSatim).padStart(11)}   x${r.medCarpan.toFixed(2).padStart(5)}  ${String(Math.round(r.medAy)).padStart(3)}   %${(r.zararPay * 100).toFixed(0)}`);
  }

  if (!existsSync(CIKTI)) mkdirSync(CIKTI, { recursive: true });
  const satirlar = [["county", "apn", "acres", "alim_yil", "alim_ay", "alim_fiyat", "satim_yil", "satim_ay", "satim_fiyat", "carpan", "ay_fark"].join(",")];
  for (const c of cift.sort((a, b) => b.carpan - a.carpan)) {
    satirlar.push([c.county, c.apn, c.acres.toFixed(3), c.alim.yil, c.alim.ay, c.alim.fiyat, c.satim.yil, c.satim.ay, c.satim.fiyat, c.carpan.toFixed(2), c.ayFark].join(","));
  }
  const yol = resolve(CIKTI, `cevirme-kaniti-${new Date().toISOString().slice(0, 10)}.csv`);
  writeFileSync(yol, satirlar.join("\n") + "\n", "utf8");
  console.log(`\n✔ ${yol}  (${cift.length} parsel, tek tek alım→satım)`);
}

if (process.argv[1] && process.argv[1].endsWith("cevirme-kaniti.mjs")) await main();
