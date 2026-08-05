#!/usr/bin/env node
/**
 * VegaLand — Ulusal Ayıklama
 *
 * Ham eyalet NDJSON'larını tek şemaya indirger ve iş kuralına göre süzer.
 * Her eyaletin alan adları FARKLI (TX 9 alan, FL 119, MD 117) — bu yüzden
 * tahmin eden bir eşleyici yerine, her eyalet için ELLE DOĞRULANMIŞ eşleme
 * kullanılıyor. Alan adları 2026-08-04'te canlı `?f=json` ile alındı.
 *
 * Çıktı: veri/ayik/<EY>.ndjson.gz  + veri/ayik/rapor.json
 *
 * Kullanım:
 *   node ayikla.mjs TX
 *   node ayikla.mjs --hepsi
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
// --county: county-hazirla.mjs'in ürettiği OTOMATİK eşlemeleri kullanır ve
// veri/county/ altını işler. Eyalet geneli eşlemeler ELLE doğrulanmıştı;
// county tarafı otomatik, o yüzden çıktı da ayrı dizine yazılıyor.
const COUNTY_KIPI = process.argv.includes('--county');
const VERI_KOK = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const VERI = COUNTY_KIPI ? path.join(VERI_KOK, 'county') : VERI_KOK;
const CIKTI = path.join(VERI, 'ayik');

/**
 * County defterindeki otomatik alan rollerini ESLEME biçimine çevirir.
 * bosArsa kuralı ÖN TARAMA sonucuna göre seçilir (aşağıda), çünkü hangi alanın
 * gerçekten dolu olduğunu önceden bilmiyoruz — NC'de structno, WY'de locationad
 * yüzünden tam bu noktada iki kez yanıldık.
 */
function countyEsleme(kayit) {
  const e = kayit.esleme || {};
  return {
    apn: e.apn, sahip: e.sahip, situs: e.situs, tarif: null,
    akr: e.akr, deger: e.deger, county: null,
    posta: e.posta, postaSehir: e.postaSehir, postaEyalet: e.postaEyalet, postaZip: e.postaZip,
    _bina: e.bina, _situs: e.situs, _eyalet: kayit.eyalet, _countyAd: kayit.county,
  };
}

/**
 * Eşleme sözlüğü. Değer bir alan adı VEYA (satır)=>değer fonksiyonu.
 * bosArsa(satır) → true ise parsel boş arsa sayılır (eyalete özgü kod/alan).
 * Bilinmiyorsa null bırakılır — uydurma yapılmaz, alan boş geçer.
 */
