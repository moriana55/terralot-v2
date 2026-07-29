// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET SKORLAMA — 0-100 `offmarket_score`, COUNTY'DEN BAĞIMSIZ.
//
// Bu motor önce yalnız Mohave (AZ) için yazılmıştı (`mohave-score.ts`). Sahibin
// "tek olacak her şey" direktifiyle GENELLEŞTİRİLDİ: aynı skor artık 15 eyaletin
// 206 county'sinde çalışır. Mohave'ye özel olan TEK şey bölge-talep katsayıları
// idi; onlar silinmedi, county bazlı ayar tablosuna (`COUNTY_BOLGE_TALEBI`)
// taşındı. `mohave-score.ts` artık bu dosyanın Mohave bağlamına bağlanmış ince
// bir sarmalayıcısıdır — eski çağrı yerleri ve testleri aynen çalışır.
//
// Bileşenler (toplam 100):
//   1) Marj potansiyeli   (0-40) — LANDVALUE/acre, AYNI bölgenin medyanına göre
//      ne kadar ucuz. Medyan veri setinden hesaplanır (hard-code YOK).
//   2) Boyut tatlı noktası (0-25) — 1.0-2.5 acre tam puan (bireysel alıcının
//      "tek ev/tek kabin" hayaline uygun boy); 0.8-1.0 ve 2.5-5.0 kademeli iner.
//   3) Bölge talebi       (0-20) — county'ye özel ayar tablosu. Tablosu olmayan
//      county'de her bölge nötr-düşük varsayılır (uydurma katsayı YOK).
//   4) Sahip motivasyonu  (0-15) — sahibin posta adresi parselin eyaletine göre
//      ne kadar uzak (eyalet-içi=0, komşu eyalet=4, uzak=8, doğu yakası=12) +
//      aynı sahibin birden çok parseli varsa +3 (portföy sahibi = toplu pazarlık).
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
  /** Parselin eyaleti — sahip motivasyonunda "eyalet-içi mi" kararını verir. */
  state?: string | null;
  /** Parselin county'si — bölge talep tablosunu seçer. */
  county?: string | null;
}

export interface ScoreBreakdown {
  margin: number;     // 0-40
  size: number;       // 0-25
  demand: number;     // 0-20
  motivation: number; // 0-15
  total: number;      // 0-100, yuvarlanmış
}

/**
 * Skor bağlamı: satırda `state`/`county` yoksa (ör. Mohave snapshot'ında bu
 * alanlar hiç yok) çağıran taraf bağlamı dışarıdan verir.
 */
