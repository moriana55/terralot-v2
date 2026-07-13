// ─────────────────────────────────────────────────────────────────────────────
// ⚔️ RAKİP DEFTERİ — saf veri dönüşümü + hesaplama (JSON → tablo satırları + özet).
//
// Kaynak veri: src/data/rakip-defteri.json (scraper/rakip-defteri-uret.mjs ile
// scraper/rakip-tapu-sonuc.json [county tapu] + scraper/rakip-ilan-fiyat.json
// [rakip ilanı] + scraper/rakip-tapu-diger.json [diğer oyuncular] birleştirilir).
//
// Bu dosya SADECE saf fonksiyon — network/DOM/fs YOK, node --test ile doğrulanır.
//
// PAKET TAPU: birim fiyat hesabı lib/paket-tapu.ts'deki PAYLAŞILAN mantığı
// kullanır (effectivePriceForStats/isPaketTapu) — o dosyaya DOKUNULMAZ, sadece
// import edilir.
//
// DÜRÜSTLÜK: "alım" alanları HER ZAMAN county tapu kaynaklı, "satış/ilan"
// alanları HER ZAMAN rakip ilanı (discountlots.com) kaynaklı. Eksik veri null
// kalır — asla uydurulmaz. Statü/etiket UI'da bu ayrımı gösterir.
// ─────────────────────────────────────────────────────────────────────────────

import { effectivePriceForStats, formatUsd, isPaketTapu } from "./paket-tapu";

export type RakipDefteriKayitTipi = "dogrulanmis_satis" | "satis_taksitte" | "envanter" | "belirsiz";

export interface RakipDefteriKayit {
  apn: string;
  kayitTipi: RakipDefteriKayitTipi;
  bolge: string | null;
  acres: number | null;
  // ALIM — kaynak: county tapu
  alimFiyati: number | null;
  alimTarihi: string | null;
  recordingNo: string | null;
  deedType: string | null;
  satici: string | null;
  legal: string | null;
  deedParcelCount: number;
  birimFiyatTahmini: number | null;
  // SATIŞ / İLAN — kaynak: rakip ilanı
  satisFiyati: number | null;
  pesinat: number | null;
  aylik: number | null;
  vade: number | null;
  statu: string | null;
  ilanBaslik: string | null;
  ilanUrl: string | null;
  snapshotTarihi: string | null;
}

export interface RakipDefteriDigerOyuncu {
  firma: string;
  tip: string | null;
  parselSayisi: number;
  bolgeler: string[];
  ornekApnler: string[];
  mailingState: string | null;
  not: string | null;
}

export interface RakipDefteriData {
  generatedAt: string;
  source: string;
  toplamKayit: number;
  kayitlar: RakipDefteriKayit[];
  digerOyuncular: RakipDefteriDigerOyuncu[];
}

export const RAKIP_DEFTERI_STATU_ROZET: Record<RakipDefteriKayitTipi, string> = {
  dogrulanmis_satis: "Satıldı ✓",
  satis_taksitte: "Taksitte",
  envanter: "Stokta",
  belirsiz: "Bilinmiyor",
};

export interface RakipDefteriRow extends RakipDefteriKayit {
  /** Paket tapuysa birim fiyat (birimFiyatTahmini), değilse alimFiyati. İstatistik/kâr hesabında KULLANILAN fiyat. */
  etkinAlim: number | null;
  paket: boolean;
  /** Kâr = satisFiyati - etkinAlim (ikisi de varsa). */
  karMarji: number | null;
  /** Çarpan = satisFiyati / etkinAlim (etkinAlim > 0 ise). */
  carpan: number | null;
  statuRozeti: string;
  /** "$peşinat + $aylık × vade ay" — pesinat/aylik/vade'den en az biri varsa. */
  taksitOzeti: string | null;
}

/** JSON kayıtlarını tablo satırlarına çevirir — kâr/çarpan/paket rozeti hesaplanır. */
export function buildRakipDefteriRows(data: RakipDefteriData | null | undefined): RakipDefteriRow[] {
  if (!data || !Array.isArray(data.kayitlar)) return [];
  return data.kayitlar.map((k) => {
    const paket = isPaketTapu(k.deedParcelCount);
    const etkinAlim = effectivePriceForStats(k.alimFiyati, k.deedParcelCount, k.birimFiyatTahmini);

    const karMarji =
      k.satisFiyati != null && etkinAlim != null && Number.isFinite(k.satisFiyati) && Number.isFinite(etkinAlim)
        ? k.satisFiyati - etkinAlim
        : null;

    const carpan =
      k.satisFiyati != null && etkinAlim != null && Number.isFinite(k.satisFiyati) && etkinAlim > 0
        ? Math.round((k.satisFiyati / etkinAlim) * 100) / 100
        : null;

    const taksitParcalari: string[] = [];
    if (k.pesinat != null) taksitParcalari.push(`$${Math.round(k.pesinat).toLocaleString("en-US")} peşin`);
    if (k.aylik != null) taksitParcalari.push(`$${Math.round(k.aylik).toLocaleString("en-US")}/ay`);
    if (k.vade != null) taksitParcalari.push(`${k.vade} ay vade`);
    const taksitOzeti = taksitParcalari.length ? taksitParcalari.join(" + ") : null;

    return {
      ...k,
      etkinAlim,
      paket,
      karMarji,
      carpan,
      statuRozeti: RAKIP_DEFTERI_STATU_ROZET[k.kayitTipi] ?? "Bilinmiyor",
      taksitOzeti,
    };
  });
}

