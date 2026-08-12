#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FİLTRELİ HASAT — kayıt defterindeki county'lerden SÜZGEÇTEN GEÇEN parselleri
//                  offmarket_leads'e UPSERT eder.
//
//   node scraper/filtreli-hasat.mjs                 # varsayılan 7 hedef eyalet
//   node scraper/filtreli-hasat.mjs MS WV           # seçili eyalet(ler)
//   node scraper/filtreli-hasat.mjs --county ms-amite
//   TEST=1 node scraper/filtreli-hasat.mjs MS       # county başına 1 sayfa
//
// ── NEDEN VAR ───────────────────────────────────────────────────────────────
// Eski county betikleri (nc-offmarket.mjs, mt-…, al-… ) her eyalet için uç
// noktayı ve alan adlarını TEKRAR yazıyordu. Kayıt defteri
// (dashboard/src/lib/county-registry.ts) bu bilgiyi zaten VERİ olarak tutuyor;
// bu betik onu okuyup tek bir hasat motoru gibi çalışır. Yeni county eklemek =
// kayıt defterine satır eklemek.
//
// ── SÜZGEÇ (indirme ölçütü) ─────────────────────────────────────────────────
// "Her şeyi indir" YASAK — AR'deki 71.585 adressiz satır gibi çöp birikmesin.
// Bir parsel ancak ŞU DÖRDÜNÜ birden geçerse yazılır:
//   1. BOŞ ARSA      → kaynağın kendi `baseWhere`'i (county'ye göre imprv=0 /
//                      DOR kodu / fiziksel adres boş vb.)
//   2. MEKTUP ATILIR → owner + mailing_address + mailing_city + mailing_state
//                      + mailing_zip BEŞİ DE dolu. Biri eksikse İNDİRİLMEZ.
//                      ⚠ BU KURAL GEVŞEMEZ: AR'de 71.585 adressiz satır var ve
//                      hiçbirine mektup atılamıyor. Aynı çöp tekrar birikmesin.
//   3. ACRE BANDI    → 0,25 – 640 acre. Sınırlar UYDURULMADI:
//                      grade-core.mjs `acresPoints` <0,25'e 0 puan verip
//                      "mikro parsel — satışı zor" bayrağı basıyor,
//                      `MAX_GRADABLE_ACRES` = 640 üstünü "derecelendirilemez"
//                      sayıyor. Süzgeç bu iki eşiği ödünç alır.
//   4. DEĞER BANDI   → land_value 300 – 75.000 $.
//                      ⚠ Değeri BİLİNMEYEN parsel bu kuralla ELENMEZ — "değeri
//                      yok" ile "değeri aralık dışı" farklı şeylerdir
//                      (county-providers/arcgis.ts clientFilter ile aynı ilke).
// Ayrıca grade-core `checkEligibility` ile kamu/kurum sahipli ve template
// sahipli ("UNKNOWN OWNER" vb.) parseller elenir — nasılsa not alamazlar.
// Kamu sahipli kayıt SATIN ALINAMAZ, bu yüzden elenmeye devam eder.
//
// ── ABSENTEE ARTIK GEÇİŞ ŞARTI DEĞİL (2026-07-29) ───────────────────────────
// Eskiden "posta eyaleti ≠ parsel eyaleti" bir ELEME kuralıydı. 28 Tem turunda
// 295.746 adayın 231.327'sini (%78,2) TEK BAŞINA bu kural eledi. Oysa absentee
// olmak bir MOTİVASYON SİNYALİ ve grade-core `motivationPoints` içinde ZATEN
// puan olarak var (satır ~305: "out-of-state sahip" +6). Aynı kuralı bir de
// kapıda geçiş şartı yapmak çifte uygulamaydı: havuz gereksiz daraldı, sinyali
// zaten taşıyan skor motoru işini yapamadı.
// Doğrusu: İÇERİ AL, SKOR SIRALASIN. Absentee bilgisi artık satır bazında
// hesaplanıp `absentee` kolonuna yazılır (eskiden sabit `true` yazılıyordu —
// süzgeç zaten elediği için doğruydu, artık değil).
//
// ── DEĞER BANDI: TAVAN 75.000 → 1.000.000 $ (2026-08-06) ────────────────────
// Yiğit kuralı (2026-08-04): "arsa ucuzlukçuluğu BIRAKILDI — 1 milyon dolara
// kadar her band kovalanır (pahalıda al-sat değil KOMİSYON modeli). Değere göre
// ELEME yapma, sadece band etiketi koy." Motor bu karardan sonra da 75.000 $
// tavanını uygulamaya devam ediyordu: birikmiş turlarda 291.701 aday sırf değer
// bandından elendi (çekilen 2.269.184 satırın %12,9'u) — yeni stratejide tam da
// kovalanması gereken parseller. Tavan 1.000.000 $'a çıkarıldı; üstü kapsam
// dışı sayılır (komisyon modeli o bandı hedeflemiyor).
//   ucuz         → 300 ≤ değer ≤ 20.000     (projenin klasik ucuz-lot bandı)
//   buyuk-bilet  → 20.000 < değer ≤ 75.000
//   premium      → 75.000 < değer ≤ 1.000.000  (2026-08-06 ile açıldı)
//   bilinmiyor   → kaynakta değer alanı yok (WV / WY Carbon / MT Sanders)
// Böylece sonradan "ucuz bant / büyük bilet" diye süzülebilir.
// NOT: `price_basis` kolonu BAŞKA bir işi tutuyor (eksik-raporu.mjs teklif
// fiyatının neye dayandığını yazıyor: sabit-2999 / comp) — üstüne yazılmadı.
//
// ── GÜVENLİK FRENLERİ ───────────────────────────────────────────────────────
//   • YAZMA YALNIZCA UPSERT (`ON CONFLICT (lead_id) DO UPDATE`). DELETE/DROP/
//     TRUNCATE yok, düz INSERT yok (socrata-harvest.js koca partileri sessizce
//     düşürüyordu — o hata tekrarlanmıyor).
//   • TABAN ÇİZGİSİ: koşu başında satır sayısı ölçülür; sonda altına düşerse
//     betik HATA ile çıkar.
//   • DB TAVANI: her ~25.000 yazılan satırda `pg_database_size` ölçülür.
//     TAVAN_GB (varsayılan 2) aşılırsa hasat DURUR ve nedenini raporlar.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { checkEligibility } from "./lib/grade-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJE = resolve(HERE, "..");

