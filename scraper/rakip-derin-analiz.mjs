#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// RAKİP DERİN ANALİZ — parcel_owners üzerinden operatör profili çıkarır.
//
//   node scraper/rakip-derin-analiz.mjs            # rapor
//   node scraper/rakip-derin-analiz.mjs --pdf      # + PDF
//
// SORDUĞU SORULAR (sadece "kimde kaç parsel var" değil):
//   1. Kim gerçek rakip, kim ev üreticisi? (ikisi aynı arsaya talip ama
//      üretici inşaat marjını da kaptığı için DAHA FAZLA ödeyebilir)
//   2. Aynı posta adresini paylaşan LLC'ler → tek operatörün şirket ailesi
//   3. Ne zaman almışlar → hızlanıyorlar mı, duruyorlar mı
//   4. Piyasaya göre ucuza mı pahalıya mı alıyorlar (county comp'una kıyasla)
//   5. Eyalet dışından mı yönetiliyorlar (uzaktan operasyon = bizim de yapabileceğimiz)
//
// ⚠️ ALIM FİYATI: SALE_PRC1 parselin SON kayıtlı bedeli. QUAL_CD1 Florida DOR'un
// resmi kalite kodudur; "01" ve "02" nitelikli (kol) satıştır, gerisi
// nitelikli DEĞİL (aile devri, düzeltme tapusu, haciz vb). Mohave'de bu ayrımı
// yapamadığımız için çarpan hesabı çöpe gitmişti — burada kod var, kullanılıyor.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

// Florida DOR nitelikli satış kodları (kol satışı sayılanlar).
const QUALIFIED = new Set(["01", "02", "1", "2"]);

// Ev üreticisi / geliştirici kalıpları — bunlar arsa çevirici DEĞİL.
const BUILDER_RE = /\b(HOMES?|HOMEBUILD|BUILDERS?|CONSTRUCTION|DEVELOPMENT|DEVELOPERS?|RESIDENTIAL|COMMUNITIES|LENNAR|TOLL|DR HORTON|PULTE|MERITAGE|ADAMS HOMES|MAronda|HABITAT)\b/i;
// Arsa çevirici / yatırımcı kalıpları.
const LANDCO_RE = /\b(LAND|LOTS?|ACRE|PARCEL|REALTY|PROPERT|INVEST|CAPITAL|VENTURES?|HOLDINGS?|ASSETS?|EQUITY|ACQUISITION)\b/i;
// Tüzel kişi olduğunu gösteren ekler (gerçek şahısları analizden çıkarmak için).
const ENTITY_RE = /\b(LLC|L\.L\.C|INC|CORP|CO|COMPANY|LTD|LP|LLP|TRUST|PARTNERS|GROUP|FUND)\b\.?/i;

export function classify(owner) {
  const o = String(owner ?? "").toUpperCase();
  if (!ENTITY_RE.test(o)) return "sahis";
  if (BUILDER_RE.test(o)) return "uretici";
  if (LANDCO_RE.test(o)) return "arsa_yatirimcisi";
  return "diger_tuzel";
}

