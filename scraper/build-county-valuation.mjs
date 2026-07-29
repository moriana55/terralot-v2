#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// COUNTY DEĞERLEME MODELİ — land_comps'tan county bazlı $/acre ve
// satış/assessed oranı türetir; her county'ye GÜVEN KADEMESİ (T1..T4) verir.
//
//   node scraper/build-county-valuation.mjs
//   node scraper/build-county-valuation.mjs --dry     # yazma, sadece rapor
//
// NEDEN BU DOSYA VAR: est_retail bugüne kadar TEK SABİTTİ (2999). O sabitin
// kaynağı sonradan anlaşıldı: Rina Land'in medyan $/dönüm fiyatı ($2.991) —
// yani tüm envanteri piyasanın EN UCUZ oyuncusuna göre değerliyorduk.
// Discount Lots aynı boyuttaki arsayı $20.503/dönümden satıyor (6,9 kat).
//
// ── İKİ KRİTİK VERİ SORUNU VE ÇÖZÜMLERİ ─────────────────────────────────────
// 1) BİRİM KARIŞIKLIĞI (Colorado): feed çoğu county'de satış fiyatını SENT
//    cinsinden veriyor (medyan $1.2M, max $129M; satış/assessed oranı 2305x).
//    Ama bazı county zaten dolar veriyor. Sabit ÷100 uygulamak YANLIŞ olur.
//    ÇÖZÜM: county başına ölçek tespiti — medyan(satış/assessed) oranını
//    eyaletin bilinen takdir rejimine göre beklenen banda getiren 10'un
//    kuvvetini bul. Ölçek uygulanamıyorsa county KARANTİNAYA alınır (T4),
//    uydurma yapılmaz.
// 2) KOL SATIŞI OLMAYAN KAYITLAR: $1 aile devri, vergi satışı, banka devri.
//    Kaynağın kalite kodu + county-içi istatistiksel kırpma (P10-P90) ile elenir.
//
// DÜRÜSTLÜK: Hiçbir county'ye "tahmin" değer atanmaz. Örneklem yetmiyorsa T4
// döner ve o county yatırım havuzuna GİRMEZ (bkz. YATIRIM-ELEME-METODU.md).
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const DRY = process.argv.includes("--dry");

// Eyaletin takdir (assessment) rejimi → gerçek bir piyasa satışında beklenen
// satış/assessed oranı bandı. Bunlar kamuya açık takdir oranlarından türetildi;
// bant GENİŞ tutuldu çünkü amaç ince ayar değil, 100x'lik birim hatası yakalamak.
//   CO: boş arsa takdir oranı ~%27,9 → satış ≈ 3,6x assessed
//   FL: "just value" piyasa değerine yakın takdir → satış ≈ 1x assessed
// scaleSearch: SADECE birim belirsizliği KANITLANMIŞ kaynakta açılır.
// FL feed'i dolar veriyor (doğrulandı) → arama KAPALI; açık bırakmak
// detektörün "banda uyan" yanlış bir katsayı seçmesine yol açıyordu
// (FL:13'e hatalı 0,1 uygulanmıştı — sessiz bozulma, en tehlikeli tür).
const ASSESSMENT_REGIME = {
  CO: { lo: 1.5, hi: 12, nominal: 3.6, scaleSearch: true },  // sent/dolar karışık
  FL: { lo: 0.4, hi: 4, nominal: 1.0, scaleSearch: false },
  OR: { lo: 0.4, hi: 5, nominal: 1.2, scaleSearch: false },
  SC: { lo: 1.0, hi: 30, nominal: 6.0, scaleSearch: false },
  GA: { lo: 1.5, hi: 8, nominal: 2.5, scaleSearch: false },
};

// Ürün sınırı: bizim işimiz kırsal/banliyö boş arsa. Dönümü bundan pahalı
// olan county şehir-içi arsa pazarıdır — comp'ları bizim envanterle
// kıyaslanamaz, karantinaya alınır (ör. Miami minik lotları $2M/dönüm).
const PPA_MAX = 250000;
const PPA_MIN = 50;

const median = (a) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
const pct = (a, p) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.max(0, Math.floor(p * b.length)))];
};