// ── Ayarlar ─────────────────────────────────────────────────────────────────
export const HEDEF_EYALETLER = ["MS", "WV", "MT", "NC", "AL", "ID", "WY"];

export const ACRE_MIN = 0.25;   // grade-core acresPoints: altı "satışı zor"
export const ACRE_MAX = 640;    // grade-core MAX_GRADABLE_ACRES
export const DEGER_MIN = 300;   // projenin ucuz-lot bandı taban
export const DEGER_MAX = 1000000; // 2026-08-06: 75.000 → 1.000.000 (aşağıya bak)
export const UCUZ_BANT_MAX = 20000; // eski tavan — artık eleme değil, ETİKET sınırı
export const ORTA_BANT_MAX = 75000; // 29 Tem tavanı — yine eleme değil, ETİKET sınırı

const TAVAN_GB = Number(process.env.HASAT_TAVAN_GB || 2.5);
// FL hasadı bitti — kapsam ölçer de (dashboard/scripts/kapsam-olc.mjs) atlıyor.
export const ATLANAN_EYALETLER = new Set(["FL"]);
const TAVAN_BYTE = TAVAN_GB * 1024 ** 3;
const BOYUT_KONTROL_HER = 25000;
const SAYFA = 1000;
const PARTI = 500;              // upsert parti büyüklüğü
const TEST = process.env.TEST === "1";
const UA = "Mozilla/5.0 (VegaLand filtreli-hasat)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const temiz = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// ── Süzgeç (SAF — testten doğrudan çağrılabilir) ────────────────────────────
/**
 * Değer bandı ETİKETİ — eleme değil, sınıflandırma.
 * Sonradan "ucuz bant / büyük bilet" diye süzülebilsin diye value_band'e yazılır.
 */