const ESLEME = {
  TX: {
    apn: 'Prop_ID', sahip: 'OWNER_NAME', situs: 'SITUS_ADDR', tarif: 'LEGAL_DESC',
    akr: (r) => sayi(r.GIS_AREA), deger: null, county: null,
    postaTek: 'MAIL_ADDR',   // 'ADRES, ŞEHİR, EYALET ZIP' tek satır
    bosArsa: (r) => !r.SITUS_ADDR || !/\d/.test(String(r.SITUS_ADDR).replace(/\bTX\b|\d{5}/g, '')),
  },
  FL: {
    apn: 'PARCEL_ID', sahip: 'OWN_NAME', situs: 'PHY_ADDR1', tarif: 'S_LEGAL',
    akr: (r) => sayi(r.LND_SQFOOT) / 43560, deger: 'LND_VAL', county: 'CO_NO',
    posta: 'OWN_ADDR1', postaSehir: 'OWN_CITY', postaEyalet: 'OWN_STATE', postaZip: 'OWN_ZIPCD',
    // DOR kullanım kodu 00 = boş konut arsası, 10 = boş ticari, 40 = boş sanayi
    bosArsa: (r) => ['00', '10', '40', '0', '99'].includes(String(r.DOR_UC || '').trim()) || sayi(r.NO_BULDNG) === 0,
  },
  NC: {
    apn: 'parno', sahip: 'ownname', situs: 'siteadd', tarif: 'legdecfull',
    akr: 'gisacres', deger: 'landval', county: 'cntyname',
    posta: 'mailadd', postaSehir: 'mcity', postaEyalet: 'mstate', postaZip: 'mzip',
    // structno NC verisinde HİÇ doldurulmamış (400.000 satırın 400.000'inde 0) ve
    // parusedesc boş geliyor. İkisini de kullanmak her parseli boş arsa sayıyordu
    // (%81). Tek güvenilir sinyal improvval — %20,3 boş arsa veriyor, makul.
    bosArsa: (r) => sayi(r.improvval) === 0,
  },
  NJ: {
    apn: 'PAMS_PIN', sahip: 'OWNER_NAME', situs: 'PROP_LOC', tarif: 'LAND_DESC',
    akr: 'CALC_ACRE', deger: 'LAND_VAL', county: 'COUNTY',
    posta: 'ST_ADDRESS', postaSehirEyalet: 'CITY_STATE', postaZip: 'ZIP5',
    // NJ mülk sınıfı 1 = boş arsa
    bosArsa: (r) => String(r.PROP_CLASS || '').trim() === '1' || sayi(r.IMPRVT_VAL) === 0,
  },
  CO: {
    apn: 'parcel_id', sahip: 'owner', situs: 'situsAdd', tarif: 'legalDesc',
    akr: 'landAcres', deger: 'apprValTot', county: 'countyName',
    posta: 'ownerAdd', postaSehir: 'ownAddCty', postaEyalet: 'ownAddStt', postaZip: 'ownAddZip',
    bosArsa: (r) => /vacant|vacnt/i.test(r.landUseDsc || '') || !r.situsAdd,
  },
  MA: {
    apn: 'LOC_ID', sahip: 'OWNER1', situs: 'SITE_ADDR', tarif: null,
    akr: 'LOT_SIZE', deger: 'LAND_VAL', county: 'CITY',
    posta: 'OWN_ADDR', postaSehir: 'OWN_CITY', postaEyalet: 'OWN_STATE', postaZip: 'OWN_ZIP',
    // MA kullanım kodu 130-132, 390-393 = boş arsa
    bosArsa: (r) => /^(13[0-2]|39[0-3]|440)/.test(String(r.USE_CODE || '')) || sayi(r.BLDG_VAL) === 0,
  },
  MS: {
    apn: 'parno', sahip: 'ownname', situs: 'siteadd', tarif: 'legldesc',
    akr: 'gisacres', deger: 'landval', county: 'cntyname',
    posta: 'mailadd1', postaSehir: 'mcity1', postaEyalet: 'mstate1', postaZip: 'mzip1',
    bosArsa: (r) => (sayi(r.impval1) + sayi(r.impval2)) === 0,
  },
  CT: {
    apn: 'Parcel_ID', sahip: 'Owner', situs: 'Location', tarif: null,
    akr: 'Land_Acres', deger: 'Appraised_Land', county: 'Town_Name',
    posta: 'Mailing_Address', postaSehir: 'Mailing_City', postaEyalet: 'Mailing_State', postaZip: 'Mailing_Zip',
    bosArsa: (r) => sayi(r.Appraised_Building) === 0 || /vacant/i.test(r.State_Use_Description || ''),
  },
  MT: {
    apn: 'PARCELID', sahip: 'OwnerName', situs: 'AddressLine1', tarif: 'LegalDescriptionShort',
    akr: 'GISAcres', deger: 'TotalLandValue', county: 'CountyName',
    posta: 'OwnerAddress1', postaSehir: 'OwnerCity', postaEyalet: 'OwnerState', postaZip: 'OwnerZipCode',
    bosArsa: (r) => /vacant/i.test(r.PropType || '') || sayi(r.TotalBuildingValue) === 0,
  },
  WY: {
    apn: 'parcelnb', sahip: 'ownername1', situs: 'locationad', tarif: 'legal',
    akr: null, deger: 'actualvalu', county: 'jurisdicti',
    posta: 'mailaddres', postaSehir: 'mailcity', postaEyalet: 'mailstate', postaZip: 'mailzipcod',
    // WY katmanında bina değeri/kullanım kodu YOK. Elimizdeki tek sinyal konum
    // adresi; yer tutucular temizlendikten sonra boşsa arsa sayıyoruz.
    // ⚠ Zayıf sinyal — adresi olan boş arsa da vardır, kabul edilen risk.
    bosArsa: (r) => !tmz(r.locationad),
  },
  VT: {
    apn: 'PARCID', sahip: 'OWNER1', situs: 'LOCAPROP', tarif: 'DESCPROP',
    akr: 'ACRESGL', deger: 'LAND_LV', county: 'TNAME',
    posta: 'ADDRGL1', postaSehir: 'CITYGL', postaEyalet: 'STGL', postaZip: 'ZIPGL',
    bosArsa: (r) => sayi(r.IMPRV_LV) === 0 || /^(4|5)/.test(String(r.CAT || '')),
  },
  NY: {
    apn: 'PRINT_KEY', sahip: 'PRIMARY_OWNER', situs: 'PARCEL_ADDR', tarif: null,
    akr: 'ACRES', deger: 'FULL_MARKET_VAL', county: 'COUNTY_NAME',
    posta: 'MAIL_ADDR', postaSehir: 'MAIL_CITY', postaEyalet: 'MAIL_STATE', postaZip: 'MAIL_ZIP',
    // NYS mülk sınıfı 300-399 = boş arsa
    bosArsa: (r) => /^3\d\d$/.test(String(r.PROP_CLASS || '')) || sayi(r.YR_BLT) === 0,
  },
  WI: {
    apn: 'PARCELID', sahip: 'OWNERNME1', situs: 'SITEADRESS', tarif: null,
    akr: (r) => sayi(r.GISACRES) || sayi(r.DEEDACRES), deger: 'LNDVALUE', county: 'CONAME',
    postaTek: 'PSTLADRESS',   // '358 N ROCKYHILL RD , GALENA, IL 61036'
    bosArsa: (r) => sayi(r.IMPVALUE) === 0,
  },
  HI: {
    apn: 'PARCEL_ID', sahip: 'OWNER', situs: 'SITUS', tarif: 'LEGAL_DESC',
    akr: 'ACREAGE', deger: 'MKT_VAL_LA', county: 'COUNTY_NAM',
    posta: 'MAIL_ADDRE', postaSehir: 'M_PLACENM', postaEyalet: 'M_STATENM', postaZip: 'M_ZIPCODE',
    bosArsa: (r) => sayi(r.MKT_VAL_BL) === 0 || sayi(r.BUILDINGS) === 0,
  },
};

