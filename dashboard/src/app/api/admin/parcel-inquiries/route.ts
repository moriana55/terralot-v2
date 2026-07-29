import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { fallbackInquiries, type ParcelInquiry } from "@/lib/parcel-inquiry-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GATED admin list — sitenin TEK talep hunisi (parcel_inquiries).
// Kaynak 1: Supabase parcel_inquiries (kalıcı). Kaynak 2: bellek-içi fallback
// tamponu (kalıcılaşamayan satırlar — `volatile` etiketli).

// Hem yeni uuid'ler hem de eski Inquiry cuid'leri kabul edilir (taşınan
// satırların `legacy_id`'si cuid; eski link/entegrasyon kırılmasın).
const idSemasi = z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** uuid ise `id`, değilse (cuid) `legacy_id` sütunundan eşleştir. */
const idSutunu = (id: string) => (UUID_RE.test(id) ? "id" : "legacy_id");

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
      .select("id,parcel_id,parcel_title,name,email,phone,message,status,created_at,source,legacy_id")
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

// Durum güncelleme (NEW → CONTACTED → QUALIFIED → CLOSED) — sadece kalıcı satırlar.
// QUALIFIED eski `Inquiry` ekranında vardı; huni birleşince kaybolmasın diye burada da var.
const patchSchema = z.object({
  id: idSemasi,
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]),
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
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq(idSutunu(parsed.data.id), parsed.data.id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// Talep silme — eski /admin/leads ekranında vardı, huni birleşince kaybolmasın.
// Sadece gated admin; onay diyaloğu ekranda. Tek satır siler (id/legacy_id eşleşmesi).
export async function DELETE(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const parsed = idSemasi.safeParse(searchParams.get("id") ?? "");
  if (!parsed.success) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const s = supabaseAdmin();
    const { error } = await s
      .from("parcel_inquiries")
      .delete()
      .eq(idSutunu(parsed.data), parsed.data);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
