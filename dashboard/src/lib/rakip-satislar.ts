// ─────────────────────────────────────────────────────────────────────────────
// RAKİP SATIŞLARI KATMANI — saf veri dönüşümü (JSON → harita noktaları + özet).
//
// Kaynak veri: src/data/rakip-satislar.json (scraper/build-rakip-satislar.js
// tarafından tapu-kanıtlı Discount Lots/WP RE Ventures kayıtlarından üretilir).
// Bu dosya SADECE saf fonksiyon — network/DOM YOK, node --test ile doğrulanır.
//
// Kayıt tipleri (kaynaktaki kayit_tipi):
//   dogrulanmis_satis — tapuda kayıtlı TAMAMLANMIŞ satış (fiyat+tarih+recording no)
//   satis_taksitte     — "Sold - Terms/Servicing Retained" (taksit sürüyor)
//   envanter           — hâlâ rakip envanterinde (satılmamış)
//   belirsiz           — durum netleşmemiş (site+tapu çapraz kontrolü yetersiz)
// ─────────────────────────────────────────────────────────────────────────────

export interface RakipSatisRecord {
  id: string;
  apn: string;
  kayitTipi: "dogrulanmis_satis" | "satis_taksitte" | "envanter" | "belirsiz";
  lat: number;
  lng: number;
  coordSource: "exact" | "group" | null;
  fiyat: number | null;
  tarih: string | null;
  recordingNo: string | null;
  deedType: string | null;
  karsiTaraf: string | null;
  sirketLlc: string | null;
  bolge: string | null;
  acres: number | null;
  legal: string | null;
  siteDurumu: string | null;
}

export interface RakipSatislarData {
  generatedAt: string;
  source: string;
  totalKayit: number;
  haritadaGosterilen: number;
  atlanan: number;
  records: RakipSatisRecord[];
}

// Görsel dil: mevcut "Rakip ilanları" katmanı (aktif ilan) kırmızı elmas kullanıyor —
// KARIŞMASIN diye bu katman mor/lila/gri paletinde. Tamamlanmış satış = koyu mor
// dolu daire (kalıcı fiyat etiketiyle); taksitli = açık lila/mor kontur; stok = soluk
// gri halka (envanter+belirsiz).
export const RAKIP_SATIS_RENK: Record<RakipSatisRecord["kayitTipi"], string> = {
  dogrulanmis_satis: "#4c1d95", // koyu mor — tapu-kanıtlı tamamlanmış satış
  satis_taksitte: "#a78bfa", // açık lila/mor — taksit sürüyor
  envanter: "#9ca3af", // soluk gri — hâlâ stokta
  belirsiz: "#9ca3af", // soluk gri — durum netleşmemiş (stokla aynı görsel dil)
};

export interface RakipSatisPoint extends RakipSatisRecord {
  color: string;
  /** Kalıcı kısa fiyat etiketi (ör. "$30K") — sadece fiyatı olan kayıtlarda. */
  priceLabel: string | null;
}

/** $ → kısaltılmış etiket: 8117 → "$8.1K", 125000 → "$125K", null → null. */
export function formatKisaFiyat(fiyat: number | null | undefined): string | null {
  if (fiyat == null || !Number.isFinite(fiyat) || fiyat <= 0) return null;
  if (fiyat >= 1000) {
    const k = fiyat / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `$${rounded}K`;
  }
  return `$${Math.round(fiyat)}`;
}

/** JSON kayıtlarını harita katmanı noktalarına çevirir (renk + fiyat etiketi eklenir). */
export function buildRakipSatislarLayer(data: RakipSatislarData | null | undefined): RakipSatisPoint[] {
  if (!data || !Array.isArray(data.records)) return [];
  return data.records
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map((r) => ({
      ...r,
      color: RAKIP_SATIS_RENK[r.kayitTipi] ?? "#9ca3af",
      priceLabel: formatKisaFiyat(r.fiyat),
    }));
}

export interface RakipSatislarOzet {
  dogrulanmisSatis: number;
  taksitli: number;
  envanter: number; // envanter + belirsiz birlikte ("stok")
  medyanFiyat: number | null;
  toplam: number;
  rozetMetni: string;
}

/** Medyan (basit, sıralı dizi ortancası). Boşsa null. */
function medyan(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Katman açıldığında köşede gösterilen mini özet rozeti — rakamlar JSON'dan hesaplanır. */
export function computeRakipSatislarOzet(points: RakipSatisPoint[]): RakipSatislarOzet {
  const dogrulanmis = points.filter((p) => p.kayitTipi === "dogrulanmis_satis");
  const taksitli = points.filter((p) => p.kayitTipi === "satis_taksitte");
  const stok = points.filter((p) => p.kayitTipi === "envanter" || p.kayitTipi === "belirsiz");

  const fiyatlar = [...dogrulanmis, ...taksitli]
    .map((p) => p.fiyat)
    .filter((f): f is number => f != null && Number.isFinite(f) && f > 0);
  const med = medyan(fiyatlar);

  const rozetMetni = `${dogrulanmis.length} tapulu satış · ${taksitli.length} taksitli${
    med != null ? ` · medyan ${formatKisaFiyat(med)}` : ""
  }`;

  return {
    dogrulanmisSatis: dogrulanmis.length,
    taksitli: taksitli.length,
    envanter: stok.length,
    medyanFiyat: med,
    toplam: points.length,
    rozetMetni,
  };
}
