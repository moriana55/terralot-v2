import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `deal_tracking` table.
// Used by admin/acquisitions for the deal lifecycle / watchlist / portfolio.

const ALLOWED_FIELDS = new Set([
  "lead_id",
  "stage",
  "starred",
  "notes",
  "max_offer",
  "acquired_cost",
  "list_price",
  "sold_price",
  "updated_at",
]);

// GET ?lead_ids=a,b,c — returns rows for the given lead ids (.in("lead_id", ...))
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("lead_ids") || "";
    const leadIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (leadIds.length === 0) return NextResponse.json({ tracking: [] });

    const s = supabaseAdmin();
    const { data, error } = await s.from("deal_tracking").select("*").in("lead_id", leadIds);
    if (error) return NextResponse.json({ tracking: [], error: error.message }, { status: 200 });
    return NextResponse.json({ tracking: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { tracking: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}

// POST { lead_id, ...patch } — upsert on conflict lead_id
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    if (!body || typeof body.lead_id !== "string" || !body.lead_id)
      return NextResponse.json({ error: "lead_id required" }, { status: 400 });

    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(k)) row[k] = v;
    }
    row.updated_at = new Date().toISOString();

    const s = supabaseAdmin();
    const { data, error } = await s
      .from("deal_tracking")
      .upsert(row, { onConflict: "lead_id" })
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
