#!/usr/bin/env node
/**
 * GOKCE CAPITAL — İLAN ARŞİVİ (kanıt toplama)
 *
 * NEDEN: Rakip analizinde "aldığı fiyat" tapu kaydından ispatlanabiliyor ama
 * "sattığı fiyat" elle kopyalanmış bir metin dosyasındaydı — sorulduğunda
 * gösterecek belge yoktu. Bu araç ilan sayfalarının HAM HTML'ini zaman damgası
 * ve SHA-256 özetiyle arşivler. Fiyat, sayfanın kendi kaynağında görünür.
 *
 * ⚠️ Site Türkiye'den 403 veriyor ("blocked from your country"); Litvanya'daki
 * VPS'ten HTTP 200 dönüyor. Bu yüzden SUNUCUDA çalıştırılır.
 *
 * Kullanım (VPS'te):  node gokce-arsiv.mjs
 * Çıktı: data/gokce-arsiv/<tarih>/ altında ham HTML'ler + ozet.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const TARIH = new Date().toISOString().slice(0, 10);
const CIKTI = path.join(KOK, 'data', 'gokce-arsiv', TARIH);
const KOK_URL = 'https://gokcecapital.gokcap.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * İndirme curl ile yapılıyor, node fetch ile DEĞİL: site fetch'in TLS/HTTP
 * parmak izini tanıyıp 403 veriyor, aynı User-Agent'la curl 200 alıyor.
 */
async function getir(url, deneme = 0) {
  try {
    const out = execFileSync('curl', [
      '-sS', '--fail-with-body', '--compressed', '--max-time', '45',
      '-A', UA,
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      url,
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (!out || out.length < 200) throw new Error(`boş yanıt (${out?.length ?? 0} bayt)`);
    return out;
  } catch (e) {
    if (deneme >= 3) throw new Error(e.message.split('\n')[0]);
    await uyu(1500 * 2 ** deneme);
    return getir(url, deneme + 1);
  }
}

const ozetle = (s) => crypto.createHash('sha256').update(s).digest('hex');
const metin = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Sayfadan alan çıkar. Bulunamayan alan null kalır — uydurma yapılmaz. */
function ayikla(html) {
  const t = metin(html);
  const bul = (re) => { const m = t.match(re); return m ? m[1].trim() : null; };
  const sayi = (v) => (v == null ? null : Number(String(v).replace(/[^0-9.]/g, '')) || null);
  return {
    fiyat: sayi(bul(/\$\s?([0-9][0-9,]{3,})/)),
    apn: bul(/(?:APN|Parcel\s*(?:ID|Number|#))\s*:?\s*([A-Za-z0-9\-.\/]{5,40})/i),
    akr: sayi(bul(/([0-9.]+)\s*(?:acres?|ac\b)/i)),
    county: bul(/([A-Za-z .'-]{3,30})\s+County/),
    eyalet: bul(/\b([A-Z]{2})\b\s*(?:\d{5})?\s*(?:$|·|\|)/),
    baslik: bul(/^\s*(.{5,80}?)\s+(?:For Sale|Available|\$)/i),
    durum: /\bsold\b/i.test(t) ? 'Sold' : /\bpending\b/i.test(t) ? 'Pending' : /\bavailable\b/i.test(t) ? 'Available' : null,
  };
}

fs.mkdirSync(CIKTI, { recursive: true });

// 1) İlan listesi sayfası
console.error('ilan listesi indiriliyor...');
const liste = await getir(`${KOK_URL}/listings`);
fs.writeFileSync(path.join(CIKTI, '_listings.html'), liste);
const listeOzet = ozetle(liste);

// 2) Sayfadaki property numaraları
const pn = [...new Set([...liste.matchAll(/property\?pn=(\d+)/g)].map((m) => m[1]))];
console.error(`${pn.length} ilan bulundu`);

const kayitlar = [];
let i = 0;
for (const no of pn) {
  i++;
  const url = `${KOK_URL}/property?pn=${no}`;
  let html;
  try { html = await getir(url); }
  catch (e) { console.error(`  pn=${no} alınamadı: ${e.message}`); continue; }

  const dosya = `pn-${no}.html`;
  fs.writeFileSync(path.join(CIKTI, dosya), html);
  const alanlar = ayikla(html);
  kayitlar.push({ pn: no, url, dosya, sha256: ozetle(html), bayt: html.length, ...alanlar });
  process.stderr.write(`\r  ${i}/${pn.length} · pn=${no} · ${alanlar.fiyat ? '$' + alanlar.fiyat.toLocaleString('tr-TR') : 'fiyat okunamadı'}      `);
  await uyu(400);   // siteye nazik davran
}
console.error('');

const ozet = {
  alindi: new Date().toISOString(),
  kaynak: `${KOK_URL}/listings`,
  not: 'Sayfalar Litvanya\'daki VPS\'ten indirildi; site Türkiye\'den 403 veriyor. '
     + 'Her kaydın sha256 özeti var — dosya sonradan değiştirilirse özet tutmaz.',
  listeSha256: listeOzet,
  ilanSayisi: kayitlar.length,
  fiyatOkunan: kayitlar.filter((k) => k.fiyat).length,
  apnOkunan: kayitlar.filter((k) => k.apn).length,
  toplamListeDegeri: kayitlar.reduce((a, k) => a + (k.fiyat || 0), 0),
  kayitlar,
};
fs.writeFileSync(path.join(CIKTI, 'ozet.json'), JSON.stringify(ozet, null, 1));

console.error(`\n✓ ${CIKTI}`);
console.error(`  ${kayitlar.length} ilan arşivlendi · ${ozet.fiyatOkunan} fiyat · ${ozet.apnOkunan} APN okundu`);
console.error(`  toplam liste değeri $${ozet.toplamListeDegeri.toLocaleString('tr-TR')}`);
