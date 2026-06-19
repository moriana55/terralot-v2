/**
 * Oklahoma "June Tax Resale" land scraper  (source = TAX:OK)
 * ----------------------------------------------------------------------------
 * Kaynak: https://oktaxrolls.com  — Oklahoma'daki ~74 county treasurer'ın ortak
 * platformu. Her county /county/<Name> sayfasında, June (Haziran) tax resale
 * listesini ya düz metin (.txt) ya da PDF olarak yayınlar. 68 O.S. §3125 gereği
 * 3+ yıl ödenmemiş vergili parseller "two-thirds assessed value VEYA toplam
 * vergi borcu (hangisi azsa)" minimum bedelle açık artırmaya çıkar — ucuz arsa.
 *
 * Bu script SADECE fetch + parse yapar, sonuçları console.log'a basar.
 * data.db / Supabase'e HİÇBİR ŞEY YAZMAZ (test amaçlı).
 *
 * Hedef şema (her satır):
 *   state, county, apn, owner_name, minimum_bid, value, acres, address, source
 *
 * Çalıştırma:
 *   node scrape_oklahoma.js                 # ilk 5 county (varsayılan)
 *   OK_COUNTIES=8 node scrape_oklahoma.js   # ilk 8 county
 *   OK_ONLY=Bryan,Atoka node scrape_oklahoma.js   # sadece bu county'ler
 *   OK_JSON=1 node scrape_oklahoma.js       # çıktıyı JSON olarak da bas
 *
 * KISIT: npm install yok. Sadece Node yerleşik fetch + sistemdeki `pdftotext`
 * (poppler) kullanılır. pdftotext yoksa PDF county'leri atlanır ve uyarılır.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = 'https://oktaxrolls.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_COUNTIES = parseInt(process.env.OK_COUNTIES || '5', 10);
const ONLY = (process.env.OK_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// pdftotext var mı?
let HAS_PDFTOTEXT = false;
try { execSync('pdftotext -v', { stdio: 'ignore' }); HAS_PDFTOTEXT = true; } catch { /* yok */ }

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, signal: AbortSignal.timeout(35000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

// "$1,641.24" -> 1641.24
const money = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// Legal description içinden dönüm (acre) tahmini — varsa.
function acresFromLegal(legal) {
  if (!legal) return null;
  // "12.5 ACS", "0.73 AC", "2 ACRES", "1 ACRE"
  const m = legal.match(/(\d+(?:\.\d+)?)\s*AC(?:RE|RES|S)?\b/i);
  if (m) { const a = parseFloat(m[1]); if (a > 0 && a < 100000) return a; }
  return null;
}

// ── 1) County listesini ana sayfadan çıkar ──────────────────────────────────
async function listCounties() {
  const html = await get(BASE + '/');
  const set = new Set();
  const re = /href="https:\/\/oktaxrolls\.com\/county\/([A-Za-z]+)"/g;
  let m;
  while ((m = re.exec(html))) set.add(m[1]);
  return [...set];
}

// ── 2) Bir county sayfasından resale döküman linklerini bul ─────────────────
async function findResaleDocs(county) {
  const html = await get(`${BASE}/county/${county}`);
  const docs = [];
  const re = /href="(https:\/\/oktaxrolls\.com\/public\/custom\/upload\/document\/[^"]+\.(txt|pdf))"/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    const fname = decodeURIComponent(url.split('/').pop());
    // Sadece RESALE / SALE içerenleri al (bidder packet / "what you should know" gibi
    // bilgilendirme dökümanlarını ele).
    if (!/resale|_sale|^sale/i.test(fname)) continue;
    if (/what.?you.?should|bidder.?packet|instruction|notice.?only|rules/i.test(fname)) continue;
    docs.push({ url, fname, ext: m[2].toLowerCase() });
  }
  // Aynı dosyayı tekrar etme
  const seen = new Set();
  return docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}

