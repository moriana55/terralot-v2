import { NextRequest, NextResponse } from "next/server";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { fetchNearbySoldComps } from "@/lib/attom";

// On-demand real ATTOM sold comps for a parcel (lat/lng). Admin-gated + limited.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radius = sp.get("radius") ? Math.min(20, Math.max(1, Number(sp.get("radius")))) : 8;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, reason: "lat/lng gerekli", count: 0, median: null, comps: [] });
  }
  const result = await fetchNearbySoldComps(lat, lng, radius);
  return NextResponse.json(result);
}
