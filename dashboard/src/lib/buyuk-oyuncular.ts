// ─────────────────────────────────────────────────────────────────────────────
// 🐋 BÜYÜK OYUNCULAR — saf veri dönüşümü (kompakt JSON → harita noktaları).
//
// Kaynak: src/data/buyuk-oyuncular.json (scraper/buyuk-oyuncular-uret.mjs
// tarafından Mohave county parsel CSV'sinden owner/adres eşleştirmeyle üretilir).
// Kompakt satır formatı: [oyuncuIdx, apn, lat, lng, acres, landValue, salep, saledt]
// — 5K+ nokta için alan adları tekrarlanmaz (boyut ~%60 küçülür).
//
// Bu dosya SADECE saf fonksiyon — network/DOM YOK, node --test ile doğrulanır.
// ─────────────────────────────────────────────────────────────────────────────

export type OyuncuTip = "gizli_ag" | "yatirimci" | "gelistirici";

export interface BuyukOyuncu {
  id: string;
  ad: string;
  kisaAd: string;
  tip: OyuncuTip;
  parselSayisi: number;
  not: string;
}

export type BuyukOyuncuRow = [
  oyuncuIdx: number, apn: string, lat: number, lng: number,
  acres: number | null, landValue: number | null, salep: number | null, saledt: string | null,
];

export interface BuyukOyuncularData {
  generatedAt: string;
  source: string;
  oyuncular: BuyukOyuncu[];
  rows: BuyukOyuncuRow[];
}

export interface BuyukOyuncuPoint {
  oyuncuIdx: number;
  apn: string;
  lat: number;
  lng: number;
  acres: number | null;
  landValue: number | null;
  salep: number | null;
  saledt: string | null;
}

// 8 renklik sabit palet — mevcut katmanlarla (grade yeşil/mavi/gri, rakip-ilan
// kırmızı, rakip-satış mor/lila) çakışmayacak tonlar. Gizli ağ = dikkat çekici
// turkuaz/camgöbeği (koordinatör talebi).
export const OYUNCU_PALET: string[] = [
  "#06b6d4", // 0 gizli ağ — turkuaz/camgöbeği
  "#d946ef", // 1 fuşya
  "#f97316", // 2 turuncu
  "#84cc16", // 3 limon yeşili
  "#a16207", // 4 koyu amber
  "#ec4899", // 5 pembe
  "#1e40af", // 6 koyu mavi
  "#64748b", // 7 kurşun gri
];

export const oyuncuRenk = (idx: number): string => OYUNCU_PALET[idx % OYUNCU_PALET.length];

/** Kompakt satırları harita noktalarına açar; bozuk/koordinatsız satırları eler. */
export function expandBuyukOyuncuRows(data: BuyukOyuncularData | null | undefined): BuyukOyuncuPoint[] {
  if (!data || !Array.isArray(data.rows) || !Array.isArray(data.oyuncular)) return [];
  const n = data.oyuncular.length;
  const out: BuyukOyuncuPoint[] = [];
  for (const r of data.rows) {
    if (!Array.isArray(r) || r.length < 4) continue;
    const [oyuncuIdx, apn, lat, lng, acres, landValue, salep, saledt] = r;
    if (typeof oyuncuIdx !== "number" || oyuncuIdx < 0 || oyuncuIdx >= n) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      oyuncuIdx, apn: String(apn ?? ""), lat, lng,
      acres: acres ?? null, landValue: landValue ?? null,
      salep: salep ?? null, saledt: saledt ?? null,
    });
  }
  return out;
}

/** Seçili oyuncu index'lerine göre nokta filtresi (legend checkbox'ları). */
export function filterBuyukOyuncuPoints(points: BuyukOyuncuPoint[], seciliIdx: ReadonlySet<number>): BuyukOyuncuPoint[] {
  return points.filter((p) => seciliIdx.has(p.oyuncuIdx));
}

/**
 * Varsayılan seçim: geliştiriciler HARİÇ herkes açık (koordinatör: Aileron/
 * geliştirici tipi flip rakibi değil — dahil ama varsayılan kapalı).
 */
export function defaultSecim(oyuncular: BuyukOyuncu[]): Set<number> {
  const s = new Set<number>();
  oyuncular.forEach((o, i) => { if (o.tip !== "gelistirici") s.add(i); });
  return s;
}
