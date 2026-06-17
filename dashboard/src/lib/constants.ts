// Shared magic numbers — centralized so limits/timeouts live in one place.

// Gate brute-force limiter (src/app/api/gate/route.ts)
export const GATE_RATE_WINDOW_MS = 5 * 60_000; // 5 min
export const GATE_RATE_MAX_ATTEMPTS = 8;

// Generic API rate limiter defaults (src/lib/api-guard.ts)
export const API_RATE_WINDOW_MS = 60_000; // 1 min
export const API_RATE_LIMIT = 60; // requests/window/IP

// Due-diligence external fetch timeouts (src/app/api/dd-check/route.ts)
export const DD_FEMA_TIMEOUT_MS = 5000;
export const DD_OVERPASS_TIMEOUT_MS = 4000;

// Hot-counties / catalysts result caps (src/app/api/hot-counties/route.ts)
export const HOT_COUNTIES_CAP = 25;
export const HOT_STATES_CAP = 20;

// Scraper → dashboard sync (src/app/api/admin/sync-deals/route.ts)
// Hard cap on rows accepted per import so a hostile/buggy payload can't exhaust
// memory or hammer Supabase. Batches are upserted in chunks of this size.
export const SYNC_MAX_ROWS = 5000;
export const SYNC_BATCH_SIZE = 200;
