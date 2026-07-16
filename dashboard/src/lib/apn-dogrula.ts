// ─────────────────────────────────────────────────────────────────────────────
// APN + TRS DOĞRULAMA — saf veri arama/karşılaştırma fonksiyonları.
//
// Amaç: müşteri toplantısında "bu veriyi nereden biliyorsun?" sorusuna canlı
// kanıtla cevap vermek. İki girdi tipi desteklenir:
//   - APN (parsel no, örn "209-09-019")  → tekil parsel karşılaştırması
//   - TRS (Township-Range-Section, örn "26N 19W 31") → bölge özeti
//
// Bu dosya SADECE saf fonksiyon — network/DOM/fs YOK, node --test ile
// doğrulanır. Ağır iş (fetch/JSON okuma) API route'ta veya sayfada yapılır.
// ─────────────────────────────────────────────────────────────────────────────

// ── Girdi normalizasyonu ─────────────────────────────────────────────────────

/** Sadece rakam. */
function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

/**
 * Girilen APN'den denenecek aday değerler (tireli + tiresiz + biçimlenmiş +
 * orijinal). County'nin book-map-parcel formatı ###-##-### (8 hane) — ama harf
 * eki de olabilir (319-17-184B gibi), o yüzden orijinal/trim edilmiş metin de
 * adaylara eklenir.
 */
export function normalizeApnCandidates(raw: string): string[] {
  const trimmed = raw.trim().toUpperCase();
  const digits = digitsOnly(trimmed);
  const out = new Set<string>();
  if (trimmed) out.add(trimmed);
  if (digits) out.add(digits);
  if (digits.length === 8) {
    out.add(`${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`);
  }
  return [...out];
}

