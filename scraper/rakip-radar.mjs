#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// RAKİP RADAR — competitor_snapshots'taki HAM günlük taramaları İSTİHBARATA
// çevirir: ilan ömrü (DOM), fiyat değişimi, kaybolma (=satış şüphesi),
// county emilim oranı.
//
//   node scraper/rakip-radar.mjs          # analiz + yaz
//   node scraper/rakip-radar.mjs --dry    # sadece rapor
//
// NEDEN: competitor-scraper zaten her gece (run-all.sh → com.terralot.sourcing)
// snapshot alıyor ve 7.335 kayıt birikmiş — ama kimse bunlardan DOM/satış
// sinyali üretmiyordu. Ham veri istihbarat değildir.
//
// ── İKİ TUZAK VE KORUMALARI ─────────────────────────────────────────────────
// 1) KAYBOLMA ≠ SATIŞ. İlan sitedan çekilmiş, URL'i değişmiş veya sezonluk
//    gizlenmiş olabilir. Bu yüzden "satıldı" DEMİYORUZ; `gone_confidence`
//    veriyoruz: ardışık kaç turda görülmedi + rakibin tipik DOM'una göre.
// 2) SCRAPER KÖRLÜĞÜ. Bir turda site down/pagination hatası olursa o rakibin
//    TÜM ilanları "kayboldu" görünür ve istatistik çöp olur. Koruma: bir turda
//    rakibin ilan sayısı önceki turun %60'ının altına düşerse o tur
//    GÜVENİLMEZ sayılır, kaybolma hesabına katılmaz.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const DRY = process.argv.includes("--dry");
const RUN_TRUST_RATIO = 0.6;   // tur güvenilirlik eşiği
const GONE_MIN_RUNS = 2;       // en az bu kadar ardışık turda yoksa "gitti"

/**
 * SAF: hangi turlar güvenilmez? Rakip bazında, ilan sayısı bir önceki
 * güvenilir turun RUN_TRUST_RATIO'sunun altına düşen tur şüphelidir.
 * runs: [{ day, competitor, n }] (gün artan sırada)
 * Dönen: Set("competitor|day")
 */
export function findUntrustedRuns(runs, ratio = RUN_TRUST_RATIO) {
  const bad = new Set();
  const hist = new Map(); // competitor → son turların ilan sayıları
  for (const r of runs) {
    const h = hist.get(r.competitor) ?? [];
    // Taban = son 5 turun MEDYANI. "Son iyi tur"a kıyaslamak kırılgandı:
    // scraper bir gün iki kez koşup ilan sayısını 3x şişirince (07-03: 543
    // vs normal 181) sonraki TÜM turlar güvenilmez damgası yiyordu.
    // Medyan tek uç değere karşı dayanıklı.
    if (h.length >= 3) {
      const s = [...h].sort((a, b) => a - b);
      const base = s[s.length >> 1];
      if (r.n < base * ratio) { bad.add(`${r.competitor}|${r.day}`); continue; }
    }
    h.push(r.n);
    if (h.length > 5) h.shift();
    hist.set(r.competitor, h);
  }
  return bad;
}

/**
 * SAF: ilan yaşam döngüsünden kaybolma güveni.
 * missedRuns = son görülmeden sonra kaç GÜVENİLİR tur geçti.
 */
export function goneConfidence(missedRuns, daysVisible, medianDom) {
  if (missedRuns < GONE_MIN_RUNS) return { gone: false, confidence: "aktif" };
  // Rakibin tipik DOM'una yakın süre görünüp kaybolduysa satış olma ihtimali yüksek.
  const near = medianDom > 0 && daysVisible >= medianDom * 0.5;
  if (missedRuns >= 4 && near) return { gone: true, confidence: "yüksek" };
  if (missedRuns >= 3) return { gone: true, confidence: "orta" };
  return { gone: true, confidence: "düşük" };
}

