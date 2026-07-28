// ─────────────────────────────────────────────────────────────────────────────
// SAĞLAYICI ZİNCİRİ — bir county sorgusunu kaynaklar arasında yürütür.
//
// Kural:
//   • Kaynaklar kayıttaki SIRAYLA denenir (ücretsiz ArcGIS → ücretli Regrid).
//   • SERT HATA (servis-hatasi / kimlik-hatasi / yapilandirilmamis) → sonraki kaynağa geç.
//   • "bos" (veri yok) DÜRÜST BİR CEVAPTIR → zincir orada durur, para harcanmaz.
//     "Veri yok" ile "servis çöktü" asla karıştırılmaz.
//   • Hiçbir kaynak başaramazsa satır DÖNMEZ — sahte veri üretilmez.
// ─────────────────────────────────────────────────────────────────────────────

import { queryArcGis } from "./arcgis";
import { queryRegrid, kotaDurumu } from "./regrid";
import type {
  CountyEntry, CountyQueryResult, LiveSearch, ProviderOutcome,
} from "./types";

export const RESULT_CAP = 200; // interaktif sorgu tavanı — tam hasat değil

/** Sonraki kaynağa geçmeyi gerektiren durumlar. */
const SERT_HATA = new Set(["servis-hatasi", "kimlik-hatasi", "yapilandirilmamis"]);

export async function queryCounty(
  countyKey: string, entry: CountyEntry, search: LiveSearch, cap: number = RESULT_CAP,
): Promise<CountyQueryResult> {
  const attempts: ProviderOutcome[] = [];

  const temel = {
    countyKey,
    label: entry.label,
    state: entry.state,
    county: entry.county,
    fetchedAt: new Date().toISOString(),
  };

  if (entry.sources.length === 0) {
    return {
      ...temel, provider: null, status: "yapilandirilmamis", rows: [], rawCount: 0,
      capped: false, attempts: [], apiCalls: 0,
      message: `${entry.label} için tanımlı veri kaynağı yok. (${entry.not ?? "kaynak aranıyor"})`,
    };
  }

  for (const src of entry.sources) {
    const sonuc = src.kind === "arcgis"
      ? await queryArcGis(src, entry.state, entry.label, search, cap)
      : await queryRegrid(src, entry.state, entry.label, search, cap);
    attempts.push(sonuc);

    if (!SERT_HATA.has(sonuc.status)) {
      // ok veya bos → dürüst cevap, zincir biter.
      return {
        ...temel,
        provider: sonuc.provider,
        status: sonuc.status,
        rows: sonuc.rows,
        rawCount: sonuc.rawCount,
        capped: sonuc.capped,
        message: sonuc.message,
        where: sonuc.where,
        attempts,
        apiCalls: attempts.reduce((t, a) => t + a.apiCalls, 0),
      };
    }
    // "kota-doldu" da zinciri durdurur (para koruması) — ama sert hata sayılmaz,
    // yukarıdaki dalda yakalanır ve dürüstçe raporlanır.
  }

  const son = attempts[attempts.length - 1];
  return {
    ...temel,
    provider: null,
    status: son?.status ?? "servis-hatasi",
    rows: [], rawCount: 0, capped: false,
    message: attempts.map((a) => `[${a.provider}] ${a.message ?? a.status}`).join(" · "),
    where: son?.where,
    attempts,
    apiCalls: attempts.reduce((t, a) => t + a.apiCalls, 0),
  };
}

export { kotaDurumu };
export * from "./types";
