#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// LAND COMPS HASATÇISI — GERÇEK boş arsa satışlarını county GIS'lerinden çeker.
//
//   node scraper/harvest-land-comps.mjs            # tüm kaynaklar
//   node scraper/harvest-land-comps.mjs FL         # tek eyalet
//
// NEDEN: est_retail bugüne kadar TEK BİR SABİTTİ (2999 — bir rakibin 1 ac liste
// fiyatı), tüm ülkeye uygulanıyordu. $1M yatırım kararı buna dayandırılamaz.
// Bu script gerçekleşmiş SATIŞ fiyatlarını toplar; county değerleme modeli
// (build-county-valuation.mjs) bunun üstüne kurulur.
//
// KOL SATIŞI (arm's-length) FİLTRESİ — kritik: ham veride $1'lik aile devri,
// vergi satışı, banka devri var. Bunlar piyasa değeri DEĞİL. Üç kat filtre:
//   1) Kaynağın kendi kalite kodu (FL QUAL_CD1 = DOR resmi kodu)
//   2) Satış anında BOŞ arsa mıydı (FL VI_CD1='V'; diğerlerinde land-use kodu)
//   3) Mutlak taban: fiyat >= $1.000
// County-içi istatistiksel uç değer kırpma modelde yapılır, burada değil.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import crypto from "node:crypto";
import { dbUrl } from "./grade-offmarket.mjs";

const SINCE_YEAR = parseInt(process.env.COMP_SINCE || "2021", 10); // son ~5 yıl
const PAGE = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function esriQuery(url, params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const u = url + "/query?" + new URLSearchParams({ f: "json", returnGeometry: "false", ...params });
      const r = await fetch(u, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160));
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      // Üstel geri çekilme: "fetch failed" (geçici ağ/TLS kesintisi) uzun
      // hasatlarda kaçınılmaz — 3 denemede pes etmek 56K comp'ta iş bıraktırdı.
      await sleep(Math.min(60000, 3000 * 2 ** i));
    }
  }
}

// Esri sayfalama. DİKKAT: çoğu servis resultOffset'i ~10.000'de kesiyor
// ("Invalid query parameters") — FL bu yüzden 10.000 comp'ta duruyordu.
// Çözüm: OBJECTID keyset sayfalama (offset yok, "OBJECTID > son" ile ilerle).
// Sunucu tarafı sıralama garanti olsun diye orderByFields=OBJECTID.
async function* pageAll(url, where, outFields, idField = "OBJECTID") {
  let lastId = -1;
  for (;;) {
    const w = `(${where}) AND ${idField} > ${lastId}`;
    const j = await esriQuery(url, {
      where: w, outFields: `${outFields},${idField}`, resultRecordCount: String(PAGE), orderByFields: `${idField} ASC`,
    });
    const feats = j.features ?? [];
    if (!feats.length) return;
    const attrs = feats.map((f) => f.attributes);
    const maxId = Math.max(...attrs.map((a) => Number(a[idField]) || 0));
    if (!(maxId > lastId)) return; // ilerleme yoksa sonsuz döngüye girme
    lastId = maxId;
    yield attrs;
    if (feats.length < PAGE) return;
    await sleep(400);
  }
}

const num = (v) => { const n = Number(String(v ?? "").replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };

// ── KAYNAK ADAPTÖRLERİ ───────────────────────────────────────────────────────
// Her adaptör ham satırı ortak comp şemasına çevirir. Yeni eyalet eklemek =
// buraya bir adaptör yazmak.
const SOURCES = [
  {
    state: "FL",
    name: "FDOR Cadastral 2025 (eyalet geneli)",
    url: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0",
    // VI_CD1='V' → satış anında BOŞ arsaydı (yapı sonradan gelmiş olabilir, o yüzden
    // DOR_UC'ye değil buna güveniyoruz). QUAL_CD kalite kodu modelde filtrelenir.
    where: `SALE_PRC1 > 1000 AND SALE_YR1 >= ${SINCE_YEAR} AND VI_CD1 = 'V'`,
    fields: "CO_NO,PARCEL_ID,SALE_PRC1,SALE_YR1,SALE_MO1,QUAL_CD1,VI_CD1,DOR_UC,LND_SQFOOT,JV,LND_VAL",
    map: (a) => ({
      county_key: `FL:${a.CO_NO}`, // FIPS eşlemesi modelde
      apn: a.PARCEL_ID,
      sale_price: num(a.SALE_PRC1),
      sale_year: num(a.SALE_YR1),
      sale_month: num(a.SALE_MO1),
      acres: a.LND_SQFOOT ? num(a.LND_SQFOOT) / 43560 : null,
      assessed_total: num(a.JV),
      assessed_land: num(a.LND_VAL),
      use_code: a.DOR_UC ?? null,
      qual_code: a.QUAL_CD1 ?? null,
      vacant: a.VI_CD1 === "V",
      zoning: null,
    }),
  },
  {
    state: "CO",
    name: "Colorado Public Parcels (eyalet geneli)",
    url: "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0",
    // salePrice/saleDate STRING tipinde → sayısal where çalışmaz, boş-olmayan
    // çekip client tarafında ayıklıyoruz. landUseDsc ile boş arsa süzülür.
    where: "salePrice IS NOT NULL AND salePrice <> '' AND salePrice <> '0'",
    fields: "countyName,countyFips,parcel_id,salePrice,saleDate,landAcres,asedValTot,apprValTot,landUseCde,landUseDsc,zoningCode,zoningDesc",
    map: (a) => {
      const d = String(a.saleDate ?? "");
      const y = num((d.match(/(19|20)\d{2}/) || [])[0]);
      const use = String(a.landUseDsc ?? "").toUpperCase();
      return {
        county_key: `CO:${a.countyFips ?? a.countyName}`,
        apn: a.parcel_id,
        sale_price: num(a.salePrice),
        sale_year: y,
        sale_month: null,
        acres: num(a.landAcres),
        assessed_total: num(a.asedValTot),
        assessed_land: num(a.apprValTot),
        use_code: a.landUseCde ?? null,
        qual_code: null,
        vacant: /VACANT|VAC LAND|AGRIC|MEADOW|GRAZ/.test(use),
        zoning: a.zoningCode ?? null,
      };
    },
  },
  {
    state: "OR",
    name: "Klamath County Taxlots",
    url: "https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/KC_Taxlots/FeatureServer/1",
    where: `SALE_PRICE > 1000 AND YRSOLD >= ${SINCE_YEAR}`,
    fields: "SALE_PRICE,SALE_DATE,YRSOLD,MOSOLD",
    map: (a) => ({
      county_key: "OR:KLAMATH", apn: null,
      sale_price: num(a.SALE_PRICE), sale_year: num(a.YRSOLD), sale_month: num(a.MOSOLD),
      acres: null, assessed_total: null, assessed_land: null,
      use_code: null, qual_code: null, vacant: null, zoning: null,
    }),
  },
];

const detId = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);