// ── 3a) Etiketli (label-based) parser — hem Atoka .txt hem Pittsburg .pdf ────
// Atoka:    "Tax ID:" / "Parcel ID:" / <owner> / "Legal Description:" / "Total Due:"
// Pittsburg: "Parcel ID:" / <owner> / "Legal Descrip(ti)on:" / "Total Due:"
// (pdftotext bazen "ti" ligatürünü düşürür → "Descrip on" toleransı.)
function parseLabeled(text, county) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  const flush = () => { if (cur && cur.apn) out.push(finalize(cur, county)); cur = null; };
  const newRec = () => ({ tid: null, apn: '', owner: '', legal: '', due: null, _inLegal: false });

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) { if (cur) cur._inLegal = false; continue; }
    let m;
    if ((m = line.match(/^Tax ID:\s*(.+)$/i))) { flush(); cur = newRec(); cur.tid = m[1].trim(); continue; }
    if ((m = line.match(/^Parcel ID:\s*(.+)$/i))) {
      // Atoka'da Parcel ID, Tax ID'den sonra gelir (aynı kayıt); Pittsburg'da
      // kayıt başıdır. Mevcut kaydın apn'i doluysa yeni kayıt başlat.
      if (!cur || cur.apn) { flush(); cur = newRec(); }
      cur.apn = m[1].trim(); cur._inLegal = false; continue;
    }
    if (!cur) continue;
    if ((m = line.match(/^Legal Descrip(?:ti)?on:\s*(.*)$/i))) { cur.legal = m[1].trim(); cur._inLegal = true; continue; }
    if ((m = line.match(/^Total Due:\s*(.+)$/i))) { cur.due = money(m[1]); cur._inLegal = false; continue; }
    // Owner: Parcel ID ile Legal arasındaki satır(lar)
    if (cur.apn && !cur.legal && cur.due == null && !cur._inLegal) { cur.owner = (cur.owner ? cur.owner + ' ' : '') + line; continue; }
    if (cur._inLegal) cur.legal += ' ' + line;
  }
  flush();
  return out;
}

// ── 3b) PDF metni parser (Bryan / Pittsburg tarzı, pdftotext -layout çıktısı) ─
// Bloklar genelde:
//   <parcel id>
//   TID:<num> <OWNER NAME>
//   <legal description satırları...>
//   ... TOTAL TAX, PENALTY, COST DUE: $amount
function parsePdfText(text, county) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  const PARCEL = /^\s*(\d{4}-\d{2}-\d{2}[A-Z]?-\d{2}[A-Z]?-\d-\d{3}-\d{2}|\d{3,4}-\d{2}-[\dA-Z-]{6,})\s*$/;
  const TID = /^\s*TID:\s*(\d+)\s+(.+?)\s*$/i;
  const DUE = /TOTAL\s+TAX,?\s+PENALTY,?\s+COST\s+DUE:\s*(?:Total\s*)?\$?([\d,]+\.\d{2})/i;
  const flush = () => { if (cur && cur.apn) out.push(finalize(cur, county)); cur = null; };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (PARCEL.test(line)) { flush(); cur = { apn: line.trim(), owner: '', legal: '', due: null }; continue; }
    if (!cur) continue;
    if ((m = line.match(TID))) { cur.tid = m[1]; cur.owner = m[2].trim(); continue; }
    if ((m = line.match(DUE))) { cur.due = money(m[1]); flush(); continue; }
    // Sayfa numarası / boş satır / gürültü -> legal'e ekleme
    if (!line.trim() || /^\d{1,3}$/.test(line.trim())) continue;
    if (cur.owner) cur.legal = (cur.legal ? cur.legal + ' ' : '') + line.trim();
  }
  flush();
  return out;
}

// Ortak: ham bloktan hedef şemaya
function finalize(r, county) {
  const owner = (r.owner || '').replace(/\s+/g, ' ').replace(/[&,]+\s*$/, '').trim() || 'UNKNOWN OWNER';
  const legal = (r.legal || '').replace(/\s+/g, ' ').trim();
  return {
    state: 'OK',
    county: `${county.toUpperCase()} COUNTY`,
    apn: r.apn || (r.tid ? `TID-${r.tid}` : null),
    owner_name: owner,
    minimum_bid: r.due ?? null,   // OK June resale: min bid = toplam vergi borcu (ya da 2/3 assessed)
    value: null,                  // bu listelerde assessed value yok; dd-enrich aşamasında doldurulur
    acres: acresFromLegal(legal),
    address: legal || null,       // metes-and-bounds legal description (gerçek adres yok)
    source: 'TAX:OK',
  };
}

