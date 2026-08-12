// Shared magic numbers — centralized so limits/timeouts live in one place.

// Gate brute-force limiter (src/app/api/gate/route.ts)
export const GATE_RATE_WINDOW_MS = 5 * 60_000; // 5 min
export const GATE_RATE_MAX_ATTEMPTS = 8;

// Generic API rate limiter defaults (src/lib/api-guard.ts)
export const API_RATE_WINDOW_MS = 60_000; // 1 min
// İstek/dakika/IP. 60'tı — TEK KULLANICI için bile dardı: paneldeki bir sayfa
// açılışta 8-10 uç birden çağırıyor, birkaç ekran gezince sınır doluyor ve
// ekranda "Yüklenemedi: rate_limited" çıkıyordu (2026-08-12'de sunum
// hazırlığında yaşandı).
//
// ⚠ Yerelde `x-forwarded-for` başlığı YOK → clientIp() "unknown" döner ve
// TÜM istekler tek kovayı paylaşır; yani terminalden atılan test istekleri
// tarayıcının hakkını yiyor. Üretimde (Vercel) başlık geldiği için kova
// gerçekten IP başınadır.
//
// 300, şifre kapısının arkasındaki tek kullanıcıyı asla rahatsız etmez ama
// betikle yapılan kaba kuvvet denemesini yine durdurur.
export const API_RATE_LIMIT = 300; // requests/window/IP

// Due-diligence external fetch timeouts (src/app/api/dd-check/route.ts)
export const DD_FEMA_TIMEOUT_MS = 5000;
export const DD_OVERPASS_TIMEOUT_MS = 13000;

// Hot-counties / catalysts result caps (src/app/api/hot-counties/route.ts)
export const HOT_COUNTIES_CAP = 25;
export const HOT_STATES_CAP = 20;

// Scraper → dashboard sync (src/app/api/admin/sync-deals/route.ts)
// Hard cap on rows accepted per import so a hostile/buggy payload can't exhaust
// memory or hammer Supabase. Batches are upserted in chunks of this size.
export const SYNC_MAX_ROWS = 5000;
export const SYNC_BATCH_SIZE = 200;
