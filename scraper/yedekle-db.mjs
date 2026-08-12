#!/usr/bin/env node
/**
 * SUPABASE YEDEĞİ — her tabloyu gzip'li CSV olarak diske yazar.
 *
 * NEDEN pg_dump DEĞİL: Mac'teki pg_dump 16, Supabase sunucusu 17.6. pg_dump
 * kendinden YENİ bir sunucudan döküm almayı reddeder. Homebrew'dan 17
 * kurdurmak yerine kendi bağlantımızla `COPY ... TO STDOUT (format csv)`
 * kullanılıyor: sürüm bağımsız, tek bağımlılık `pg`.
 *
 * NE ALIR: veri (CSV) + tablo başına kolon listesi + satır sayısı (`_ozet.json`).
 * NE ALMAZ: indeks/kısıt/RLS politikaları gibi şema nesneleri. Şema zaten
 * `scraper/sql/*.sql` dosyalarında versiyonlu duruyor — asıl kaybolacak şey
 * VERİ, bu betik onu kurtarır.
 *
 * GERİ YÜKLEME:
 *   psql "<DATABASE_URL>" -c "\\copy offmarket_leads(<kolonlar>) from program 'gzcat offmarket_leads.csv.gz' csv"
 * (kolon listesi `_ozet.json` içinde tablo başına yazılı)
 *
 *   node yedekle-db.mjs                     # ~/Desktop/vegaland-db-yedek/<tarih>
 *   node yedekle-db.mjs --hedef /yol        # başka klasöre
 *   node yedekle-db.mjs --rapor             # sadece ne alınacağını göster
 */

