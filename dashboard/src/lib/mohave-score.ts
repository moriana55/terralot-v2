// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE OFF-MARKET SKORLAMA — "En İyi 750" reçetesi için 0-100 offmarket_score.
//
// Cerberus felsefesinden (scraper/scoring.js) ilhamla ama BİREBİR KOPYA DEĞİL:
// Cerberus bid/value (açık artırma teklifi vs county değeri) karşılaştırır; burada
// açık artırma yok — absentee sahipten posta ile teklif hedefliyoruz. Bileşenler:
//
//   1) Marj potansiyeli   (0-40) — LANDVALUE/acre, AYNI bölgenin medyanına göre
//      ne kadar ucuz. Medyan veri setinden hesaplanır (hard-code YOK).
//   2) Boyut tatlı noktası (0-25) — 1.0-2.5 acre tam puan (bireysel alıcının
//      "tek ev/tek kabin" hayaline uygun boy); 0.8-1.0 ve 2.5-5.0 kademeli iner.
//   3) Bölge talebi       (0-20) — sabit tablo: Meadview (Lake Mead turizmi,
//      en yoğun rakip yatırımcı ilgisi) > Dolan Springs/Meadview karışığı >
//      Yucca/Kingman (büyüme koridoru ama rekreasyon çekimi az) > kırsal/diğer.
//   4) Sahip motivasyonu  (0-15) — eyalet-dışı mesafe kademesi (AZ içi=0,
//      komşu eyalet=4, uzak eyalet=8, doğu yakası=12 — hiç görmediği araziyi
//      elden çıkarma isteği mesafeyle artar) + aynı sahibin birden çok parseli
//      varsa +3 bonus (portföy sahibi = daha kolay pazarlık/toplu teklif).
//
// Eksik alan → o bileşen 0 puan alır, toplam skor yine hesaplanır (NaN sızmaz).
// Saf + bağımlılıksız: node --test ile JSON/Supabase çekmeden doğrulanır.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreRow {
  apn?: string | null;
  acres?: number | null;
  land_value?: number | null;
  region?: string | null;
  mailing_state?: string | null;
  owner?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_zip?: string | null;
}

export interface ScoreBreakdown {
  margin: number;     // 0-40
  size: number;       // 0-25
  demand: number;     // 0-20
  motivation: number; // 0-15
  total: number;      // 0-100, yuvarlanmış
}

// Bileşen tavanları — testte ve raporlarda toplamın 100'ü geçmediğini doğrulamak için dışa açık.
export const SCORE_WEIGHTS = { MARGIN_MAX: 40, SIZE_MAX: 25, DEMAND_MAX: 20, MOTIVATION_MAX: 15 } as const;

const clean = (s: unknown): string => String(s ?? "").trim();
const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ─── 1) Marj potansiyeli (0-40) ──────────────────────────────────────────────

/** Bölge → medyan $/acre. Yalnız acres>0 VE land_value sayısal olan satırlardan hesaplanır. */
export function computeRegionMedians(rows: ScoreRow[]): Record<string, number> {
  const byRegion = new Map<string, number[]>();
  for (const r of rows) {
    const acres = toNum(r.acres);
    const lv = toNum(r.land_value);
    const region = clean(r.region);
    if (!region || acres == null || acres <= 0 || lv == null || lv < 0) continue;
    const arr = byRegion.get(region) ?? [];
    arr.push(lv / acres);
    byRegion.set(region, arr);
  }
  const out: Record<string, number> = {};
  for (const [region, arr] of byRegion) out[region] = median(arr);
  return out;
}

function marginScore(row: ScoreRow, regionMedian: number | undefined): number {
  const acres = toNum(row.acres);
  const lv = toNum(row.land_value);
  if (acres == null || acres <= 0 || lv == null || lv < 0) return 0; // eksik/geçersiz alan
  if (!regionMedian || regionMedian <= 0) return 0; // bölge medyanı yoksa kıyas mümkün değil
  const pricePerAcre = lv / acres;
  if (pricePerAcre <= 0) return SCORE_WEIGHTS.MARGIN_MAX; // pratikte bedelsiz — tam puan
  const discount = (regionMedian - pricePerAcre) / regionMedian;
  const clamped = Math.max(0, Math.min(1, discount));
  return Math.round(clamped * SCORE_WEIGHTS.MARGIN_MAX);
}

// ─── 2) Boyut tatlı noktası (0-25) ───────────────────────────────────────────

function sizeScore(acresRaw: number | null): number {
  const a = acresRaw;
  if (a == null || !Number.isFinite(a) || a <= 0) return 0;
  const MAX = SCORE_WEIGHTS.SIZE_MAX;
  if (a < 0.8) return 0;
  if (a < 1.0) return Math.round(((a - 0.8) / 0.2) * MAX);
  if (a <= 2.5) return MAX;
  if (a <= 5.0) return Math.round(((5.0 - a) / 2.5) * MAX);
  return 0;
}

