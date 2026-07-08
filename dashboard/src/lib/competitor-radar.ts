// ─────────────────────────────────────────────────────────────────────────────
// RAKİP SATIŞ RADARI — saf hesap katmanı (DB/network YOK, test edilebilir).
//
// İki bağımsız veri kaynağını UI için toplulaştırır:
//   1) competitor_listings (scraper'ın "şu an ne satılıyor" tablosu, ~291 satır)
//      → RAKİP MANZARASI: rakip başına aktif ilan, medyan fiyat, medyan $/acre,
//        eyalet/county dağılımı, dönüm aralığı. İlk günden (diff birikmeden) çalışır.
//   2) competitor_tracked (rakip-radar yaşam döngüsü tablosu) → SATIŞ SİNYALİ:
//      bu hafta yeni / bu hafta kaybolan (≈satıldı) / tahmini satış hızı.
//   3) competitor_sales (PropStream deed/satış importu) → DOĞRULANMIŞ SATIŞLAR.
//
// Ayrıca PropStream CSV export'unu ESNEK başlık eşleme ile competitor_sales
// satırlarına çevirir (import-propstream-csv.mjs desenini izler; kolon adları
// PropStream sürümüne göre değişir).
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

// ── Sayısal yardımcılar ──────────────────────────────────────────────────────
export function median(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function daysBetween(fromIso: string | null | undefined, to: Date): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return null;
  return Math.max(0, Math.round((to.getTime() - from) / DAY_MS));
}

