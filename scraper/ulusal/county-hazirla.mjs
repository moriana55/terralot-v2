#!/usr/bin/env node
/**
 * VegaLand — County Kaynaklarını Hasada Hazırla
 *
 * county-kesif.mjs 410+ county'de parsel katmanı buldu ama her birinin alan
 * adları farklı (ownname / OWNER / Owner_Name / TAXPAYER ...). 410 county'ye
 * elle eşleme yazmak mümkün değil; bu dosya alan ROLLERİNİ ad kalıplarından
 * çıkarır ve hasat/ayıklama motorlarının okuyabileceği bir kaynak defteri üretir.
 *
 * ⚠️ Eyalet geneli kaynaklardan farkı: oradaki eşlemeler ELLE doğrulandı, burası
 * otomatik. Bu yüzden çıktı 'guven' puanı taşır ve düşük güvenli kayıtlar
 * ayrı işaretlenir — ikisi tek torbaya konmaz.
 *
 * Kullanım:  node county-hazirla.mjs            → county-kaynaklar.json
 *            node county-hazirla.mjs --minimum 5000
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const GIRIS = path.join(KOK, 'county-kaynaklar.ndjson');
const CIKTI = path.join(KOK, 'county-kaynaklar.json');
const MIN = Number(process.argv[process.argv.indexOf('--minimum') + 1]) || 3000;

/**
 * Alan rolü kalıpları — sıra ÖNEMLİ, ilk eşleşen kazanır.
 * Dışlamalar gerçek tuzaklardan geliyor: 'OWN_TYPE' mülkiyet türü (Utah'ta bu
 * yüzden yanlış pozitif çıkmıştı), 'OWNERID' kimlik, 'MAILINGDATE' tarih.
 */
const ROL = {
  sahip: {
    kabul: [/^own(er)?_?nam/i, /^ownname/i, /^owner$/i, /^own1$/i, /^owner_?1$/i, /^taxpayer_?name/i,
            /^deed_?own/i, /^owner_?full/i, /^name$/i, /^ownr/i, /own.*name/i, /taxpayer/i],
    ret: [/type|typ$|code|_cd$|_id$|id$|class|date|num|pct|percent|count/i],
  },
  posta: {
    kabul: [/^mail_?add?r?(ess)?1?$/i, /^mailadd/i, /^own(er)?_?add?r?1?$/i, /^pstl/i,
            /^mailing_?add/i, /^m_?addr/i, /mail.*addr/i, /owner.*addr/i],
    ret: [/type|code|_cd$|_id$|date|city|state|zip|country/i],
  },
  postaSehir:  { kabul: [/^mail_?city/i, /^mcity/i, /^own(er)?_?city/i, /mail.*city/i, /owner.*city/i], ret: [/code|_cd$/i] },
  postaEyalet: { kabul: [/^mail_?st(ate)?$/i, /^mstate/i, /^own(er)?_?st(ate)?$/i, /mail.*state/i, /owner.*state/i], ret: [/code|_cd$/i] },
  postaZip:    { kabul: [/^mail_?zip/i, /^mzip/i, /^own(er)?_?zip/i, /mail.*zip/i, /owner.*zip/i], ret: [] },
  apn:         { kabul: [/^apn$/i, /^parcel_?id$/i, /^parcelnum/i, /^pin$/i, /^parno$/i, /^prop_?id$/i, /^account/i, /parcel.*(id|no|num)/i], ret: [/date|year/i] },
  situs:       { kabul: [/^situs_?add?r?/i, /^site_?add?r?/i, /^prop_?add?r?/i, /^phy_?add?r?/i, /^address$/i, /^locat/i,
                          // Maricopa 'PropertyFullStreetAddress' — dar kalıplar kaçırıyordu
                          /propert.*(street|address)/i, /physical.*address/i, /full.*street.*address/i, /site.*address/i], ret: [/mail|own|city|state|zip|code|dir$|type$|num/i] },
  akr:         { kabul: [/^gis_?acres?$/i, /^acres?$/i, /^deed_?acres?$/i, /^calc_?acres?$/i, /^land_?acres?$/i, /acre/i], ret: [/code|_cd$/i] },
  deger:       { kabul: [/^land_?val/i, /^lndval/i, /^landvalue$/i, /^assessed_?val/i, /^market_?val/i, /^total_?val/i, /^appr/i, /val(ue)?$/i], ret: [/code|_cd$|date|year|type/i] },
  bina:        { kabul: [/^imp(rov)?_?val/i, /^impval/i, /^bldg_?val/i, /^building_?val/i, /^struct(no|ure)?$/i, /^no_?bldg/i,
                          // 'ImprovementFullCashValue', 'BuildingValue', 'StructureValue' gibi
                          // uzun adlar dar kalıplara takılmıyordu — Maricopa böyle kaçtı.
                          /improvement.*val/i, /building.*val/i, /struct.*val/i, /bldg.*val/i], ret: [/code|_cd$|date|assessed.*ratio|desc/i] },
  kullanim:    { kabul: [/^propert?y?_?use_?desc/i, /^land_?use_?desc/i, /use_?desc/i, /^propuse/i, /^proptype/i, /^land_?use$/i, /^propert?y?_?use$/i], ret: [/code$|_cd$/i] },
  yapimYili:   { kabul: [/^construction_?year/i, /^year_?built/i, /^yr_?blt/i, /^act_?yr_?blt/i, /^eff_?year/i], ret: [] },
};

