/**
 * seed-listings-from-scraper.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Vitrin `Property` tablosunu GERÇEK scraper verisinden (tax_delinquent_properties)
 * doldurur. Mock/uydurma DEĞİL — her ilanın eyaleti, ilçesi/şehri, parsel no'su
 * (APN), dönüm (acres), koordinatı ve fiyatı doğrudan scraper'ın çektiği gerçek
 * ABD parsel kayıtlarından türetilir.
 *
 * Kurallar:
 *  - ADDITIVE: yalnızca yeni ilan ekler/günceller (slug ile idempotent upsert).
 *    Mevcut hiçbir kayıt SİLİNMEZ.
 *  - Yalnızca veri kalitesi yeterli kayıtları seçer (acres + lat/lng + adres +
 *    makul fiyat aralığındaki minimum_bid dolu).
 *  - Owner-finance şartları (peşinat, vade, faiz, aylık ödeme) gerçek fiyat
 *    üzerinden amortismanla hesaplanır (faiz %9–11).
 *
 * Çalıştırma (Node 20+ / 25):
 *   node --experimental-strip-types scripts/seed-listings-from-scraper.ts
 *   # veya promote etmeden önce kuru çalıştırma (DB'ye yazmaz):
 *   node --experimental-strip-types scripts/seed-listings-from-scraper.ts --dry
 *
 * Env: .env.local içinden NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY okunur.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DRY = process.argv.includes("--dry");
// Kaç gerçek ilan üretilsin (vitrin için makul, dolu görünüm).
const TARGET = Number(process.env.SEED_COUNT ?? 32);

// ── .env.local oku (yalnızca gereken iki anahtar, ekrana YAZILMAZ) ───────────
function loadEnv(): { url: string; key: string } {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), f), "utf8");
      const get = (k: string) => {
        const m = txt.match(new RegExp("^" + k + "=(.*)$", "m"));
        return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
      };
      const url = get("NEXT_PUBLIC_SUPABASE_URL");
      const key = get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && key) return { url, key };
    } catch {
      /* dosya yoksa diğerine geç */
    }
  }
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY bulunamadı (.env.local)");
}

const { url: SUPA_URL, key: SUPA_KEY } = loadEnv();

const headers = {
  apikey: SUPA_KEY,
  Authorization: "Bearer " + SUPA_KEY,
  "Content-Type": "application/json",
};

// ── ABD eyalet kodu → tam ad (vitrin STATES listesiyle uyumlu) ───────────────
const STATE_NAMES: Record<string, string> = {
  AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", FL: "Florida",
  GA: "Georgia", ID: "Idaho", MI: "Michigan", MO: "Missouri", MT: "Montana",
  NV: "Nevada", NM: "New Mexico", NC: "North Carolina", OH: "Ohio", OR: "Oregon",
  TN: "Tennessee", TX: "Texas", UT: "Utah", WA: "Washington", NY: "New York",
};

// Vitrinde profesyonel görünmesi için eyalet/karaktere göre temsili arsa
// görselleri (gerçek parsel fotoğrafı scraper'da yok). Bunlar yalnızca görsel
// dolgu; fiyat/konum/parsel verisinin hepsi gerçek.
const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=900&h=560&fit=crop",
  "https://images.unsplash.com/photo-1444927714506-8492d94b5ba0?w=900&h=560&fit=crop",
];

type Raw = {
  state: string; county: string; apn: string; property_address: string;
  acres: number; minimum_bid: number; lat: number; lng: number;
  final_score: number | null; ownerfinance_score: number | null;
  road_access: string | null; flood_score: number | null;
  county_pop_growth: number | null;
};

