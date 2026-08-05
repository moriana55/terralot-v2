#!/usr/bin/env node
/**
 * VegaLand — Dışa Aktarma Paketi
 *
 * Sunucu kapanmadan önce ÇIKMASI GEREKEN şeyi tek arşive toplar.
 *
 * Ham parseller pakete GİRMEZ: birkaç GB tutuyorlar ve kaynaktan istenildiği an
 * yeniden indirilebiliyorlar (hasat.mjs zaten kesintiye dayanıklı). Paketin
 * içine yalnızca ÜRETİLMİŞ bilgi girer — ayıklanmış kovalar, puanlar, kaynak
 * defteri, county keşif sonucu ve huni raporu. Bunlar yeniden üretilebilir ama
 * saatler sürer; asıl değer bunlarda.
 *
 * Kullanım:  node paketle.mjs            → veri/paket/vegaland-<tarih>.tar.gz
 *            node paketle.mjs --ham      → ham parselleri de dahil et (büyük)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const PAKET = path.join(VERI, 'paket');
const hamDahil = process.argv.includes('--ham');
// Çekirdek paket: ürün için gereken her şey, arşiv hariç. 'binali' kovası
// (üzerinde bina olan parseller) satır sayısının çoğunu ve paketin büyük
// kısmını oluşturuyor ama arsa işinde kullanılmıyor — sunucuda kalabilir.
const cekirdek = process.argv.includes('--cekirdek');

const boyut = (p) => {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;
  return fs.readdirSync(p).reduce((a, f) => a + boyut(path.join(p, f)), 0);
};
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

// Pakete girecekler — VERI'ye göreli yollar.
const parcalar = cekirdek
  ? [
      { yol: 'puanli',          aciklama: 'puanlanmış arsalar (A+/A/B/C/D) — ANA ÜRÜN' },
      { yol: 'ayik/aday',       aciklama: 'boş arsa + sahip + posta (puanlanmamış ham aday)' },
      { yol: 'ayik/postasiz',   aciklama: 'boş arsa, posta yok — skip-trace adayı' },
    ]
  : [
      { yol: 'ayik',            aciklama: 'ayıklanmış kovalar (aday · postasız · sahipsiz · binalı)' },
      { yol: 'puanli',          aciklama: 'puanlanmış arsalar (A+/A/B/C/D)' },
    ];
if (hamDahil) parcalar.push({ yol: '.', aciklama: 'HAM parseller (--ham verildi)' });

// Kaynak defteri ve keşif çıktısı VERI dışında, scraper dizininde duruyor.
const yanDosyalar = ['kaynaklar.json', 'county-kaynaklar.ndjson'];

fs.mkdirSync(PAKET, { recursive: true });

// 1) Huni raporunu üret ve pakete koy (tabloyu sonradan yeniden koşamayabiliriz)
try {
  const cikti = execFileSync('node', [path.join(KOK, 'huni.mjs'), '--json'], {
    encoding: 'utf8', env: { ...process.env, VEGALAND_VERI: VERI }, maxBuffer: 64 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(VERI, 'huni.json'), cikti);
  const metin = execFileSync('node', [path.join(KOK, 'huni.mjs')], {
    encoding: 'utf8', env: { ...process.env, VEGALAND_VERI: VERI }, maxBuffer: 64 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(VERI, 'huni.txt'), metin);
  console.error('huni raporu üretildi (huni.json + huni.txt)');
} catch (e) {
  console.error(`⚠ huni raporu üretilemedi: ${e.message} — paket yine de hazırlanıyor`);
}

// 2) Yan dosyaları VERI altına kopyala ki arşiv tek kökten toplansın
for (const f of yanDosyalar) {
  const kaynak = path.join(KOK, f);
  if (fs.existsSync(kaynak)) fs.copyFileSync(kaynak, path.join(VERI, f));
  else console.error(`⚠ ${f} bulunamadı, pakete girmiyor`);
}

// 3) İçindekiler
const icindekiler = [];
for (const p of parcalar) {
  const tam = path.join(VERI, p.yol);
  if (!fs.existsSync(tam)) { console.error(`⚠ ${p.yol} yok, atlandı`); continue; }
  icindekiler.push({ ...p, bayt: boyut(tam) });
}
for (const f of [...yanDosyalar, 'huni.json', 'huni.txt']) {
  const tam = path.join(VERI, f);
  if (fs.existsSync(tam)) icindekiler.push({ yol: f, aciklama: '', bayt: boyut(tam) });
}

if (!icindekiler.length) { console.error('Pakete girecek hiçbir şey yok. Önce ayikla.mjs ve puanla.mjs koş.'); process.exit(1); }

const tarih = new Date().toISOString().slice(0, 10);
const ad = `vegaland-${hamDahil ? 'tam-' : cekirdek ? 'cekirdek-' : ''}${tarih}.tar.gz`;
const hedef = path.join(PAKET, ad);

console.error('\nPakete girenler:');
for (const i of icindekiler) console.error(`  ${i.yol.padEnd(26)} ${mb(i.bayt).padStart(10)}  ${i.aciklama}`);
console.error(`  ${'─'.repeat(26)} ${mb(icindekiler.reduce((a, i) => a + i.bayt, 0)).padStart(10)} (sıkıştırmadan önce)`);
if (!hamDahil) console.error('\nHam parseller DAHİL DEĞİL — kaynaktan yeniden indirilebilir (node hasat.mjs --tumu).');
if (cekirdek) console.error("'binali' ve 'sahipsiz' kovaları DAHİL DEĞİL — arsa işinde kullanılmıyor, sunucuda kalıyor.");

const girdiler = icindekiler.map((i) => i.yol).filter((y) => y !== '.');
execFileSync('tar', ['-czf', hedef, '-C', VERI, ...girdiler], { stdio: 'inherit' });

console.error(`\n✓ ${hedef}`);
console.error(`  ${mb(boyut(hedef))}`);
console.error('\nMac\'e çekmek için:');
console.error(`  scp root@2.24.161.97:${hedef} ~/Desktop/`);
