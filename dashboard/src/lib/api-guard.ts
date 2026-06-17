import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, gateEnabled, gateToken } from "@/lib/gate";
import { API_RATE_LIMIT, API_RATE_WINDOW_MS } from "@/lib/constants";

// ── Auth ─────────────────────────────────────────────────────────────────────
// Validates the same gate session cookie used by middleware.ts / gate.ts.
// Returns a 401 NextResponse when invalid, or null when the request is allowed.
// Note: when the gate isn't active (Clerk live, or no password set) this is a
// no-op — the middleware/Clerk already governs access in that mode.
export async function requireGate(req: NextRequest): Promise<NextResponse | null> {
  if (!gateEnabled()) return null;
  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  let expected: string | null = null;
  try {
    expected = await gateToken();
  } catch {
    expected = null; // fail closed
  }
  if (expected && cookie && cookie === expected) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// ── Rate limit ────────────────────────────────────────────────────────────────
// Simple in-memory, Map-based limiter with expired-entry cleanup so the Map
// never grows unbounded. Returns true when the key is over the limit.
const buckets = new Map<string, { n: number; ts: number }>();

interface RateLimitOpts {
  limit?: number;
  windowMs?: number;
}

function cleanup(now: number, windowMs: number) {
  for (const [k, v] of buckets) {
    if (now - v.ts > windowMs) buckets.delete(k);
  }
}

export function rateLimit(key: string, opts: RateLimitOpts = {}): boolean {
  const limit = opts.limit ?? API_RATE_LIMIT;
  const windowMs = opts.windowMs ?? API_RATE_WINDOW_MS;
  const now = Date.now();
  cleanup(now, windowMs);
  const b = buckets.get(key);
  if (!b || now - b.ts > windowMs) {
    buckets.set(key, { n: 1, ts: now });
    return false;
  }
  b.n++;
  return b.n > limit;
}

// Client IP from x-forwarded-for, used as the rate-limit key.
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Convenience: returns a 429 NextResponse when over the limit, else null.
export function enforceRateLimit(req: NextRequest, opts?: RateLimitOpts): NextResponse | null {
  if (rateLimit(clientIp(req), opts)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  return null;
}