const COUNTY_KAYIT = COUNTY_KIPI
  ? JSON.parse(fs.readFileSync(path.join(KOK, 'county-kaynaklar.json'), 'utf8'))
  : null;

const sayi = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
// Yer tutucu değerler gerçek veri DEĞİLDİR. WY'de adres alanı boş bırakılmak
// yerine "  N/A" yazılmış; '!adres' kontrolü bunu dolu sayınca 373.048 parselin
// tamamı 'binalı' kovasına düştü ve eyaletten hiç aday çıkmadı.
const YER_TUTUCU = /^(n\/?a|none|null|nil|unknown|unk|tbd|-+|\.+|0)$/i;
const tmz = (v) => {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!s || YER_TUTUCU.test(s)) return null;
  return s;
};

/** 'ADRES, ŞEHİR, EYALET ZIP' → parçalar. TX tek satırlı posta adresi için. */
function postaAyristir(tek) {
  const s = tmz(tek); if (!s) return {};
  const m = s.match(/^(.*),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/);
  if (m) return { adres: tmz(m[1]), sehir: tmz(m[2]), eyalet: m[3], zip: m[4] };
  const m2 = s.match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$/);
  if (m2) return { adres: tmz(s.slice(0, m2.index)), sehir: null, eyalet: m2[1], zip: m2[2] };
  return { adres: s };
}
/** 'ŞEHİR EY' birleşik alanı (NJ CITY_STATE). */
function sehirEyaletAyristir(v) {
  const s = tmz(v); if (!s) return {};
  const m = s.match(/^(.*)\s+([A-Z]{2})$/);
  return m ? { sehir: tmz(m[1]), eyalet: m[2] } : { sehir: s };
}

function al(r, k) { return typeof k === 'function' ? k(r) : (k ? r[k] : null); }

/**
 * Değer bandı — ETİKET, eleme kriteri DEĞİL.
 * İş kararı 2026-08-04: ucuzlukçuluk bırakıldı. Ucuz band al-sat, pahalı band
 * aracılık/komisyon modeli. Pahalı parsel listeden DÜŞMEZ, sadece etiketlenir.
 */
function degerBandi(d) {
  if (d == null || d <= 0) return 'bilinmiyor';
  if (d < 25_000) return '0-25K';
  if (d < 100_000) return '25-100K';
  if (d < 500_000) return '100-500K';
  if (d < 1_000_000) return '500K-1M';
  return '1M+';
}

