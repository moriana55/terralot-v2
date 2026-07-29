#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SAHİP SAYIMI (rakip keşfi) — hedef county'lerdeki TÜM boş arsaları sahip
// adı + alım fiyatı/tarihiyle çeker. Amaç: rakip listesini TAHMİN ETMEK değil,
// VERİDEN KEŞFETMEK — "kimin elinde çok boş parsel var?"
//
//   node scraper/harvest-owners.mjs           # varsayılan county seti
//   node scraper/harvest-owners.mjs 18,19,52  # belirli FL county kodları
//
// NEDEN BÖYLE: Esri'nin sunucu-taraflı groupBy'ı bu serviste yeteneği
// bildirmesine rağmen 400 dönüyor. Ham satırları çekip gruplamayı Postgres'te
// yapıyoruz — hem çalışıyor hem ham veri elde kalıyor (tekrar analiz edilebilir).
//
// ⚠️ ALIM FİYATI YORUMU (2026-07-26 dersi): SALE_PRC1 parselin SON kayıtlı
// bedelidir. Bu bedel sahibin ALIMI olabilir, şirketler arası devir olabilir,
// ya da nominal ($100 quit-claim) olabilir. "X şu fiyata aldı" demeden önce
// QUAL_CD1 (DOR kalite kodu) ve tutar kontrol edilmeli. Mohave'de bu ayrımı
// yapmadığımız için çarpan hesabı çöpe gitti — aynı hatayı tekrarlama.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import crypto from "node:crypto";
import { dbUrl } from "./grade-offmarket.mjs";

const FL_URL = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0";
// Envanterimizin yoğun olduğu + comp modeli T1 çıkan county'ler.
const DEFAULT_COUNTIES = [18, 38, 19, 52, 64, 37, 46, 48, 15];
const FL_NAMES = { 11:"Alachua",13:"Bay",14:"Bradford",15:"Brevard",17:"Calhoun",18:"Charlotte",19:"Citrus",
  36:"Hendry",37:"Hernando",38:"Highlands",45:"Lake",46:"Lee",48:"Levy",52:"Marion",57:"Okeechobee",
  63:"Polk",64:"Putnam" };
const PAGE = parseInt(process.env.OWNER_PAGE || "1000", 10);
// Servis bugün 215K satırdan sonra 400 ile kısmaya başladı → nazik tempo şart.
const PACE = parseInt(process.env.OWNER_PACE || "1500", 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const detId = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);

async function esri(params, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(FL_URL + "/query?" + new URLSearchParams({ f: "json", returnGeometry: "false", ...params }),
        { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 140));
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      // 400 çoğu zaman throttle demek — uzun geri çekilme (5 dk'ya kadar).
      await sleep(Math.min(300000, 5000 * 2 ** i));
    }
  }
}

const OUT_FIELDS = "OBJECTID,CO_NO,PARCEL_ID,OWN_NAME,OWN_ADDR1,OWN_CITY,OWN_STATE,LND_SQFOOT,JV,LND_VAL,SALE_PRC1,SALE_YR1,SALE_MO1,QUAL_CD1,PHY_CITY";
const MAX_OID = parseInt(process.env.OWNER_MAX_OID || "10900000", 10);
const WINDOW = parseInt(process.env.OWNER_WINDOW || "25000", 10);

/**
 * PENCERELİ TARAMA — 2026-07-26 teşhisi:
 * `OBJECTID > -1` gibi AÇIK UÇLU sorgu, servisi 10,8 milyonluk katmanın
 * tamamını tarayıp sıralamaya zorluyor ve 400 ile düşüyor. Charlotte'un
 * çalışıp Highlands'in çalışmamasının sebebi buydu (Charlotte'un kayıtları
 * OBJECTID uzayının başında, sorgu oraya erken ulaşıyor).
 * `OBJECTID BETWEEN a AND b` ile SINIRLI pencere sorunsuz çalışıyor.
 * Tüm hedef county'ler tek geçişte toplanır.
 */
async function* pageWindows(counties, startOid = 0) {
  const inList = counties.join(",");
  for (let lo = startOid; lo <= MAX_OID; lo += WINDOW) {
    const hi = lo + WINDOW - 1;
    let cursor = lo - 1;
    for (;;) {
      const j = await esri({
        where: `CO_NO IN (${inList}) AND VI_CD1='V' AND OWN_NAME IS NOT NULL AND OBJECTID BETWEEN ${cursor + 1} AND ${hi}`,
        outFields: OUT_FIELDS, resultRecordCount: String(PAGE), orderByFields: "OBJECTID ASC",
      });
      const f = j.features ?? [];
      if (!f.length) break;
      const a = f.map((x) => x.attributes);
      const maxId = Math.max(...a.map((x) => Number(x.OBJECTID) || 0));
      yield { rows: a, lo, hi };
      if (f.length < PAGE || !(maxId > cursor)) break;
      cursor = maxId;   // pencere İÇİNDE alt-sayfalama (yine sınırlı, güvenli)
      await sleep(PACE);
    }
    await sleep(PACE);
  }
}

