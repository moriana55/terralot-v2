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
  const hepsi = (meta.fields || []).map((f) => f.name).filter((n) => !/^Shape[_.]/.test(n));
  // kaynak.alanlar verilmişse SADECE onları iste. FL'de 119, MD'de 117 alan var;
  // hepsini çekmek yanıtı şişirip sunucuyu 504'e düşürüyor (FL'de 458/sn'ye indi).
  const alanlar = kaynak.alanlar?.length
    ? [oidAlan, ...kaynak.alanlar.filter((a) => hepsi.includes(a) && a !== oidAlan)]
    : hepsi;
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
    // Seyreklik = OID aralığı / kayıt sayısı. NC'de 28,7M genişlikte 5,9M kayıt
    // var (seyreklik 4,8) — sabit 2000'lik pencere çoğunlukla boş dönüyordu.
    seyreklik: Math.max(1, (Number(s.encok ?? 0) - Number(s.enaz ?? 1) + 1) / Math.max(sayim.count || 1, 1)),
  };
}

const BOSLUK = [];   // hiçbir şekilde çekilemeyen OID aralıkları — sessizce atlanmaz, raporlanır

/**
 * Tek pencereyi çek. Sunucu 504/timeout verirse pencereyi İKİYE BÖLerek yeniden dener
 * (FL gibi ağır katmanlarda tek bir yoğun aralık tüm hasadı kilitliyordu).
 * En küçük pencerede de başarısızsa aralık BOSLUK'a yazılır ve hasat devam eder.
 */
