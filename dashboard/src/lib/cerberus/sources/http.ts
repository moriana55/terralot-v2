// Shared defensive fetch helper for ALL Cerberus enrichment adapters.
//
// CONTRACT (every adapter relies on this):
//   • Hard timeout (default 8s) via AbortController — a hung free API NEVER
//     stalls the analysis pipeline.
//   • try/catch around the whole thing — returns null on ANY failure
//     (network error, non-2xx, JSON parse error, abort). NEVER throws.
//   • Cached at the Next.js fetch layer via `next.revalidate` so repeated
//     parcels in a batch don't re-hit the free APIs (respects rate limits).
//
// These free public APIs are keyless but rate-limited; the long revalidate
// windows + per-source caching are how we stay polite.

export interface FetchJsonOpts {
  /** Hard timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Next.js cache revalidate window in seconds (default 24h). */
  revalidate?: number;
  /** Extra headers (e.g. a descriptive User-Agent for OSM Overpass etiquette). */
  headers?: Record<string, string>;
  /** POST body (Overpass uses form-encoded POST). */
  body?: string;
  method?: "GET" | "POST";
}

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_REVALIDATE = 60 * 60 * 24; // 24h — geo facts are effectively static.

// Honest, contactable UA so the free APIs can reach us if we misbehave.
const UA = "terralot-cerberus/1 (+land-due-diligence; contact: sales@nocturndev.com)";

/**
 * Fetch JSON defensively. Returns the parsed JSON (as `unknown`) or null.
 * NEVER throws — every adapter trusts this to keep the pipeline alive.
 */
export async function fetchJson(
  url: string,
  opts: FetchJsonOpts = {},
): Promise<unknown | null> {
  const { timeoutMs = DEFAULT_TIMEOUT, revalidate = DEFAULT_REVALIDATE, headers, body, method } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: method ?? (body ? "POST" : "GET"),
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": UA, ...headers },
      body,
      // Cache at the framework layer; long window since geo facts are static.
      next: { revalidate },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null; // some endpoints lie about content-type / return HTML on error
    }
  } catch {
    return null; // abort / network / DNS — degrade gracefully
  } finally {
    clearTimeout(timer);
  }
}

/** Build a query string from a record, skipping null/undefined. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}