export function degerBandi(v) {
  if (v == null || !Number.isFinite(Number(v))) return "bilinmiyor";
  const n = Number(v);
  if (n <= UCUZ_BANT_MAX) return "ucuz";
  if (n <= ORTA_BANT_MAX) return "buyuk-bilet";
  return "premium";
}

/** Posta eyaleti parselin eyaletinden farklıysa sahip uzakta = absentee. */
export function absenteeMi(r, eyalet) {
  const ms = temiz(r?.mailing_state).toUpperCase();
  if (!ms) return false;
  return ms !== String(eyalet).toUpperCase();
}

/**
 * Normalize edilmiş bir satır süzgeçten geçiyor mu?
 * Dönen: null (geçti) | { kural, ayrinti } (elendi).
 * Kural adları rapordaki "hangi kural ne kadar eledi" kırılımını üretir.
 *
 * ⚠ ABSENTEE BURADA ELEMEZ. Motivasyon sinyali olarak grade-core'da puanlanır;
 *   kapıda ikinci kez uygulanmaz (bkz. dosya başındaki not).
 */
export function suzgec(r, eyalet) {
  if (!r) return { kural: "mektup-eksik", ayrinti: "sahip/apn/adres normalize edilemedi" };
  if (!temiz(r.owner) || !temiz(r.mailing_address) || !temiz(r.mailing_city) ||
      !temiz(r.mailing_state) || !temiz(r.mailing_zip)) {
    return { kural: "mektup-eksik", ayrinti: "beş posta alanından biri boş" };
  }
  const inel = checkEligibility({ owner: r.owner, acres: r.acres });
  if (inel && inel.reason === "gov_owner") return { kural: "kamu-sahipli", ayrinti: inel.flag };
  if (inel && inel.reason === "owner_missing") return { kural: "mektup-eksik", ayrinti: inel.flag };
  // ── DÖNÜMÜ BİLİNMEYEN PARSEL ARTIK ELENMİYOR (2026-08-10) ──────────────────
  // Değer kuralının ilkesi zaten şuydu: "değeri YOK" ile "değeri aralık DIŞI"
  // farklı şeylerdir; bilinmeyen elenmez. Acre'de bu ilke uygulanmamıştı —
  // dönümü boş gelen parsel doğrudan atılıyordu. Aynı mantıkla kalmalı:
  // kaynakta alan yok diye parsel yok sayılmaz. Notlandırmada dönüm puanı
  // alamayacağı için A+ çıkmaz; envanterde durur, dönüm verisi sonradan
  // geldiğinde (backfill) değerlenir. Şu an tamamen kayboluyordu.
  //
  // Eleme sebebi de AYRIŞTIRILDI: "acre-bandi" artık yalnız GERÇEKTEN bant
  // dışı parseller içindir. Böylece bir sonraki turda kaç kaydın veri
  // eksikliğinden, kaç kaydın gerçek bant ihlalinden elendiği log'dan görülür.
  const a = Number(r.acres);
  const acreBilinmiyor = !Number.isFinite(a) || a <= 0;
  if (!acreBilinmiyor) {
    if (a < ACRE_MIN) return { kural: "acre-bandi", ayrinti: `${a} ac < ${ACRE_MIN}` };
    if (a > ACRE_MAX) return { kural: "acre-bandi", ayrinti: `${a} ac > ${ACRE_MAX}` };
  }
  const v = r.land_value;
  // Değeri BİLİNMEYEN parsel elenmez (WV/WY Carbon/MT Sanders'ta değer alanı yok).
  if (v != null && Number.isFinite(Number(v))) {
    if (Number(v) < DEGER_MIN) return { kural: "deger-bandi", ayrinti: `$${v} < $${DEGER_MIN}` };
    if (Number(v) > DEGER_MAX) return { kural: "deger-bandi", ayrinti: `$${v} > $${DEGER_MAX}` };
  }
  return null;
}