export interface SkorBaglam {
  state?: string | null;
  county?: string | null;
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

/** "AZ|MOHAVE" biçiminde county anahtarı (bölge talep tablosunu seçmek için). */
export function countyKey(state: string | null | undefined, county: string | null | undefined): string {
  return `${clean(state).toUpperCase()}|${clean(county).toUpperCase().replace(/ COUNTY$/i, "").trim()}`;
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

// ─── 3) Bölge talebi (0-20) — COUNTY BAZLI AYAR ──────────────────────────────
//
// Mohave için gerekçe (motorun ilk yazıldığı yer): Meadview / Lake Mead
// rekreasyon bölgesine en yakın etiket → en yoğun yatırımcı/turist talebi.
// "Dolan Springs / Meadview" karışık etiket Meadview payı taşır ama saf değil.
// Yucca/Kingman büyüme koridorunda ama göl çekimi yok. Golden Valley/Kingman ve
// kırsal/diğer etiketler daha soğuk, düşük rekabetli alan.
//
// BAŞKA COUNTY EKLERKEN: katsayıyı ancak SAHA GEREKÇESİ varsa yaz. Tablosu
// olmayan county nötr-düşük (DEFAULT) alır — bu, uydurma katsayıdan iyidir.
export const COUNTY_BOLGE_TALEBI: Record<string, Record<string, number>> = {
  "AZ|MOHAVE": {
    "Meadview / Lake Mead": 20,
    "Dolan Springs / Meadview": 16,
    "Yucca / Kingman G.": 12,
    "Golden Valley / Kingman": 10,
    "Mohave (kırsal)": 6,
    "Mohave (diğer)": 4,
  },
};

/** Tabloda olmayan (yeni/tanınmayan) bölge etiketi → nötr-düşük varsayılır. */
export const DEFAULT_REGION_DEMAND = 6;

function demandScore(region: string | null | undefined, cKey: string): number {
  const key = clean(region);
  if (!key) return 0; // bölge bilgisi hiç yoksa bileşen sıfır
  const tablo = COUNTY_BOLGE_TALEBI[cKey];
  return tablo?.[key] ?? DEFAULT_REGION_DEMAND;
}

// ─── 4) Sahip motivasyonu (0-15) ─────────────────────────────────────────────
// Doğu yakası: araziyi büyük ihtimalle hiç görmemiş sahip — en yüksek motivasyon.
const EAST_COAST_STATES = new Set([
  "NY", "NJ", "CT", "MA", "PA", "MD", "VA", "FL", "GA", "NC", "SC", "RI", "NH", "VT", "ME", "DE", "DC",
]);

// ABD eyalet komşulukları (coğrafi sabit) — "komşu eyalet sahibi hâlâ yakın
// sayılır, motivasyonu orta" kademesi için. Yalnız hedef eyaletlerimiz + çevresi.
const KOMSU_EYALETLER: Record<string, string[]> = {
  AZ: ["NV", "CA", "UT", "CO", "NM"],
  NM: ["AZ", "CO", "OK", "TX", "UT"],
  CO: ["WY", "NE", "KS", "OK", "NM", "AZ", "UT"],
  TX: ["NM", "OK", "AR", "LA"],
  FL: ["GA", "AL"],
  AR: ["MO", "TN", "MS", "LA", "TX", "OK"],
  NC: ["VA", "TN", "GA", "SC"],
  TN: ["KY", "VA", "NC", "GA", "AL", "MS", "AR", "MO"],
  GA: ["NC", "SC", "FL", "AL", "TN"],
  OK: ["KS", "MO", "AR", "TX", "NM", "CO"],
  NV: ["OR", "ID", "UT", "AZ", "CA"],
  OR: ["WA", "ID", "NV", "CA"],
  MO: ["IA", "IL", "KY", "TN", "AR", "OK", "KS", "NE"],
  MI: ["OH", "IN", "WI"],
  SC: ["NC", "GA"],
};

function distanceTier(ownerState: string | null | undefined, parcelState: string | null | undefined): number {
  const s = clean(ownerState).toUpperCase();
  if (!s) return 0; // eksik alan → katkı yok
  const p = clean(parcelState).toUpperCase();
  if (p && s === p) return 0; // eyalet-içi sahip: yerinde, satma motivasyonu düşük
  if (p && KOMSU_EYALETLER[p]?.includes(s)) return 4;
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

function motivationScore(
  ownerState: string | null | undefined,
  parcelState: string | null | undefined,
  ownerParcelCount: number
): number {
  const base = distanceTier(ownerState, parcelState);
  const bonus = ownerParcelCount > 1 ? 3 : 0;
  return Math.min(SCORE_WEIGHTS.MOTIVATION_MAX, base + bonus);
}

// ─── Toplam skor ──────────────────────────────────────────────────────────────

export function scoreRowBreakdown(
  row: ScoreRow,
  regionMedians: Record<string, number>,
  ownerParcelCounts: Map<string, number>,
  baglam?: SkorBaglam
): ScoreBreakdown {
  const state = baglam?.state ?? row.state ?? null;
  const county = baglam?.county ?? row.county ?? null;
  const margin = marginScore(row, regionMedians[clean(row.region)]);
  const size = sizeScore(toNum(row.acres));
  const demand = demandScore(row.region, countyKey(state, county));
  const parcelCount = ownerParcelCounts.get(ownerGroupKey(row)) ?? 1;
  const motivation = motivationScore(row.mailing_state, state, parcelCount);
  const rawTotal = margin + size + demand + motivation;
  // Kalkan: yukarıdaki fonksiyonlar zaten sonlu sayı döner, ama son bir güvence —
  // NaN/Infinity hiçbir koşulda dışarı sızmasın, 0-100 aralığına sıkıştırılsın.
  const total = Number.isFinite(rawTotal) ? Math.max(0, Math.min(100, Math.round(rawTotal))) : 0;
  return { margin, size, demand, motivation, total };
}

export function scoreRow(
  row: ScoreRow,
  regionMedians: Record<string, number>,
  ownerParcelCounts: Map<string, number>,
  baglam?: SkorBaglam
): number {
  return scoreRowBreakdown(row, regionMedians, ownerParcelCounts, baglam).total;
}

/** Toplu skorlama: medyan + sahip-parsel haritasını bir kez hesaplayıp her satıra offmarket_score ekler. */
export function scoreAllRows<T extends ScoreRow>(
  rows: T[],
  baglam?: SkorBaglam
): (T & { offmarket_score: number })[] {
  const regionMedians = computeRegionMedians(rows);
  const ownerParcelCounts = computeOwnerParcelCounts(rows);
  return rows.map((r) => ({ ...r, offmarket_score: scoreRow(r, regionMedians, ownerParcelCounts, baglam) }));
}

/** Toplu skorlama + kırılım (hangi bileşenden kaç puan geldiği ekranda gösterilsin diye). */
export function scoreAllRowsBreakdown<T extends ScoreRow>(
  rows: T[],
  baglam?: SkorBaglam
): (T & { offmarket_score: number; skor_kirilim: ScoreBreakdown })[] {
  const regionMedians = computeRegionMedians(rows);
  const ownerParcelCounts = computeOwnerParcelCounts(rows);
  return rows.map((r) => {
    const k = scoreRowBreakdown(r, regionMedians, ownerParcelCounts, baglam);
    return { ...r, offmarket_score: k.total, skor_kirilim: k };
  });
}

/**
 * Tüm satırları offmarket_score'a göre AZALAN sıralar (eşitlikte APN'e göre —
 * deterministik). "En İyi 750" reçetesi (mohave-campaign.ts) VE harita katmanının
 * top-750 üyelik seti (mohave-map-points API'si) bu TEK sıralamayı paylaşır —
 * iki yerde ayrı sort mantığı tekrar etmesin.
 */
export function rankByOffmarketScore<T extends ScoreRow>(
  rows: T[],
  baglam?: SkorBaglam
): (T & { offmarket_score: number })[] {
  const scored = scoreAllRows(rows, baglam);
  return [...scored].sort(
    (a, b) => b.offmarket_score - a.offmarket_score || clean(a.apn).localeCompare(clean(b.apn))
  );
}