async function main() {
  const arg = process.argv[2];
  const counties = arg ? arg.split(",").map((x) => parseInt(x, 10)).filter(Boolean) : DEFAULT_COUNTIES;
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg boşta hata: ${e.message}`));

  await pool.query(`
    create table if not exists parcel_owners (
      row_id text primary key,
      state text, county text, county_code int, apn text,
      owner text, owner_addr text, owner_city text, owner_state text,
      acres numeric, assessed_total numeric, assessed_land numeric,
      last_sale_price numeric, last_sale_year int, last_sale_month int,
      qual_code text, phy_city text, oid bigint, pulled_at timestamptz default now()
    );
    create index if not exists idx_powners_owner on parcel_owners (owner);
    create index if not exists idx_powners_county on parcel_owners (state, county_code);
    alter table parcel_owners add column if not exists oid bigint;`);

  // Tek geçiş: tüm hedef county'ler aynı pencere taramasında toplanır.
  const rs = await pool.query("select coalesce(max(oid),0) m from parcel_owners where state='FL'");
  const startOid = Number(rs.rows[0].m);
  if (startOid > 0) console.log(`OBJECTID ${startOid} sonrasından devam ediliyor`);
  console.log(`pencere taraması: ${counties.length} county · ${WINDOW} genişlik · ${PACE}ms tempo`);

  let n = 0, batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const uniq = new Map();
    for (const b of batch) uniq.set(b.row_id, b);
    const rows = [...uniq.values()];
    const vals = [], params = [];
    rows.forEach((r, j) => {
      const o = j * 18;
      vals.push(`(${Array.from({ length: 18 }, (_, k) => `$${o + k + 1}`).join(",")})`);
      params.push(r.row_id, "FL", r.county, r.county_code, r.apn, r.owner, r.owner_addr, r.owner_city,
        r.owner_state, r.acres, r.assessed_total, r.assessed_land, r.last_sale_price, r.last_sale_year,
        r.last_sale_month, r.qual_code, r.phy_city, r.oid);
    });
    await pool.query(
      `insert into parcel_owners (row_id,state,county,county_code,apn,owner,owner_addr,owner_city,owner_state,
         acres,assessed_total,assessed_land,last_sale_price,last_sale_year,last_sale_month,qual_code,phy_city,oid)
       values ${vals.join(",")} on conflict (row_id) do update set
         owner=excluded.owner, last_sale_price=excluded.last_sale_price, oid=excluded.oid, pulled_at=now()`, params);
    batch = [];
  };

  try {
    for await (const { rows, hi } of pageWindows(counties, startOid)) {
      for (const a of rows) {
        const co = Number(a.CO_NO);
        batch.push({
          row_id: detId(`FL|${co}|${a.PARCEL_ID}`), apn: a.PARCEL_ID,
          county: FL_NAMES[co] ?? String(co), county_code: co,
          owner: a.OWN_NAME, owner_addr: a.OWN_ADDR1, owner_city: a.OWN_CITY, owner_state: a.OWN_STATE,
          acres: a.LND_SQFOOT ? Number(a.LND_SQFOOT) / 43560 : null,
          assessed_total: a.JV ?? null, assessed_land: a.LND_VAL ?? null,
          last_sale_price: a.SALE_PRC1 ?? null, last_sale_year: a.SALE_YR1 ?? null,
          last_sale_month: a.SALE_MO1 ? Number(a.SALE_MO1) : null,
          qual_code: a.QUAL_CD1 ?? null, phy_city: a.PHY_CITY ?? null, oid: Number(a.OBJECTID) || null,
        });
        n++;
        if (batch.length >= 1000) await flush();
      }
      process.stdout.write(`\r  OID ${hi} · toplanan ${n}`);
    }
    await flush();
    console.log(`\n  ✓ tarama bitti: ${n} boş parsel`);
  } catch (e) {
    await flush();
    console.error(`\n  ✗ kesildi: ${String(e.message).slice(0, 140)} — ${n} yazıldı (tekrar çalıştır, kaldığı yerden sürer)`);
  }

  const s = await pool.query(`select county, count(*) n, count(distinct owner) sahip from parcel_owners group by 1 order by n desc`);
  console.log("\nTOPLANAN:");
  for (const r of s.rows) console.log(`  ${String(r.county).padEnd(12)} ${String(r.n).padStart(7)} parsel · ${r.sahip} farklı sahip`);
  await pool.end();
}

if (process.argv[1]?.endsWith("harvest-owners.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