// ─── 3) Bölge talebi (0-20) — sabit tablo ────────────────────────────────────
// Gerekçe: Meadview / Lake Mead rekreasyon bölgesine en yakın etiket → en yoğun
// yatırımcı/turist talebi. "Dolan Springs / Meadview" karışık etiket Meadview
// payı taşır ama saf değil. Yucca/Kingman büyüme koridorunda ama göl çekimi yok.
// Golden Valley/Kingman ve kırsal/diğer etiketler daha soğuk, düşük rekabetli alan.
const REGION_DEMAND: Record<string, number> = {
  "Meadview / Lake Mead": 20,
  "Dolan Springs / Meadview": 16,
  "Yucca / Kingman G.": 12,
  "Golden Valley / Kingman": 10,
  "Mohave (kırsal)": 6,
  "Mohave (diğer)": 4,
};
// Tabloda olmayan (yeni/tanınmayan) bir bölge etiketi görülürse nötr-düşük varsay.
const DEFAULT_REGION_DEMAND = 6;

function demandScore(region: string | null | undefined): number {
  const key = clean(region);
  if (!key) return 0; // bölge bilgisi hiç yoksa bileşen sıfır
  return REGION_DEMAND[key] ?? DEFAULT_REGION_DEMAND;
}

// ─── 4) Sahip motivasyonu (0-15) ─────────────────────────────────────────────
// Komşu eyalet: AZ'ye bitişik/çok yakın — hâlâ "yakın", orta motivasyon.
const NEIGHBOR_STATES = new Set(["NV", "CA", "UT", "CO", "NM"]);
// Doğu yakası: araziyi büyük ihtimalle hiç görmemiş sahip — en yüksek motivasyon.
const EAST_COAST_STATES = new Set([
  "NY", "NJ", "CT", "MA", "PA", "MD", "VA", "FL", "GA", "NC", "SC", "RI", "NH", "VT", "ME", "DE", "DC",
]);

function distanceTier(state: string | null | undefined): number {
  const s = clean(state).toUpperCase();
  if (!s) return 0; // eksik alan → katkı yok
  if (s === "AZ") return 0; // eyalet-içi sahip: yerinde, satma motivasyonu düşük
  if (NEIGHBOR_STATES.has(s)) return 4;
  if (EAST_COAST_STATES.has(s)) return 12;
  return 8; // diğer uzak eyaletler
}

/** Sahip+posta-adresi anahtarı (mohave-campaign.ts'teki dedupe anahtarıyla aynı felsefe). */
function ownerGroupKey(row: ScoreRow): string {
  return [row.owner, row.mailing_address, row.mailing_city, row.mailing_state, row.mailing_zip]
    .map((s) => clean(s).toUpperCase().replace(/\s+/g, " "))
    .join("|");
}

/** Aynı sahip+adresin veri setinde kaç parseli var — portföy bonusu için. */
export function computeOwnerParcelCounts(rows: ScoreRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const key = ownerGroupKey(r);
    if (!key.replace(/\|/g, "").trim()) continue; // tamamen boş satırı sayma
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

function motivationScore(state: string | null | undefined, ownerParcelCount: number): number {
  const base = distanceTier(state);
  const bonus = ownerParcelCount > 1 ? 3 : 0;
  return Math.min(SCORE_WEIGHTS.MOTIVATION_MAX, base + bonus);
}

// ─── Toplam skor ──────────────────────────────────────────────────────────────

export function scoreRowBreakdown(
  row: ScoreRow,
  regionMedians: Record<string, number>,
  ownerParcelCounts: Map<string, number>
): ScoreBreakdown {
  const margin = marginScore(row, regionMedians[clean(row.region)]);
  const size = sizeScore(toNum(row.acres));
  const demand = demandScore(row.region);
  const parcelCount = ownerParcelCounts.get(ownerGroupKey(row)) ?? 1;
  const motivation = motivationScore(row.mailing_state, parcelCount);
  const rawTotal = margin + size + demand + motivation;
  // Kalkan: yukarıdaki fonksiyonlar zaten sonlu sayı döner, ama son bir güvence —
  // NaN/Infinity hiçbir koşulda dışarı sızmasın, 0-100 aralığına sıkıştırılsın.
  const total = Number.isFinite(rawTotal) ? Math.max(0, Math.min(100, Math.round(rawTotal))) : 0;
  return { margin, size, demand, motivation, total };
}

export function scoreRow(
  row: ScoreRow,
  regionMedians: Record<string, number>,
  ownerParcelCounts: Map<string, number>
): number {
  return scoreRowBreakdown(row, regionMedians, ownerParcelCounts).total;
}

/** Toplu skorlama: medyan + sahip-parsel haritasını bir kez hesaplayıp her satıra offmarket_score ekler. */
export function scoreAllRows<T extends ScoreRow>(rows: T[]): (T & { offmarket_score: number })[] {
  const regionMedians = computeRegionMedians(rows);
  const ownerParcelCounts = computeOwnerParcelCounts(rows);
  return rows.map((r) => ({ ...r, offmarket_score: scoreRow(r, regionMedians, ownerParcelCounts) }));
}

/**
 * Tüm satırları offmarket_score'a göre AZALAN sıralar (eşitlikte APN'e göre —
 * deterministik). "En İyi 750" reçetesi (mohave-campaign.ts) VE harita katmanının
 * top-750 üyelik seti (mohave-map-points API'si) bu TEK sıralamayı paylaşır —
 * iki yerde ayrı sort mantığı tekrar etmesin.
 */
export function rankByOffmarketScore<T extends ScoreRow>(rows: T[]): (T & { offmarket_score: number })[] {
  const scored = scoreAllRows(rows);
  return [...scored].sort(
    (a, b) => b.offmarket_score - a.offmarket_score || clean(a.apn).localeCompare(clean(b.apn))
  );
}
