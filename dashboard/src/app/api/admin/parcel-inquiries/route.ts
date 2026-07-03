import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { fallbackInquiries, type ParcelInquiry } from "@/lib/parcel-inquiry-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GATED admin list of buyer inquiries from the public /p/[id] page.
// Source 1: Supabase parcel_inquiries (durable). Source 2: in-memory fallback
// buffer (rows that failed to persist — labelled `volatile`).

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let rows: ParcelInquiry[] = [];
  let tableOk = false;
  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("parcel_inquiries")
      .select("id,parcel_id,parcel_title,name,email,phone,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) {
      tableOk = true;
      rows = data as ParcelInquiry[];
    }
  } catch {
    tableOk = false;
  }

  const volatile = fallbackInquiries();
  const merged = [...volatile, ...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return NextResponse.json({ tableOk, volatileCount: volatile.length, rows: merged });
}

// Status update (NEW → CONTACTED → CLOSED) — durable rows only.
const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
});

export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const s = supabaseAdmin();
    const { error } = await s
      .from("parcel_inquiries")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