async function pencereCek(kaynak, bilgi, bas, bit) {
  const where = encodeURIComponent(`${bilgi.oidAlan} >= ${bas} AND ${bilgi.oidAlan} < ${bit}`);
  const url =
    `${kaynak.url}/query?where=${where}` +
    `&outFields=${encodeURIComponent(bilgi.alanlar.join(','))}` +
    `&returnGeometry=false&returnCentroid=true&outSR=4326&f=json`;
  let j;
  try {
    j = await jsonAl(url);
    // Esri pencereyi maxRecordCount'ta kırptıysa veri EKSİK gelir. Sessizce kabul
    // etmek yerine pencereyi ikiye bölüp tekrar iniyoruz.
    if (j.exceededTransferLimit && bit - bas > 2) {
      const orta = bas + Math.floor((bit - bas) / 2);
      const [a, b] = await Promise.all([
        pencereCek(kaynak, bilgi, bas, orta),
        pencereCek(kaynak, bilgi, orta, bit),
      ]);
      return a.concat(b);
    }
  } catch (e) {
    const genislik = bit - bas;
    if (genislik > 50) {
      const orta = bas + Math.floor(genislik / 2);
      console.error(`\n${kaynak.eyalet}: OID ${bas}-${bit} çekilemedi (${e.message}), ikiye bölünüyor`);
      const [a, b] = await Promise.all([
        pencereCek(kaynak, bilgi, bas, orta),
        pencereCek(kaynak, bilgi, orta, bit),
      ]);
      return a.concat(b);
    }
    console.error(`\n${kaynak.eyalet}: ⚠ OID ${bas}-${bit} ATLANDI — ${e.message}`);
    BOSLUK.push({ eyalet: kaynak.eyalet, bas, bit, hata: e.message });
    return [];
  }
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
  // Hangi eyaletlerin koşacağına en aşağıdaki hedef listesi karar verir; burada
  // sadece kaynağı bozuk olan elenir. (Eskiden 'hazir' olmayan her şey burada
  // atlanıyordu — bu, --tumu kipini ve tek eyalet çağrısını sessizce engelliyordu.)
  if (kaynak.durum === 'yanlis-pozitif') { console.error(`${ab}: kaynak yanlış pozitif, atlandı`); return; }

  fs.mkdirSync(VERI, { recursive: true });
  const bilgi = await katmanBilgisi(kaynak);
  // Pencere OID GENİŞLİĞİdir, kayıt sayısı değil. Seyrek katmanda dar pencere
  // boş döner; genişletiyoruz ki pencere başına ~PENCERE kadar kayıt düşsün.
  // Fazla gelirse exceededTransferLimit yakalayıp bölüyoruz.
  const pencere = Math.max(1, Math.round(Math.min(PENCERE, bilgi.maxKayit) * bilgi.seyreklik));

  let ilerleme = { sonrakiOid: bilgi.enaz, yazilan: 0, basladi: new Date().toISOString() };
  if (fs.existsSync(ilerlemeYolu(ab))) {
    ilerleme = JSON.parse(fs.readFileSync(ilerlemeYolu(ab), 'utf8'));
    console.error(`${ab}: kaldığı yerden devam — OID ${ilerleme.sonrakiOid}, ${ilerleme.yazilan.toLocaleString('tr-TR')} kayıt yazılmış`);
  } else {
    console.error(`${ab}: ${kaynak.ad}`);
    console.error(`${ab}: ${bilgi.toplam.toLocaleString('tr-TR')} parsel · OID ${bilgi.enaz}-${bilgi.encok} · seyreklik ${bilgi.seyreklik.toFixed(2)} · pencere ${pencere} · ${bilgi.alanlar.length} alan`);
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
    const satirlar = gruplar.filter(Boolean).flat();
    if (satirlar.length === 0) bosArdisik++; else bosArdisik = 0;
    // NOT: boş pencere sayacı artık hasadı DURDURMUYOR. NC'de OID'ler seyrek
    // olduğu için 40 ardışık boş pencere %0,5'te 'katman bitti' sanılıp
    // 5,9M parselin 5,9M'i kaçırılmıştı. Tek durma ölçütü OID üst sınırıdır.
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

    if (bosArdisik === 200) console.error(`\n${ab}: 200 ardışık boş pencere — OID aralığı seyrek, taramaya devam ediliyor`);
  }

  await new Promise((r) => { gz.end(r); });
  console.error(`\n${ab}: BİTTİ — ${ilerleme.yazilan.toLocaleString('tr-TR')} kayıt → ${ciktiYolu(ab)}`);
  ilerleme.bitti = new Date().toISOString();
  ilerleme.beklenen = bilgi.toplam;
  ilerleme.bosluk = BOSLUK.filter((b) => b.eyalet === ab);
  if (ilerleme.bosluk.length) console.error(`${ab}: ⚠ ${ilerleme.bosluk.length} OID aralığı hiç çekilemedi (ilerleme dosyasında listeli)`);
  fs.writeFileSync(ilerlemeYolu(ab), JSON.stringify(ilerleme, null, 1));
  if (bilgi.toplam && Math.abs(ilerleme.yazilan - bilgi.toplam) / bilgi.toplam > 0.02) {
    console.error(`${ab}: ⚠ UYARI — beklenen ${bilgi.toplam.toLocaleString('tr-TR')}, yazılan ${ilerleme.yazilan.toLocaleString('tr-TR')} (%2'den fazla sapma)`);
  }
}

const arg = process.argv.slice(2);
// `_` ile başlayan anahtarlar açıklama satırı, eyalet değil.
// --hepsi = sahip adı + posta adresi olan eyaletler (kampanyaya hazır).
// --tumu  = kaynağı çalışan HER eyalet; posta veya isim eksik olsa da ham veri alınır
//           (eksik alan skip-trace ile tamamlanabilir, veri bedava).
const durumu = (k) => KAYNAKLAR[k].durum || 'hazir';
const tumEyalet = Object.keys(KAYNAKLAR).filter((k) => !k.startsWith('_'));
const hedef = arg.includes('--tumu')
  ? tumEyalet.filter((k) => durumu(k) !== 'yanlis-pozitif')
  : arg.includes('--hepsi')
    ? tumEyalet.filter((k) => durumu(k) === 'hazir')
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
