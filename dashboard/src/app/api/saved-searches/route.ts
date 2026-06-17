import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// SAVED SEARCHES — guarded CRUD over saved_searches.
//
//   GET    /api/saved-searches                          → all saved searches
//   POST   /api/saved-searches  { name, filters_json, source?, notify_email? }
//   POST   /api/saved-searches  { id, _action:"delete" }
//
// filters_json is the opaque filter set captured from the deal-screener /
// acquisitions UI. The /run endpoint re-evaluates it and reports new matches.
// Graceful empty list when the table doesn't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();
  try {
    const { data, error } = await s
      .from("saved_searches")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ searches: [], reason: "table unavailable" });
    return NextResponse.json({ searches: data || [] });
  } catch {
    return NextResponse.json({ searches: [] });
  }
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const s = supabaseAdmin();

  if (body._action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
      const { error } = await s.from("saved_searches").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const record = {
    name: String(body.name),
    source: (body.source as string) || "deal-screener",
    filters_json: body.filters_json ?? {},
    notify_email: (body.notify_email as string) ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    if (body._action === "update" && body.id) {
      const { data, error } = await s
        .from("saved_searches")
        .update(record)
        .eq("id", body.id)
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ search: data });
    }
    const { data, error } = await s.from("saved_searches").insert(record).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ search: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
