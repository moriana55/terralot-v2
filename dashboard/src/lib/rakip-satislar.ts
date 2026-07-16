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
  /**
   * PAKET TAPU (bulk deed) — aynı recordingNo'ya bağlı parsel sayısı (yoksa/
   * tekil kayıtta 1). > 1 ise `fiyat` bu tapunun TOPLAM tutarıdır, tek parselin
   * fiyatı DEĞİL — bkz. lib/paket-tapu.ts. Eski (backfill öncesi) veride
   * alan olmayabilir, bu yüzden optional.
   */
  deedParcelCount?: number;
  /** fiyat / deedParcelCount — paket kayıtlarda parsel-başı tahmini. */
  birimFiyatTahmini?: number | null;
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

// ── KOORDİNAT GRUPLAMA ────────────────────────────────────────────────────────
// Aynı (~5. ondalığa yuvarlanmış) koordinatı paylaşan kayıtlar TEK birleşik
// marker'da toplanır — özellikle blok-merkezi (coordSource="group") kayıtları
// aynı noktaya düşer ve kalıcı fiyat etiketleri üst üste binerdi. Jitter YOK
// (konum yalanı olur); grup rozeti "3 satış · $8K–$30K" formatında.
export interface RakipSatisGroup {
  key: string;
  lat: number;
  lng: number;
  points: RakipSatisPoint[];
  /** Grubun görsel tipi: en "güçlü" kayıt (dogrulanmis > taksit > stok). */
  dominantTip: RakipSatisRecord["kayitTipi"];
  color: string;
  /**
   * Kalıcı rozet metni. Tek tamamlanmış satış → fiyat etiketi ("$8.1K");
   * çoklu grupta SADECE tamamlanmış satış fiyatları aralığa girer
   * ("2 satış · $8K–$30K" — taksitlilerin LLC alım fiyatları karışmaz);
   * satışsız çoklu grup → "N kayıt"; fiyatsız tek kayıt → null.
   */
  label: string | null;
}

const TIP_ONCELIK: Record<RakipSatisRecord["kayitTipi"], number> = {
  dogrulanmis_satis: 3, satis_taksitte: 2, envanter: 1, belirsiz: 0,
};

export function groupRakipSatisPoints(points: RakipSatisPoint[]): RakipSatisGroup[] {
  const groups = new Map<string, RakipSatisPoint[]>();
  for (const p of points) {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const arr = groups.get(key);
    if (arr) arr.push(p); else groups.set(key, [p]);
  }
  return [...groups.entries()].map(([key, pts]) => {
    const dominant = pts.reduce((a, b) => (TIP_ONCELIK[b.kayitTipi] > TIP_ONCELIK[a.kayitTipi] ? b : a));
    const satislar = pts.filter((p) => p.kayitTipi === "dogrulanmis_satis");
    const satisFiyatlar = satislar
      .map((p) => p.fiyat)
      .filter((f): f is number => f != null && Number.isFinite(f) && f > 0);
    let label: string | null;
    if (pts.length === 1) {
      // Tek kayıt: eski davranış — sadece tamamlanmış satışta kalıcı fiyat etiketi.
      label = pts[0].kayitTipi === "dogrulanmis_satis" ? pts[0].priceLabel : null;
    } else if (satisFiyatlar.length > 0) {
      const min = Math.min(...satisFiyatlar);
      const max = Math.max(...satisFiyatlar);
      const aralik = min === max ? formatKisaFiyat(min) : `${formatKisaFiyat(min)}–${formatKisaFiyat(max)}`;
      label = `${satislar.length} satış · ${aralik}`;
    } else {
      label = `${pts.length} kayıt`;
    }
    return {
      key,
      lat: pts[0].lat,
      lng: pts[0].lng,
      points: pts,
      dominantTip: dominant.kayitTipi,
      color: dominant.color,
      label,
    };
  });
}

export interface RakipSatislarOzet {
  dogrulanmisSatis: number;
  taksitli: number;
  envanter: number; // envanter + belirsiz birlikte ("stok")
  /** SADECE tamamlanmış (tapu-kanıtlı) satış fiyatlarının medyanı. */
  medyanFiyat: number | null;
  /** Rakibin KENDİ alım kayıtlarının (taksitli+envanter SALEP) ortalaması — maliyet tabanı. */
  ortalamaAlisFiyat: number | null;
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

const gecerliFiyat = (f: number | null): f is number => f != null && Number.isFinite(f) && f > 0;

/**
 * PAKET TAPU (bulk deed) düzeltmesi: bir kaydın istatistiklerde (medyan/
 * ortalama) kullanılacak "etkin" fiyatı. deedParcelCount > 1 ise county'nin
 * SALEP'i (fiyat) toplu tapu tutarıdır — istatistiğe TOPLAM değil,
 * birimFiyatTahmini (=fiyat/deedParcelCount) girer. Tekil kayıtlarda (count
 * yok/1) fiyatın kendisi değişmeden kullanılır. Bkz. lib/paket-tapu.ts.
 */
function etkinFiyat(p: RakipSatisRecord): number | null {
  if (p.deedParcelCount != null && p.deedParcelCount > 1) {
    return gecerliFiyat(p.birimFiyatTahmini ?? null) ? (p.birimFiyatTahmini as number) : null;
  }
  return p.fiyat;
}

/**
 * Katman açıldığında köşede gösterilen mini özet rozeti — rakamlar JSON'dan hesaplanır.
 * ÖNEMLİ SEMANTİK: medyan SADECE tamamlanmış satış fiyatlarından; taksitli/envanter
 * kayıtlarındaki fiyat LLC'nin KENDİ ALIM kaydıdır (maliyet tabanı) — o AYRI
 * "rakip ort. alış" rakamı olarak raporlanır, satış medyanına KARIŞMAZ.
 * PAKET TAPU kayıtlarında (deedParcelCount > 1) SALEP yerine birimFiyatTahmini
 * kullanılır (hem medyan satış hem rakip ort. alış hesabında) — toplu tapu
 * tutarının tekil parsel istatistiğini yapay şişirmesi engellenir.
 */
export function computeRakipSatislarOzet(points: RakipSatisPoint[]): RakipSatislarOzet {
  const dogrulanmis = points.filter((p) => p.kayitTipi === "dogrulanmis_satis");
  const taksitli = points.filter((p) => p.kayitTipi === "satis_taksitte");
  const stok = points.filter((p) => p.kayitTipi === "envanter" || p.kayitTipi === "belirsiz");

  const satisFiyatlar = dogrulanmis.map(etkinFiyat).filter(gecerliFiyat);
  const med = medyan(satisFiyatlar);

  const alisFiyatlar = [...taksitli, ...stok].map(etkinFiyat).filter(gecerliFiyat);
  const ortAlis = alisFiyatlar.length
    ? alisFiyatlar.reduce((s, f) => s + f, 0) / alisFiyatlar.length
    : null;

  const rozetMetni = `${dogrulanmis.length} tapulu satış · ${taksitli.length} taksitli${
    med != null ? ` · medyan satış ${formatKisaFiyat(med)}` : ""
  }${ortAlis != null ? ` · rakip ort. alış ${formatKisaFiyat(ortAlis)}` : ""}`;

  return {
    dogrulanmisSatis: dogrulanmis.length,
    taksitli: taksitli.length,
    envanter: stok.length,
    medyanFiyat: med,
    ortalamaAlisFiyat: ortAlis,
    toplam: points.length,
    rozetMetni,
  };
}