// ── MEDYAN ──────────────────────────────────────────────────────────────────
function medyan(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const gecerli = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

export interface RakipDefteriOzet {
  toplamKayit: number;
  tamamlanmisSatis: number;
  aktifTaksitli: number;
  envanterSayisi: number;
  belirsizSayisi: number;
  /** Tekil-deed bazlı (paket ise birim fiyat) medyan alım. */
  medyanAlim: number | null;
  medyanSatis: number | null;
  medyanCarpan: number | null;
  aktifTaksitliOrtAylik: number | null;
  aktifTaksitliMedyanVade: number | null;
  /** Aktif taksitli sözleşmelerin aylık ödemelerinin TOPLAMI — tahmini aylık tahsilat. */
  tahminiAylikToplam: number | null;
}

/** Özet kartları için canlı hesap — hard-code yok, tamamen `rows`'tan türetilir. */
export function computeRakipDefteriOzet(rows: RakipDefteriRow[]): RakipDefteriOzet {
  const tamamlanmis = rows.filter((r) => r.kayitTipi === "dogrulanmis_satis");
  const taksitli = rows.filter((r) => r.kayitTipi === "satis_taksitte");
  const envanter = rows.filter((r) => r.kayitTipi === "envanter");
  const belirsiz = rows.filter((r) => r.kayitTipi === "belirsiz");

  const alimFiyatlar = rows.map((r) => r.etkinAlim).filter(gecerli);
  const satisFiyatlar = rows.map((r) => r.satisFiyati).filter(gecerli);
  const carpanlar = rows.map((r) => r.carpan).filter(gecerli);

  const taksitliAylik = taksitli.map((r) => r.aylik).filter(gecerli);
  const taksitliVade = taksitli.map((r) => r.vade).filter(gecerli);

  const tahminiAylikToplam = taksitliAylik.length ? taksitliAylik.reduce((s, v) => s + v, 0) : null;

  return {
    toplamKayit: rows.length,
    tamamlanmisSatis: tamamlanmis.length,
    aktifTaksitli: taksitli.length,
    envanterSayisi: envanter.length,
    belirsizSayisi: belirsiz.length,
    medyanAlim: medyan(alimFiyatlar),
    medyanSatis: medyan(satisFiyatlar),
    medyanCarpan: medyan(carpanlar),
    aktifTaksitliOrtAylik: taksitliAylik.length ? taksitliAylik.reduce((s, v) => s + v, 0) / taksitliAylik.length : null,
    aktifTaksitliMedyanVade: medyan(taksitliVade),
    tahminiAylikToplam,
  };
}

/** "Ne öğreniyoruz" bölümü için otomatik metin — rakamlar tamamen `ozet`/`rows`'tan gelir. */
export function computeNeOgreniyoruz(ozet: RakipDefteriOzet, rows: RakipDefteriRow[]): string[] {
  const maddeler: string[] = [];

  if (ozet.medyanAlim != null && ozet.medyanSatis != null) {
    const carpanMetni = ozet.medyanCarpan != null ? ` (×${ozet.medyanCarpan.toFixed(2)})` : "";
    maddeler.push(
      `Ortalama ${formatUsd(ozet.medyanAlim)}'a alıp ${formatUsd(ozet.medyanSatis)}'e satıyor${carpanMetni}.`,
    );
  }

  const pesinatlar = rows.map((r) => r.pesinat).filter(gecerli);
  if (pesinatlar.length) {
    const min = Math.min(...pesinatlar);
    const max = Math.max(...pesinatlar);
    maddeler.push(
      min === max
        ? `Peşinat kancası: ilanların çoğunda $${min.toLocaleString("en-US")}.`
        : `Peşinat kancası: ilanların çoğunda $${min.toLocaleString("en-US")}–$${max.toLocaleString("en-US")}.`,
    );
  }

  if (ozet.aktifTaksitli > 0 && ozet.tahminiAylikToplam != null) {
    maddeler.push(
      `${ozet.aktifTaksitli} aktif sözleşmeden ayda ~${formatUsd(ozet.tahminiAylikToplam)} tahsilat (tahmini).`,
    );
  }

  const carpanliRows = rows.filter((r) => gecerli(r.carpan));
  if (carpanliRows.length) {
    const enKarli = carpanliRows.reduce((a, b) => ((b.carpan ?? 0) > (a.carpan ?? 0) ? b : a));
    if (enKarli.carpan != null) {
      maddeler.push(`En kârlı işlem: APN ${enKarli.apn}, ×${enKarli.carpan.toFixed(2)} kat.`);
    }
  }

  return maddeler;
}

// ── FİLTRE / ARAMA / SIRALAMA (client-side, saf) ───────────────────────────
export type RakipDefteriSiraAlan = "carpan" | "karMarji" | "etkinAlim" | "satisFiyati" | "acres";

export function sortRakipDefteriRows(
  rows: RakipDefteriRow[],
  alan: RakipDefteriSiraAlan,
  yon: "asc" | "desc" = "desc",
): RakipDefteriRow[] {
  const dir = yon === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[alan];
    const vb = b[alan];
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // null her zaman sona
    if (vb == null) return -1;
    return (va - vb) * dir;
  });
}

export function filterRakipDefteriRows(
  rows: RakipDefteriRow[],
  opts: { statu?: RakipDefteriKayitTipi | "hepsi"; bolge?: string; arama?: string },
): RakipDefteriRow[] {
  const { statu = "hepsi", bolge, arama } = opts;
  const q = arama?.trim().toLowerCase();
  return rows.filter((r) => {
    if (statu !== "hepsi" && r.kayitTipi !== statu) return false;
    if (bolge && bolge !== "hepsi" && r.bolge !== bolge) return false;
    if (q) {
      const hay = `${r.apn} ${r.bolge ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
