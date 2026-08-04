#!/usr/bin/env node
/**
 * VegaLand — Ulusal Hasat Motoru
 *
 * Eyalet geneli ArcGIS FeatureServer katmanlarından TÜM parselleri çeker,
 * geometri YAZMADAN (sadece centroid) sıkıştırılmış NDJSON'a yazar.
 *
 * Tasarım kararları:
 *  - Geometri saklanmaz. Poligon parsel başına 0,5-2 KB; ulusal ölçekte 500 GB+.
 *    Centroid (lat/lng) yeter, poligon lazım olursa kaynaktan tek parsel çekilir.
 *  - Kesintiye dayanıklı. Her pencere bittiğinde ilerleme dosyaya yazılır;
 *    yeniden başlatınca kaldığı OBJECTID'den devam eder.
 *  - Esri "açık uçlu sorgu 400 döndürür" tuzağı: her zaman OBJECTID pencereli
 *    tarama (`OBJECTID >= a AND OBJECTID < b`), resultOffset'e güvenilmez —
 *    büyük katmanlarda sunucu offset'i sessizce kırpıyor.
 *
 * Kullanım:
 *   node hasat.mjs TX                      # tek eyalet
 *   node hasat.mjs TX FL OH                # birkaç eyalet
 *   node hasat.mjs --hepsi                 # kayıttaki tüm eyaletler
 *   VEGALAND_VERI=/mnt/veri node hasat.mjs TX   # çıktı dizinini değiştir
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const KAYNAKLAR = JSON.parse(fs.readFileSync(path.join(KOK, 'kaynaklar.json'), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; VegaLand/1.0)' };

const PENCERE = Number(process.env.PENCERE || 2000);   // OBJECTID pencere genişliği
const ES_ZAMAN = Number(process.env.ES_ZAMAN || 4);    // paralel istek
const DENEME = 4;

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

async function jsonAl(url, deneme = 0) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(`Esri ${j.error.code}: ${j.error.message || ''}`);
    return j;
  } catch (e) {
    if (deneme >= DENEME) throw e;
    await uyu(1500 * 2 ** deneme);
    return jsonAl(url, deneme + 1);
  }
}

/** Katmanın OBJECTID aralığını ve alan listesini öğren. */
async function katmanBilgisi(kaynak) {
  const meta = await jsonAl(`${kaynak.url}?f=json`);
  const oidAlan = meta.objectIdField || 'OBJECTID';
  const alanlar = (meta.fields || []).map((f) => f.name).filter((n) => n !== 'Shape__Area' && n !== 'Shape__Length');
  const ist = await jsonAl(
    `${kaynak.url}/query?where=1%3D1&outStatistics=` +
      encodeURIComponent(JSON.stringify([
        { statisticType: 'min', onStatisticField: oidAlan, outStatisticFieldName: 'enaz' },
        { statisticType: 'max', onStatisticField: oidAlan, outStatisticFieldName: 'encok' },
      ])) + '&f=json'
  );
  const s = ist.features?.[0]?.attributes || {};
  const sayim = await jsonAl(`${kaynak.url}/query?where=1%3D1&returnCountOnly=true&f=json`);
  return {
    oidAlan,
    alanlar,
    enaz: Number(s.enaz ?? 1),
    encok: Number(s.encok ?? 0),
    toplam: sayim.count ?? 0,
    maxKayit: meta.maxRecordCount || 1000,
  };
}

/** Tek pencereyi çek; centroid ister, poligon istemez. */
async function pencereCek(kaynak, bilgi, bas, bit) {
  const where = encodeURIComponent(`${bilgi.oidAlan} >= ${bas} AND ${bilgi.oidAlan} < ${bit}`);
  const url =
    `${kaynak.url}/query?where=${where}` +
    `&outFields=${encodeURIComponent(bilgi.alanlar.join(','))}` +
    `&returnGeometry=false&returnCentroid=true&outSR=4326&f=json`;
  const j = await jsonAl(url);
  return (j.features || []).map((f) => {
    const a = f.attributes || {};
    const c = f.centroid || {};
    if (c.x != null) { a._lng = Math.round(c.x * 1e6) / 1e6; a._lat = Math.round(c.y * 1e6) / 1e6; }
    a._ey = kaynak.eyalet;
    return a;
  });
}

function ilerlemeYolu(ab) { return path.join(VERI, `${ab}.ilerleme.json`); }
function ciktiYolu(ab) { return path.join(VERI, `${ab}.ndjson.gz`); }

