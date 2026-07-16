// ─────────────────────────────────────────────────────────────────────────────
// PAKET TAPU (bulk/package deed) — saf hesaplama + biçimlendirme yardımcıları.
//
// SORUN: Mohave County assessor verisinde, aynı RECPTNO (tapu kayıt no) birden
// fazla parseli kapsayan bir "paket/bulk deed" ise, county o RECPTNO'nun
// TOPLAM satış fiyatını (SALEP) HER parselin satırına AYNI şekilde yazıyor.
// Doğrulanmış örnek: APN 308-22-040 (SIMPLE FOODS LLC), RECPTNO 2020059875,
// SALEP $35.000 — ama aynı RECPTNO'ya bağlı 6 parsel var (~18 acre toplam),
// yani gerçek parsel-başı fiyat ~$5.833, $35.000 DEĞİL.
//
// Bu dosya SADECE saf fonksiyon — network/DOM/fs YOK, node --test ile
// doğrulanır. Üretici scriptler (scraper/lib/deed-utils.mjs — CommonJS/ESM
// tarafı) AYNI mantığı paylaşır; burası dashboard/UI tarafı için TS aynası.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir RECPTNO'ya bağlı parsel sayısı. Boş/null RECPTNO -> 1 (tekil kayıt
 * kabul edilir — bunu "paket" gibi yorumlamak yanlış olur).
 */
export function deedParcelCount(recptno: string | null | undefined, counts: ReadonlyMap<string, number>): number {
  const r = (recptno ?? "").toString().trim();
  if (!r) return 1;
  const n = counts.get(r);
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Parsel başına tahmini birim fiyat = salep / deedParcelCount.
 * Geçersiz/sıfır/negatif salep -> null (uydurma yok).
 */
export function estimateUnitPrice(
  salep: number | string | null | undefined,
  count: number | null | undefined,
): number | null {
  const s = typeof salep === "number" ? salep : Number(salep);
  if (!Number.isFinite(s) || s <= 0) return null;
  const c = typeof count === "number" && Number.isFinite(count) && count > 0 ? count : 1;
  return Math.round((s / c) * 100) / 100;
}

/** deedParcelCount > 1 ise kayıt bir paket/toplu tapunun parçasıdır. */
export function isPaketTapu(deedParcelCountValue: number | null | undefined): boolean {
  return typeof deedParcelCountValue === "number" && deedParcelCountValue > 1;
}

/** $ tam sayı biçimlendirme (en-US, örn. 35000 -> "$35,000"). */
export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Paket tapu (toplu alım) için popup/etiket açıklaması. Toplam fiyatı GİZLEMEZ
 * ama tek parselin fiyatıymış gibi de SUNMAZ — hem toplam hem parsel-başı
 * tahmin gösterilir.
 *
 * Örnek çıktı: "Alım: $35,000 · 2020/10/15 — 6 parsellik paket tapusu
 * (parsel başına ~$5,833)"
 */
export function formatPaketAlimAciklama(
  salep: number,
  tarih: string | null | undefined,
  deedParcelCountValue: number,
  birimFiyat: number,
): string {
  const tarihStr = tarih ? ` · ${tarih}` : "";
  return `Alım: ${formatUsd(salep)}${tarihStr} — ${deedParcelCountValue} parsellik paket tapusu (parsel başına ~${formatUsd(birimFiyat)})`;
}

/**
 * Bir kaydın fiyat gösterimi için "etkin" fiyatı seçer — istatistik (medyan/
 * ortalama) hesaplarında paket kayıtlarda SALEP yerine birim fiyat tahmini
 * kullanılır; tekil kayıtlarda SALEP'in kendisi değişmeden kullanılır.
 */
export function effectivePriceForStats(
  salep: number | null | undefined,
  deedParcelCountValue: number | null | undefined,
  birimFiyatTahmini: number | null | undefined,
): number | null {
  if (isPaketTapu(deedParcelCountValue)) {
    return typeof birimFiyatTahmini === "number" && Number.isFinite(birimFiyatTahmini) ? birimFiyatTahmini : null;
  }
  return typeof salep === "number" && Number.isFinite(salep) ? salep : null;
}