async function main() {
  const only = process.argv[2]?.toUpperCase();
  const srcs = only ? SOURCES.filter((s) => s.state === only) : SOURCES;
  if (!srcs.length) { console.error(`kaynak yok: ${only}`); process.exit(1); }

  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg boşta hata (yok sayıldı): ${e.message}`));

  await pool.query(`
    create table if not exists land_comps (
      comp_id text primary key,
      state text not null, county_key text not null, apn text,
      sale_price numeric, sale_year int, sale_month int,
      acres numeric, assessed_total numeric, assessed_land numeric,
      use_code text, qual_code text, vacant boolean, zoning text,
      source text not null, pulled_at timestamptz default now()
    );
    create index if not exists idx_land_comps_county on land_comps (state, county_key);
    create index if not exists idx_land_comps_year on land_comps (sale_year);`);

  for (const src of srcs) {
    console.log(`\n=== ${src.state} · ${src.name} ===`);
    let seen = 0, kept = 0, batch = [];
    const flush = async () => {
      if (!batch.length) return;
      // Parti içi tekilleştirme ZORUNLU: aynı INSERT'te tekrarlayan comp_id
      // "ON CONFLICT DO UPDATE aynı satırı iki kez etkileyemez" hatası verir.
      // (CO bileşik katmanında aynı parsel birden çok kez geçiyor.)
      const uniq = new Map();
      for (const c of batch) uniq.set(c.comp_id, c);
      batch = [...uniq.values()];
      const vals = [], params = [];
      batch.forEach((c, j) => {
        const o = j * 15;
        vals.push(`(${Array.from({ length: 15 }, (_, k) => `$${o + k + 1}`).join(",")})`);
        params.push(c.comp_id, c.state, c.county_key, c.apn, c.sale_price, c.sale_year, c.sale_month,
          c.acres, c.assessed_total, c.assessed_land, c.use_code, c.qual_code, c.vacant, c.zoning, c.source);
      });
      await pool.query(
        `insert into land_comps (comp_id,state,county_key,apn,sale_price,sale_year,sale_month,
           acres,assessed_total,assessed_land,use_code,qual_code,vacant,zoning,source)
         values ${vals.join(",")}
         on conflict (comp_id) do update set sale_price=excluded.sale_price,
           acres=excluded.acres, assessed_total=excluded.assessed_total, pulled_at=now()`,
        params
      );
      batch = [];
    };

    try {
      for await (const rows of pageAll(src.url, src.where, src.fields)) {
        seen += rows.length;
        for (const raw of rows) {
          const c = src.map(raw);
          if (!c.sale_price || c.sale_price < 1000) continue;
          if (!c.sale_year || c.sale_year < SINCE_YEAR) continue;
          if (c.vacant === false) continue; // boş arsa değilse comp değil
          batch.push({ ...c, state: src.state, source: src.name,
            comp_id: detId(`${src.state}|${c.county_key}|${c.apn ?? ""}|${c.sale_year}|${c.sale_month ?? ""}|${c.sale_price}`) });
          kept++;
          if (batch.length >= 1000) await flush();
        }
        process.stdout.write(`\r  tarandı ${seen} · comp ${kept}`);
      }
      await flush();
      console.log(`\n  ✓ ${src.state}: ${kept} comp (${seen} satır tarandı)`);
    } catch (e) {
      await flush();
      console.error(`\n  ✗ ${src.state} kesildi: ${String(e.message).slice(0, 180)} — ${kept} comp yazıldı`);
    }
  }

  const s = await pool.query(
    `select state, count(*) n, count(distinct county_key) cty,
       round(percentile_cont(0.5) within group (order by sale_price)::numeric) med
     from land_comps group by 1 order by n desc`);
  console.log("\nTOPLANAN COMP:");
  for (const r of s.rows) console.log(`  ${r.state}: ${r.n} comp · ${r.cty} county · medyan satış $${r.med}`);
  await pool.end();
}

if (process.argv[1]?.endsWith("harvest-land-comps.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