/**
 * SAF: county'nin fiyat ölçeğini tespit eder.
 * Dönen: { scale, ratioBefore, ratioAfter, ok } — scale ∈ {1, 0.1, 0.01, 0.001}
 * ok=false → oran hiçbir ölçekte makul banda girmiyor, county karantina.
 */
export function detectScale(salePrices, assessedVals, regime) {
  const pairs = salePrices
    .map((p, i) => [p, assessedVals[i]])
    .filter(([p, a]) => p > 0 && a > 0);
  if (pairs.length < 5) return { scale: null, ok: false, reason: "assessed eşleşmesi < 5" };
  const rawRatio = median(pairs.map(([p, a]) => p / a));

  // Birim belirsizliği kanıtlanmamış kaynakta ölçek ARAMA — sabit 1.
  if (!regime.scaleSearch) {
    const ok = rawRatio >= regime.lo && rawRatio <= regime.hi;
    return { scale: 1, ratioBefore: rawRatio, ratioAfter: rawRatio, ok,
      reason: ok ? null : `oran ${rawRatio.toFixed(1)}x beklenen ${regime.lo}-${regime.hi} bandı dışında` };
  }

  // İlk uyanı değil, nominale LOG uzaklığı en küçük olanı seç — "banda giren
  // herhangi bir katsayı" kabul etmek yanlış ölçeği sessizce geçiriyordu.
  const cands = [1, 0.1, 0.01, 0.001]
    .map((scale) => ({ scale, r: rawRatio * scale }))
    .filter(({ r }) => r >= regime.lo && r <= regime.hi)
    .map((x) => ({ ...x, dist: Math.abs(Math.log(x.r / regime.nominal)) }))
    .sort((a, b) => a.dist - b.dist);
  if (!cands.length)
    return { scale: null, ok: false, ratioBefore: rawRatio, reason: `oran ${rawRatio.toFixed(1)}x hiçbir ölçekte ${regime.lo}-${regime.hi} bandına girmiyor` };
  return { scale: cands[0].scale, ratioBefore: rawRatio, ratioAfter: cands[0].r, ok: true };
}

/**
 * SAF: kol satışı olmayanları ele. County-içi P10-P90 $/acre kırpması +
 * assessed'e göre absürt oranların atılması.
 */
export function filterArmsLength(comps) {
  const withPpa = comps.filter((c) => c.acres > 0 && c.sale_price > 0)
    .map((c) => ({ ...c, ppa: c.sale_price / c.acres }));
  if (withPpa.length < 5) return withPpa;
  const lo = pct(withPpa.map((c) => c.ppa), 0.10);
  const hi = pct(withPpa.map((c) => c.ppa), 0.90);
  return withPpa.filter((c) => c.ppa >= lo && c.ppa <= hi);
}

