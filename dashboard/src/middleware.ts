import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { GATE_COOKIE, clerkIsReal, gateEnabled, gateToken } from "@/lib/gate";

// Protect admin/investor pages AND all API routes except the login endpoint.
const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/investor(.*)", "/api/((?!gate).*)"]);
const isApi = (req: NextRequest) => req.nextUrl.pathname.startsWith("/api/");

async function gateMiddleware(req: NextRequest) {
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
  if (isProtectedRoute(req)) await auth.protect();
});

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (clerkIsReal()) return clerk(req, ev);
  if (gateEnabled()) return gateMiddleware(req);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