function normalize(ab, r) {
  const e = ESLEME[ab]; if (!e) return null;
  let posta = {};
  if (e.postaTek) posta = postaAyristir(r[e.postaTek]);
  else {
    posta.adres = tmz(al(r, e.posta));
    if (e.postaSehirEyalet) Object.assign(posta, sehirEyaletAyristir(r[e.postaSehirEyalet]));
    else posta.sehir = tmz(al(r, e.postaSehir));
    posta.eyalet = posta.eyalet || tmz(al(r, e.postaEyalet));
    posta.zip = tmz(al(r, e.postaZip));
  }
  if (posta.zip) posta.zip = String(posta.zip).replace(/[^0-9]/g, '').slice(0, 5) || null;
  if (posta.eyalet) posta.eyalet = String(posta.eyalet).trim().toUpperCase().slice(0, 2);

  const apn = tmz(al(r, e.apn));
  const county = tmz(al(r, e.county));
  // Kaynak katmanın kendi OBJECTID'si — katman içinde KESİN tekil.
  const oid = r.OBJECTID ?? r.FID ?? r.OID_ ?? r.objectid ?? null;
  return {
    // APN çoğu eyalette sadece county İÇİNDE tekil; TX katmanında county alanı
    // olmadığı için APN'e göre tekilleştirmek 1,7M gerçek parseli mükerrer sanıp
    // atıyordu. Kimlik APN + OBJECTID birlikte kuruluyor.
    lead_id: `${ab}-${county || 'NA'}-${apn || 'NA'}-${oid ?? ''}`.replace(/\s+/g, '_').replace(/-$/, ''),
    _oid: oid,
    eyalet: ab,
    county,
    apn,
    sahip: tmz(al(r, e.sahip)),
    posta_adres: posta.adres || null,
    posta_sehir: posta.sehir || null,
    posta_eyalet: posta.eyalet || null,
    posta_zip: posta.zip || null,
    situs: tmz(al(r, e.situs)),
    tarif: tmz(al(r, e.tarif)),
    akr: al(r, e.akr) != null ? Math.round(sayi(al(r, e.akr)) * 100) / 100 : null,
    deger: e.deger ? sayi(al(r, e.deger)) || null : null,
    deger_bandi: degerBandi(e.deger ? sayi(al(r, e.deger)) : null),
    lat: r._lat ?? null,
    lng: r._lng ?? null,
    bos_arsa: e.bosArsa ? !!e.bosArsa(r) : false,
  };
}

/**
 * KOVALAR — hiçbir satır silinmez, ait olduğu kovaya yazılır.
 * İş kararı 2026-08-04: 'elerken ayrı ayrı kovalara kuralım ki işimize yarayacak
 * yerler de olsun, belki yön değiştiririz.' Eskiden süzgeçten geçmeyen satır
 * çöpe gidiyordu — TX'te 10,4M binalı parsel böyle kaybolmuştu; oysa binalı
 * parsel VegaWest'in ana işi (ev alıp yenileyip satmak).
 */
const KOVA = {
  aday:      'boş arsa + sahip adı + posta adresi — ana ürün',
  binali:    'üzerinde bina var + sahip + posta — ev/konut işi (VegaWest modeli)',
  postasiz:  'boş arsa + sahip adı var, posta adresi YOK — skip-trace adayı',
  sahipsiz:  'sahip adı yok (posta olabilir) — isimsiz mektup kampanyası',
  belirsiz:  'boş arsa mı belli DEĞİL — kaynakta bina/kullanım sinyali yok',
};

function kovaSec(n, bosArsaBilinmiyor) {
  if (!n.sahip) return 'sahipsiz';
  // Boş arsa olup olmadığını söyleyecek alan yoksa 'binalı' demek uydurma olur.
  if (bosArsaBilinmiyor) return n.posta_adres ? 'belirsiz' : 'postasiz';
  if (!n.bos_arsa) return 'binali';
  if (!n.posta_adres) return 'postasiz';
  return 'aday';
}

