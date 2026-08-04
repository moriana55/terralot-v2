#!/usr/bin/env node
/**
 * VegaLand — Eleme Hunisi Raporu
 *
 * Hasat → ayıklama → puanlama zincirinin her adımında kaç parselin nereye
 * gittiğini tek tabloda gösterir. Müşteriye anlatılacak hikâye budur:
 * "X milyon parsel tarandı, Y'si boş arsa, Z'si ulaşılabilir sahipli,
 *  N tanesi A+ aday."
 *
 * Hiçbir sayı hesaplanmaz/tahmin edilmez — hepsi ayik/ ve puanli/ altındaki
 * gerçek rapor dosyalarından ve ilerleme dosyalarından okunur. Ölçülemeyen
 * değer 'ölçülemedi' yazılır, sıfır yazılmaz.
 *
 * Kullanım:  node huni.mjs            (metin tablo)
 *            node huni.mjs --json     (makine okunur)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const KAYNAKLAR = JSON.parse(fs.readFileSync(path.join(KOK, 'kaynaklar.json'), 'utf8'));

const oku = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const bin = (x) => (x == null ? 'ölçülemedi' : x.toLocaleString('tr-TR'));

// 1) HASAT — ilerleme dosyalarından
const hasat = [];
if (fs.existsSync(VERI)) {
  for (const f of fs.readdirSync(VERI).filter((f) => f.endsWith('.ilerleme.json'))) {
    const ab = f.replace('.ilerleme.json', '');
    const d = oku(path.join(VERI, f));
    if (!d) continue;
    const beklenen = d.beklenen ?? KAYNAKLAR[ab]?.parsel ?? null;
    hasat.push({
      eyalet: ab,
      cekilen: d.yazilan ?? 0,
      beklenen,
      bitti: !!d.bitti,
      // Sapma sessiz kalmasın: eksik hasat, sonraki her adımı yanıltır.
      eksik: beklenen && d.bitti && Math.abs(d.yazilan - beklenen) / beklenen > 0.02,
      bosluk: (d.bosluk || []).length,
    });
  }
}
hasat.sort((a, b) => b.cekilen - a.cekilen);

// 2) AYIKLAMA — kovalar
const ayikRapor = oku(path.join(VERI, 'ayik', 'rapor.json'));
const kova = { aday: 0, binali: 0, postasiz: 0, sahipsiz: 0, mukerrer: 0, okunan: 0, eyaletDisi: 0 };
for (const e of ayikRapor?.eyaletler || []) {
  for (const k of Object.keys(kova)) kova[k] += e[k] || 0;
}

// 3) PUANLAMA — sınıflar
const puanRapor = oku(path.join(VERI, 'puanli', 'rapor.json'));
const sinif = {}; const band = {}; let puanlanan = 0, kamu = 0;
for (const e of puanRapor?.eyaletler || []) {
  puanlanan += e.sayi || 0; kamu += e.elenenKamu || 0;
  for (const [k, v] of Object.entries(e.dagilim || {})) sinif[k] = (sinif[k] || 0) + v;
  for (const [k, v] of Object.entries(e.bandDagilim || {})) band[k] = (band[k] || 0) + v;
}

const toplamCekilen = hasat.reduce((a, r) => a + r.cekilen, 0);
const rapor = {
  tarih: new Date().toISOString(),
  eyaletSayisi: hasat.length,
  hasat: { toplamCekilen, eyaletler: hasat },
  ayiklama: kova,
  puanlama: { puanlanan, kamuElendi: kamu, sinif, band },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rapor, null, 1));
  process.exit(0);
}

const yuzde = (x, t) => (t ? `%${((x / t) * 100).toFixed(1)}` : '—');
const c = [];
c.push('');
c.push('╔══════════════════════════════════════════════════════════════════╗');
c.push('║              VEGALAND — ULUSAL ELEME HUNİSİ                      ║');
c.push('╚══════════════════════════════════════════════════════════════════╝');
c.push('');
c.push(`1. HASAT — ${hasat.length} eyalet, ${bin(toplamCekilen)} parsel indirildi`);
c.push('');
for (const r of hasat) {
  const durum = !r.bitti ? 'devam ediyor' : r.eksik ? '⚠ EKSİK' : 'tam';
  c.push(`   ${r.eyalet.padEnd(4)} ${bin(r.cekilen).padStart(12)} / ${bin(r.beklenen).padStart(12)}  ${durum}` +
         (r.bosluk ? `  (${r.bosluk} aralık çekilemedi)` : ''));
}
c.push('');

if (kova.okunan) {
  c.push(`2. AYIKLAMA — ${bin(kova.okunan)} satır okundu, hiçbiri silinmedi`);
  c.push('');
  c.push(`   ▸ boş arsa + sahip + posta ....... ${bin(kova.aday).padStart(12)}  ${yuzde(kova.aday, kova.okunan)}   ← ÜRÜN`);
  c.push(`   ▸ boş arsa, posta adresi yok ..... ${bin(kova.postasiz).padStart(12)}  ${yuzde(kova.postasiz, kova.okunan)}   skip-trace adayı`);
  c.push(`   ▸ üzerinde bina var .............. ${bin(kova.binali).padStart(12)}  ${yuzde(kova.binali, kova.okunan)}   arşiv (arsa işi değil)`);
  c.push(`   ▸ sahip adı yok .................. ${bin(kova.sahipsiz).padStart(12)}  ${yuzde(kova.sahipsiz, kova.okunan)}   isimsiz mektup`);
  c.push(`   ▸ mükerrer (hasat çakışması) ..... ${bin(kova.mukerrer).padStart(12)}`);
  c.push('');
  c.push(`   Adayların ${bin(kova.eyaletDisi)}'inde sahip BAŞKA EYALETTE oturuyor (${yuzde(kova.eyaletDisi, kova.aday)}).`);
  c.push('');
} else {
  c.push('2. AYIKLAMA — henüz koşulmadı (node ayikla.mjs --hepsi)');
  c.push('');
}

if (puanlanan) {
  c.push(`3. PUANLAMA — ${bin(puanlanan)} arsa puanlandı (${bin(kamu)} kamu parseli elendi)`);
  c.push('');
  for (const s of ['A+', 'A', 'B', 'C', 'D']) {
    if (!sinif[s]) continue;
    const etiket = { 'A+': 'en güçlü motivasyon', A: 'güçlü', B: 'orta', C: 'zayıf', D: 'sinyal yok' }[s];
    c.push(`   ${s.padEnd(3)} ${bin(sinif[s]).padStart(12)}  ${yuzde(sinif[s], puanlanan).padStart(6)}   ${etiket}`);
  }
  c.push('');
  c.push('   Değer bandı (hiçbiri elenmedi, sadece etiket):');
  for (const [k, v] of Object.entries(band).sort((a, b) => b[1] - a[1])) {
    c.push(`     ${k.padEnd(12)} ${bin(v).padStart(12)}  ${yuzde(v, puanlanan)}`);
  }
  c.push('');
  const hedef = (sinif['A+'] || 0) + (sinif.A || 0);
  c.push('   ─────────────────────────────────────────────────────────────');
  c.push(`   ${bin(toplamCekilen)} parsel tarandı → ${bin(hedef)} birinci sınıf aday (A+ ve A)`);
  c.push('   ─────────────────────────────────────────────────────────────');
} else {
  c.push('3. PUANLAMA — henüz koşulmadı (node puanla.mjs --hepsi)');
}
c.push('');
console.log(c.join('\n'));
