#!/usr/bin/env node
/**
 * disk-guard.mjs — Supabase disk bekçisi.
 *
 * NEDEN VAR: 2026-07-27'de 2 GB'lık disk doldu, Postgres kendini salt-okunur
 * moda aldı ve ardından hiç açılamadı (PGRST002). Proje saatlerce yerde kaldı.
 * Kök sebep tek bir gece değil, sessizce büyüyen veri + ağır yazma turlarıydı.
 * Bu script o gecenin tekrarını önler: doluluk eşiği aşmışsa scraper turunu
 * BAŞLAMADAN durdurur. Tek bir turun iptal olması, tüm veritabanının kilitlenip
 * her şeyin durmasından iyidir.
 *
 * ÖNEMLİ: gerçek disk kullanımı sadece veritabanı DEĞİL —
 *   toplam = pg_database_size + WAL + sistem dosyaları
 * WAL ağır yazma turlarında 1 GB'a kadar çıkabiliyor; krizin sebebi buydu.
 *
 * Kullanım:
 *   node disk-guard.mjs            # kontrol et, eşik aşılmışsa exit 1
 *   node disk-guard.mjs --report   # sadece raporla, her zaman exit 0
 *
 * Ayarlar (env):
 *   DISK_LIMIT_GB   toplam disk boyutu            (varsayılan 8)
 *   DISK_WARN_PCT   bu yüzdeyi aşarsa durdur      (varsayılan 80)
 *   DISK_SYSTEM_GB  sistem dosyası payı           (varsayılan 0.20)
 */
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const LIMIT_GB = parseFloat(process.env.DISK_LIMIT_GB || "8");
const WARN_PCT = parseFloat(process.env.DISK_WARN_PCT || "80");
const SYSTEM_GB = parseFloat(process.env.DISK_SYSTEM_GB || "0.20");
const REPORT_ONLY = process.argv.includes("--report");

const GB = 1024 ** 3;
const fmt = (bytes) => `${(bytes / GB).toFixed(2)} GB`;

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* bildirim gönderilemedi — koşuyu etkilemesin */
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 1, keepAlive: true });
  pool.on("error", () => {});

  let dbBytes = 0;
  let walBytes = 0;
  let readOnly = "off";
  let topTables = [];

  try {
    const { rows } = await pool.query(
      `select pg_database_size(current_database()) as db,
              current_setting('default_transaction_read_only') as ro`
    );
    dbBytes = Number(rows[0].db);
    readOnly = rows[0].ro;

    // WAL'a erişim rol iznine bağlı; yoksa sessizce 0 kabul et (eksik ölçüm,
    // ama DB boyutu tek başına yine de erken uyarı verir).
    try {
      const w = await pool.query(`select coalesce(sum(size),0) as wal from pg_ls_waldir()`);
      walBytes = Number(w.rows[0].wal);
    } catch {
      walBytes = 0;
    }

    const t = await pool.query(
      `select c.relname, pg_total_relation_size(c.oid) as bytes
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by 2 desc limit 5`
    );
    topTables = t.rows;
  } catch (e) {
    // Bağlanamıyorsak zaten bir sorun var — turu başlatma.
    console.error(`✗ disk-guard: veritabanına bağlanılamadı → ${e.message}`);
    await pool.end().catch(() => {});
    process.exit(REPORT_ONLY ? 0 : 1);
  }

  await pool.end().catch(() => {});

  const usedBytes = dbBytes + walBytes + SYSTEM_GB * GB;
  const limitBytes = LIMIT_GB * GB;
  const pct = (usedBytes / limitBytes) * 100;

  console.log(`— Supabase disk durumu —`);
  console.log(`  veritabanı : ${fmt(dbBytes)}`);
  console.log(`  WAL        : ${fmt(walBytes)}${walBytes === 0 ? "  (okunamadı — ölçüm eksik)" : ""}`);
  console.log(`  sistem     : ${fmt(SYSTEM_GB * GB)}  (tahmin)`);
  console.log(`  TOPLAM     : ${fmt(usedBytes)} / ${LIMIT_GB} GB  → %${pct.toFixed(1)}`);
  console.log(`  salt-okunur: ${readOnly}`);
  console.log(`  en büyükler: ${topTables.map((r) => `${r.relname} ${fmt(Number(r.bytes))}`).join(" · ")}`);

  if (readOnly === "on") {
    const msg =
      `🔴 Terralot: veritabanı SALT-OKUNUR modda — scraper turu iptal edildi.\n` +
      `Disk %${pct.toFixed(1)} (${fmt(usedBytes)}/${LIMIT_GB} GB).\n` +
      `Çözüm: Supabase panelinden diski büyüt, sonra SQL Editor'da:\n` +
      `  set session characteristics as transaction read write;\n` +
      `  alter database postgres set default_transaction_read_only = 'off';`;
    console.error(`\n✗ ${msg}`);
    await telegram(msg);
    process.exit(REPORT_ONLY ? 0 : 1);
  }

  if (pct >= WARN_PCT) {
    const msg =
      `🔴 Terralot: disk %${pct.toFixed(1)} dolu (${fmt(usedBytes)}/${LIMIT_GB} GB) — ` +
      `scraper turu BAŞLATILMADI.\n` +
      `Eşik %${WARN_PCT}. Disk dolarsa Postgres salt-okunura düşer ve proje komple durur.\n` +
      `Yapılacak: Supabase → Settings → Compute and Disk → Disk Size büyüt, ` +
      `veya eski/kullanılmayan tabloları boşalt.`;
    console.error(`\n✗ ${msg}`);
    await telegram(msg);
    process.exit(REPORT_ONLY ? 0 : 1);
  }

  console.log(`\n✓ disk-guard: yer var (eşik %${WARN_PCT}), tur başlayabilir.`);
  process.exit(0);
}

main().catch(async (e) => {
  console.error(`✗ disk-guard beklenmedik hata: ${e.message}`);
  process.exit(REPORT_ONLY ? 0 : 1);
});