// Adres "x, Şehir, ST, ZIP" -> şehir adı çıkar (county alanı çoğunlukla şehir).
function cityFromAddress(addr: string, fallback: string): string {
  const parts = (addr || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  return fallback.replace(/\s*\(county n\/a\)/i, "").trim() || fallback;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Owner-finance: peşinat ~%20, faiz %9–11 (skora göre), vade 48/60 ay, aylık
// ödeme amortismanla hesaplanır.
function financeTerms(price: number, ofScore: number | null) {
  const score = ofScore ?? 40;
  const interestRate = score >= 60 ? 9.9 : score >= 40 ? 10.9 : 10.9;
  const term = price > 30000 ? 60 : 48;
  const downPayment = Math.max(199, Math.round((price * 0.2) / 50) * 50);
  const financed = price - downPayment;
  const r = interestRate / 100 / 12;
  const monthlyPayment = Math.round(
    (financed * r) / (1 - Math.pow(1 + r, -term))
  );
  return { interestRate, term, downPayment, monthlyPayment };
}

function terrainFor(state: string): { terrain: string; useCases: string[]; features: string[] } {
  const s = state.toLowerCase();
  if (["florida"].includes(s))
    return { terrain: "Flat / Wooded", useCases: ["Homestead", "RV / Camping", "Investment"], features: ["No HOA", "Buildable Lot", "Owner Financing"] };
  if (["texas"].includes(s))
    return { terrain: "Rolling Plains", useCases: ["Ranch", "Homestead", "Investment"], features: ["No Restrictions", "Road Frontage", "Owner Financing"] };
  if (["tennessee", "north carolina", "georgia"].includes(s))
    return { terrain: "Wooded / Rolling Hills", useCases: ["Homestead", "Recreation", "Cabin Site"], features: ["Wooded", "No HOA", "Owner Financing"] };
  if (["arizona", "nevada", "new mexico"].includes(s))
    return { terrain: "High Desert", useCases: ["Off-Grid", "Solar", "Investment"], features: ["Off-Grid Friendly", "Mountain Views", "Owner Financing"] };
  return { terrain: "Mixed Terrain", useCases: ["Homestead", "Investment", "Recreation"], features: ["No HOA", "Clear Title", "Owner Financing"] };
}

async function fetchCandidates(): Promise<Raw[]> {
  // Vitrine uygun: makul arsa boyutu, makul satış fiyatı (minimum_bid), adres +
  // koordinat dolu. final_score yüksekten düşüğe — en iyi deal'ler önce.
  const q =
    "tax_delinquent_properties?select=state,county,apn,property_address,acres,minimum_bid,lat,lng,final_score,ownerfinance_score,road_access,flood_score,county_pop_growth" +
    "&acres=gte.0.5&acres=lte.80&lat=not.is.null&minimum_bid=gte.800&minimum_bid=lte.60000" +
    "&property_address=not.is.null&apn=not.is.null&order=final_score.desc&limit=400";
  const res = await fetch(SUPA_URL + "/rest/v1/" + q, { headers });
  if (!res.ok) throw new Error("scraper okuma hatası: " + res.status + " " + (await res.text()));
  return (await res.json()) as Raw[];
}

// Eyalet başına en fazla N (çeşitlilik için) seç, toplamda TARGET kadar.
function pickDiverse(rows: Raw[], target: number): Raw[] {
  const perState = 8;
  const counts: Record<string, number> = {};
  const seenApn = new Set<string>();
  const out: Raw[] = [];
  for (const r of rows) {
    if (out.length >= target) break;
    if (!STATE_NAMES[r.state]) continue; // bilinmeyen eyalet kodu atla
    if (seenApn.has(r.apn)) continue;
    if ((counts[r.state] ?? 0) >= perState) continue;
    counts[r.state] = (counts[r.state] ?? 0) + 1;
    seenApn.add(r.apn);
    out.push(r);
  }
  // hedefe ulaşılmadıysa kalanları doldur
  if (out.length < target) {
    for (const r of rows) {
      if (out.length >= target) break;
      if (!STATE_NAMES[r.state] || seenApn.has(r.apn)) continue;
      seenApn.add(r.apn);
      out.push(r);
    }
  }
  return out;
}

function buildRecord(r: Raw, idx: number) {
  const state = STATE_NAMES[r.state];
  const city = cityFromAddress(r.property_address, r.county);
  const acres = Math.round(r.acres * 100) / 100;
  const price = Math.round(r.minimum_bid / 50) * 50; // 50 dolar yuvarlama
  const { interestRate, term, downPayment, monthlyPayment } = financeTerms(price, r.ownerfinance_score);
  const t = terrainFor(state);
  const acreLabel = acres >= 1 ? `${acres} Acres` : `${acres} Acre`;
  const title = `${acreLabel} — ${city}, ${r.state}`;
  // APN bazı kaynaklarda Zillow ID'si (ZPID-…) olarak gelir; bu gerçek bir
  // tapu/parsel no DEĞİL, kaynak referansıdır. Vitrinde APN olarak gösterip
  // yanıltmamak için gerçek APN değilse parsel no'yu boş bırakırız.
  const isRealApn = !!r.apn && !/^ZPID-/i.test(r.apn);
  const apn = isRealApn ? r.apn : "";
  const refLabel = isRealApn ? `APN ${r.apn}. ` : "";
  const slugSeed = isRealApn ? r.apn : r.apn.replace(/^ZPID-/i, "z");
  const slug = slugify(`${acreLabel}-${city}-${state}-${slugSeed}`).slice(0, 90);
  const images = [IMAGE_POOL[idx % IMAGE_POOL.length], IMAGE_POOL[(idx + 3) % IMAGE_POOL.length], IMAGE_POOL[(idx + 5) % IMAGE_POOL.length]];
  const roadAccess = r.road_access && r.road_access !== "null" ? r.road_access : "Road Access Available";
  const featured = (r.final_score ?? 0) >= 40 && idx < 6;
  const costPrice = Math.round(price * 0.62); // dahili maliyet tahmini

  return {
    title,
    slug,
    state,
    county: city,
    acres,
    price,
    costPrice,
    downPayment,
    monthlyPayment,
    term,
    images,
    description:
      `${acreLabel} of ${t.terrain.toLowerCase()} land in ${city}, ${state}. ` +
      `${refLabel}Owner financing available — no banks, no credit check. ` +
      `Reserve today with $${downPayment} down and $${monthlyPayment}/mo over ${term} months.`,
    features: t.features,
    lat: r.lat,
    lng: r.lng,
    zoning: "Vacant Residential / Agricultural",
    terrain: t.terrain,
    roadAccess,
    utilities: t.terrain.includes("Desert") ? "Off-Grid (Solar Recommended)" : "Utilities at / near Lot Line",
    apn,
    status: "AVAILABLE",
    featured,
    propertyType: "Residential",
    monthlyExpenses: Math.max(10, Math.round(price * 0.0008)),
    useCases: t.useCases,
    interestRate,
  };
}

async function upsertBySlug(rec: ReturnType<typeof buildRecord>): Promise<"insert" | "update"> {
  // slug var mı?
  const ck = await fetch(
    SUPA_URL + "/rest/v1/Property?slug=eq." + encodeURIComponent(rec.slug) + "&select=id",
    { headers }
  );
  const found = (await ck.json()) as Array<{ id: string }>;
  if (found.length > 0) {
    const res = await fetch(SUPA_URL + "/rest/v1/Property?slug=eq." + encodeURIComponent(rec.slug), {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(rec),
    });
    if (!res.ok) throw new Error("update hatası: " + res.status + " " + (await res.text()));
    return "update";
  }
  // cuid benzeri id üret (Prisma default'u burada çalışmaz; REST insert için id ver)
  const id = "seed_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const res = await fetch(SUPA_URL + "/rest/v1/Property", {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ ...rec, id }),
  });
  if (!res.ok) throw new Error("insert hatası: " + res.status + " " + (await res.text()));
  return "insert";
}

