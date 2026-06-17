import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `Property` table.
// The admin dashboard / listings / analytics pages used to read & write this
// table with the browser anon client, which returns 0 rows under RLS — that's
// why those pages rendered empty and edits silently failed.

// Whitelisted column selections per use-case. We restrict `select` so the route
// can't be used to exfiltrate arbitrary columns, while still serving exactly
// what each page asks for.
const SELECTS: Record<string, string> = {
  // src/app/admin/page.tsx — portfolio stats
  stats: "price,status",
  // src/app/admin/listings/page.tsx — listings table
  listings: "id,title,slug,state,county,acres,price,monthlyPayment,status,featured,images",
  // src/app/admin/analytics/page.tsx — financial analysis
  analytics:
    "id,title,state,county,acres,price,costPrice,downPayment,monthlyPayment,term,paymentsReceived,status,featured,interestRate,monthlyExpenses,useCases,images",
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "listings";
    const select = SELECTS[view] || SELECTS.listings;
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const s = supabaseAdmin();
    let q = s.from("Property").select(select);
    // stats view has no createdAt ordering requirement
    if (view !== "stats") q = q.order("createdAt", { ascending: false });
    if (status) q = q.eq("status", status);
    if (search) {
      const term = search.replace(/[%,]/g, "");
      q = q.or(`title.ilike.%${term}%,state.ilike.%${term}%,county.ilike.%${term}%`);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ properties: [], error: error.message }, { status: 200 });
    return NextResponse.json({ properties: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { properties: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}

const ALLOWED_PATCH_FIELDS = new Set(["featured", "status", "title", "price", "monthlyPayment"]);

export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_PATCH_FIELDS.has(k)) update[k] = v;
    }
    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: "no allowed fields" }, { status: 400 });

    const s = supabaseAdmin();
    const { data, error } = await s.from("Property").update(update).eq("id", id).select().maybeSingle();
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
    const { error } = await s.from("Property").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