/** Poligon halkasının ağırlık merkezi → [lng, lat] (üretilmez, geometriden gelir). */
export function halkaMerkezi(geom) {
  if (!geom) return null;
  if (Number.isFinite(geom.x) && Number.isFinite(geom.y)) return [geom.x, geom.y];
  const ring = geom?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0, sy = 0, n = 0;
  for (const [x, y] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x; sy += y; n++;
  }
  if (!n) return null;
  const lng = sx / n, lat = sy / n;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
}

// ── ArcGIS erişimi ──────────────────────────────────────────────────────────
async function arcgis(src, params, tercihGet = false) {
  const p = new URLSearchParams({ f: "json", ...params });
  const bas = { "User-Agent": UA, ...(src.headers ?? {}) };
  const res = tercihGet || src.method === "GET"
    ? await fetch(`${src.endpoint}?${p}`, { headers: bas, signal: AbortSignal.timeout(90000) })
    : await fetch(src.endpoint, {
        method: "POST",
        headers: { ...bas, "Content-Type": "application/x-www-form-urlencoded" },
        body: p.toString(),
        signal: AbortSignal.timeout(90000),
      });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).slice(0, 160));
  return j;
}

/**
 * Kaynağın yeteneklerini TEK SEFER ölçer — kayıt defteri bayrakları yeterli
 * değil (bazı servis GET ister, bazısı sayfalama reddeder, bazısı geometri
 * vermez). Uydurmak yerine sorup öğreniyoruz.
 */
async function yetenekOlc(src) {
  const temel = { outFields: src.outFields, returnGeometry: "true", outSR: "4326", geometryPrecision: "6", maxAllowableOffset: "0.0005" };
  for (const get of [false, true]) {
    // 1) Sayfalama + geometri
    //
    // ÜÇ DENEME (2026-08-12): burası tek denemeydi ve geometrili sorgu GEÇİCİ
    // bir hatayla (timeout/5xx) düşerse akış sessizce 2. adıma —
    // "geometri yok" moduna — kayıyordu. O county'nin TÜM hasadı koordinatsız
    // yazılıyor, haritada hiç görünmüyordu: AL/Cullman'da 17.464 parselin
    // tamamı böyle pinsiz kaldı (servis test edildi, geometriyi sorunsuz
    // veriyor). Kalıcı olarak geometri vermeyen servis üç denemede de düşer,
    // maliyet iki fazla istek.
    for (let deneme = 1; deneme <= 3; deneme++) {
      try {
        const j = await arcgis(src, { where: src.baseWhere, ...temel, resultRecordCount: "1", resultOffset: "0" }, get);
        if (j.features?.length) {
          // "Özellik döndü" yetmez — geometri GERÇEKTEN geldi mi?
          const geoVar = j.features.some((f) => f?.geometry);
          return { mod: "sayfali", get, geometri: geoVar };
        }
        break; // sorgu çalıştı ama kayıt yok → tekrar denemenin anlamı yok
      } catch {
        if (deneme < 3) await sleep(2000 * deneme);
      }
    }
    // 2) Sayfalama, geometri yok
    try {
      const j = await arcgis(src, { where: src.baseWhere, outFields: src.outFields, returnGeometry: "false", resultRecordCount: "1", resultOffset: "0" }, get);
      if (j.features?.length) return { mod: "sayfali", get, geometri: false };
    } catch { /* sonraki denemeye */ }
    // 3) Sayfalama yok → objectId listesi + parça parça çekim
    try {
      const j = await arcgis(src, { where: src.baseWhere, returnIdsOnly: "true" }, get);
      if (Array.isArray(j.objectIds)) {
        return { mod: "id-parca", get, geometri: true, idAlan: j.objectIdFieldName, idler: j.objectIds };
      }
    } catch { /* sonraki denemeye */ }
  }
  return null;
}

