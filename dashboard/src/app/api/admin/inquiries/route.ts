import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `Inquiry` table
// (joined with Property title). Used by admin/leads.
// Note: the existing /api/inquiries route is a separate in-memory stub used by
// the public inquiry form — it does NOT touch this table, so this is additive.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("Inquiry")
      .select(`*, Property(title)`)
      .order("createdAt", { ascending: false });
    if (error) return NextResponse.json({ inquiries: [], error: error.message }, { status: 200 });
    return NextResponse.json({ inquiries: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { inquiries: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}

const ALLOWED_STATUS = new Set(["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]);

export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    let body: { status?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    if (!body.status || !ALLOWED_STATUS.has(body.status))
      return NextResponse.json({ error: "invalid status" }, { status: 400 });

    const s = supabaseAdmin();
    const { data, error } = await s
      .from("Inquiry")
      .update({ status: body.status })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
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
    const { error } = await s.from("Inquiry").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
