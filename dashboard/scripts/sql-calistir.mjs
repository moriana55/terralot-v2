// ─────────────────────────────────────────────────────────────────────────────
// SQL ÇALIŞTIR — sql/*.sql dosyalarını doğrudan bağlantıyla (DIRECT_URL) uygular.
// GÜVENLİK FRENİ: dosyada DELETE / DROP / TRUNCATE geçiyorsa ÇALIŞTIRMAZ.
// Kullanım: node scripts/sql-calistir.mjs sql/county_normalized.sql
// ─────────────────────────────────────────────────────────────────────────────
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { ENV, ROOT } from "./_gecici/db.mjs";

const dosya = process.argv[2];
if (!dosya) { console.error("kullanım: node scripts/sql-calistir.mjs <dosya.sql>"); process.exit(1); }
const metin = fs.readFileSync(path.resolve(ROOT, dosya), "utf8");

// Yorum satırlarını çıkardıktan sonra yıkıcı komut ara.
const kod = metin.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const yasak = kod.match(/\b(delete\s+from|drop\s+(table|column|index|schema)|truncate)\b/i);
if (yasak) { console.error("REDDEDİLDİ — yıkıcı komut bulundu:", yasak[0]); process.exit(2); }

const sql = postgres(ENV.DIRECT_URL, { ssl: "require", max: 1 });
console.log("Çalıştırılıyor:", dosya);
await sql.unsafe(metin);
console.log("TAMAM.");
await sql.end();