function topCounts(values: (string | null | undefined)[], limit = 4): { key: string; n: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = (v || "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

// ── 1) RAKİP MANZARASI (raw competitor_listings'ten, hemen çalışır) ──────────
export interface RawListing {
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  price: number | null;
}

export interface CompetitorLandscape {
  competitor: string;
  activeCount: number;
  medianPrice: number | null;
  medianPpa: number | null; // medyan $/acre
  acresMin: number | null;
  acresMedian: number | null;
  acresMax: number | null;
  states: { key: string; n: number }[]; // en yoğun eyaletler
  counties: { key: string; n: number }[]; // en yoğun county'ler
}

export function competitorLandscape(listings: RawListing[]): CompetitorLandscape[] {
  const groups = new Map<string, RawListing[]>();
  for (const l of listings) {
    const name = (l.competitor || "Bilinmeyen").trim() || "Bilinmeyen";
    (groups.get(name) || groups.set(name, []).get(name)!).push(l);
  }
  const out: CompetitorLandscape[] = [];
  for (const [competitor, items] of groups) {
    const prices = items.map((i) => i.price).filter((p): p is number => p != null && p > 0);
    const acres = items.map((i) => i.acres).filter((a): a is number => a != null && a > 0);
    const ppas = items
      .map((i) => (i.price != null && i.price > 0 && i.acres && i.acres > 0 ? i.price / i.acres : null))
      .filter((p): p is number => p != null);
    out.push({
      competitor,
      activeCount: items.length,
      medianPrice: median(prices),
      medianPpa: ppas.length ? Math.round(median(ppas)!) : null,
      acresMin: acres.length ? Math.min(...acres) : null,
      acresMedian: median(acres),
      acresMax: acres.length ? Math.max(...acres) : null,
      states: topCounts(items.map((i) => i.state)),
      counties: topCounts(items.map((i) => i.county)),
    });
  }
  return out.sort((a, b) => b.activeCount - a.activeCount);
}

// ── 2) SATIŞ SİNYALİ (competitor_tracked'ten, zamanla dolar) ─────────────────
export interface TrackedRow {
  listing_key: string;
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  first_seen: string;
  last_seen: string;
  current_price: number | null;
  status: string; // ACTIVE | PENDING | SUSPECTED_SOLD | SOLD_VERIFIED | WITHDRAWN
  disappeared_at: string | null;
  dom_days: number | null;
}

export interface CompetitorSignal {
  competitor: string;
  tracked: number;
  newThisWeek: number; // first_seen son 7 gün
  lostThisWeek: number; // disappeared_at son 7 gün (≈satıldı)
  suspectedTotal: number; // toplam SUSPECTED_SOLD
  /** Kaybolan/hafta — toplam kaybolan ile izleme süresine göre tahmini satış hızı. */
  velocityPerWeek: number | null;
}

const isDisappeared = (t: TrackedRow) =>
  !!t.disappeared_at || t.status === "SUSPECTED_SOLD" || t.status === "SOLD_VERIFIED";

export function competitorSignals(tracked: TrackedRow[], now: Date): CompetitorSignal[] {
  const groups = new Map<string, TrackedRow[]>();
  for (const t of tracked) {
    const name = (t.competitor || "Bilinmeyen").trim() || "Bilinmeyen";
    (groups.get(name) || groups.set(name, []).get(name)!).push(t);
  }
  const out: CompetitorSignal[] = [];
  for (const [competitor, items] of groups) {
    const firstSeens = items.map((t) => new Date(t.first_seen).getTime()).filter((n) => !Number.isNaN(n));
    const spanDays = firstSeens.length ? Math.max(1, (now.getTime() - Math.min(...firstSeens)) / DAY_MS) : 0;
    const disappeared = items.filter(isDisappeared).length;
    out.push({
      competitor,
      tracked: items.length,
      newThisWeek: items.filter((t) => {
        const d = daysBetween(t.first_seen, now);
        return d != null && d <= 7;
      }).length,
      lostThisWeek: items.filter((t) => {
        const d = daysBetween(t.disappeared_at, now);
        return d != null && d <= 7;
      }).length,
      suspectedTotal: items.filter((t) => t.status === "SUSPECTED_SOLD").length,
      velocityPerWeek: spanDays > 0 && disappeared > 0 ? Math.round((disappeared / spanDays) * 7 * 10) / 10 : null,
    });
  }
  return out.sort((a, b) => b.tracked - a.tracked);
}

// "Muhtemelen Satıldı" tablosu: kaybolmuş (satış şüphesi) ilanlar.
export interface LikelySold {
  listing_key: string;
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  lastPrice: number | null;
  disappearedAt: string | null;
  domDays: number | null;
}

export function likelySold(tracked: TrackedRow[]): LikelySold[] {
  return tracked
    .filter((t) => t.status === "SUSPECTED_SOLD")
    .map((t) => ({
      listing_key: t.listing_key,
      competitor: t.competitor,
      title: t.title,
      state: t.state,
      county: t.county,
      acres: t.acres,
      lastPrice: t.current_price,
      disappearedAt: t.disappeared_at,
      domDays: t.dom_days,
    }))
    .sort((a, b) => (b.disappearedAt || "").localeCompare(a.disappearedAt || ""));
}

// ── 3) DOĞRULANMIŞ SATIŞLAR (competitor_sales, PropStream) ────────────────────
export interface SaleRow {
  competitor_name: string | null;
  price: number | null;
  acres: number | null;
  sale_date: string | null; // ISO date
  state: string | null;
  county: string | null;
}

export interface CompetitorSalesStat {
  competitor: string;
  count: number;
  medianPrice: number | null;
  medianPpa: number | null;
  firstSale: string | null;
  lastSale: string | null;
  /** Gözlemlenen tarih aralığında ay başına satış (satış hızı). */
  salesPerMonth: number | null;
}

export function salesStats(sales: SaleRow[]): CompetitorSalesStat[] {
  const groups = new Map<string, SaleRow[]>();
  for (const s of sales) {
    const name = (s.competitor_name || "Bilinmeyen").trim() || "Bilinmeyen";
    (groups.get(name) || groups.set(name, []).get(name)!).push(s);
  }
  const out: CompetitorSalesStat[] = [];
  for (const [competitor, items] of groups) {
    const prices = items.map((s) => s.price).filter((p): p is number => p != null && p > 0);
    const ppas = items
      .map((s) => (s.price != null && s.price > 0 && s.acres && s.acres > 0 ? s.price / s.acres : null))
      .filter((p): p is number => p != null);
    const dates = items
      .map((s) => s.sale_date)
      .filter((d): d is string => !!d && !Number.isNaN(new Date(d).getTime()))
      .sort();
    const first = dates[0] ?? null;
    const last = dates[dates.length - 1] ?? null;
    let perMonth: number | null = null;
    if (first && last) {
      const months = Math.max(1, (new Date(last).getTime() - new Date(first).getTime()) / (DAY_MS * 30));
      perMonth = Math.round((items.length / months) * 10) / 10;
    }
    out.push({
      competitor,
      count: items.length,
      medianPrice: median(prices),
      medianPpa: ppas.length ? Math.round(median(ppas)!) : null,
      firstSale: first,
      lastSale: last,
      salesPerMonth: perMonth,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ── PropStream CSV → competitor_sales eşleme ─────────────────────────────────
// RFC4180 CSV parse (tırnaklı alan + "" kaçış). import-propstream-csv.mjs ile aynı.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  // BOM at
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* atla */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Beklenen PropStream kolonları (deed/satış geçmişi export'u). Esnek eşleme —
// aşağıdaki varyantların HERHANGİ biri yakalanır.
export const SALES_FIELD_PATTERNS: Record<string, RegExp[]> = {
  grantor: [/grantor/i, /^seller$/i, /seller.*name/i, /seller/i],
  grantee: [/grantee/i, /^buyer$/i, /buyer.*name/i, /buyer/i],
  apn: [/\bapn\b/i, /parcel.*number/i, /parcel.*id/i, /parcel\s*#/i, /parcel.*no/i, /^account/i],
  sale_date: [/sale.*date/i, /recording.*date/i, /record.*date/i, /transfer.*date/i, /deed.*date/i, /last.*sale.*date/i, /^date$/i],
  price: [/sale.*price/i, /sale.*amount/i, /last.*sale.*price/i, /transfer.*amount/i, /^amount$/i, /^price$/i],
  acres: [/acre/i, /lot.*size.*acre/i, /^acreage$/i],
  county: [/county/i],
  state: [/property.*state/i, /site.*state/i, /^state$/i, /situs.*state/i],
  deed_type: [/deed.*type/i, /document.*type/i, /doc.*type/i, /^deed$/i, /instrument.*type/i],
};

export function matchSalesHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const norm = headers.map((h) => (h || "").trim());
  for (const [field, pats] of Object.entries(SALES_FIELD_PATTERNS)) {
    for (let i = 0; i < norm.length; i++) {
      if (map[field] != null) break;
      if (norm[i] && pats.some((p) => p.test(norm[i]))) map[field] = i;
    }
  }
  return map;
}

export function numFromString(s: unknown): number | null {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// "1/15/2026", "2026-01-15", "15-Jan-2026" → ISO date (YYYY-MM-DD) veya null.
// Timezone-stabil: yerel gün bileşenlerini kullanır (toISOString UTC'ye kaydırıp
// günü bir geri atmasın diye).
export function parseDateFlexible(s: unknown): string | null {
  const raw = String(s ?? "").trim();
  if (!raw) return null;
  // Zaten ISO tarih ise doğrudan al.
  const isoM = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) return `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Deterministik dedup anahtarı (crypto YOK — djb2 string hash).
export function saleKey(parts: (string | number | null | undefined)[]): string {
  const s = parts.map((p) => String(p ?? "").trim().toLowerCase()).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `sale_${(h >>> 0).toString(36)}`;
}

export interface SaleRecord {
  sale_key: string;
  competitor_name: string | null;
  grantor_llc: string | null;
  grantee: string | null;
  apn: string | null;
  sale_date: string | null;
  price: number | null;
  acres: number | null;
  county: string | null;
  state: string | null;
  deed_type: string | null;
  source: string;
}

export interface MapResult {
  detected: Record<string, string>; // field → matched header
  records: SaleRecord[];
  skipped: number;
  missing: string[]; // eşleşmeyen kritik alanlar (grantor VEYA apn + sale_date VEYA price)
}

/**
 * CSV metnini competitor_sales kayıtlarına çevirir.
 * @param competitorOverride  Kullanıcının UI'da girdiği rakip adı (grantor'a düşer).
 */
export function csvToSales(text: string, competitorOverride?: string | null, source = "propstream"): MapResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { detected: {}, records: [], skipped: 0, missing: ["headers"] };
  const headers = rows[0];
  const m = matchSalesHeaders(headers);
  const detected: Record<string, string> = {};
  for (const [f, i] of Object.entries(m)) detected[f] = headers[i];

  const get = (r: string[], f: string) => (m[f] != null ? String(r[m[f]] ?? "").trim() : "");
  const override = (competitorOverride || "").trim();
  const records: SaleRecord[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const grantor = get(r, "grantor") || null;
    const apn = get(r, "apn") || null;
    const sale_date = parseDateFlexible(get(r, "sale_date"));
    const price = numFromString(get(r, "price"));
    // Anlamlı bir satır için en az bir tanımlayıcı (grantor/apn) + bir satış
    // göstergesi (tarih/fiyat) olmalı.
    if (!(grantor || apn) || !(sale_date || price)) { skipped++; continue; }
    const competitor_name = override || grantor;
    const key = saleKey([competitor_name, apn, sale_date, price, source]);
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    records.push({
      sale_key: key,
      competitor_name,
      grantor_llc: grantor,
      grantee: get(r, "grantee") || null,
      apn,
      sale_date,
      price,
      acres: numFromString(get(r, "acres")),
      county: get(r, "county") || null,
      state: (get(r, "state") || "").toUpperCase().slice(0, 2) || null,
      deed_type: get(r, "deed_type") || null,
      source,
    });
  }

  const missing: string[] = [];
  if (m.grantor == null && m.apn == null) missing.push("grantor/apn");
  if (m.sale_date == null && m.price == null) missing.push("sale_date/price");
  return { detected, records, skipped, missing };
}
