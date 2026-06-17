import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns competitor_listings via the service role. The page used to read this
// table directly with the browser anon client, which returns 0 rows when RLS is
// enabled — that's why the competitor page looked empty even though data exists.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("competitor_listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ listings: [], error: error.message }, { status: 200 });
    return NextResponse.json({ listings: data ?? [] });
  } catch (e) {
    return NextResponse.json({ listings: [], error: e instanceof Error ? e.message : "failed" }, { status: 200 });
  }
}