async function eyaletHasat(ab) {
  const kaynak = KAYNAKLAR[ab];
  if (!kaynak) { console.error(`${ab}: kayıtta yok, atlandı`); return; }
  if (kaynak.durum && kaynak.durum !== 'hazir') { console.error(`${ab}: durum='${kaynak.durum}', atlandı`); return; }

  fs.mkdirSync(VERI, { recursive: true });
  const bilgi = await katmanBilgisi(kaynak);
  const pencere = Math.min(PENCERE, bilgi.maxKayit);

  let ilerleme = { sonrakiOid: bilgi.enaz, yazilan: 0, basladi: new Date().toISOString() };
  if (fs.existsSync(ilerlemeYolu(ab))) {
    ilerleme = JSON.parse(fs.readFileSync(ilerlemeYolu(ab), 'utf8'));
    console.error(`${ab}: kaldığı yerden devam — OID ${ilerleme.sonrakiOid}, ${ilerleme.yazilan.toLocaleString('tr-TR')} kayıt yazılmış`);
  } else {
    console.error(`${ab}: ${kaynak.ad}`);
    console.error(`${ab}: ${bilgi.toplam.toLocaleString('tr-TR')} parsel · OID ${bilgi.enaz}-${bilgi.encok} · pencere ${pencere} · ${bilgi.alanlar.length} alan`);
  }

  const gz = zlib.createGzip({ level: 6 });
  const cikti = fs.createWriteStream(ciktiYolu(ab), { flags: 'a' });
  gz.pipe(cikti);

  const t0 = Date.now();
  let oid = ilerleme.sonrakiOid;
  let bosArdisik = 0;

  while (oid <= bilgi.encok) {
    const isler = [];
    for (let k = 0; k < ES_ZAMAN && oid + k * pencere <= bilgi.encok; k++) {
      const bas = oid + k * pencere;
      isler.push(pencereCek(kaynak, bilgi, bas, bas + pencere).catch((e) => {
        console.error(`${ab}: OID ${bas} penceresi hata — ${e.message}`);
        return null; // null = başarısız, atlanmadı sayılmaz
      }));
    }
    const gruplar = await Promise.all(isler);
    if (gruplar.some((g) => g === null)) {
      console.error(`${ab}: pencere hatası, 10 sn bekleniyor`);
      await uyu(10_000);
      continue; // aynı yerden tekrar dene
    }
    const satirlar = gruplar.flat();
    if (satirlar.length === 0) bosArdisik++; else bosArdisik = 0;
    for (const s of satirlar) {
      if (!gz.write(JSON.stringify(s) + '\n')) await new Promise((r) => gz.once('drain', r));
    }
    ilerleme.yazilan += satirlar.length;
    oid += ES_ZAMAN * pencere;
    ilerleme.sonrakiOid = oid;
    fs.writeFileSync(ilerlemeYolu(ab), JSON.stringify(ilerleme));

    const gecen = (Date.now() - t0) / 1000;
    const hiz = Math.round(ilerleme.yazilan / Math.max(gecen, 1));
    const yuzde = bilgi.toplam ? ((ilerleme.yazilan / bilgi.toplam) * 100).toFixed(1) : '?';
    process.stderr.write(`\r${ab}: ${ilerleme.yazilan.toLocaleString('tr-TR')}/${bilgi.toplam.toLocaleString('tr-TR')} (%${yuzde}) · ${hiz}/sn · OID ${oid}   `);

    if (bosArdisik > 40) { console.error(`\n${ab}: 40 ardışık boş pencere, OID aralığı bitti sayılıyor`); break; }
  }

  await new Promise((r) => { gz.end(r); });
  console.error(`\n${ab}: BİTTİ — ${ilerleme.yazilan.toLocaleString('tr-TR')} kayıt → ${ciktiYolu(ab)}`);
  ilerleme.bitti = new Date().toISOString();
  ilerleme.beklenen = bilgi.toplam;
  fs.writeFileSync(ilerlemeYolu(ab), JSON.stringify(ilerleme, null, 1));
  if (bilgi.toplam && Math.abs(ilerleme.yazilan - bilgi.toplam) / bilgi.toplam > 0.02) {
    console.error(`${ab}: ⚠ UYARI — beklenen ${bilgi.toplam.toLocaleString('tr-TR')}, yazılan ${ilerleme.yazilan.toLocaleString('tr-TR')} (%2'den fazla sapma)`);
  }
}

const arg = process.argv.slice(2);
const hedef = arg.includes('--hepsi')
  ? Object.keys(KAYNAKLAR).filter((k) => (KAYNAKLAR[k].durum || 'hazir') === 'hazir')
  : arg.filter((a) => !a.startsWith('--'));

if (!hedef.length) {
  console.error('kullanım: node hasat.mjs TX [FL ...]  |  node hasat.mjs --hepsi');
  console.error('kayıtlı eyaletler:', Object.keys(KAYNAKLAR).join(' '));
  process.exit(1);
}
console.error(`veri dizini: ${VERI}`);
for (const ab of hedef) {
  try { await eyaletHasat(ab); }
  catch (e) { console.error(`\n${ab}: BAŞARISIZ — ${e.message}`); }
}