async function ayikla(ab) {
  const giris = path.join(VERI, `${ab}.ndjson.gz`);
  if (!fs.existsSync(giris)) { console.error(`${ab}: ham dosya yok, atlandı`); return null; }
  if (COUNTY_KIPI) {
    const kayit = COUNTY_KAYIT[ab];
    if (!kayit) { console.error(`${ab}: county defterinde yok, atlandı`); return null; }
    ESLEME[ab] = countyEsleme(kayit);
  }
  if (!ESLEME[ab]) { console.error(`${ab}: eşleme tanımlı değil, atlandı`); return null; }

  const akis = {};
  for (const k of Object.keys(KOVA)) {
    fs.mkdirSync(path.join(CIKTI, k), { recursive: true });
    const g = zlib.createGzip({ level: 6 });
    g.pipe(fs.createWriteStream(path.join(CIKTI, k, `${ab}.ndjson.gz`)));
    akis[k] = g;
  }

  // ── ÖN TARAMA: ölü alan tespiti ────────────────────────────────────────────
  // Bir alan örneklemin tamamında boş/sıfırsa o alan DOLDURULMAMIŞ demektir;
  // 'değeri sıfır' demek değildir. NC'de structno böyleydi ve her parseli boş
  // arsa saydırıyordu. Ölü alanlar rapora yazılır ki kural yazarken görülsün.
  const ORNEK = 50_000;
  const doluluk = new Map();
  let orneklenen = 0;
  {
    const on = readline.createInterface({ input: fs.createReadStream(giris).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const satir of on) {
      if (orneklenen >= ORNEK) break;
      let r; try { r = JSON.parse(satir); } catch { continue; }
      orneklenen++;
      for (const [k, v] of Object.entries(r)) {
        if (k.startsWith('_')) continue;
        const bos = v === null || v === undefined || v === '' || v === 0 || v === '0';
        const d = doluluk.get(k) || { dolu: 0 };
        if (!bos) d.dolu++;
        doluluk.set(k, d);
      }
    }
    on.close();
  }
  const oluAlanlar = [...doluluk.entries()].filter(([, d]) => d.dolu === 0).map(([k]) => k);
  if (oluAlanlar.length) {
    console.error(`${ab}: ⚠ ÖLÜ ALAN (${orneklenen.toLocaleString('tr-TR')} satırda hiç dolu değil): ${oluAlanlar.join(', ')}`);
  }

  // County kipinde boş arsa kuralı ÖN TARAMAYA göre seçilir. Elle yazılmış kural
  // yok; hangi alanın gerçekten dolu olduğuna bakılır. Hiçbiri sağlam değilse
  // parseller 'belirsiz' kovasına gider — 'boş arsa' diye uydurulmaz.
  if (COUNTY_KIPI) {
    const e = ESLEME[ab];
    const saglam = (alan) => alan && (doluluk.get(alan)?.dolu || 0) > 0;
    if (saglam(e._bina)) {
      e.bosArsa = (r) => sayi(r[e._bina]) === 0;
      e._yontem = `bina alanı (${e._bina}) = 0`;
    } else if (saglam(e._situs)) {
      e.bosArsa = (r) => !tmz(r[e._situs]);
      e._yontem = `konum adresi (${e._situs}) boş`;
    } else {
      e.bosArsa = null;   // karar verilemiyor
      e._yontem = 'belirlenemedi';
    }
    console.error(`${ab}: boş arsa yöntemi → ${e._yontem}`);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(giris).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const s = { okunan: 0, bozuk: 0, sahipsiz: 0, postasiz: 0, dolu: 0, mukerrer: 0, gecen: 0, bosArsa: 0, eyaletDisi: 0 };
  const bandlar = {};
  const gorulen = new Set();

  // Kesik/bozuk gzip tüm eyaleti düşürmesin: okunabilen kısım işlenir, kesinti
  // dürüstçe raporlanır. (NJ dosyası süreç öldürülünce %57'de kesilmişti ve
  // ayıklama 'invalid block type' ile eyaletin tamamını atlıyordu.)
  let kesinti = null;
  rl.input.on('error', (e) => { kesinti = e.message; });
  for await (const satir of rl) {
    s.okunan++;
    let r; try { r = JSON.parse(satir); } catch { s.bozuk++; continue; }
    const n = normalize(ab, r);
    if (!n) { s.bozuk++; continue; }
    // Tekilleştirme anahtarı:
    //  • county + APN varsa O kullanılır — katman yenilense bile değişmez.
    //    (NC OneMap hasat sırasında yeniden inşa edildi, OBJECTID'ler kaydı;
    //     aynı parsel iki farklı OBJECTID ile yakalanıp 295 bin fazla satır oluştu.)
    //  • county yoksa APN county içinde tekil olduğu için güvenilmez → OBJECTID.
    //    (TX'te county alanı yok; APN'e göre tekilleştirmek 1,7M gerçek parseli
    //     mükerrer sanıp atmıştı.)
    const anahtar = (n.county && n.apn) ? `${n.county}|${n.apn}` : (n._oid ?? n.lead_id);
    if (gorulen.has(anahtar)) { s.mukerrer++; continue; }
    gorulen.add(anahtar);
    delete n._oid;
    n.eyalet_disi = !!(n.posta_eyalet && n.posta_eyalet !== ab);

    const kova = kovaSec(n, ESLEME[ab].bosArsa == null);
    s[kova] = (s[kova] || 0) + 1;
    if (kova === 'aday') {
      s.gecen++;
      if (n.eyalet_disi) s.eyaletDisi++;
      bandlar[n.deger_bandi] = (bandlar[n.deger_bandi] || 0) + 1;
    }
    const g = akis[kova];
    if (!g.write(JSON.stringify(n) + '\n')) await new Promise((r2) => g.once('drain', r2));
  }
  await Promise.all(Object.values(akis).map((g) => new Promise((r) => g.end(r))));
  if (kesinti) {
    console.error(`${ab}: ⚠ HAM DOSYA KESİK — ${kesinti}. Okunabilen ${s.okunan.toLocaleString('tr-TR')} satır işlendi, ` +
      'gerisi eksik. Eyaleti yeniden hasat et.');
    s.kesik = true;
  }

  const yuzde = (x) => s.okunan ? `%${((x / s.okunan) * 100).toFixed(1)}` : '-';
  const say = (x) => (x || 0).toLocaleString('tr-TR');
  console.error(
    `${ab}: ${say(s.okunan)} okundu → kovalar: ` +
    `aday ${say(s.aday)} (${yuzde(s.aday || 0)}) · binalı ${say(s.binali)} · ` +
    `postasız ${say(s.postasiz)} · sahipsiz ${say(s.sahipsiz)} · mükerrer ${say(s.mukerrer)}` +
    ` · adayların ${say(s.eyaletDisi)}'i eyalet dışı sahip`
  );
  // Boş arsa oranı ölçüldüğü kadarıyla ABD genelinde %10-30 bandında. Çok
  // yüksek oran neredeyse her zaman bir alanın yanlış okunduğunu gösterir.
  const bosOran = s.okunan ? (s.aday + s.postasiz) / s.okunan : 0;
  if (bosOran > 0.6) {
    console.error(`${ab}: ⚠ ŞÜPHELİ — parsellerin %${(bosOran * 100).toFixed(1)}'i boş arsa çıktı. ` +
      `bosArsa kuralının dayandığı alan doldurulmamış olabilir (yukarıdaki ölü alan listesine bak).`);
  }
  console.error(`${ab}: değer bandı → ` + Object.entries(bandlar).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v.toLocaleString('tr-TR')}`).join(' · '));
  return { eyalet: ab, ...s, bandlar };
}

const arg = process.argv.slice(2);
const hedef = arg.includes('--hepsi')
  ? (COUNTY_KIPI
      // sadece gerçekten hasat edilmiş county'ler
      ? fs.readdirSync(VERI).filter((f) => f.endsWith('.ndjson.gz')).map((f) => f.replace('.ndjson.gz', ''))
      : Object.keys(ESLEME))
  : arg.filter((a) => !a.startsWith('--'));
if (!hedef.length) { console.error('kullanım: node ayikla.mjs TX | --hepsi'); process.exit(1); }

const rapor = [];
for (const ab of hedef) {
  try { const r = await ayikla(ab); if (r) rapor.push(r); }
  catch (e) { console.error(`${ab}: HATA — ${e.message}`); }
}
fs.mkdirSync(CIKTI, { recursive: true });
fs.writeFileSync(path.join(CIKTI, 'rapor.json'), JSON.stringify({ tarih: new Date().toISOString(), eyaletler: rapor }, null, 1));
const t = rapor.reduce((a, r) => ({ ok: a.ok + r.okunan, ge: a.ge + r.gecen, ed: a.ed + r.eyaletDisi }), { ok: 0, ge: 0, ed: 0 });
console.error(`\nTOPLAM: ${t.ok.toLocaleString('tr-TR')} ham → ${t.ge.toLocaleString('tr-TR')} aday · ${t.ed.toLocaleString('tr-TR')} eyalet dışı sahip`);
