import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { daysBetween, type TrackedListing, type Verification } from "@/lib/rakip-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  key: z.string().min(1).max(500),
  action: z.enum(["sold", "withdrawn", "reopen"]),
  price: z.coerce.number().positive().max(100_000_000).optional(),
});

// POST /api/admin/rakip-radar/override — manuel karar:
//   sold      → "Satıldı onayla" (Recorder/Affidavit'te görülen fiyatla)
//   withdrawn → "Çekildi" (satış değil, ilan kaldırılmış)
//   reopen    → yanlışlıkla kapatılanı tekrar şüpheye al
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { key, action, price } = parsed.data;

  const s = supabaseAdmin();
  const { data: t, error } = await s
    .from("competitor_tracked")
    .select("*")
    .eq("listing_key", key)
    .maybeSingle<TrackedListing>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!t) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });

  const now = new Date();
  const nowIso = now.toISOString();
  const verification: Verification = {
    method: "manual",
    checkedAt: nowIso,
    note:
      action === "sold"
        ? `Manuel onay: satıldı${price ? ` ($${price.toLocaleString("en-US")})` : ""}.`
        : action === "withdrawn"
          ? "Manuel karar: ilan çekildi (satış değil)."
          : "Manuel: tekrar şüpheye alındı.",
  };

  const update: Record<string, unknown> = { verification, updated_at: nowIso };
  if (action === "sold") {
    update.status = "SOLD_VERIFIED";
    if (price != null) update.sold_price = price;
    if (t.dom_days == null) update.dom_days = daysBetween(t.first_seen, now);
    if (!t.disappeared_at) update.disappeared_at = nowIso;
  } else if (action === "withdrawn") {
    update.status = "WITHDRAWN";
    if (t.dom_days == null) update.dom_days = daysBetween(t.first_seen, now);
    if (!t.disappeared_at) update.disappeared_at = nowIso;
  } else {
    update.status = "SUSPECTED_SOLD";
    update.sold_price = null;
  }

  const { error: uerr } = await s.from("competitor_tracked").update(update).eq("listing_key", key);
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 });

  await s.from("competitor_events").insert({
    listing_key: key,
    type: "STATUS_CHANGED",
    old_value: { status: t.status },
    new_value: { status: update.status, via: "manual", price: price ?? null },
    delta: null,
  });

  return NextResponse.json({ ok: true, status: update.status });
}
