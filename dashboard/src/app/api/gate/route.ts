import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, gateEnabled, gateToken } from "@/lib/gate";

export const runtime = "nodejs";

// Simple in-memory brute-force limiter: max 8 attempts / 5 min per IP.
const attempts = new Map<string, { n: number; ts: number }>();
const WINDOW = 5 * 60_000;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.ts > WINDOW) { attempts.set(ip, { n: 1, ts: now }); return false; }
  a.n++;
  return a.n > 8;
}

export async function POST(req: NextRequest) {
  if (!gateEnabled()) {
    // Nothing to gate (Clerk active or no password set) — accept.
    return NextResponse.json({ ok: true, noop: true });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Çok fazla deneme — 5 dk bekle." }, { status: 429 });
  }
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }
  attempts.delete(ip); // success resets
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h session
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
