import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `Deal` table.
// Used by admin/deals (full, ordered) and admin/contacts (full, unordered).
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const ordered = searchParams.get("ordered") === "1";

    const s = supabaseAdmin();
    let q = s.from("Deal").select("*");
    if (ordered) q = q.order("createdAt", { ascending: false });
    const { data, error } = await q;
    if (error) return NextResponse.json({ deals: [], error: error.message }, { status: 200 });
    return NextResponse.json({ deals: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { deals: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const s = supabaseAdmin();
    const { error } = await s.from("Deal").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