/** SAF: aynı posta adresini paylaşan sahipleri kümeler → şirket ailesi. */
export function groupByAddress(rows) {
  const key = (r) => [r.owner_addr, r.owner_city, r.owner_state]
    .map((x) => String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")).join("|");
  const m = new Map();
  for (const r of rows) {
    // SOKAK ADRESİ ZORUNLU: adres alanı boşken şehir+eyalete göre kümelemek
    // "Orlando'daki 20 şirket aynı aile" gibi saçma sonuç veriyordu.
    const sokak = String(r.owner_addr ?? "").replace(/[^A-Za-z0-9]/g, "");
    if (sokak.length < 6) continue;
    const k = key(r);
    if (!m.has(k)) m.set(k, { addr: `${r.owner_addr}, ${r.owner_city}, ${r.owner_state}`, owners: new Set(), parsel: 0 });
    const g = m.get(k);
    g.owners.add(r.owner);
    g.parsel += r.n;
  }
  return [...m.values()].filter((g) => g.owners.size > 1).sort((a, b) => b.parsel - a.parsel);
}

/** SAF: sahip adı normalizasyonu — "CAH - ECFL" ile "CAH-ECFL", "Holiday Builders Inc"
 * ile "HOLIDAY BUILDERS INC" aynı şirkettir; normalize edilmezse sayımlar bölünür. */
export function normOwner(o) {
  return String(o ?? "").toUpperCase()
    .replace(/[.,]/g, " ").replace(/\s*-\s*/g, "-")
    .replace(/\b(L L C|LLC)\b/g, "LLC").replace(/\bINCORPORATED\b/g, "INC")
    .replace(/\s+/g, " ").trim();
}

/** SAF: eyalet normalizasyonu — alan bazen "FL" bazen "FLORIDA" geliyor;
 * ham karşılaştırma "Weeki Wachee, FLORIDA"yı eyalet dışı sanıyordu. */
export function normState(s) {
  const t = String(s ?? "").toUpperCase().trim();
  return t === "FLORIDA" ? "FL" : t;
}

const usd = (v) => (v == null ? "—" : "$" + Math.round(Number(v)).toLocaleString("en-US"));

const WRITE = process.argv.includes("--write");

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg: ${e.message}`));
  if (WRITE) {
    // Ağır gruplama burada (doğrudan pg erişimi var); UI hafif tabloyu okur.
    await pool.query(`
      create table if not exists competitor_profile (
        owner text primary key, tip text, parsel int, county_n int, countyler text,
        toplam_acres numeric, toplam_assessed numeric, nitelikli_alim int,
        med_alim numeric, med_ppa numeric, ilk_yil int, son_yil int, son2yil_alim int,
        owner_city text, owner_state text, owner_addr text, analyzed_at timestamptz default now()
      );
      create table if not exists competitor_family (
        addr text primary key, sirket_n int, parsel int, sirketler text,
        analyzed_at timestamptz default now()
      );`);
  }

  // Sahip bazında toplu profil. Nitelikli satış filtresi burada uygulanır.
  const q = await pool.query(`
    select owner, max(owner_addr) owner_addr, max(owner_city) owner_city, max(owner_state) owner_state,
      count(*) n,
      count(distinct county) county_n,
      string_agg(distinct county, ', ') countyler,
      round(sum(acres)::numeric,1) toplam_ac,
      round(sum(assessed_total)::numeric) toplam_assessed,
      count(*) filter (where qual_code in ('01','02','1','2') and last_sale_price > 1000) nitelikli_alim,
      round(percentile_cont(0.5) within group (order by last_sale_price)
        filter (where qual_code in ('01','02','1','2') and last_sale_price > 1000)::numeric) med_nitelikli_alim,
      round(percentile_cont(0.5) within group (order by last_sale_price/nullif(acres,0))
        filter (where qual_code in ('01','02','1','2') and last_sale_price > 1000)::numeric) med_ppa,
      min(last_sale_year) filter (where last_sale_price > 1000) ilk_yil,
      max(last_sale_year) filter (where last_sale_price > 1000) son_yil,
      count(*) filter (where last_sale_year >= 2024) son2yil_alim
    from parcel_owners
    group by owner`);

  // Normalize edilmiş ada göre birleştir (aynı şirketin yazım varyantları).
  const merged = new Map();
  for (const r of q.rows) {
    const k = normOwner(r.owner);
    if (!merged.has(k)) merged.set(k, { ...r, owner: k, n: 0, nitelikli_alim: 0, son2yil_alim: 0,
      toplam_ac: 0, toplam_assessed: 0, _alim: [], _ppa: [], _cty: new Set() });
    const m = merged.get(k);
    m.n += Number(r.n); m.nitelikli_alim += Number(r.nitelikli_alim ?? 0);
    m.son2yil_alim += Number(r.son2yil_alim ?? 0);
    m.toplam_ac += Number(r.toplam_ac ?? 0); m.toplam_assessed += Number(r.toplam_assessed ?? 0);
    if (r.med_nitelikli_alim) m._alim.push(Number(r.med_nitelikli_alim));
    if (r.med_ppa) m._ppa.push(Number(r.med_ppa));
    String(r.countyler ?? "").split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => m._cty.add(x));
    m.ilk_yil = Math.min(m.ilk_yil ?? 9999, Number(r.ilk_yil ?? 9999));
    m.son_yil = Math.max(m.son_yil ?? 0, Number(r.son_yil ?? 0));
    if (!m.owner_addr && r.owner_addr) { m.owner_addr = r.owner_addr; m.owner_city = r.owner_city; m.owner_state = r.owner_state; }
  }
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  const rows = [...merged.values()].filter((r) => r.n >= 5).map((r) => ({
    ...r, county_n: r._cty.size, countyler: [...r._cty].join(", "),
    med_nitelikli_alim: med(r._alim), med_ppa: med(r._ppa),
    ilk_yil: r.ilk_yil === 9999 ? null : r.ilk_yil, son_yil: r.son_yil || null,
    tip: classify(r.owner) }));
  const tip = rows.reduce((m, r) => ((m[r.tip] = (m[r.tip] ?? 0) + 1), m), {});
  console.log(`5+ parsel tutan sahip: ${rows.length}`);
  console.log(`  arsa yatırımcısı ${tip.arsa_yatirimcisi ?? 0} · ev üreticisi ${tip.uretici ?? 0} · diğer tüzel ${tip.diger_tuzel ?? 0} · şahıs ${tip.sahis ?? 0}\n`);

  const yat = rows.filter((r) => r.tip === "arsa_yatirimcisi").sort((a, b) => b.n - a.n);
  console.log("═══ ARSA YATIRIMCILARI (gerçek rakipler) ═══");
  console.log("SAHIP                                 PARSEL  CTY  NİT.ALIM  MED.ALIM   $/DÖNÜM  YIL      MERKEZ");
  for (const r of yat.slice(0, 30)) {
    console.log("  " + String(r.owner).slice(0, 34).padEnd(36) +
      String(r.n).padStart(5) + String(r.county_n).padStart(5) +
      String(r.nitelikli_alim).padStart(9) +
      usd(r.med_nitelikli_alim).padStart(10) + usd(r.med_ppa).padStart(10) +
      ` ${r.ilk_yil ?? "?"}-${r.son_yil ?? "?"}`.padStart(11) +
      "  " + String(r.owner_city ?? "").slice(0, 13) + ", " + (r.owner_state ?? ""));
  }

  console.log("\n═══ EV ÜRETİCİLERİ (aynı arsaya talip, daha fazla ödeyebilir) ═══");
  for (const r of rows.filter((r) => r.tip === "uretici").sort((a, b) => b.n - a.n).slice(0, 10))
    console.log("  " + String(r.owner).slice(0, 34).padEnd(36) + String(r.n).padStart(5) +
      usd(r.med_nitelikli_alim).padStart(12) + "  " + String(r.owner_city ?? "").slice(0, 16));

  // Şirket ailesi tespiti
  const aile = groupByAddress(rows);
  console.log("\n═══ AYNI ADRESTEN YÖNETİLEN ŞİRKET AİLELERİ ═══");
  if (!aile.length) console.log("  (yok)");
  for (const g of aile.slice(0, 10))
    console.log(`  ${String(g.parsel).padStart(5)} parsel · ${g.owners.size} şirket · ${g.addr}\n        ${[...g.owners].slice(0, 5).join(" | ")}`);

  // Eyalet dışı operatörler
  const disari = yat.filter((r) => r.owner_state && normState(r.owner_state) !== "FL");
  console.log(`\n═══ FLORIDA DIŞINDAN YÖNETİLEN ARSA YATIRIMCILARI: ${disari.length} ═══`);
  for (const r of disari.slice(0, 12))
    console.log(`  ${String(r.owner).slice(0, 32).padEnd(34)}${String(r.n).padStart(5)} parsel   ${r.owner_city}, ${r.owner_state}`);

  // Alım hızı
  const aktif = yat.filter((r) => Number(r.son2yil_alim) > 0).sort((a, b) => b.son2yil_alim - a.son2yil_alim);
  console.log(`\n═══ 2024+ ALIM YAPANLAR (hâlâ aktif toplayanlar) ═══`);
  for (const r of aktif.slice(0, 12))
    console.log(`  ${String(r.owner).slice(0, 32).padEnd(34)}${String(r.son2yil_alim).padStart(5)} parsel (2024+)   toplam ${r.n}`);

  if (WRITE) {
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      const vals = [], params = [];
      part.forEach((r, j) => {
        const o = j * 16;
        vals.push(`(${Array.from({ length: 16 }, (_, k) => `$${o + k + 1}`).join(",")})`);
        params.push(r.owner, r.tip, r.n, r.county_n, r.countyler, r.toplam_ac, r.toplam_assessed,
          r.nitelikli_alim, r.med_nitelikli_alim, r.med_ppa, r.ilk_yil, r.son_yil,
          r.son2yil_alim, r.owner_city, r.owner_state, r.owner_addr);
      });
      await pool.query(
        `insert into competitor_profile (owner,tip,parsel,county_n,countyler,toplam_acres,toplam_assessed,
           nitelikli_alim,med_alim,med_ppa,ilk_yil,son_yil,son2yil_alim,owner_city,owner_state,owner_addr)
         values ${vals.join(",")} on conflict (owner) do update set parsel=excluded.parsel,
           tip=excluded.tip, nitelikli_alim=excluded.nitelikli_alim, med_alim=excluded.med_alim,
           med_ppa=excluded.med_ppa, son2yil_alim=excluded.son2yil_alim, analyzed_at=now()`, params);
    }
    for (const g of aile.slice(0, 200)) {
      await pool.query(
        `insert into competitor_family (addr,sirket_n,parsel,sirketler) values ($1,$2,$3,$4)
         on conflict (addr) do update set sirket_n=excluded.sirket_n, parsel=excluded.parsel,
           sirketler=excluded.sirketler, analyzed_at=now()`,
        [g.addr, g.owners.size, g.parsel, [...g.owners].join(" | ")]);
    }
    console.log(`\n✓ competitor_profile (${rows.length}) + competitor_family (${Math.min(aile.length,200)}) yazıldı`);
  }
  await pool.end();
}

if (process.argv[1]?.endsWith("rakip-derin-analiz.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