import pg from "pg";
import copyTo from "pg-copy-streams";
import { createWriteStream, mkdirSync, writeFileSync, statSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { dbUrl } from "./grade-offmarket.mjs";

const RAPOR = process.argv.includes("--rapor");
const hedefArg = process.argv.indexOf("--hedef");
const KOK =
  hedefArg > -1 && process.argv[hedefArg + 1]
    ? process.argv[hedefArg + 1]
    : path.join(process.env.HOME, "Desktop", "vegaland-db-yedek");

// Tarih klasörü: eski yedek ezilmesin.
const damga = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const DIZIN = path.join(KOK, damga);

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

const c = new pg.Client({ connectionString: dbUrl() });
await c.connect();
await c.query("set statement_timeout = 0");

// Yedeklenecek tablolar: public şemasındaki BOŞ OLMAYANLAR (görünümler hariç).
const { rows: tablolar } = await c.query(`
  select t.table_name ad,
         coalesce(s.n_live_tup, 0)::int satir,
         pg_total_relation_size(quote_ident(t.table_name)::regclass) bayt
    from information_schema.tables t
    left join pg_stat_user_tables s on s.relname = t.table_name
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
   order by bayt desc`);

// ⚠ `pg_stat_user_tables.n_live_tup` YAKLAŞIKTIR ve istatistik sıfırlandığında
// (indeks bakımı, sunucu yeniden başlatma) DOLU tabloyu 0 gösterir. İlk sürüm
// buna göre eleme yapıyordu ve `land_comps` (58 MB) ile `parcel_owners` (30 MB)
// yedekten sessizce düşüyordu. Yedekte "sessizce düşmek" kabul edilemez:
// artık TÜM tablolar alınır, gerçek satır sayısı count(*) ile ölçülür.
// Boş tablonun gz dosyası zaten birkaç yüz bayt.
for (const t of tablolar) {
  const { rows: [k] } = await c.query(`select count(*)::int n from public."${t.ad}"`);
  t.satir = k.n;
}
const alinacak = tablolar;
const atlanan = [];

console.log(`hedef: ${DIZIN}`);
console.log(`tablo: ${tablolar.length} — hepsi alınacak (boş olanlar dahil)\n`);
for (const t of alinacak) console.log(`  ${t.ad.padEnd(30)} ${String(t.satir).padStart(9)} satır · ${mb(Number(t.bayt))}`);

if (RAPOR) {
  console.log("\n--rapor: hiçbir şey yazılmadı.");
  await c.end();
  process.exit(0);
}

mkdirSync(DIZIN, { recursive: true });
const ozet = { alindi: new Date().toISOString(), kaynak: "supabase", tablolar: {} };
let toplamBayt = 0;

/**
 * Bir tabloyu KENDİ bağlantısıyla döker.
 *
 * NEDEN AYRI BAĞLANTI (2026-08-12): ilk sürüm tek `pg.Client` ile tüm tabloları
 * sırayla döküyordu. En büyük tablo (offmarket_leads, 107 MB gz) bittikten
 * hemen sonra Supabase bağlantıyı düşürdü, `pg.Client` bunu yakalanmamış
 * `error` olayı olarak fırlattı ve SÜREÇ ÖLDÜ — geriye tek dosya kaldı, kalan
 * 38 tablo hiç alınmadı. Yedekte yarım kalmak, hiç almamaktan tehlikelidir
 * (dolu klasör "yedeğim var" hissi verir).
 *
 * Artık her tablo kendi bağlantısını açıp kapatıyor: biri düşerse yalnız o
 * tablo etkilenir ve 3 kez yeniden denenir.
 */
async function tabloDok(ad, dosya) {
  for (let deneme = 1; ; deneme++) {
    const cc = new pg.Client({ connectionString: dbUrl(), keepAlive: true });
    cc.on("error", () => {}); // boşta hata süreci öldürmesin
    try {
      await cc.connect();
      await cc.query("set statement_timeout = 0");
      const kaynak = cc.query(copyTo.to(`copy public."${ad}" to stdout (format csv, header true)`));
      // COPY akışı: satırlar belleğe TOPLANMAZ, doğrudan gzip'e akar.
      await pipeline(kaynak, createGzip({ level: 6 }), createWriteStream(dosya));
      await cc.end().catch(() => {});
      return;
    } catch (e) {
      await cc.end().catch(() => {});
      if (deneme >= 3) throw e;
      console.log(`\n   ⚠ ${ad}: ${e.message.slice(0, 70)} — ${deneme + 1}. deneme`);
      await new Promise((r) => setTimeout(r, 4000 * deneme));
    }
  }
}

const basarisiz = [];
for (const t of alinacak) {
  const { rows: kolonlar } = await c.query(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name=$1 order by ordinal_position`,
    [t.ad]
  );
  const kolonAdlari = kolonlar.map((k) => k.column_name);
  const dosya = path.join(DIZIN, `${t.ad}.csv.gz`);
  const t0 = Date.now();
  process.stdout.write(`→ ${t.ad} … `);

  try {
    await tabloDok(t.ad, dosya);
  } catch (e) {
    console.log(`BAŞARISIZ: ${e.message.slice(0, 80)}`);
    basarisiz.push({ tablo: t.ad, hata: e.message });
    continue;
  }

  const boyut = statSync(dosya).size;
  toplamBayt += boyut;
  ozet.tablolar[t.ad] = { satir: t.satir, kolonlar: kolonAdlari, dosya: path.basename(dosya), bayt: boyut };
  console.log(`${mb(boyut)} · ${Math.round((Date.now() - t0) / 1000)} sn`);
}

ozet.bosTablolar = tablolar.filter((t) => t.satir === 0).map((t) => t.ad);
ozet.toplamBayt = toplamBayt;
writeFileSync(path.join(DIZIN, "_ozet.json"), JSON.stringify(ozet, null, 2));

ozet.basarisiz = basarisiz;
// Yedeğin GÜVENİLİR olup olmadığı tek bakışta görünsün.
console.log(basarisiz.length ? `\n⚠ EKSİK YEDEK — ${basarisiz.length} tablo alınamadı:` : `\n✔ Yedek tamam: ${DIZIN}`);
for (const b of basarisiz) console.log(`   ✗ ${b.tablo}: ${b.hata.slice(0, 90)}`);
if (basarisiz.length) console.log(`   klasör: ${DIZIN}`);
console.log(`  ${Object.keys(ozet.tablolar).length} tablo · ${mb(toplamBayt)} (sıkıştırılmış)`);
console.log(`  bunların ${ozet.bosTablolar.length} tanesi boş`);
await c.end();