// İki parser dener, daha çok satır çıkaranı seçer (format county'ye göre değişir).
function parseAny(text, county) {
  const a = parseLabeled(text, county);
  const b = parsePdfText(text, county);
  return a.length >= b.length ? a : b;
}

async function parseDoc(doc, county) {
  if (doc.ext === 'txt') {
    const text = await get(doc.url);
    return parseAny(text, county);
  }
  if (doc.ext === 'pdf') {
    if (!HAS_PDFTOTEXT) throw new Error('pdftotext yok — PDF atlandı');
    const buf = await get(doc.url, true);
    const tmp = path.join(os.tmpdir(), `okresale_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(tmp, buf);
    try {
      const text = execSync(`pdftotext -layout "${tmp}" -`, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
      return parseAny(text, county);
    } finally { try { fs.unlinkSync(tmp); } catch { /* yoksay */ } }
  }
  return [];
}

(async () => {
  console.log('→ Oklahoma June tax-resale taranıyor (oktaxrolls.com)...');
  console.log(`  pdftotext: ${HAS_PDFTOTEXT ? 'var' : 'YOK (PDF county atlanacak)'}\n`);

  let counties;
  try {
    counties = await listCounties();
  } catch (e) {
    console.error('FATAL: county listesi çekilemedi:', e.message);
    process.exit(1);
  }
  if (ONLY.length) counties = counties.filter((c) => ONLY.some((o) => o.toLowerCase() === c.toLowerCase()));
  const targets = counties.slice(0, ONLY.length ? counties.length : MAX_COUNTIES);
  console.log(`  ${counties.length} county bulundu, ${targets.length} taranacak: ${targets.join(', ')}\n`);

  const all = [];
  for (const county of targets) {
    try {
      const docs = await findResaleDocs(county);
      if (!docs.length) { console.log(`  · ${county}: resale dökümanı bulunamadı`); await sleep(300); continue; }
      let countyRows = [];
      for (const doc of docs) {
        try {
          const rows = await parseDoc(doc, county);
          countyRows = countyRows.concat(rows);
          console.log(`  ✓ ${county} · ${doc.fname} (${doc.ext}) → ${rows.length} parsel`);
        } catch (e) {
          console.log(`  ✗ ${county} · ${doc.fname}: ${e.message}`);
        }
        await sleep(250);
      }
      all.push(...countyRows);
    } catch (e) {
      console.log(`  ✗ ${county}: ${e.message}`);
    }
    await sleep(400);
  }

  // ── Özet + örnekler ───────────────────────────────────────────────────────
  console.log(`\n──────── SONUÇ ────────`);
  console.log(`Toplam parsel: ${all.length}`);
  const byCounty = {};
  for (const r of all) byCounty[r.county] = (byCounty[r.county] || 0) + 1;
  for (const [c, n] of Object.entries(byCounty)) console.log(`  ${c}: ${n}`);

  const withBid = all.filter((r) => r.minimum_bid != null);
  if (withBid.length) {
    const bids = withBid.map((r) => r.minimum_bid).sort((a, b) => a - b);
    console.log(`\nminimum_bid dolu: ${withBid.length}/${all.length} | min $${bids[0]} · medyan $${bids[Math.floor(bids.length / 2)]} · max $${bids[bids.length - 1]}`);
  }
  const withAcres = all.filter((r) => r.acres != null).length;
  console.log(`acres çıkarıldı: ${withAcres}/${all.length}`);

  console.log(`\n── Örnek 5 satır ──`);
  for (const r of all.slice(0, 5)) {
    console.log(JSON.stringify({
      state: r.state, county: r.county, apn: r.apn, owner_name: r.owner_name,
      minimum_bid: r.minimum_bid, value: r.value, acres: r.acres,
      address: (r.address || '').slice(0, 70), source: r.source,
    }));
  }

  if (process.env.OK_JSON) {
    const outPath = path.join(__dirname, 'ok_resale_sample.json');
    fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
    console.log(`\n(JSON yazıldı: ${outPath} — sadece test çıktısı, DB değil)`);
  }
  console.log('\n✅ Test tamam. (data.db / Supabase YAZILMADI.)');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
