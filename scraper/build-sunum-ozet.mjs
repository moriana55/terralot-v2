#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SUNUM ÖZETİ — "Bugün" ekranındaki sunum bloğunun beslendiği KÜÇÜK dosya.
//
// Neden ayrı dosya: `bolge-profili.json` (434 KB) ve `toplu-alicilar.json`
// (194 KB) sunum bloğu için fazla ağır. `/admin` sayfası bir client component
// olduğu için doğrudan import edilseler 600 KB tarayıcıya inerdi. Buradan
// yalnızca gösterilecek ~1 KB'lık sayı çıkarılır.
//
// Çalıştır (iki snapshot betiğinden SONRA):
//   node scraper/build-bolge-profili.mjs
//   node scraper/build-toplu-alicilar.mjs
//   node scraper/build-sunum-ozet.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, "../dashboard/src/data");
const OUT = path.join(DATA, "sunum-ozet.json");

const bolge = JSON.parse(readFileSync(path.join(DATA, "bolge-profili.json"), "utf8"));
const alici = JSON.parse(readFileSync(path.join(DATA, "toplu-alicilar.json"), "utf8"));

// Yaşam sebebi dağılımı — county sayısı DEĞİL parsel sayısı ağırlıklı
// (8 parselli county ile 140.000 parselli county aynı ağırlıkta değil).
const siniflar = new Map();
for (const c of bolge.county) {
  const e = siniflar.get(c.sinif) ?? { parsel: 0, county: 0, renk: c.sinifRenk };
  e.parsel += c.lead;
  e.county += 1;
  siniflar.set(c.sinif, e);
}
const dagilim = [...siniflar.entries()]
  .map(([ad, v]) => ({ ad, ...v, pay: Math.round((v.parsel / bolge.toplamLead) * 100) }))
  .sort((a, b) => b.parsel - a.parsel);

const tumAlicilar = [...alici.biriktirici, ...alici.aktif];

// Skip-trace listesinin son hâli (varsa) — dosya adından kişi sayısı okunur.
let skiptrace = null;
const outDir = path.join(HERE, "out");
if (existsSync(outDir)) {
  const dosyalar = readdirSync(outDir).filter((f) => /^skiptrace-\d{4}-\d{2}-\d{2}-\d+\.csv$/.test(f)).sort();
  const son = dosyalar[dosyalar.length - 1];
  if (son) skiptrace = { dosya: `scraper/out/${son}`, kisi: Number(son.match(/-(\d+)\.csv$/)[1]) };
}

const ozet = {
  uretildi: new Date().toISOString(),
  veriAni: bolge.uretildi,
  toplamLead: bolge.toplamLead,
  countyN: bolge.countyN,
  eyaletN: new Set(bolge.county.map((c) => c.state)).size,
  aplusA: bolge.county.reduce((s, c) => s + c.aplus, 0),
  dagilim,
  // İlk iki yaşam sebebi envanterin ne kadarını kapsıyor — sunumun ana cümlesi.
  ilkIkiPay: dagilim.slice(0, 2).reduce((s, d) => s + d.pay, 0),
  alici: {
    biriktirici: alici.biriktirici.length,
    aktif: alici.aktif.length,
    postali: tumAlicilar.filter((x) => x.posta).length,
    kurumsalParsel: alici.sayac.lead_kurumsal,
    kurumsalSahip: alici.sayac.kurumsal_sahip_n,
    enIyiKesisim: tumAlicilar
      .sort((a, b) => b.kesisimAplus - a.kesisimAplus)
      .slice(0, 3)
      .map((x) => ({ owner: x.owner, kesisim: x.kesisimAplus })),
  },
  enBuyukCounty: bolge.county.slice(0, 5).map((c) => ({
    ad: `${c.state}/${c.county}`, lead: c.lead, aplus: c.aplus, sinif: c.sinif,
  })),
  skiptrace,
};

writeFileSync(OUT, JSON.stringify(ozet, null, 1));
console.log(`✔ ${OUT}`);
console.log(`  ${ozet.eyaletN} eyalet · ${ozet.countyN} county · ${ozet.toplamLead.toLocaleString("en-US")} parsel · ${ozet.aplusA.toLocaleString("en-US")} A+/A`);
console.log(`  ilk iki yaşam sebebi envanterin %${ozet.ilkIkiPay}'i · alıcı listesi ${ozet.alici.biriktirici + ozet.alici.aktif} şirket`);
if (skiptrace) console.log(`  skip-trace: ${skiptrace.kisi.toLocaleString("en-US")} kişi (${skiptrace.dosya})`);
