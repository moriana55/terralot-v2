// ─────────────────────────────────────────────────────────────────────────────
// CANLI COUNTY SONUÇ TİPLERİ — tek kaynak.
//
// Hem eski `live-county.ts` hem yeni sağlayıcı katmanı (`county-providers/`)
// bu tipleri kullanır; döngüsel import olmasın diye ayrı dosyada tutulur.
// Bu şekil DEĞİŞMEZ: mevcut ekranlar (canli-sorgu) ve /api/admin/live-county
// POST kaydetme akışı buna bağlı.
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveCountyResult {
  apn: string;
  owner: string;
  mailing_address: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
  situs: string;
  use: string;
  acres: number | null;
  land_value: number | null;
  absentee: boolean;
}

export interface LiveSearch {
  owner?: string;
  apn?: string;
  mailingState?: string;
  minValue?: number;
  maxValue?: number;
}

/** Sahibe GERÇEKTEN mektup atılabilir mi — katı tanım. Tahmin yok. */
export function mailable(r: LiveCountyResult): boolean {
  return !!(
    r.owner?.trim() &&
    r.mailing_address?.trim() &&
    r.mailing_city?.trim() &&
    r.mailing_state?.trim() &&
    r.mailing_zip?.trim()
  );
}
