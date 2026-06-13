import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/investor(.*)"]);

// Placeholder key ile clerkMiddleware handshake redirect'i yapıyor —
// gerçek key gelene kadar middleware tamamen bypass
const AUTH_ENABLED = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("cGxhY2Vob2xkZXI");

export default AUTH_ENABLED
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
