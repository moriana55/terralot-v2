// ─────────────────────────────────────────────────────────────────────────────
// INQUIRY TAŞI — eski `Inquiry` tablosunu tek huniye (`parcel_inquiries`) kopyalar.
//
// 1) ÖNCE YEDEK: Inquiry + Property tablolarının TAM dışa aktarımı
//    ../yedek/<tarih>/Inquiry.json ve Property.json olarak diske yazılır.
// 2) SONRA KOPYALA: her Inquiry satırı parcel_inquiries'e eklenir.
//    propertyId → parcel_id, Property.title → parcel_title, createdAt → created_at,
//    id → legacy_id, source = 'eski-inquiry', yeni id = uuid.
//
// SALT-EKLEME: kaynak `Inquiry` satırları SİLİNMEZ. Hiçbir DELETE/DROP/TRUNCATE yok.
// IDEMPOTENT: legacy_id zaten varsa o satır atlanır → tekrar tekrar çalıştırılabilir.
//
// Kullanım: node scripts/inquiry-tasi.mjs [YYYY-AA-GG]
// ─────────────────────────────────────────────────────────────────────────────
import { sb } from "./_gecici/db.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TARIH = process.argv[2] || "2026-07-29";
const DIZIN = path.resolve(import.meta.dirname, "../../yedek", TARIH);
fs.mkdirSync(DIZIN, { recursive: true });

// Tablonun tamamını sayfalayarak çeker (Supabase varsayılan 1000 satır sınırı).
async function tumSatirlar(tablo, siraSutunu) {
  const SAYFA = 1000;
  const hepsi = [];
  for (let ofset = 0; ; ofset += SAYFA) {
    const { data, error } = await sb
      .from(tablo)
      .select("*")
      .order(siraSutunu, { ascending: true })
      .range(ofset, ofset + SAYFA - 1);
    if (error) throw new Error(`${tablo}: ${error.message}`);
    hepsi.push(...data);
    if (data.length < SAYFA) break;
  }
  return hepsi;
}

// ── 1) Yedek ────────────────────────────────────────────────────────────────
const inquiryler = await tumSatirlar("Inquiry", "id");
const propertyler = await tumSatirlar("Property", "id");

fs.writeFileSync(path.join(DIZIN, "Inquiry.json"), JSON.stringify(inquiryler, null, 2));
fs.writeFileSync(path.join(DIZIN, "Property.json"), JSON.stringify(propertyler, null, 2));
console.log("YEDEK →", DIZIN);
console.log("  Inquiry :", inquiryler.length, "satır");
console.log("  Property:", propertyler.length, "satır");

// ── 2) Taşıma ───────────────────────────────────────────────────────────────
if (inquiryler.length === 0) {
  console.log("Taşınacak Inquiry satırı yok — taşıma atlandı.");
  process.exit(0);
}

// Hedefte hangi legacy_id'ler zaten var? (idempotenlik)
const { data: mevcut, error: mevcutHata } = await sb
  .from("parcel_inquiries")
  .select("legacy_id")
  .not("legacy_id", "is", null);
if (mevcutHata) throw new Error("parcel_inquiries okunamadı: " + mevcutHata.message);
const tasinmis = new Set((mevcut ?? []).map((r) => r.legacy_id));

const baslikMap = new Map(propertyler.map((p) => [p.id, p.title]));
const DURUMLAR = new Set(["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]);

const yeniler = [];
let atlanan = 0;
for (const q of inquiryler) {
  if (tasinmis.has(q.id)) { atlanan++; continue; }
  yeniler.push({
    id: crypto.randomUUID(),
    parcel_id: String(q.propertyId ?? "bilinmiyor"),
    parcel_title: baslikMap.get(q.propertyId) ?? null,
    name: q.name ?? "(isimsiz)",
    email: q.email || null,
    phone: q.phone || null,
    message: q.message || null,
    status: DURUMLAR.has(q.status) ? q.status : "NEW",
    created_at: q.createdAt ?? new Date().toISOString(),
    updated_at: q.updatedAt ?? q.createdAt ?? new Date().toISOString(),
    source: "eski-inquiry",
    legacy_id: q.id,
  });
}

let eklenen = 0;
for (let i = 0; i < yeniler.length; i += 500) {
  const dilim = yeniler.slice(i, i + 500);
  const { error } = await sb.from("parcel_inquiries").insert(dilim);
  if (error) throw new Error("insert hatası: " + error.message);
  eklenen += dilim.length;
}

console.log("TAŞIMA TAMAM.");
console.log("  taşınan  :", eklenen);
console.log("  atlanan  :", atlanan, "(legacy_id zaten var)");
console.log("  kaynak Inquiry satırları DOKUNULMADI (silinmedi).");
