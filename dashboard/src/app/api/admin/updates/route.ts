import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `updates` table.
// Used by /updates (milestone registry). bot_statuses stays on the anon client.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ updates: [], error: error.message }, { status: 200 });
    return NextResponse.json({ updates: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { updates: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}

// POST { week, title, items[] } — insert a manual milestone
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    let body: { week?: string; title?: string; items?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    const week = typeof body.week === "string" ? body.week.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const items = Array.isArray(body.items)
      ? body.items.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (!week || !title || items.length === 0)
      return NextResponse.json({ error: "week, title and items required" }, { status: 400 });

    const s = supabaseAdmin();
    const { data, error } = await s
      .from("updates")
      .insert({ week, title, items })
      .select()
      .single();
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
    const { error } = await s.from("updates").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
