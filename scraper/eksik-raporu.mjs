#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// EKSİK RAPORU — 15 eyaletin her biri için "neyimiz var, neyimiz yok".
//
//   node scraper/eksik-raporu.mjs           # tablo
//   node scraper/eksik-raporu.mjs --write   # state_readiness tablosuna yaz
//
// NEDEN: "veri var ama sürekli bir yanlış yapıyoruz" hissinin kaynağı, hangi
// eyalette neyin HAZIR neyin EKSİK olduğunun tek yerde görünmemesi. Bu rapor
// her eyalet için zinciri satır satır gösterir:
//     lead → mektup adresi → koordinat → geo → comp → değerleme → fiyat → not
// Bir halka eksikse o eyalet o adıma kadar hazırdır, ötesi değildir.
//
// Ayrıca fiyat KAYNAĞINI etiketler (price_basis): comp'a mı dayanıyor yoksa
// eski 2999 sabitine mi. Uydurma değeri silmiyoruz (Mohave kampanyası ona
// bağlı) ama GÖRÜNÜR yapıyoruz — sessiz uydurma olmasın.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const WRITE = process.argv.includes("--write");

async function q(pool, sql, params = [], tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { return await pool.query(sql, params); }
    catch (e) { if (i === tries - 1) throw e; await new Promise((r) => setTimeout(r, 2500 * (i + 1))); }
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 2, keepAlive: true, connectionTimeoutMillis: 30000 });
  pool.on("error", (e) => console.warn(`pg boşta: ${e.message}`));

  // ── Fiyat kaynağı etiketi (idempotent) ────────────────────────────────────
  // DB salt-okunur olabilir (depolama limiti) — rapor yine de çıkmalı.
  const ro = (await q(pool, "show transaction_read_only")).rows[0].transaction_read_only === "on";
  if (ro) console.log("⚠ VERİTABANI SALT-OKUNUR — etiketleme atlandı, rapor okunanla üretiliyor.\n");
  if (!ro) await q(pool, "alter table offmarket_leads add column if not exists price_basis text");
  // 565K satırı tek UPDATE ile etiketlemek Supabase'i düşürüyordu (57P01
  // "terminating connection due to administrator command"). Parçalı + limitli.
  const etiketle = async (etiket, kosul) => {
    for (let tur = 0; tur < 200; tur++) {
      const r = await q(pool, `update offmarket_leads set price_basis=$1
        where lead_id in (select lead_id from offmarket_leads
                          where price_basis is null and (${kosul}) limit 5000)`, [etiket]);
      if (!r.rowCount) break;
      process.stdout.write(`\r  ${etiket}: ${(tur + 1) * 5000}`);
    }
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  };
  if (!ro) await etiketle("comp", `state='FL' and est_offer is not null and acres>0
    and exists (select 1 from offer_summary o
                where o.county = regexp_replace(offmarket_leads.county,'\\s+County.*$',''))`);
  if (!ro) await etiketle("sabit-2999", `est_retail is not null and acres>0
    and abs(est_retail - 2999*least(greatest(acres,0.7),2)) < 1`);
  if (!ro) await etiketle("belirsiz", "est_offer is not null");

  // ── Eyalet bazlı hazırlık zinciri ─────────────────────────────────────────
  const { rows } = await q(pool, `
    select l.state,
      count(*) lead,
      count(*) filter (where l.owner is not null and l.mailing_address is not null) mektuplu,
      count(*) filter (where l.lat is not null) koordinatli,
      count(*) filter (where l.geo_enriched_at is not null) geo,
      count(*) filter (where l.acres > 0) donumlu,
      count(*) filter (where l.land_value > 0) degerli,
      -- price_basis kolonu yoksa/etiketlenmediyse formülden türet
      count(*) filter (where l.est_offer is not null and l.est_retail is not null and l.acres > 0
        and abs(l.est_retail - 2999*least(greatest(l.acres,0.7),2)) >= 1) comp_fiyat,
      count(*) filter (where l.est_retail is not null and l.acres > 0
        and abs(l.est_retail - 2999*least(greatest(l.acres,0.7),2)) < 1) sabit_fiyat,
      count(*) filter (where l.grade in ('A+','A')) top_not,
      count(*) filter (where l.grade is not null) notlu
    from offmarket_leads l group by 1 order by count(*) desc`);

  const comps = await q(pool, `select state, count(*) n, count(distinct county_key) cty from land_comps group by 1`);
  const compMap = new Map(comps.rows.map((r) => [r.state, r]));
  const val = await q(pool, `select state, count(*) filter (where tier in ('T1','T2')) t1 from county_valuation group by 1`);
  const valMap = new Map(val.rows.map((r) => [r.state, Number(r.t1)]));
  const own = await q(pool, `select state, count(*) n, count(distinct owner) sahip from parcel_owners group by 1`);
  const ownMap = new Map(own.rows.map((r) => [r.state, r]));

  const yuzde = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const isaret = (p) => (p >= 90 ? "✓" : p >= 40 ? "~" : "✗");

  console.log("15 EYALET HAZIRLIK TABLOSU");
  console.log("(✓ ≥%90  ~ %40-89  ✗ <%40 · comp/rakip sütunları adet)\n");
  console.log("ST      LEAD   MEKTUP  KOORD   GEO   DÖNÜM   COMP  DEĞERLEME  FİYAT-KAYNAK   RAKİP    A+/A");
  const satirlar = [];
  for (const r of rows) {
    const n = Number(r.lead);
    const c = compMap.get(r.state);
    const o = ownMap.get(r.state);
    const compFiyat = Number(r.comp_fiyat), sabitFiyat = Number(r.sabit_fiyat);
    const fiyatEtiket = compFiyat > 0
      ? `comp ${yuzde(compFiyat, n)}%`
      : sabitFiyat > 0 ? `SABİT ${yuzde(sabitFiyat, n)}%` : "yok";
    const s = {
      state: r.state, lead: n,
      mektup: yuzde(Number(r.mektuplu), n), koord: yuzde(Number(r.koordinatli), n),
      geo: yuzde(Number(r.geo), n), donum: yuzde(Number(r.donumlu), n),
      comp: c ? Number(c.n) : 0, comp_county: c ? Number(c.cty) : 0,
      degerleme: valMap.get(r.state) ?? 0,
      comp_fiyat: compFiyat, sabit_fiyat: sabitFiyat,
      rakip: o ? Number(o.sahip) : 0,
      top_not: Number(r.top_not), notlu: Number(r.notlu),
    };
    satirlar.push(s);
    console.log(
      `${r.state.padEnd(6)}${String(n).padStart(7)}` +
      `${(isaret(s.mektup) + s.mektup + "%").padStart(8)}` +
      `${(isaret(s.koord) + s.koord + "%").padStart(8)}` +
      `${(isaret(s.geo) + s.geo + "%").padStart(7)}` +
      `${(isaret(s.donum) + s.donum + "%").padStart(8)}` +
      `${String(s.comp).padStart(7)}${String(s.degerleme).padStart(10)} county` +
      `${fiyatEtiket.padStart(14)}${String(s.rakip).padStart(8)}${String(s.top_not).padStart(8)}`
    );
  }

  // ── Eksik listesi: en yüksek etkili boşluklar ────────────────────────────
  console.log("\n═══ EN BÜYÜK BOŞLUKLAR (lead sayısına göre) ═══");
  const bosluklar = [];
  for (const s of satirlar) {
    if (s.comp === 0) bosluklar.push({ etki: s.lead, ne: `${s.state}: comp YOK — değerleme kurulamaz`, nasil: "county GIS'inde satış alanı ara (SALEP/SALE_PRC benzeri) veya non-disclosure ise kapalı kaynak" });
    else if (s.degerleme === 0) bosluklar.push({ etki: s.lead, ne: `${s.state}: comp var ama T1/T2 county yok`, nasil: "build-county-valuation.mjs — örneklem/ölçek kontrolü" });
    if (s.comp_fiyat === 0 && s.sabit_fiyat > 0) bosluklar.push({ etki: s.sabit_fiyat, ne: `${s.state}: fiyatlar hâlâ 2999 SABİTİNDEN (${s.sabit_fiyat} lead)`, nasil: "comp topla → teklif-motoru.mjs o eyalete genişlet" });
    if (s.donum < 40) bosluklar.push({ etki: s.lead, ne: `${s.state}: dönüm verisi %${s.donum} — fiyatlama imkânsız`, nasil: "parsel kaynağından acreage çek" });
    if (s.mektup < 40) bosluklar.push({ etki: s.lead, ne: `${s.state}: mektup adresi %${s.mektup}`, nasil: "skip-trace (PropStream) veya adresli kaynak" });
    if (s.rakip === 0 && s.lead > 5000) bosluklar.push({ etki: s.lead, ne: `${s.state}: rakip taraması YOK`, nasil: "harvest-owners.mjs o eyalete adaptör yaz" });
  }
  bosluklar.sort((a, b) => b.etki - a.etki);
  for (const b of bosluklar.slice(0, 18))
    console.log(`  ${String(b.etki).padStart(7)} lead · ${b.ne}\n            → ${b.nasil}`);

  if (WRITE && !ro) {
    await q(pool, `create table if not exists state_readiness (
      state text primary key, lead int, mektup_pct int, koord_pct int, geo_pct int,
      donum_pct int, comp_n int, comp_county int, degerleme_county int,
      comp_fiyat int, sabit_fiyat int, rakip_sahip int, top_not int, notlu int,
      built_at timestamptz default now())`);
    for (const s of satirlar) {
      await q(pool, `insert into state_readiness (state,lead,mektup_pct,koord_pct,geo_pct,donum_pct,
          comp_n,comp_county,degerleme_county,comp_fiyat,sabit_fiyat,rakip_sahip,top_not,notlu,built_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
        on conflict (state) do update set lead=excluded.lead, mektup_pct=excluded.mektup_pct,
          koord_pct=excluded.koord_pct, geo_pct=excluded.geo_pct, donum_pct=excluded.donum_pct,
          comp_n=excluded.comp_n, comp_county=excluded.comp_county,
          degerleme_county=excluded.degerleme_county, comp_fiyat=excluded.comp_fiyat,
          sabit_fiyat=excluded.sabit_fiyat, rakip_sahip=excluded.rakip_sahip,
          top_not=excluded.top_not, notlu=excluded.notlu, built_at=now()`,
        [s.state, s.lead, s.mektup, s.koord, s.geo, s.donum, s.comp, s.comp_county,
         s.degerleme, s.comp_fiyat, s.sabit_fiyat, s.rakip, s.top_not, s.notlu]);
    }
    console.log(`\n✓ state_readiness yazıldı (${satirlar.length} eyalet)`);
  }
  await pool.end();
}

if (process.argv[1]?.endsWith("eksik-raporu.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
