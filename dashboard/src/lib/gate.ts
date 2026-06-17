// Interim admin gate — used ONLY while Clerk keys are placeholders.
// Once real Clerk keys are set, middleware uses Clerk and this is dormant.
// Web Crypto (SHA-256) so it works in both Edge middleware and Node routes.

export const GATE_COOKIE = "tl_admin_gate";

const PLACEHOLDER_MARK = "cGxhY2Vob2xkZXI"; // base64("placeholder")

export function clerkIsReal(): boolean {
  const k = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return !!k && !k.includes(PLACEHOLDER_MARK);
}

// The gate is active only when Clerk is NOT real AND a password is configured.
export function gateEnabled(): boolean {
  return !clerkIsReal() && !!process.env.ADMIN_PASSWORD;
}

// Deterministic session token derived from password + secret.
// Fails closed: never falls back to a hardcoded secret, and never derives a
// token from an empty password (which would let an empty password match).
export async function gateToken(): Promise<string> {
  const pw = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — gate refusing to issue a session (fail closed).");
  }
  if (!pw) {
    throw new Error("ADMIN_PASSWORD is not set — gate refusing to issue a session (fail closed).");
  }
  const data = new TextEncoder().encode(`${pw}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
