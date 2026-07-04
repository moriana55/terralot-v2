// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER SAĞLIĞI — saf yardımcılar (DB/fs YOK, test edilebilir).
//
// İki sinyali tek "sağlık" görünümüne çevirir:
//   1) Veri tazeliği: competitor_listings.max(scraped_at) → kaç gün önce?
//      3 günü geçince STALE (kırmızı rozet). 2,5 hafta fark edilmeden ölmesin.
//   2) Runner durumu: ~/Library/Application Support/terralot-runner/status.json
//      (launchd koşucusu her koşumda yazar). Üst üste ≥2 başarısızlık VEYA
//      48 saatten uzun süredir hiç koşmamışsa uyarı.
// ─────────────────────────────────────────────────────────────────────────────

/** Rozetin kırmızıya döndüğü eşik (gün). */
export const SCRAPE_STALE_DAYS = 3;
/** Runner'ın "hiç koşmuyor" sayıldığı eşik (saat). */
export const RUNNER_SILENT_HOURS = 48;

export interface RunnerStatus {
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  consecutiveFailures?: number;
  lastError?: string | null;
}

export interface ScraperHealth {
  /** Son başarılı tarama üzerinden geçen tam gün (ts yoksa null). */
  ageDays: number | null;
  /** ageDays eşiği aştı mı (ts yoksa da true — hiç veri yok demektir). */
  stale: boolean;
  /** Runner kaynaklı görünür uyarı metni (yoksa null). */
  runnerWarning: string | null;
}

function daysSince(ts: string | null | undefined, now: Date): number | null {
  if (!ts) return null;
  const ms = now.getTime() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
}

/**
 * lastScrapeAt: competitor_listings.max(scraped_at).
 * runner: status.json içeriği (dosya yoksa/okunamadıysa null — ör. Vercel'de).
 */
export function scraperHealth(
  lastScrapeAt: string | null,
  runner: RunnerStatus | null,
  now = new Date()
): ScraperHealth {
  const ageDays = daysSince(lastScrapeAt, now);
  const stale = ageDays == null || ageDays > SCRAPE_STALE_DAYS;

  let runnerWarning: string | null = null;
  if (runner) {
    const fails = runner.consecutiveFailures ?? 0;
    const lastRunMs = runner.lastRunAt ? now.getTime() - new Date(runner.lastRunAt).getTime() : Infinity;
    if (fails >= 2) {
      runnerWarning = `Scraper koşucusu üst üste ${fails} kez başarısız oldu${runner.lastError ? ` (${runner.lastError})` : ""}.`;
    } else if (lastRunMs > RUNNER_SILENT_HOURS * 3600000) {
      runnerWarning = `Scraper koşucusu ${RUNNER_SILENT_HOURS} saatten uzun süredir hiç koşmadı — launchd job'ını kontrol et.`;
    }
  }
  return { ageDays, stale, runnerWarning };
}

/** Rozet metni: "bugün" / "1 gün önce" / "X gün önce" / "hiç". */
export function scrapeAgeLabel(ageDays: number | null): string {
  if (ageDays == null) return "hiç";
  if (ageDays === 0) return "bugün";
  return `${ageDays} gün önce`;
}
