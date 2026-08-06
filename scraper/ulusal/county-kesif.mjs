#!/usr/bin/env node
/**
 * VegaLand — County Kaynak Keşfi
 *
 * Eyalet geneli ücretsiz parsel katmanı olmayan eyaletlerde veri county'lerde
 * dağınık duruyor. Bu tarayıcı county'leri TEK TEK elle aramak yerine:
 *   1) Census TIGERweb'den hedef eyaletlerin county listesini alır (ücretsiz, anahtarsız)
 *   2) her county için ArcGIS Online'da parsel katmanı arar
 *   3) bulduğu katmanın ALAN LİSTESİNİ ve KAYIT SAYISINI canlı sorguyla doğrular
 *   4) sahip adı + posta adresi var mı diye puanlar
 *
 * Hiçbir sonuç tahmin değil — her satır gerçek HTTP yanıtından geliyor.
 *
 * Kesintiye dayanıklı: sonuçlar satır satır county-kaynaklar.ndjson'a yazılır,
 * yeniden başlatınca taranmış county'ler atlanır.
 *
 * Kullanım:
 *   node county-kesif.mjs                 # varsayılan hedef eyaletler
 *   node county-kesif.mjs AZ NM OK        # belirli eyaletler
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const CIKTI = path.join(KOK, 'county-kaynaklar.ndjson');

// Eyalet geneli kaynağı OLMAYAN ve iş kuralına uyan (ucuz arsa + taksitli satış)
// eyaletler. HEDEF-25-EYALET.md'deki tier sırasına göre.
const VARSAYILAN = ['AZ', 'NM', 'OK', 'TN', 'MO', 'KS', 'NE', 'SD', 'ND', 'ID', 'NV', 'OR', 'AR', 'GA', 'AL', 'SC', 'KY', 'MI', 'IA', 'ME'];

const FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', FL: '12',
  GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22',
  ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40',
  OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50',
  VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
};
const AD = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', IA: 'Iowa', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', MA: 'Massachusetts', MD: 'Maryland',
  ME: 'Maine', MI: 'Michigan', MN: 'Minnesota', MO: 'Missouri', MS: 'Mississippi',
  MT: 'Montana', NC: 'North Carolina', ND: 'North Dakota', NE: 'Nebraska',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NV: 'Nevada', NY: 'New York',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VA: 'Virginia', VT: 'Vermont', WA: 'Washington', WI: 'Wisconsin', WV: 'West Virginia',
  WY: 'Wyoming',
};

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; VegaLand/1.0)' };
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (u, t = 30_000) => {
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(t) });
  return r.json();
};

/** Census TIGERweb — hedef eyaletin county adları. Ücretsiz, anahtarsız. */
async function countyListesi(ab) {
  const url =
    'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query' +
    `?where=${encodeURIComponent(`STATE='${FIPS[ab]}'`)}` +
    '&outFields=NAME,GEOID&returnGeometry=false&f=json';
  const d = await j(url);
  // TIGERweb 'Los Alamos County' döndürüyor; 'County/Parish/Borough' ekini at,
  // yoksa arama 'Los Alamos County County New Mexico' oluyor.
  return (d.features || []).map((f) => ({
    ad: String(f.attributes.NAME).replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$/i, '').trim(),
    tamAd: f.attributes.NAME,
    geoid: f.attributes.GEOID,
  }));
}

// Sahip ADI alanı: 'owner'/'ownname' gibi. 'OWN_TYPE'/'ownertype' mülkiyet TÜRÜdür,
// sahip adı DEĞİL — Utah'ta tam bu tuzağa düşülmüştü, ayıklanıyor.
const SAHIP = (n) => /own|taxpay|grantee|deed/i.test(n) && !/type|typ$|cd$|code|_id$|class/i.test(n);
const POSTA = (n) => /mail|owner?add|own_add|pstl/i.test(n);
const ADRESIMSI = (n) => /addr|city|zip|state/i.test(n);

async function katmanDogrula(url) {
  const lm = await j(`${url}?f=json`);
  const alanlar = (lm.fields || []).map((f) => f.name);
  if (!alanlar.length) return null;
  const sahip = alanlar.filter(SAHIP);
  const posta = alanlar.filter(POSTA);
  const adres = alanlar.filter(ADRESIMSI);
  if (!sahip.length) return null;                       // sahip adı yoksa kampanyaya yaramaz
  const c = await j(`${url}/query?where=1%3D1&returnCountOnly=true&f=json`).catch(() => ({}));
  const n = c.count || 0;
  if (!n) return null;
  return {
    url, kayit: n, alanlar,
    sahipAlan: sahip.slice(0, 3),
    postaAlan: posta.slice(0, 5),
    postaVar: posta.length > 0 || adres.length >= 3,
  };
}