/** Sayfa sayfa ham `attributes`+`geometry` üretir. */
async function* sayfalar(src, yet) {
  const geoP = yet.geometri
    ? { returnGeometry: "true", outSR: "4326", geometryPrecision: "6", maxAllowableOffset: "0.0005" }
    : { returnGeometry: "false" };

  if (yet.mod === "id-parca") {
    const parca = 400;
    for (let i = 0; i < yet.idler.length; i += parca) {
      const dilim = yet.idler.slice(i, i + parca);
      let j = null;
      for (let deneme = 0; deneme < 3 && !j; deneme++) {
        try {
          j = await arcgis(src, { objectIds: dilim.join(","), outFields: src.outFields, ...geoP }, yet.get);
        } catch (e) {
          if (deneme === 2) throw e;
          await sleep(2000 * (deneme + 1));
        }
      }
      yield j.features ?? [];
      if (TEST) return;
      await sleep(250);
    }
    return;
  }

  for (let off = 0; ; ) {
    let j = null;
    for (let deneme = 0; deneme < 3 && !j; deneme++) {
      try {
        j = await arcgis(src, {
          where: src.baseWhere, outFields: src.outFields, ...geoP,
          resultOffset: String(off), resultRecordCount: String(SAYFA),
          ...(src.orderBy ? { orderByFields: src.orderBy } : {}),
        }, yet.get);
      } catch (e) {
        if (deneme === 2) throw e;
        await sleep(2000 * (deneme + 1));
      }
    }
    const feats = j.features ?? [];
    if (!feats.length) return;
    yield feats;
    off += feats.length;
    if (TEST) return;
    if (feats.length < SAYFA && !j.exceededTransferLimit) return;
    await sleep(250);
  }
}

// ── DB ──────────────────────────────────────────────────────────────────────
function dbUrl() {
  const env = readFileSync(resolve(PROJE, "dashboard/.env.local"), "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL bulunamadı (dashboard/.env.local)");
  return m[1].trim().replace("aws-0-", "aws-1-").replace(/\?pgbouncer=true.*$/, "");
}

const KOLONLAR = [
  "lead_id", "state", "county", "region", "apn", "owner",
  "mailing_address", "mailing_city", "mailing_state", "mailing_zip",
  "situs", "use", "acres", "land_value", "absentee", "lat", "lng",
  "source", "land_value_source", "value_band", "updated_at",
];

/**
 * `value_band` kolonu yoksa ekler. ALTER … ADD COLUMN IF NOT EXISTS — veri
 * silmez, mevcut satırlara NULL yazar. (DROP/DELETE/TRUNCATE bu dosyada YOK.)
 */
async function semaHazirla(client) {
  await client.query("alter table offmarket_leads add column if not exists value_band text");
}

/**
 * UPSERT — `lead_id` çakışmasında GÜNCELLE. Düz INSERT kullanılmaz.
 * Not/geo kolonlarına DOKUNULMAZ (grade_*, dist_*, phone*) — yeniden hasat
 * yapılan county'de mevcut zenginleştirme silinmesin.
 */
async function upsert(client, satirlar) {
  if (!satirlar.length) return 0;
  const deger = [];
  const yer = satirlar.map((s, i) => {
    const t = KOLONLAR.map((_, k) => `$${i * KOLONLAR.length + k + 1}`);
    deger.push(...KOLONLAR.map((k) => s[k]));
    return `(${t.join(",")})`;
  });
  const guncelle = KOLONLAR.filter((k) => k !== "lead_id").map((k) => `${k}=EXCLUDED.${k}`).join(", ");
  const sql =
    `INSERT INTO offmarket_leads (${KOLONLAR.join(",")}) VALUES ${yer.join(",")} ` +
    `ON CONFLICT (lead_id) DO UPDATE SET ${guncelle}`;
  // Bağlantı koparsa parti KAYBOLMASIN — 3 deneme (Pool yeni bağlantı açar).
  for (let a = 1; ; a++) {
    try { await client.query(sql, deger); break; }
    catch (e) {
      if (a >= 3) throw e;
      await sleep(3000 * a);
    }
  }
  return satirlar.length;
}

