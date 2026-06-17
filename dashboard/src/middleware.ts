import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { GATE_COOKIE, clerkIsReal, gateEnabled, gateToken } from "@/lib/gate";

// Explicitly PUBLIC API endpoints — reachable by the marketing site even when
// the admin gate / Clerk protection is active. These are the only /api/* paths
// that anonymous traffic may hit; each enforces its own input validation +
// per-IP rate limit at the route level (lead capture & read-only public data).
// Everything else under /api/* is protected (fail-closed) below.
const PUBLIC_API = [
  "/api/gate",
  "/api/inquiries",
  "/api/checkout",
  "/api/hot-counties",
  "/api/growth-catalysts",
  "/api/county-demographics",
  "/api/market-rates",
];
const isPublicApi = (req: NextRequest) =>
  PUBLIC_API.some((p) => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(p + "/"));

// Cron-authenticated machine endpoints: a scheduled job can't carry the admin
// gate cookie or a Clerk session, so it authenticates with a bearer CRON_SECRET.
// We let such a request bypass the page/gate auth ONLY when CRON_SECRET is set
// AND the presented token matches (constant-time) — fail closed otherwise. The
// route handler re-verifies the secret, so this is defense-in-depth, not the
// sole check. Currently only the scraper→dashboard sync endpoint opts in.
const CRON_ENDPOINTS = ["/api/admin/sync-deals"];
function cronBearerOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (!CRON_ENDPOINTS.some((p) => req.nextUrl.pathname === p)) return false;
  const header = req.headers.get("authorization") || "";
  const fromHeader = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const fromQuery = req.nextUrl.searchParams.get("secret") || "";
  const presented = fromHeader || fromQuery;
  if (!presented || presented.length !== secret.length) return false;
  let out = 0;
  for (let i = 0; i < presented.length; i++) out |= presented.charCodeAt(i) ^ secret.charCodeAt(i);
  return out === 0;
}

// Protect admin/investor pages AND all API routes EXCEPT the public allowlist.
const isProtectedRoute = (req: NextRequest) =>
  !isPublicApi(req) && matchProtected(req);
const matchProtected = createRouteMatcher(["/admin(.*)", "/investor(.*)", "/buyer(.*)", "/api/(.*)"]);
const isApi = (req: NextRequest) => req.nextUrl.pathname.startsWith("/api/");

async function gateMiddleware(req: NextRequest) {
  if (cronBearerOk(req)) return NextResponse.next(); // valid CRON_SECRET bearer
  if (!isProtectedRoute(req)) return NextResponse.next();
  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  // Fail closed: if the token can't be derived (e.g. SESSION_SECRET missing),
  // deny rather than allow.
  let expected: string | null = null;
  try {
    expected = await gateToken();
  } catch {
    expected = null;
  }
  if (expected && cookie && cookie === expected) return NextResponse.next();
  // API → 401 JSON; pages → redirect to gate
  if (isApi(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

const clerk = clerkMiddleware(async (auth, req) => {
  if (cronBearerOk(req)) return; // valid CRON_SECRET bearer → machine access
  if (isProtectedRoute(req)) await auth.protect();
});

// Fail-closed deny for protected routes when NO auth mechanism is configured
// (Clerk keys are placeholders AND no ADMIN_PASSWORD/SESSION_SECRET set).
// Previously this fell through to NextResponse.next(), leaving every /admin,
// /investor and /api/* route fully open. Now an unconfigured deployment denies
// protected traffic instead of silently exposing it.
function denyUnconfigured(req: NextRequest): NextResponse {
  if (isApi(req)) {
    return NextResponse.json(
      { error: "auth_not_configured", message: "Set Clerk keys or ADMIN_PASSWORD + SESSION_SECRET." },
      { status: 503 }
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  return NextResponse.redirect(url);
}

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (clerkIsReal()) return clerk(req, ev);
  if (gateEnabled()) return gateMiddleware(req);
  // No real auth configured: a valid cron bearer may still reach its endpoint
  // (the route re-checks the secret); otherwise allow public, deny protected.
  if (cronBearerOk(req)) return NextResponse.next();
  if (isProtectedRoute(req)) return denyUnconfigured(req);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
