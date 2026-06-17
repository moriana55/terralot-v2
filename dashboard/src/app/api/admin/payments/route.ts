import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `Payment` table
// (joined with Property title). Used by admin/payments.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("Payment")
      .select(`*, Property(title)`)
      .order("createdAt", { ascending: false });
    if (error) return NextResponse.json({ payments: [], error: error.message }, { status: 200 });
    return NextResponse.json({ payments: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { payments: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}

const ALLOWED_STATUS = new Set(["PENDING", "PAID", "OVERDUE", "FAILED"]);

export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    let body: { status?: string; paidAt?: string | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    if (!body.status || !ALLOWED_STATUS.has(body.status))
      return NextResponse.json({ error: "invalid status" }, { status: 400 });

    const update: Record<string, unknown> = { status: body.status };
    if (body.status === "PAID") update.paidAt = body.paidAt ?? new Date().toISOString();

    const s = supabaseAdmin();
    const { data, error } = await s.from("Payment").update(update).eq("id", id).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data, paidAt: update.paidAt ?? null });
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
    const { error } = await s.from("Payment").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
