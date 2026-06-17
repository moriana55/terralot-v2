import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `upcoming_sales` table.
// Used by admin/deal-map (geo points with coords).
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("upcoming_sales")
      .select("id,county,state,sale_date,lat,lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(200);
    if (error) return NextResponse.json({ sales: [], error: error.message }, { status: 200 });
    return NextResponse.json({ sales: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { sales: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}
