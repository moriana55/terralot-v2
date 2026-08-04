#!/usr/bin/env node
/**
 * VegaLand — Arsa Puanlama
 *
 * `ayik/aday/` kovasındaki boş arsaları satış motivasyonu sinyallerine göre
 * puanlar. Ek veri kaynağı GEREKTİRMEZ — her sinyal hasat verisinden çıkar.
 *
 * ⚠️ İKİ KURAL (tartışılmasın):
 * 1. **Hiçbir parsel değere göre ELENMEZ.** 3.000 dolarlık da 1 milyon dolarlık da
 *    listede kalır. Değer bir band etiketi; hangi bandı göstereceğine panelde
 *    kullanıcı karar verir. (Yiğit, 2026-08-04: '0-25k bandını da istiyorum
 *    üstlerini de istiyorum'.)
 * 2. **Bu ARSA modelidir.** Binalı parseller ayrı kovada, buraya karışmaz;
 *    onların sinyalleri (yaş, oda, kira çarpanı) burada yok.
 *
 * Puan = motivasyon + fırsat. İkisi ayrı raporlanır ki hangisinin ağır bastığı
 * görülsün — tek sayıya gömülmez.
 *
 * Kullanım:  node puanla.mjs TX   |   node puanla.mjs --hepsi
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const GIRIS = path.join(VERI, 'ayik', 'aday');
const CIKTI = path.join(VERI, 'puanli');

/** Sahip adından tüzel/miras/tröst sinyali. Satış motivasyonunun en güçlü göstergesi. */
const SAHIP_TIPI = [
  { ad: 'miras',    re: /\b(ESTATE OF|ESTATE|HEIRS?|DECEASED|DEC'?D|LIFE ESTATE|ET AL)\b/i, puan: 22 },
  { ad: 'tröst',    re: /\b(TRUST|TRUSTEE|TR\b|LIVING TRUST|FAMILY TRUST)\b/i,              puan: 16 },
  { ad: 'tüzel',    re: /\b(LLC|L\.L\.C|INC\b|CORP|CORPORATION|COMPANY|CO\b|LP\b|LTD|PARTNERSHIP|HOLDINGS?)\b/i, puan: 12 },
  { ad: 'banka',    re: /\b(BANK|MORTGAGE|LENDING|FINANCIAL|CREDIT UNION|FEDERAL NATIONAL)\b/i, puan: 18 },
  { ad: 'kamu',     re: /\b(COUNTY OF|CITY OF|STATE OF|DEPARTMENT|DEPT OF|UNITED STATES|USA\b|SCHOOL DISTRICT|MUNICIPAL)\b/i, puan: -100 },
];

/** Akr bandı — çok küçük parsel ile 40 akr aynı iş değil. */
function akrBandi(a) {
  if (a == null || a <= 0) return 'bilinmiyor';
  if (a < 0.25) return '<0,25';
  if (a < 1) return '0,25-1';
  if (a < 5) return '1-5';
  if (a < 20) return '5-20';
  if (a < 100) return '20-100';
  return '100+';
}
// Bölünebilirlik/talep açısından orta bandlar en işlek; uçlar daha zor.
const AKR_PUAN = { '<0,25': 2, '0,25-1': 8, '1-5': 12, '5-20': 14, '20-100': 10, '100+': 6, bilinmiyor: 0 };

function puanla(n, portfoy) {
  const sebep = [];
  let motivasyon = 0, firsat = 0;

  // — MOTİVASYON: bu sahip neden satsın?
  if (n.eyalet_disi) { motivasyon += 25; sebep.push('sahip eyalet dışında'); }
  const sahip = String(n.sahip || '');
  for (const t of SAHIP_TIPI) {
    if (t.re.test(sahip)) { motivasyon += t.puan; sebep.push(`sahip tipi: ${t.ad}`); break; }
  }
  // Aynı sahibin çok parseli varsa toptan konuşulabilir; ama 500+ parsel genelde
  // kamu/geliştirici, o zaten kamu kuralıyla eleniyor.
  const adet = portfoy.get(sahip) || 1;
  if (adet >= 3 && adet <= 200) { motivasyon += Math.min(14, 4 + adet / 10); sebep.push(`sahip portföyü ${adet} parsel`); }

  // — FIRSAT: bizim için ne kadar çalışılabilir?
  const ab = akrBandi(n.akr);
  firsat += AKR_PUAN[ab] || 0;
  if (n.posta_zip) { firsat += 4; sebep.push('posta kodu tam'); }
  if (n.lat != null && n.lng != null) firsat += 3;
  if (n.deger != null && n.deger > 0) firsat += 3;

  return {
    puan: Math.round(motivasyon + firsat),
    motivasyon: Math.round(motivasyon),
    firsat: Math.round(firsat),
    akr_bandi: ab,
    sahip_portfoy: adet,
    sebep,
  };
}

async function eyaletPuanla(ab) {
  const giris = path.join(GIRIS, `${ab}.ndjson.gz`);
  if (!fs.existsSync(giris)) { console.error(`${ab}: aday dosyası yok, atlandı`); return null; }
  fs.mkdirSync(CIKTI, { recursive: true });

  // 1. geçiş — sahip portföyü say (aynı sahip kaç parsele sahip)
  const portfoy = new Map();
  for await (const s of readline.createInterface({
    input: fs.createReadStream(giris).pipe(zlib.createGunzip()), crlfDelay: Infinity,
  })) {
    if (!s.trim()) continue;
    try { const n = JSON.parse(s); if (n.sahip) portfoy.set(n.sahip, (portfoy.get(n.sahip) || 0) + 1); }
    catch { /* bozuk satır */ }
  }

  // 2. geçiş — puanla ve yaz
  const gz = zlib.createGzip({ level: 6 });
  gz.pipe(fs.createWriteStream(path.join(CIKTI, `${ab}.ndjson.gz`)));
  const dagilim = {}, bandDagilim = {};
  let sayi = 0, elenenKamu = 0, toplamPuan = 0;

  for await (const s of readline.createInterface({
    input: fs.createReadStream(giris).pipe(zlib.createGunzip()), crlfDelay: Infinity,
  })) {
    if (!s.trim()) continue;
    let n; try { n = JSON.parse(s); } catch { continue; }
    const p = puanla(n, portfoy);
    // Kamu mülkü satılık değil — tek elediğimiz şey bu, değere göre eleme YOK.
    if (p.puan < 0) { elenenKamu++; continue; }
    Object.assign(n, p);
    sayi++; toplamPuan += p.puan;
    // Kuramsal tavan ~85 (motivasyon 61 + fırsat 24). A+ = birden çok güçlü
    // motivasyon sinyali birden (eyalet dışı + miras/tröst + portföy) üst üste gelmiş.
    const kova = p.puan >= 70 ? 'A+' : p.puan >= 58 ? 'A' : p.puan >= 45 ? 'B' : p.puan >= 30 ? 'C' : 'D';
    n.sinif = kova;
    dagilim[kova] = (dagilim[kova] || 0) + 1;
    bandDagilim[n.deger_bandi] = (bandDagilim[n.deger_bandi] || 0) + 1;
    if (!gz.write(JSON.stringify(n) + '\n')) await new Promise((r) => gz.once('drain', r));
  }
  await new Promise((r) => { gz.end(r); });

  const say = (x) => (x || 0).toLocaleString('tr-TR');
  console.error(
    `${ab}: ${say(sayi)} puanlandı · ort ${(toplamPuan / Math.max(sayi, 1)).toFixed(1)} · ` +
    `A+ ${say(dagilim['A+'])} · A ${say(dagilim.A)} · B ${say(dagilim.B)} · C ${say(dagilim.C)} · D ${say(dagilim.D)} · ` +
    `kamu elendi ${say(elenenKamu)}`
  );
  console.error(`${ab}: bandlar → ` + Object.entries(bandDagilim).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${say(v)}`).join(' · '));
  return { eyalet: ab, sayi, dagilim, bandDagilim, elenenKamu };
}

const arg = process.argv.slice(2);
const hedef = arg.includes('--hepsi')
  ? fs.readdirSync(GIRIS).filter((f) => f.endsWith('.ndjson.gz')).map((f) => f.replace('.ndjson.gz', ''))
  : arg.filter((a) => !a.startsWith('--'));
if (!hedef.length) { console.error('kullanım: node puanla.mjs TX | --hepsi'); process.exit(1); }

const rapor = [];
for (const ab of hedef) {
  try { const r = await eyaletPuanla(ab); if (r) rapor.push(r); }
  catch (e) { console.error(`${ab}: HATA — ${e.message}`); }
}
fs.mkdirSync(CIKTI, { recursive: true });
fs.writeFileSync(path.join(CIKTI, 'rapor.json'), JSON.stringify({ tarih: new Date().toISOString(), eyaletler: rapor }, null, 1));
const t = rapor.reduce((a, r) => ({
  n: a.n + r.sayi, Aa: a.Aa + (r.dagilim['A+'] || 0), A: a.A + (r.dagilim.A || 0), B: a.B + (r.dagilim.B || 0),
}), { n: 0, Aa: 0, A: 0, B: 0 });
const bin = (x) => x.toLocaleString('tr-TR');
console.error(`\nTOPLAM: ${bin(t.n)} puanlı arsa · A+ ${bin(t.Aa)} · A ${bin(t.A)} · B ${bin(t.B)}`);