/** "26n 19w 31", " 26N  19W 31 " gibi varyasyonları kanonik "26N 19W 31" biçimine indirger. */
export function normalizeTrs(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** TRS deseni: "##N ##W ##" (township yön N/S, range yön E/W, section 1-2 hane + opsiyonel harf eki). */
const TRS_RE = /^\d{1,2}[NS]\s+\d{1,2}[EW]\s+\d{1,3}[A-Z]?$/i;

/** Girdi TRS formatına mı yoksa APN formatına mı benziyor? */
export function detectQueryKind(raw: string): "trs" | "apn" | "empty" {
  const trimmed = raw.trim();
  if (!trimmed) return "empty";
  if (TRS_RE.test(normalizeTrs(trimmed))) return "trs";
  return "apn";
}

// ── Bizim veri kaynaklarımızda APN arama ────────────────────────────────────

export interface RakipSatisLike {
  apn: string;
  kayitTipi: "dogrulanmis_satis" | "satis_taksitte" | "envanter" | "belirsiz";
  fiyat: number | null;
  tarih: string | null;
  recordingNo: string | null;
  karsiTaraf: string | null;
  sirketLlc: string | null;
  acres: number | null;
  /** PAKET TAPU (bulk deed) — bkz. lib/paket-tapu.ts. Eski veride olmayabilir. */
  deedParcelCount?: number;
  birimFiyatTahmini?: number | null;
  [k: string]: unknown;
}

export interface MohaveOffmarketLike {
  apn?: string | null;
  owner?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
  acres?: number | null;
  land_value?: number | null;
  last_sale_price?: number | null;
  region?: string | null;
  score?: number | null;
  [k: string]: unknown;
}

/** Adaylardan biri bir APN string'i ile (rakam-bazlı) eşleşiyor mu? */
function apnMatches(candidates: string[], value: string | null | undefined): boolean {
  if (!value) return false;
  const valDigits = digitsOnly(String(value).toUpperCase());
  const valUpper = String(value).trim().toUpperCase();
  for (const c of candidates) {
    if (c === valUpper) return true;
    if (c && valDigits && digitsOnly(c) === valDigits) return true;
  }
  return false;
}

export function findRakipSatisRecord<T extends RakipSatisLike>(
  records: T[] | null | undefined,
  candidates: string[],
): T | null {
  if (!records || !records.length) return null;
  return records.find((r) => apnMatches(candidates, r.apn)) ?? null;
}

export function findMohaveOffmarketRow<T extends MohaveOffmarketLike>(
  rows: T[] | null | undefined,
  candidates: string[],
): T | null {
  if (!rows || !rows.length) return null;
  return rows.find((r) => apnMatches(candidates, r.apn ?? null)) ?? null;
}

/** rakip-ilan-fiyat.json şekli henüz kesinleşmedi — genel/esnek arama (varsa apn alanı). */
export function findGenericApnRecord<T extends { apn?: string | null }>(
  records: T[] | null | undefined,
  candidates: string[],
): T | null {
  if (!records || !records.length) return null;
  return records.find((r) => apnMatches(candidates, r.apn ?? null)) ?? null;
}

// ── Bizim kayıt özetimiz (birleştirilmiş) ───────────────────────────────────

export interface OurRecordSummary {
  apn: string;
  found: boolean;
  ownerName: string | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  acres: number | null;
  landValue: number | null;
  sources: string[]; // hangi dosyalardan bulundu (rapor/kanıt için)
  /**
   * PAKET TAPU (bulk deed) — rakipSatis kaydı aynı RECPTNO'ya bağlı birden
   * fazla parseli kapsıyorsa (deedParcelCount>1), lastSalePrice o tapunun
   * TOPLAM tutarıdır, tek parselin fiyatı DEĞİL. UI bunu "N parsellik paket
   * tapusu (parsel başına ~$X)" notuyla göstermeli — bkz. lib/paket-tapu.ts.
   */
  deedParcelCount: number | null;
  birimFiyatTahmini: number | null;
}

/** rakip-satislar "karsiTaraf" alanı "AD (adres...)" biçiminde — parantez öncesini al. */
function stripParenthetical(s: string | null | undefined): string | null {
  if (!s) return null;
  const idx = s.indexOf("(");
  const name = idx >= 0 ? s.slice(0, idx) : s;
  const trimmed = name.trim();
  return trimmed || null;
}

/** Üç kaynaktan bulunanları TEK özet kayda birleştirir (rakip-satislar öncelikli sahiplik/satış, mohave öncelikli acre/değer). */
export function buildOurRecordSummary(
  apn: string,
  rakipSatis: RakipSatisLike | null,
  mohave: MohaveOffmarketLike | null,
  ilan?: { apn?: string | null; [k: string]: unknown } | null,
): OurRecordSummary {
  const sources: string[] = [];
  if (rakipSatis) sources.push("rakip-satislar.json (tapu kaydı)");
  if (mohave) sources.push("mohave-offmarket.json (20K lead havuzu)");
  if (ilan) sources.push("rakip-ilan-fiyat.json (aktif ilan)");

  const ownerName =
    stripParenthetical(rakipSatis?.karsiTaraf) ?? (mohave?.owner ? mohave.owner.trim() : null);

  const lastSalePrice = rakipSatis?.fiyat ?? mohave?.last_sale_price ?? null;
  const lastSaleDate = rakipSatis?.tarih ?? null;
  const acres = mohave?.acres ?? rakipSatis?.acres ?? null;
  const landValue = mohave?.land_value ?? null;
  const deedParcelCount = rakipSatis?.deedParcelCount ?? null;
  const birimFiyatTahmini = rakipSatis?.birimFiyatTahmini ?? null;

  return {
    apn,
    found: sources.length > 0,
    ownerName,
    lastSalePrice,
    lastSaleDate,
    acres,
    landValue,
    sources,
    deedParcelCount,
    birimFiyatTahmini,
  };
}

// ── County ile karşılaştırma ─────────────────────────────────────────────────

export type MatchStatus = "match" | "mismatch" | "unknown";

export interface ComparisonRow {
  label: string;
  ours: string | null;
  county: string | null;
  status: MatchStatus;
}

function normOwner(s: string | null | undefined): string | null {
  if (!s) return null;
  return s
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function normDate(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v).replace(/\//g, "-"));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function numClose(a: number, b: number, relTol: number): boolean {
  if (a === b) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= relTol;
}

export interface CountyProps {
  owner?: string | number | null;
  salep?: string | number | null;
  saledt?: string | number | null;
  parcelSize?: string | number | null;
  landValue?: string | number | null;
}

/** Bizim özet kayıt ile county'den gelen alanları karşılaştırır: ✓ eşleşen, ⚠ farklı, — bilinmiyor. */
export function compareWithCounty(ours: OurRecordSummary, county: CountyProps): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  // Sahip adı
  {
    const o = normOwner(ours.ownerName);
    const c = normOwner(county.owner != null ? String(county.owner) : null);
    let status: MatchStatus = "unknown";
    if (o && c) status = o === c || o.includes(c) || c.includes(o) ? "match" : "mismatch";
    rows.push({ label: "Sahip adı", ours: ours.ownerName, county: county.owner != null ? String(county.owner) : null, status });
  }

  // Son satış fiyatı (±5% tolerans — assessor kaydı gecikebilir)
  {
    const o = ours.lastSalePrice;
    const c = county.salep != null ? Number(county.salep) : null;
    let status: MatchStatus = "unknown";
    if (o != null && c != null && Number.isFinite(o) && Number.isFinite(c) && c > 0) {
      status = numClose(o, c, 0.05) ? "match" : "mismatch";
    }
    rows.push({
      label: "Son satış fiyatı",
      ours: o != null ? `$${Math.round(o).toLocaleString("en-US")}` : null,
      county: c != null && c > 0 ? `$${Math.round(c).toLocaleString("en-US")}` : null,
      status,
    });
  }

  // Son satış tarihi
  {
    const o = normDate(ours.lastSaleDate);
    const c = normDate(county.saledt ?? null);
    let status: MatchStatus = "unknown";
    if (o && c) status = o === c ? "match" : "mismatch";
    rows.push({ label: "Son satış tarihi", ours: ours.lastSaleDate, county: county.saledt != null ? String(county.saledt) : null, status });
  }

  // Dönüm (acre)
  {
    const o = ours.acres;
    const c = county.parcelSize != null ? Number(county.parcelSize) : null;
    let status: MatchStatus = "unknown";
    if (o != null && c != null && Number.isFinite(o) && Number.isFinite(c)) {
      status = numClose(o, c, 0.1) ? "match" : "mismatch";
    }
    rows.push({ label: "Dönüm (acre)", ours: o != null ? String(o) : null, county: c != null ? String(c) : null, status });
  }

  // Arazi değeri
  {
    const o = ours.landValue;
    const c = county.landValue != null ? Number(county.landValue) : null;
    let status: MatchStatus = "unknown";
    if (o != null && c != null && Number.isFinite(o) && Number.isFinite(c)) {
      status = numClose(o, c, 0.1) ? "match" : "mismatch";
    }
    rows.push({
      label: "Arazi değeri",
      ours: o != null ? `$${Math.round(o).toLocaleString("en-US")}` : null,
      county: c != null ? `$${Math.round(c).toLocaleString("en-US")}` : null,
      status,
    });
  }

  return rows;
}

// ── TRS bölge özeti arama ────────────────────────────────────────────────────

export interface TrsOzetKaydi {
  trs: string;
  total: number;
  vacant: number;
  absentee: number;
  absenteePct: number;
  medianAcres: number | null;
  medianLandValue: number | null;
  topOwners: { owner: string; count: number }[];
  recentSales: {
    apn: string;
    owner: string;
    salep: number;
    saledt: string;
    /** PAKET TAPU — bkz. lib/paket-tapu.ts. Eski (backfill öncesi) veride olmayabilir. */
    deedParcelCount?: number;
    birimFiyatTahmini?: number | null;
  }[];
  leadPoolCount: number;
}

export interface TrsOzetData {
  generatedAt: string;
  source: string;
  trsCount: number;
  trs: Record<string, TrsOzetKaydi>;
}

/** Girilen TRS'i normalize edip önceden hesaplanmış özet tablosunda arar. */
export function findTrsOzet(data: TrsOzetData | null | undefined, rawTrs: string): TrsOzetKaydi | null {
  if (!data || !data.trs) return null;
  const key = normalizeTrs(rawTrs);
  return data.trs[key] ?? null;
}
