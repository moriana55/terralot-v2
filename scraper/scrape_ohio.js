/**
 * Ohio tax-delinquent / forfeited-land scraper  →  source = 'TAX:OH'
 * ---------------------------------------------------------------------------
 * KAYNAK (Source):
 *   Cuyahoga County (Cleveland) Fiscal Officer — "Forfeited Land Sale" public
 *   ArcGIS FeatureServer. Bunlar Ohio'da iki kez sheriff sale'de satılmayıp
 *   eyalete forfeit edilmiş, vergi borcu nedeniyle haczedilmiş parsellerdir.
 *   Tertemiz JSON, anti-bot YOK, açık veri (ToS-friendly) → Puppeteer GEREKMEZ.
 *
 *   Service:
 *   https://services7.arcgis.com/GXM8JipKyc0m6HBi/arcgis/rest/services/
 *     2024_Forfeited_Land_Sale_Update/FeatureServer/0   (Points layer, 2025 sale)
 *
 *   Dashboard (insan gözü): https://www.arcgis.com/apps/dashboards/8a1ae8ef4f484bcaa60bea15f19ccf28
 *
 * NOT / GENİŞLETME:
 *   - Bu, OH için ilk (pilot) county'dir. Diğer büyük OH county'leri (Franklin,
 *     Lucas, Butler, Allen, Summit) "forfeited land sale" listelerini PDF veya
 *     realauction.com üzerinden yayınlar; realauction WebFetch'e 403 verir ve
 *     Puppeteer gerektirir (aşağıdaki blokaj notuna bakın). Cuyahoga ArcGIS
 *     yaklaşımı en temiz olanı, o yüzden burada onu kullanıyoruz.
 *   - 'minimum_bid' olarak forfeited land'de açık artırma başlangıcı = parselin
 *     üzerindeki toplam vergi + masraflar (Tax_and_COSTS / Taxes_on_JE). Ohio
 *     ORC §5723.06 gereği başlangıç teklifi vergi+masraf+faiz tutarıdır.
 *   - 'value' olarak county'nin sertifikalı market değeri (tax_market_) kullanılır.
 *
 * ÇALIŞTIRMA:
 *   node scrape_ohio.js            # fetch + parse + console.log (DB'ye YAZMAZ)
 *   OH_WRITE=1 node scrape_ohio.js # (ileride) migrate pipeline'a JSON döker
 *
 * KISIT: npm install yok → yalnızca mevcut bağımlılıklar (node-fetch) kullanılır.
 */

const fetch = require('node-fetch');

const SERVICE =
  'https://services7.arcgis.com/GXM8JipKyc0m6HBi/arcgis/rest/services/' +
  '2024_Forfeited_Land_Sale_Update/FeatureServer/0/query';

const PAGE = 200; // ArcGIS maxRecordCount güvenli değer
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const P = 'L2EPV_Survey_Parcel_'; // parsel öznitelik öneki
const F = 'ForGIS__';             // forfeited-sale öznitelik öneki