async function countyAra(ab, county) {
  const eyaletAd = AD[ab] || ab;
  const sorgular = [
    `${county} County ${eyaletAd} parcels`,
    `${county} County parcels owner`,
    `${county} ${eyaletAd} tax parcels`,
  ];
  const gorulen = new Set();
  let enIyi = null;
  for (const q of sorgular) {
    let sonuc = [];
    try {
      const s = await j(
        `https://www.arcgis.com/sharing/rest/search?q=${encodeURIComponent(q + ' AND type:"Feature Service"')}` +
        '&num=6&f=json&sortField=numviews&sortOrder=desc'
      );
      sonuc = s.results || [];
    } catch { /* arama hatası — sessiz geç, sonraki sorgu denenir */ }

    for (const c of sonuc) {
      if (!c.url || gorulen.has(c.url)) continue;
      gorulen.add(c.url);
      const metin = `${c.title} ${c.snippet || ''}`;
      // county adı geçmiyorsa başka yerin katmanıdır
      if (!new RegExp(`\\b${county.replace(/[^\w\s]/g, '.')}\\b`, 'i').test(metin)) continue;
      try {
        const meta = await j(`${c.url.replace(/\/$/, '')}?f=json`);
        const katmanlar = meta.layers?.length ? meta.layers.slice(0, 3).map((l) => l.id) : [null];
        for (const id of katmanlar) {
          const lu = id === null ? c.url : `${c.url.replace(/\/$/, '')}/${id}`;
          const d = await katmanDogrula(lu).catch(() => null);
          if (!d) continue;
          const puan = (d.postaVar ? 3 : 0) + (d.kayit > 20_000 ? 2 : d.kayit > 3_000 ? 1 : 0);
          if (!enIyi || puan > enIyi.puan || (puan === enIyi.puan && d.kayit > enIyi.kayit))
            enIyi = { ...d, puan, baslik: c.title };
        }
      } catch { /* servis erişilemedi */ }
      if (enIyi?.puan >= 5) break;   // yeterince iyi, aramayı uzatma
    }
    if (enIyi?.puan >= 5) break;
  }
  return enIyi;
}

const hedef = process.argv.slice(2).length ? process.argv.slice(2) : VARSAYILAN;

// kaldığı yerden devam
const tarandi = new Set();
if (fs.existsSync(CIKTI)) {
  for (const s of fs.readFileSync(CIKTI, 'utf8').split('\n')) {
    if (!s.trim()) continue;
    try { tarandi.add(JSON.parse(s).anahtar); } catch { /* bozuk satır */ }
  }
  console.error(`${tarandi.size} county zaten taranmış, atlanacak`);
}

const akis = fs.createWriteStream(CIKTI, { flags: 'a' });
let bulunan = 0, toplam = 0;

for (const ab of hedef) {
  if (!FIPS[ab]) { console.error(`${ab}: FIPS kodu bilinmiyor, atlandı`); continue; }
  let counties;
  try { counties = await countyListesi(ab); }
  catch (e) { console.error(`${ab}: county listesi alınamadı — ${e.message}`); continue; }
  console.error(`\n=== ${ab} (${AD[ab] || ab}) — ${counties.length} county ===`);

  for (const c of counties) {
    const anahtar = `${ab}-${c.geoid}`;
    if (tarandi.has(anahtar)) continue;
    toplam++;
    let d = null;
    try { d = await countyAra(ab, c.ad); } catch { /* tek county hatası taramayı durdurmaz */ }
    const satir = { anahtar, eyalet: ab, county: c.ad, geoid: c.geoid, ...(d || { yok: true }) };
    akis.write(JSON.stringify(satir) + '\n');
    if (d) {
      bulunan++;
      console.error(`  ✓ ${c.ad.padEnd(18)} ${String(d.kayit).padStart(9)} · ${d.postaVar ? 'posta VAR' : 'posta yok'} · ${d.baslik.slice(0, 40)}`);
    } else {
      process.stderr.write(`\r  · ${c.ad.slice(0, 20).padEnd(20)} bulunamadı            `);
    }
    await uyu(250);   // ArcGIS arama API'sine nazik davran
  }
}
akis.end();
console.error(`\n\nBİTTİ — ${toplam} county tarandı, ${bulunan} tanesinde sahip adı olan parsel katmanı bulundu`);
console.error(`Sonuçlar: ${CIKTI}`);
