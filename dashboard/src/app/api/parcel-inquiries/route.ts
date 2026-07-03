import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/api-guard";
import { pushFallbackInquiry } from "@/lib/parcel-inquiry-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC lead-capture for the buyer-facing /p/[id] parcel page (allowlisted in
// proxy.ts). POST-only; no read surface here at all — reads happen exclusively
// through the gated /api/admin/parcel-inquiries route.

const schema = z.object({
  parcelId: z.string().trim().min(1).max(200),
  parcelTitle: z.string().trim().max(300).optional(),
  name: z.string().trim().min(1).max(100),
  // Buyer must leave at least one working contact channel:
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  // Honeypot — bots fill every field; humans never see this one.
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  // Tight per-IP rate limit: this is an anonymous write endpoint.
  const limited = enforceRateLimit(req, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { parcelId, parcelTitle, name, email, phone, message } = parsed.data;
  if (!email && !(phone && phone.trim())) {
    return NextResponse.json({ error: "Provide an email or phone number" }, { status: 400 });
  }

  const inquiry = {
    id: crypto.randomUUID(),
    parcel_id: parcelId,
    parcel_title: parcelTitle || "",
    name,
    email: email || "",
    phone: phone || "",
    message: message || "",
    status: "NEW",
    created_at: new Date().toISOString(),
  };

  // Durable path: Supabase `parcel_inquiries` (sql/parcel_inquiries.sql; RLS =
  // anon insert-only, service-role read). If the table doesn't exist yet or the
  // insert fails, buffer in-memory so the lead isn't lost this instant, and
  // tell the page (persisted:false) to ALSO push the WhatsApp/email fallback.
  let persisted = false;
  try {
    const s = supabaseAdmin();
    const { error } = await s.from("parcel_inquiries").insert({
      id: inquiry.id,
      parcel_id: inquiry.parcel_id,
      parcel_title: inquiry.parcel_title || null,
      name: inquiry.name,
      email: inquiry.email || null,
      phone: inquiry.phone || null,
      message: inquiry.message || null,
      status: "NEW",
    });
    if (!error) persisted = true;
  } catch {
    persisted = false;
  }
  if (!persisted) pushFallbackInquiry(inquiry);

  return NextResponse.json({ success: true, id: inquiry.id, persisted });
}