// "$" / "," temizle, sayıya çevir
const num = (v) => {
  if (v == null || v === '') return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// Boş/anlamsız parçaları atıp adres birleştir
const joinAddr = (...parts) =>
  parts.map((s) => (s == null ? '' : String(s).trim())).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// Forfeited parsellerde "owner" = "STATE OF OHIO FORF ..." olur; gerçek
// (önceki) mal sahibi grantor alanındadır. Onu tercih et.
function ownerOf(a) {
  const grantor = a[`${F}GRANTOR1`] || a[`${P}grantor`];
  const owner = a[`${P}parcel_owne`] || a[`${F}DEEDED_OWNER`];
  if (grantor && !/state of ohio/i.test(grantor)) return String(grantor).replace(/,?\s*ET AL\.?,?\s*$/i, '').trim();
  if (owner && !/state of ohio/i.test(owner)) return String(owner).trim();
  return owner ? String(owner).trim() : null; // en kötü ihtimalle "STATE OF OHIO FORF ..."
}

// Bir ArcGIS feature → hedef şema (state,county,apn,owner_name,minimum_bid,value,acres,address,source)
function mapRecord(a) {
  // adres: önce derlenmiş alias, yoksa parça parça
  const address =
    a[`${P}par_addr_al`] ||
    joinAddr(a[`${P}parcel_addr`], a[`${P}parcel_pred`], a[`${P}parcel_stre`], a[`${P}parcel_suff`],
             a[`${P}parcel_city`], 'OH', a[`${P}parcel_zip`]) ||
    a[`${F}ADDRESS`] ||
    null;

  // minimum_bid = forfeited sale başlangıç teklifi (vergi + masraflar)
  const minimum_bid =
    num(a[`${F}Tax_and_COSTS`]) ??
    num(a[`${F}Taxes_on_JE`]) ??
    num(a[`${P}total_net_d`]); // toplam net delinquent (fallback)

  // value = county sertifikalı market değeri
  const value =
    num(a[`${P}tax_market_`]) ??
    num(a[`${F}F24_TOTAL`]) ??
    null;

  const apn =
    a[`${F}PROPERTY_`] ||          // dotted form: 008-24-064
    a[`${P}parcel_id`] ||
    a[`${F}PARCEL_ID`] ||
    null;

  return {
    state: 'OH',
    county: 'Cuyahoga',
    apn: apn ? String(apn).trim() : null,
    owner_name: ownerOf(a),
    minimum_bid,
    value,
    acres: num(a[`${P}parcel_acre`]),
    address,
    source: 'TAX:OH',
    // ── ekstra alanlar (migrate/scoring için faydalı, hedef şemanın dışında) ──
    _case_number: a[`${F}CASE_`] || null,
    _legal: a[`${P}legal_descr`] || null,
    _luc: a[`${P}tax_luc_des`] || a[`${F}LUC_DESCR`] || null,
    _parcel_type: a[`${P}parcel_type`] || null,
    _sale_year: a[`${P}parcel_year`] || null,
  };
}

async function fetchAll() {
  const out = [];
  let offset = 0;
  for (;;) {
    const url =
      `${SERVICE}?where=${encodeURIComponent('1=1')}` +
      `&outFields=*&returnGeometry=false&orderByFields=OBJECTID` +
      `&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
    const r = await fetch(url, { timeout: 30000, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error('ArcGIS: ' + JSON.stringify(j.error));
    const feats = j.features || [];
    for (const f of feats) out.push(mapRecord(f.attributes));
    if (feats.length < PAGE) break; // son sayfa
    offset += PAGE;
    await sleep(300);
  }
  return out;
}

(async () => {
  console.log('→ Ohio (Cuyahoga County) Forfeited Land Sale taranıyor...');
  console.log('  Kaynak: ' + SERVICE);

  let rows;
  try {
    rows = await fetchAll();
  } catch (e) {
    console.error('✗ Fetch/parse hatası:', e.message);
    console.error('  BLOKAJ: Eğer 403/timeout ise ArcGIS servisi geçici olarak');
    console.error('  yıllık satış güncellemesi için kapatılmış olabilir; veya');
    console.error('  realauction tabanlı diğer OH county’leri Puppeteer gerektirir.');
    process.exit(1);
  }

  // İskan edilebilir / boş arsa odağı: arsa tipi parselleri öne çıkar
  const land = rows.filter((r) => /LAND/i.test(r._parcel_type || '') || /VACANT/i.test(r._luc || ''));

  console.log(`\n✅ ${rows.length} forfeited parsel çekildi (${land.length} tanesi arsa/vacant land).`);
  console.log('   Eyalet: OH · County: Cuyahoga · source: TAX:OH\n');

  // Örnek satırlar (yalnızca hedef şema alanları)
  const SHOW = 5;
  console.log(`── ÖRNEK ${Math.min(SHOW, rows.length)} SATIR (hedef şema) ──`);
  for (const r of rows.slice(0, SHOW)) {
    console.log(JSON.stringify({
      state: r.state, county: r.county, apn: r.apn, owner_name: r.owner_name,
      minimum_bid: r.minimum_bid, value: r.value, acres: r.acres,
      address: r.address, source: r.source,
    }, null, 1));
  }

  // Hızlı kalite metriği
  const withBid = rows.filter((r) => r.minimum_bid > 0).length;
  const withVal = rows.filter((r) => r.value > 0).length;
  const withOwner = rows.filter((r) => r.owner_name && !/state of ohio/i.test(r.owner_name)).length;
  const withAcre = rows.filter((r) => r.acres > 0).length;
  console.log(`\n── ALAN DOLULUK ──`);
  console.log(`  minimum_bid: ${withBid}/${rows.length}`);
  console.log(`  value      : ${withVal}/${rows.length}`);
  console.log(`  owner_name (gerçek, non-state): ${withOwner}/${rows.length}`);
  console.log(`  acres      : ${withAcre}/${rows.length}`);

  // DB'ye YAZMA — sadece istenirse JSON dosyasına dök (migrate pipeline’a köprü)
  if (process.env.OH_WRITE === '1') {
    const fs = require('fs');
    const path = require('path');
    const out = path.join(__dirname, 'data', 'ohio_forfeited.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rows, null, 2));
    console.log(`\n💾 ${rows.length} satır yazıldı → ${out} (data.db'ye DEĞİL)`);
  } else {
    console.log('\nℹ️  TEST modu: data.db / Supabase’a yazılmadı. (OH_WRITE=1 ile JSON dökülür.)');
  }
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