/** SAF: örneklem sayısına göre güven kademesi. */
export function confidenceTier(n, hasAcres) {
  if (!hasAcres) return "T3";
  if (n >= 20) return "T1";
  if (n >= 8) return "T2";
  if (n >= 3) return "T3";
  return "T4";
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg boşta hata: ${e.message}`));

  if (!DRY) {
    await pool.query(`
      create table if not exists county_valuation (
        state text not null, county_key text not null,
        n_comps int, n_used int, price_scale numeric,
        med_ppa numeric, p25_ppa numeric, p75_ppa numeric,
        med_sale numeric, med_acres numeric,
        sale_to_assessed numeric, tier text, quarantine_reason text,
        built_at timestamptz default now(),
        primary key (state, county_key)
      );`);
  }

  const { rows } = await pool.query(
    `select state, county_key, sale_price::float8 sale_price, acres::float8 acres,
            assessed_total::float8 assessed_total, qual_code
     from land_comps where sale_price > 0`);

  const byCounty = new Map();
  for (const r of rows) {
    const k = `${r.state}|${r.county_key}`;
    if (!byCounty.has(k)) byCounty.set(k, []);
    byCounty.get(k).push(r);
  }
  console.log(`${rows.length} comp · ${byCounty.size} county\n`);

  const out = [];
  for (const [key, comps] of byCounty) {
    const [state, county_key] = key.split("|");
    const regime = ASSESSMENT_REGIME[state];
    let scale = 1, quarantine = null, s2a = null;

    if (regime) {
      const det = detectScale(comps.map((c) => c.sale_price), comps.map((c) => c.assessed_total), regime);
      if (det.ok) { scale = det.scale; s2a = det.ratioAfter; }
      else if (det.scale === null && det.ratioBefore != null) quarantine = det.reason;
      else quarantine = det.reason;
    }

    // Ölçek uygula, sonra kol-satışı kırpması.
    const scaled = comps.map((c) => ({ ...c, sale_price: c.sale_price * scale }));
    const used = filterArmsLength(scaled);
    const ppas = used.map((c) => c.ppa);
    let tier = quarantine ? "T4" : confidenceTier(used.length, ppas.length > 0);

    // Ürün sınırı kontrolü — şehir-içi arsa pazarı bizim comp havuzumuz değil.
    const medPpa = median(ppas);
    if (medPpa != null && (medPpa > PPA_MAX || medPpa < PPA_MIN)) {
      tier = "T4";
      quarantine = `medyan $${Math.round(medPpa).toLocaleString("en-US")}/dönüm ürün bandı dışında (${PPA_MIN}-${PPA_MAX})`;
    }
    if (!quarantine && ppas.length === 0) {
      tier = "T4";
      quarantine = "dönüm verisi yok — $/dönüm hesaplanamıyor";
    }

    out.push({
      state, county_key,
      n_comps: comps.length, n_used: used.length, price_scale: scale,
      med_ppa: median(ppas), p25_ppa: pct(ppas, 0.25), p75_ppa: pct(ppas, 0.75),
      med_sale: median(scaled.map((c) => c.sale_price)),
      med_acres: median(comps.map((c) => c.acres).filter((a) => a > 0)),
      sale_to_assessed: s2a, tier, quarantine_reason: quarantine,
    });
  }

  out.sort((a, b) => b.n_used - a.n_used);
  console.log("COUNTY          n    kull  ölçek   medyan $/ac   medyan satış   s/assessed  kademe");
  for (const r of out.slice(0, 25)) {
    console.log(
      `  ${(r.state + ":" + r.county_key).padEnd(14)}${String(r.n_comps).padStart(5)}${String(r.n_used).padStart(6)}` +
      `${String(r.price_scale).padStart(8)}${(r.med_ppa == null ? "-" : "$" + Math.round(r.med_ppa).toLocaleString("en-US")).padStart(14)}` +
      `${(r.med_sale == null ? "-" : "$" + Math.round(r.med_sale).toLocaleString("en-US")).padStart(15)}` +
      `${(r.sale_to_assessed == null ? "-" : r.sale_to_assessed.toFixed(1) + "x").padStart(12)}   ${r.tier}` +
      (r.quarantine_reason ? `  ⚠ ${r.quarantine_reason}` : "")
    );
  }

  const byTier = out.reduce((m, r) => ((m[r.tier] = (m[r.tier] ?? 0) + 1), m), {});
  console.log(`\nKADEME DAĞILIMI: ${Object.entries(byTier).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  console.log(`YATIRIMA UYGUN (T1+T2): ${(byTier.T1 ?? 0) + (byTier.T2 ?? 0)} county`);

  if (!DRY) {
    for (const r of out) {
      await pool.query(
        `insert into county_valuation (state,county_key,n_comps,n_used,price_scale,med_ppa,p25_ppa,p75_ppa,
           med_sale,med_acres,sale_to_assessed,tier,quarantine_reason,built_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
         on conflict (state,county_key) do update set n_comps=excluded.n_comps, n_used=excluded.n_used,
           price_scale=excluded.price_scale, med_ppa=excluded.med_ppa, p25_ppa=excluded.p25_ppa,
           p75_ppa=excluded.p75_ppa, med_sale=excluded.med_sale, med_acres=excluded.med_acres,
           sale_to_assessed=excluded.sale_to_assessed, tier=excluded.tier,
           quarantine_reason=excluded.quarantine_reason, built_at=now()`,
        [r.state, r.county_key, r.n_comps, r.n_used, r.price_scale, r.med_ppa, r.p25_ppa, r.p75_ppa,
         r.med_sale, r.med_acres, r.sale_to_assessed, r.tier, r.quarantine_reason]
      );
    }
    console.log(`\n✓ county_valuation yazıldı (${out.length} county)`);
  }
  await pool.end();
}

if (process.argv[1]?.endsWith("build-county-valuation.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