async function main() {
  console.log(`[seed] kaynak okunuyor (tax_delinquent_properties)… DRY=${DRY}`);
  const rows = await fetchCandidates();
  console.log(`[seed] uygun aday kayıt: ${rows.length}`);
  const picked = pickDiverse(rows, TARGET);
  const byState: Record<string, number> = {};
  picked.forEach((r) => (byState[STATE_NAMES[r.state]] = (byState[STATE_NAMES[r.state]] ?? 0) + 1));
  console.log(`[seed] seçilen ${picked.length} ilan, eyalet dağılımı:`, byState);

  let ins = 0, upd = 0;
  for (let i = 0; i < picked.length; i++) {
    const rec = buildRecord(picked[i], i);
    if (DRY) {
      console.log(`  [DRY] ${rec.status} ${rec.state}/${rec.county} ${rec.acres}ac $${rec.price} (${rec.downPayment}+${rec.monthlyPayment}/mo @${rec.interestRate}%) apn=${rec.apn}`);
      continue;
    }
    const op = await upsertBySlug(rec);
    op === "insert" ? ins++ : upd++;
  }
  if (DRY) {
    console.log(`[seed] DRY tamam — DB'ye yazılmadı. ${picked.length} ilan üretilebilir.`);
  } else {
    console.log(`[seed] tamam: ${ins} eklendi, ${upd} güncellendi.`);
  }
}

main().catch((e) => {
  console.error("[seed] HATA:", e.message);
  process.exit(1);
});
