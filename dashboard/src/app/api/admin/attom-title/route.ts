import { NextRequest, NextResponse } from "next/server";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { fetchTitlePrecheck } from "@/lib/attom";

// On-demand ATTOM tapu ön-kontrolü (sahip + ipotek sinyali). Admin-gated + limited.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const address = sp.get("address") || "";
  const cityStateZip = sp.get("loc") || "";
  if (!address) return NextResponse.json({ ok: false, reason: "adres gerekli", owner: "", absentee: null, hasMortgage: null, deedType: "", mailing: "" });
  const result = await fetchTitlePrecheck(address, cityStateZip);
  return NextResponse.json(result);
}
