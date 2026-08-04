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
const VERI = process.env.VEGALAND_VERI || path.join(KOK, 'veri');
const CIKTI = path.join(VERI, 'ayik');

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
    bosArsa: (r) => sayi(r.improvval) === 0 || sayi(r.structno) === 0 || /vacant/i.test(r.parusedesc || ''),
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
    bosArsa: (r) => !r.locationad,
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

const sayi = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const tmz = (v) => { const s = String(v ?? '').trim().replace(/\s+/g, ' '); return s && s !== 'null' ? s : null; };

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
    lat: r._lat ?? null,
    lng: r._lng ?? null,
    bos_arsa: !!(e.bosArsa && e.bosArsa(r)),
  };
}

async function ayikla(ab) {
  const giris = path.join(VERI, `${ab}.ndjson.gz`);
  if (!fs.existsSync(giris)) { console.error(`${ab}: ham dosya yok, atlandı`); return null; }
  if (!ESLEME[ab]) { console.error(`${ab}: eşleme tanımlı değil, atlandı`); return null; }
  fs.mkdirSync(CIKTI, { recursive: true });

  const gz = zlib.createGzip({ level: 6 });
  gz.pipe(fs.createWriteStream(path.join(CIKTI, `${ab}.ndjson.gz`)));

  const rl = readline.createInterface({ input: fs.createReadStream(giris).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const s = { okunan: 0, bozuk: 0, sahipsiz: 0, postasiz: 0, dolu: 0, mukerrer: 0, gecen: 0, bosArsa: 0, eyaletDisi: 0 };
  const gorulen = new Set();

  for await (const satir of rl) {
    s.okunan++;
    let r; try { r = JSON.parse(satir); } catch { s.bozuk++; continue; }
    const n = normalize(ab, r);
    if (!n) { s.bozuk++; continue; }
    if (!n.sahip) { s.sahipsiz++; continue; }
    if (!n.posta_adres) { s.postasiz++; continue; }
    if (!n.bos_arsa) { s.dolu++; continue; }
    // Gerçek mükerrer sadece hasat penceresi çakışmasından doğar; onda OBJECTID de
    // aynıdır. OBJECTID yoksa lead_id'ye düşülür.
    const anahtar = n._oid ?? n.lead_id;
    if (gorulen.has(anahtar)) { s.mukerrer++; continue; }
    gorulen.add(anahtar);
    delete n._oid;
    n.eyalet_disi = !!(n.posta_eyalet && n.posta_eyalet !== ab);
    if (n.eyalet_disi) s.eyaletDisi++;
    s.bosArsa++; s.gecen++;
    if (!gz.write(JSON.stringify(n) + '\n')) await new Promise((r2) => gz.once('drain', r2));
  }
  await new Promise((r) => { gz.end(r); });

  const yuzde = (x) => s.okunan ? `%${((x / s.okunan) * 100).toFixed(1)}` : '-';
  console.error(
    `${ab}: ${s.okunan.toLocaleString('tr-TR')} okundu → ${s.gecen.toLocaleString('tr-TR')} geçti (${yuzde(s.gecen)})` +
    ` · elenen: sahipsiz ${s.sahipsiz.toLocaleString('tr-TR')}, postasız ${s.postasiz.toLocaleString('tr-TR')},` +
    ` binalı ${s.dolu.toLocaleString('tr-TR')}, mükerrer ${s.mukerrer.toLocaleString('tr-TR')}` +
    ` · eyalet dışı sahip ${s.eyaletDisi.toLocaleString('tr-TR')}`
  );
  return { eyalet: ab, ...s };
}

const arg = process.argv.slice(2);
const hedef = arg.includes('--hepsi') ? Object.keys(ESLEME) : arg.filter((a) => !a.startsWith('--'));
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
