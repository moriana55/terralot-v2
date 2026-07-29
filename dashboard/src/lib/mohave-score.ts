// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE SKORLAMA — ARTIK İNCE BİR SARMALAYICI.
//
// Skor motorunun kendisi `offmarket-score.ts`e taşındı ve COUNTY'DEN BAĞIMSIZ
// hale getirildi (sahibin "tek olacak her şey" direktifi, ADIM 1). Mohave'ye özel
// olan TEK şey bölge-talep katsayılarıydı; onlar SİLİNMEDİ — genel motordaki
// `COUNTY_BOLGE_TALEBI["AZ|MOHAVE"]` tablosunda duruyor.
//
// Bu dosya, genel motoru Mohave bağlamına (state=AZ, county=Mohave) bağlar.
// Mohave snapshot'ındaki satırlarda `state`/`county` alanı YOKTUR; bağlam bu
// yüzden dışarıdan verilir. Böylece eski çağrı yerleri (mohave sayfası, sunum,
// mohave-campaign, mohave-map-points) ve `mohave-score.test.ts` AYNEN çalışır.
//
// Yeni kod doğrudan `@/lib/offmarket-score` kullanmalıdır.
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeOwnerParcelCounts,
  computeRegionMedians,
  scoreRowBreakdown as genelScoreRowBreakdown,
  type ScoreBreakdown,
  type ScoreRow,
  type SkorBaglam,
} from "./offmarket-score";

export { SCORE_WEIGHTS, computeOwnerParcelCounts, computeRegionMedians } from "./offmarket-score";
export type { ScoreBreakdown, ScoreRow } from "./offmarket-score";

/** Mohave bağlamı — bölge talep tablosunu ve "eyalet-içi sahip" kararını seçer. */
export const MOHAVE_BAGLAM: SkorBaglam = { state: "AZ", county: "Mohave" };

export function scoreRowBreakdown(
  row: ScoreRow,
  regionMedians: Record<string, number>,
  ownerParcelCounts: Map<string, number>
): ScoreBreakdown {
  return genelScoreRowBreakdown(row, regionMedians, ownerParcelCounts, MOHAVE_BAGLAM);
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
 * top-750 üyelik seti (mohave-map-points API'si) bu TEK sıralamayı paylaşır.
 */
export function rankByOffmarketScore<T extends ScoreRow>(rows: T[]): (T & { offmarket_score: number })[] {
  const scored = scoreAllRows(rows);
  return [...scored].sort(
    (a, b) =>
      b.offmarket_score - a.offmarket_score ||
      String(a.apn ?? "").trim().localeCompare(String(b.apn ?? "").trim())
  );
}