async function olc(client) {
  const { rows } = await client.query(
    "select (select count(*) from offmarket_leads)::bigint satir, pg_database_size(current_database())::bigint db, pg_total_relation_size('offmarket_leads')::bigint tbl"
  );
  return { satir: Number(rows[0].satir), db: Number(rows[0].db), tbl: Number(rows[0].tbl) };
}

const mb = (b) => `${Math.round(b / 1024 / 1024)} MB`;

// ── Ana akış ────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const countyArg = argv.includes("--county") ? argv[argv.indexOf("--county") + 1] : null;
  const eyaletArg = argv.filter((a) => /^[A-Za-z]{2}$/.test(a)).map((a) => a.toUpperCase());

  const { COUNTY_REGISTRY } = await import(resolve(PROJE, "dashboard/src/lib/county-registry.ts"));
  const { normalizeArcGis } = await import(resolve(PROJE, "dashboard/src/lib/county-providers/arcgis.ts"));

  // --kapsam: kapsam ölçümünde `durum:"calisiyor"` çıkmış TÜM county'ler.
  // Ölçülmemiş/kimlik hatası veren county'ye boşuna gidilmez; FL atlanır.
  const kapsamMod = argv.includes("--kapsam");
  let kapsamKeys = null;
  if (kapsamMod) {
    const olcum = JSON.parse(readFileSync(resolve(PROJE, "dashboard/public/kapsam-olcum.json"), "utf8"));
    kapsamKeys = (olcum.sonuclar ?? [])
      .filter((s) => s.durum === "calisiyor" && !ATLANAN_EYALETLER.has(s.state))
      .map((s) => s.key);
  }

  const eyaletler = eyaletArg.length ? eyaletArg : HEDEF_EYALETLER;
  const keys = countyArg
    ? [countyArg]
    : kapsamKeys
      ? kapsamKeys.filter((k) => COUNTY_REGISTRY[k] &&
          (eyaletArg.length ? eyaletArg.includes(COUNTY_REGISTRY[k].state) : true))
      : Object.keys(COUNTY_REGISTRY).filter((k) =>
          eyaletler.includes(COUNTY_REGISTRY[k].state) && !ATLANAN_EYALETLER.has(COUNTY_REGISTRY[k].state));

  // Pool (Client DEĞİL): 29 Tem TX turu 4. county'de "Connection terminated
  // unexpectedly" ile ÖLDÜ — pg.Client'ta boşta kopan bağlantı yakalanmayan
  // 'error' olayı fırlatıp süreci düşürüyor, kalan 5 county hiç hasat edilmiyor
  // ve rapor dosyası yazılmadığı için tur deftere de geçmiyordu. Pool yeniden
  // bağlanır; 'error' dinleyicisi boşta kopmayı sessizce yutar.
  const client = new pg.Pool({
    connectionString: dbUrl(),
    ssl: { rejectUnauthorized: false },
    max: 2,
    keepAlive: true,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
  client.on("error", (e) => console.warn(`pg boşta bağlantı hatası (yok sayıldı): ${e.message}`));
  await semaHazirla(client);

  const taban = await olc(client);
  console.log(`TABAN ÇİZGİSİ: ${taban.satir.toLocaleString("tr-TR")} satır · tablo ${mb(taban.tbl)} · DB ${mb(taban.db)} (tavan ${TAVAN_GB} GB)`);
  if (taban.db >= TAVAN_BYTE) {
    console.error(`DUR: DB zaten tavanda (${mb(taban.db)} ≥ ${TAVAN_GB} GB). Hiçbir şey yazılmadı.`);
    await client.end();
    return 1;
  }

  const rapor = { taban, eyalet: {}, county: [], durduruldu: null, baslangic: new Date().toISOString() };
  let yazilanToplam = 0;
  let sonBoyutKontrol = 0;
  let dur = false;

  for (const key of keys) {
    if (dur) break;
    const e = COUNTY_REGISTRY[key];
    if (!e) { console.error(`⚠ bilinmeyen county: ${key}`); continue; }
    const src = e.sources.find((s) => s.kind === "arcgis");
    const ey = (rapor.eyalet[e.state] ??= { yazilan: 0, aday: 0, elenen: {}, sorun: [] });

    if (!src) {
      ey.sorun.push(`${key}: ücretsiz ArcGIS kaynağı yok (Regrid ücretli — çağrılmadı)`);
      console.log(`⏭  ${key}: arcgis kaynağı yok, atlandı`);
      continue;
    }

    let yet;
    try {
      yet = await yetenekOlc(src);
    } catch (err) {
      yet = null;
      ey.sorun.push(`${key}: yetenek ölçümü patladı — ${err.message}`);
    }
    if (!yet) {
      ey.sorun.push(`${key}: servis sorguya yanıt vermedi (üç mod da başarısız)`);
      console.log(`❌ ${key}: servis yanıt vermiyor, atlandı`);
      continue;
    }

    const elenen = {};
    const gorulen = new Set();
    let aday = 0, yazilan = 0, bekleyen = [];
    const t0 = Date.now();

    try {
      for await (const feats of sayfalar(src, yet)) {
        for (const f of feats) {
          aday++;
          const r = normalizeArcGis(f.attributes, src.fields, e.state);
          const red = suzgec(r, e.state);
          if (red) { elenen[red.kural] = (elenen[red.kural] ?? 0) + 1; continue; }
          if (gorulen.has(r.apn)) { elenen["mukerrer"] = (elenen["mukerrer"] ?? 0) + 1; continue; }
          gorulen.add(r.apn);

          const c = halkaMerkezi(f.geometry);
          bekleyen.push({
            lead_id: `${e.leadIdPrefix}-${r.apn}`,
            state: e.state, county: e.county, region: e.label,
            apn: r.apn, owner: r.owner,
            mailing_address: r.mailing_address,
            mailing_city: r.mailing_city,
            mailing_state: r.mailing_state,
            mailing_zip: r.mailing_zip,
            situs: r.situs || null,
            use: r.use || "VACANT",
            acres: r.acres,
            land_value: r.land_value,
            // Absentee artık eleme şartı DEĞİL → satır bazında hesaplanır.
            // (Eskiden sabit `true` yazılıyordu; süzgeç elediği için doğruydu.)
            absentee: absenteeMi(r, e.state),
            lat: c ? c[1] : null,
            lng: c ? c[0] : null,
            source: `kayit-defteri:${key}`,
            // Değer alanı olan county'lerde bu bir ASSESSED değerdir, piyasa
            // değeri değil — grade-core bunu bayraklayabilsin diye yazılıyor.
            land_value_source: r.land_value != null ? "county-assessed" : null,
            // ucuz (≤20K) / buyuk-bilet (20K–75K) / bilinmiyor — sonradan süzmek için.
            value_band: degerBandi(r.land_value),
            updated_at: new Date().toISOString(),
          });

          if (bekleyen.length >= PARTI) {
            yazilan += await upsert(client, bekleyen);
            yazilanToplam += bekleyen.length;
            bekleyen = [];
            if (yazilanToplam - sonBoyutKontrol >= BOYUT_KONTROL_HER) {
              sonBoyutKontrol = yazilanToplam;
              const o = await olc(client);
              console.log(`   … boyut kontrolü: ${o.satir.toLocaleString("tr-TR")} satır · DB ${mb(o.db)}`);
              if (o.db >= TAVAN_BYTE) {
                rapor.durduruldu = `DB tavanı aşıldı: ${mb(o.db)} ≥ ${TAVAN_GB} GB (${key} işlenirken)`;
                dur = true;
                break;
              }
            }
          }
        }
        if (dur) break;
      }
      if (bekleyen.length && !dur) {
        yazilan += await upsert(client, bekleyen);
        yazilanToplam += bekleyen.length;
      }
    } catch (err) {
      ey.sorun.push(`${key}: hasat yarıda kesildi — ${err.message}`);
      if (bekleyen.length) { yazilan += await upsert(client, bekleyen); yazilanToplam += bekleyen.length; }
    }

    ey.yazilan += yazilan;
    ey.aday += aday;
    for (const [k, v] of Object.entries(elenen)) ey.elenen[k] = (ey.elenen[k] ?? 0) + v;
    rapor.county.push({
      key, aday, yazilan, elenen, mod: yet.mod,
      // Koordinat alındı mı — log'a YAZILIR. Eskiden görünmüyordu, bu yüzden
      // koordinatsız hasat edilen county aylarca fark edilmeden haritadan
      // eksik kaldı (AL/Cullman 17.464 parsel).
      geometri: yet.geometri === true,
      sureSn: Math.round((Date.now() - t0) / 1000),
    });
    if (yazilan > 0 && yet.geometri !== true) {
      ey.sorun.push(`${key}: KOORDİNATSIZ hasat — ${yazilan} parsel haritada görünmeyecek (servis geometri döndürmedi)`);
    }

    const elenenToplam = Object.values(elenen).reduce((a, b) => a + b, 0);
    const oran = aday ? Math.round((elenenToplam / aday) * 100) : 0;
    console.log(
      `✔ ${key.padEnd(15)} aday=${String(aday).padStart(6)} yazılan=${String(yazilan).padStart(6)} ` +
      `elenen=%${String(oran).padStart(3)} [${Object.entries(elenen).map(([k, v]) => `${k}:${v}`).join(" ") || "—"}]`
    );
    if (dur) break;
  }

  const son = await olc(client);
  rapor.son = son;
  rapor.bitis = new Date().toISOString();
  rapor.yazilanToplam = yazilanToplam;

  console.log("\n─────────────────────────────────────────");
  console.log(`SONUÇ: ${taban.satir.toLocaleString("tr-TR")} → ${son.satir.toLocaleString("tr-TR")} satır ` +
              `(+${(son.satir - taban.satir).toLocaleString("tr-TR")}) · DB ${mb(taban.db)} → ${mb(son.db)}`);
  if (rapor.durduruldu) console.log(`⛔ DURDURULDU: ${rapor.durduruldu}`);

  const raporDizin = join(HERE, "logs");
  mkdirSync(raporDizin, { recursive: true });
  // Dosya adına ele alınan eyaletler girer — eyalet eyalet koşulduğunda önceki
  // turun raporu EZİLMESİN (tur yarıda kalırsa ilerleme kaydı kaybolmasın).
  const etiket = Object.keys(rapor.eyalet).sort().join("-") || "bos";
  const raporYol = join(raporDizin, `filtreli-hasat-${new Date().toISOString().slice(0, 10)}-${etiket}.json`);
  writeFileSync(raporYol, JSON.stringify(rapor, null, 2));
  console.log(`Rapor: ${raporYol}`);

  await client.end();

  // TABAN ÇİZGİSİ FRENİ — satır sayısı asla azalamaz.
  if (son.satir < taban.satir) {
    console.error(`ÖLÜMCÜL: satır sayısı DÜŞTÜ (${taban.satir} → ${son.satir}). Bu olmamalıydı.`);
    return 1;
  }
  return rapor.durduruldu ? 1 : 0;
}

// Test dosyası import ettiğinde main koşmasın.
if (process.argv[1] && process.argv[1].endsWith("filtreli-hasat.mjs")) {
  process.exit(await main());
}