function rolBul(alanlar, rol) {
  const { kabul, ret } = ROL[rol];
  for (const kalip of kabul) {
    const bulunan = alanlar.find((a) => kalip.test(a) && !ret.some((r) => r.test(a)));
    if (bulunan) return bulunan;
  }
  return null;
}

const satirlar = fs.readFileSync(GIRIS, 'utf8').split('\n')
  .filter((s) => s.trim())
  .map((s) => { try { return JSON.parse(s); } catch { return null; } })
  .filter(Boolean)
  .filter((x) => !x.yok && x.kayit >= MIN && Array.isArray(x.alanlar));

// Aynı county birden çok kez taranmış olabilir — en çok kayıtlısını tut.
const enIyi = new Map();
for (const x of satirlar) {
  const v = enIyi.get(x.anahtar);
  if (!v || x.kayit > v.kayit) enIyi.set(x.anahtar, x);
}

const cikti = {};
const sayac = { yuksek: 0, orta: 0, dusuk: 0, atlanan: 0 };

for (const x of enIyi.values()) {
  const a = x.alanlar;
  const e = {};
  for (const rol of Object.keys(ROL)) e[rol] = rolBul(a, rol);

  // Sahip adı yoksa kampanyaya giremez — kayda hiç almıyoruz.
  if (!e.sahip) { sayac.atlanan++; continue; }

  // Posta adresi tek satırda mı, parçalı mı?
  const postaTam = !!(e.posta && (e.postaSehir || e.postaZip));
  // Güven: kaç kritik rol bulundu?
  // Boş arsa kararı verebilmek için bina değeri / kullanım açıklaması / yapım
  // yılı / konum adresinden EN AZ BİRİ lazım; yoksa parsel 'belirsiz' kalır.
  const arsaSinyali = [e.bina, e.kullanim, e.yapimYili, e.situs].filter(Boolean).length;
  const kritik = [e.sahip, e.posta, e.apn, e.akr || e.deger].filter(Boolean).length + (arsaSinyali ? 1 : 0);
  const guven = postaTam && arsaSinyali && kritik >= 5 ? 'yuksek'
              : e.posta && kritik >= 3 ? 'orta' : 'dusuk';
  sayac[guven]++;

  cikti[x.anahtar] = {
    eyalet: x.eyalet,
    county: x.county,
    ad: `${x.county} County, ${x.eyalet} — ${x.baslik || 'parsel'}`.slice(0, 90),
    url: x.url,
    parsel: x.kayit,
    posta: postaTam,
    arsaSinyali: arsaSinyali > 0,
    guven,
    durum: e.posta ? 'hazir' : 'posta-yok',
    // Hasat sadece bu alanları istesin — yanıt boyutu küçülür, sunucu boğulmaz.
    alanlar: [...new Set(Object.values(e).filter(Boolean))],
    esleme: e,
  };
}

fs.writeFileSync(CIKTI, JSON.stringify({
  _not: `county-kesif.mjs çıktısından OTOMATİK üretildi (${new Date().toISOString().slice(0, 10)}). ` +
        'Alan eşlemeleri ad kalıplarından çıkarıldı, elle doğrulanmadı — eyalet geneli ' +
        'kaynaklardan farkı budur. guven=yuksek olanlar önce işlenmeli.',
  ...cikti,
}, null, 1));

const ey = {};
for (const v of Object.values(cikti)) ey[v.eyalet] = (ey[v.eyalet] || 0) + 1;
const toplam = Object.values(cikti).reduce((a, v) => a + v.parsel, 0);

console.error(`${enIyi.size} county değerlendirildi (en az ${MIN.toLocaleString('tr-TR')} kayıt)`);
console.error(`  güven yüksek: ${sayac.yuksek} · orta: ${sayac.orta} · düşük: ${sayac.dusuk} · sahip adı yok (atlandı): ${sayac.atlanan}`);
console.error(`  ${Object.keys(cikti).length} county kayda alındı · ${toplam.toLocaleString('tr-TR')} parsel`);
console.error(`  eyalet dağılımı: ${Object.entries(ey).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`);
console.error(`\n→ ${CIKTI}`);