const median = (a) => {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg boşta hata: ${e.message}`));

  if (!DRY) {
    await pool.query(`
      create table if not exists competitor_intel (
        listing_key text primary key,
        competitor text, title text, state text, county text,
        first_seen date, last_seen date, days_visible int,
        first_price numeric, last_price numeric, price_changes int,
        status text, gone_confidence text,
        analyzed_at timestamptz default now()
      );
      create index if not exists idx_comp_intel_state on competitor_intel (state, county);`);
  }

  // Tur envanteri — güvenilmez turları tespit et.
  const runsQ = await pool.query(
    `select to_char(run_at::date,'YYYY-MM-DD') d, competitor, count(distinct listing_key) n from competitor_snapshots
     group by 1,2 order by 1 asc`);
  const runs = runsQ.rows.map((r) => ({ day: String(r.d).slice(0, 10), competitor: r.competitor, n: Number(r.n) }));
  const untrusted = findUntrustedRuns(runs);
  const allDays = [...new Set(runs.map((r) => r.day))].sort();
  const latestDay = allDays[allDays.length - 1];
  if (untrusted.size) console.log(`⚠ güvenilmez tur (scraper körlüğü şüphesi): ${[...untrusted].join(", ")}`);

  // İlan yaşam döngüleri.
  const lifeQ = await pool.query(`
    select listing_key, max(competitor) competitor, max(title) title,
           max(state) state, max(county) county,
           to_char(min(run_at::date),'YYYY-MM-DD') ilk, to_char(max(run_at::date),'YYYY-MM-DD') son,
           count(distinct run_at::date) gun_sayisi,
           min(price) min_p, max(price) max_p,
           count(distinct price) farkli_fiyat
    from competitor_snapshots group by listing_key`);

  // Rakip başına medyan DOM (sadece kaybolmuş ilanlardan — hâlâ aktif olanlar
  // DOM'u aşağı çeker, o yüzden hariç).
  const domByComp = new Map();
  for (const r of lifeQ.rows) {
    const son = String(r.son).slice(0, 10);
    if (son === latestDay) continue;
    const d = Math.round((new Date(son) - new Date(String(r.ilk).slice(0, 10))) / 86400000);
    if (!domByComp.has(r.competitor)) domByComp.set(r.competitor, []);
    domByComp.get(r.competitor).push(d);
  }
  const medDom = new Map([...domByComp].map(([k, v]) => [k, median(v)]));

  const out = [];
  for (const r of lifeQ.rows) {
    const ilk = String(r.ilk).slice(0, 10), son = String(r.son).slice(0, 10);
    const daysVisible = Math.round((new Date(son) - new Date(ilk)) / 86400000);
    // Son görülmeden sonraki GÜVENİLİR tur sayısı.
    const missed = allDays.filter((d) => d > son && !untrusted.has(`${r.competitor}|${d}`)).length;
    const g = goneConfidence(missed, daysVisible, medDom.get(r.competitor) ?? 0);
    out.push({
      listing_key: r.listing_key, competitor: r.competitor, title: r.title,
      state: r.state, county: r.county, first_seen: ilk, last_seen: son,
      days_visible: daysVisible, first_price: r.min_p, last_price: r.max_p,
      price_changes: Math.max(0, Number(r.farkli_fiyat) - 1),
      status: g.gone ? "GITTI" : "AKTIF", gone_confidence: g.confidence,
    });
  }

  console.log(`\nRAKIP        aktif  gitti(yuksek/orta/dusuk)  medyan_DOM  fiyat_degisen`);
  const byComp = new Map();
  for (const o of out) {
    if (!byComp.has(o.competitor)) byComp.set(o.competitor, { aktif: 0, y: 0, o: 0, d: 0, fd: 0 });
    const s = byComp.get(o.competitor);
    if (o.status === "AKTIF") s.aktif++;
    else if (o.gone_confidence === "yüksek") s.y++;
    else if (o.gone_confidence === "orta") s.o++;
    else s.d++;
    if (o.price_changes > 0) s.fd++;
  }
  for (const [k, s] of byComp) {
    console.log(`  ${k.padEnd(15)}${String(s.aktif).padStart(5)}${String(s.y + "/" + s.o + "/" + s.d).padStart(20)}${String(medDom.get(k) ?? "-").padStart(12)}${String(s.fd).padStart(15)}`);
  }

  // County emilim — likidite modelinin girdisi.
  const abs = new Map();
  for (const o of out) {
    if (!o.state || !o.county) continue;
    const k = `${o.state}|${o.county}`;
    if (!abs.has(k)) abs.set(k, { aktif: 0, gitti: 0 });
    abs.get(k)[o.status === "AKTIF" ? "aktif" : "gitti"]++;
  }
  const absSorted = [...abs].map(([k, v]) => ({ k, ...v, oran: v.aktif ? v.gitti / v.aktif : null }))
    .filter((x) => x.aktif + x.gitti >= 3).sort((a, b) => (b.oran ?? 0) - (a.oran ?? 0));
  console.log(`\nCOUNTY EMILIM (gitti/aktif — yuksek = hizli donuyor):`);
  for (const x of absSorted.slice(0, 12))
    console.log(`  ${x.k.padEnd(28)} aktif ${String(x.aktif).padStart(3)} · gitti ${String(x.gitti).padStart(3)} · oran ${x.oran == null ? "-" : x.oran.toFixed(2)}`);

  console.log(`\nNOT: "gitti" satis DEGIL, satis SUPHESIDIR. Kesinlik icin tapu`);
  console.log(`     dogrulamasi gerekir (rakip-tapu*.mjs kalibi).`);

  if (!DRY) {
    for (let i = 0; i < out.length; i += 500) {
      const part = out.slice(i, i + 500);
      const vals = [], params = [];
      part.forEach((o, j) => {
        const b = j * 13;
        vals.push(`(${Array.from({ length: 13 }, (_, k) => `$${b + k + 1}`).join(",")})`);
        params.push(o.listing_key, o.competitor, o.title, o.state, o.county, o.first_seen, o.last_seen,
          o.days_visible, o.first_price, o.last_price, o.price_changes, o.status, o.gone_confidence);
      });
      await pool.query(
        `insert into competitor_intel (listing_key,competitor,title,state,county,first_seen,last_seen,
           days_visible,first_price,last_price,price_changes,status,gone_confidence)
         values ${vals.join(",")}
         on conflict (listing_key) do update set last_seen=excluded.last_seen,
           days_visible=excluded.days_visible, last_price=excluded.last_price,
           price_changes=excluded.price_changes, status=excluded.status,
           gone_confidence=excluded.gone_confidence, analyzed_at=now()`,
        params);
    }
    console.log(`\n✓ competitor_intel yazildi (${out.length} ilan)`);
  }
  await pool.end();
}

/**
 * Kopan bağlantıda yeniden dener.
 *
 * NEDEN (2026-08-12): gece turunda radar "Connection terminated unexpectedly"
 * ile düşüyordu — Supabase uzun süren aggregate sorgusunda bağlantıyı
 * kapatınca tur BAŞARISIZ damgası yiyordu. Aynı komut elle koşturulduğunda
 * sorunsuz bitiyor, yani hata kalıcı değil GEÇİCİ. Kalıcı hatalarda
 * (yetki/şema) boşuna beklememek için sadece bağlantı hataları yeniden denenir.
 */
const GECICI_RE = /Connection terminated|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up|terminating connection/i;

async function calistir() {
  for (let deneme = 1; deneme <= 3; deneme++) {
    try {
      await main();
      return;
    } catch (e) {
      const gecici = GECICI_RE.test(String(e?.message ?? ""));
      if (!gecici || deneme === 3) throw e;
      const bekle = deneme * 15_000;
      console.warn(`radar: bağlantı koptu (${e.message}) — ${bekle / 1000}sn sonra ${deneme + 1}. deneme`);
      await new Promise((r) => setTimeout(r, bekle));
    }
  }
}

if (process.argv[1]?.endsWith("rakip-radar.mjs")) {
  calistir().catch((e) => { console.error(e); process.exit(1); });
}
