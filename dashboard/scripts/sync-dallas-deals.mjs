// ─────────────────────────────────────────────────────────────────────────────
// DALLAS DEAL SYNC — src/data/real-deals.json → tax_delinquent_properties
//
// Amaç: real-deals.json'daki 246 Dallas deal'i (Regrid + DCAD) canlı
// `tax_delinquent_properties` tablosuna senkronlar ki outreach/Lob pipeline (şu an
// sadece Harris'i mailable görüyor) Dallas'ı da görsün. Dallas'ın 514 satırı
// tabloda zaten var ama owner_address (posta adresi) BOŞ → mailable değil.
// Bu script o satırlara mailing address'i (mailAddr) doldurur.
//
// GÜVENLİK / İDEMPOTENT:
//   • Mevcut satır varsa (dedup_key = "apn:<slug(apn)>") → UPDATE (owner_address,
//     owner_name, teklif, borç, marj doldurulur). Yoksa → INSERT.
//   • DELETE YOK, WIPE YOK. Tekrar çalıştırmak güvenli (aynı dedup_key güncellenir).
//   • Mevcut 32.812 satır + Cerberus analizleri korunur. Sadece Dallas etkilenir.
//
// NOT: Canlı DB'de dedup_key üzerinde UNIQUE index YOK (SYNC_SETUP.sql çalıştırılmamış),
//   bu yüzden Postgres ON CONFLICT yerine "önce-bul-sonra-update/insert" kullanıyoruz.
//
// Kullanım:
//   node --env-file=.env.local scripts/sync-dallas-deals.mjs            # canlı sync
//   node --env-file=.env.local scripts/sync-dallas-deals.mjs --dry-run  # önizleme, yazma yok
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("HATA: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok. `--env-file=.env.local` ile çalıştır.");
  process.exit(1);
}
const s = createClient(url, key);

const slug = (x) =>
  String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// real-deals.json'u oku
const file = path.join(process.cwd(), "src", "data", "real-deals.json");
const json = JSON.parse(readFileSync(file, "utf8"));
const deals = Array.isArray(json) ? json : json.deals || [];
console.log(`real-deals.json: ${deals.length} Dallas deal okundu (${json.county || "Dallas County, TX"}).`);

// Deal → upsert payload (dedup_key idempotency anahtarı)
const byKey = new Map();
let noApn = 0, mailable = 0;
for (const d of deals) {
  const apn = d.apn ? String(d.apn).trim() : "";
  if (!apn) { noApn++; continue; }
  const ownerAddress = d.mailAddr && String(d.mailAddr).trim() ? String(d.mailAddr).trim() : null;
  if (ownerAddress) mailable++;
  byKey.set(`apn:${slug(apn)}`, {
    dedup_key: `apn:${slug(apn)}`,
    apn,
    source: "REGRID:DALLAS:DCAD",
    state: "TX",
    county: "DALLAS COUNTY",
    property_address: d.address || null,
    owner_name: d.owner && d.owner !== "?" ? d.owner : null,
    owner_address: ownerAddress,
    acres: typeof d.acres === "number" ? d.acres : null,
    minimum_bid: typeof d.suggestedOffer === "number" ? d.suggestedOffer : null,
    judgment_amount: typeof d.taxDebt === "number" ? d.taxDebt : null,
    sale_date: d.auctionDate || null,
    raw_url: d.regridUrl || null,
    savings: typeof d.estSpread === "number" ? d.estSpread : null,
    scraped_at: new Date().toISOString(),
  });
}
const rows = [...byKey.values()];
console.log(`Hazırlanan satır: ${rows.length} (APN'siz atlanan: ${noApn}, owner_address dolu/mailable: ${mailable})`);

// Mevcut Dallas satırlarını dedup_key ile haritala (UPDATE vs INSERT kararı için)
const keys = rows.map((r) => r.dedup_key);
const existing = new Map();
for (let i = 0; i < keys.length; i += 300) {
  const slice = keys.slice(i, i + 300);
  const { data, error } = await s
    .from("tax_delinquent_properties")
    .select("id,dedup_key")
    .in("dedup_key", slice);
  if (error) { console.error("Mevcut satır okuma hatası:", error.message); process.exit(1); }
  for (const r of data || []) existing.set(r.dedup_key, r.id);
}
const toUpdate = rows.filter((r) => existing.has(r.dedup_key));
const toInsert = rows.filter((r) => !existing.has(r.dedup_key));
console.log(`Eşleşen mevcut satır (UPDATE): ${toUpdate.length} · Yeni satır (INSERT): ${toInsert.length}`);

if (DRY) {
  console.log("DRY RUN — hiçbir şey yazılmadı.");
  console.log("Örnek UPDATE:", JSON.stringify(toUpdate[0] || null, null, 2));
  console.log("Örnek INSERT:", JSON.stringify(toInsert[0] || null, null, 2));
  process.exit(0);
}

let updated = 0, inserted = 0;
const errors = [];

// UPDATE mevcut satırları (id ile; owner_address vb. doldur). DELETE yok.
for (const r of toUpdate) {
  const id = existing.get(r.dedup_key);
  const patch = {
    source: r.source,
    property_address: r.property_address,
    owner_name: r.owner_name,
    owner_address: r.owner_address,
    acres: r.acres,
    minimum_bid: r.minimum_bid,
    judgment_amount: r.judgment_amount,
    sale_date: r.sale_date,
    raw_url: r.raw_url,
    savings: r.savings,
    scraped_at: r.scraped_at,
  };
  const { error } = await s.from("tax_delinquent_properties").update(patch).eq("id", id);
  if (error) errors.push(`update ${r.dedup_key}: ${error.message}`);
  else updated++;
}

// INSERT yeni satırlar (eşleşmeyen 3 deal). id'yi DB üretir.
if (toInsert.length) {
  const { error, count } = await s
    .from("tax_delinquent_properties")
    .insert(toInsert, { count: "exact" });
  if (error) errors.push(`insert batch: ${error.message}`);
  else inserted += count ?? toInsert.length;
}

console.log(`\nSYNC tamam → UPDATE: ${updated} · INSERT: ${inserted}`);
if (errors.length) console.error(`Hatalar (${errors.length}):`, errors.slice(0, 5));

// Doğrulama
const cnt = async (filter) => {
  let q = s.from("tax_delinquent_properties").select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count;
};
const total = await cnt();
const dallas = await cnt((q) => q.eq("county", "DALLAS COUNTY"));
const dallasMailable = await cnt((q) => q.eq("county", "DALLAS COUNTY").not("owner_address", "is", null));
const mailableTotal = await cnt((q) => q.not("owner_address", "is", null));
const mailableReal = await cnt((q) => q.not("owner_address", "is", null).not("source", "like", "ZILLOW%"));
console.log(`\nDOĞRULAMA:`);
console.log(`  tax_delinquent_properties TOPLAM: ${total}`);
console.log(`  Dallas County satır: ${dallas}`);
console.log(`  Dallas County mailable (owner_address dolu): ${dallasMailable}`);
console.log(`  TOPLAM mailable (owner_address dolu): ${mailableTotal}`);
console.log(`  Mailable & ZILLOW olmayan: ${mailableReal}`);
process.exit(errors.length ? 1 : 0);
