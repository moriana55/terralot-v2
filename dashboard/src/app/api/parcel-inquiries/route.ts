import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/api-guard";
import { pushFallbackInquiry } from "@/lib/parcel-inquiry-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SİTENİN TEK TALEP HUNİSİ (public write). Buraya yazan formlar:
//   p-sayfasi        → /p/[id] alıcı sayfası
//   ilan-detay       → InquiryModal
//   rezervasyon      → ReserveModal
//   ana-sayfa-bulten → ana sayfa "New Listing Alerts"
//   landforever      → /landforever ilan e-postaları
// POST-only; burada hiç okuma yüzeyi yok — okuma sadece gated
// /api/admin/parcel-inquiries üzerinden yapılır.

export const SOURCES = [
  "p-sayfasi",
  "ilan-detay",
  "rezervasyon",
  "ana-sayfa-bulten",
  "landforever",
  "eski-inquiry",
] as const;

const schema = z.object({
  parcelId: z.string().trim().min(1).max(200),
  parcelTitle: z.string().trim().max(300).optional(),
  name: z.string().trim().min(1).max(100),
  // Buyer must leave at least one working contact channel:
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  // Hangi formdan geldi — gönderilmezse /p/[id] varsayılır (o form source yollamıyor).
  source: z.enum(SOURCES).optional(),
  // Honeypot — bots fill every field; humans never see this one.
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  // Per-IP rate limit: anonim yazma ucu. 5/dk ana sayfa bülteni + aynı IP'den
  // gelen birden fazla ilan formunu haksız yere kesiyordu; 15/dk hem insanı
  // rahat bırakır hem form-flood'u durdurur. Honeypot ayrıca korur.
  const limited = enforceRateLimit(req, { limit: 15, windowMs: 60_000 });
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
  const source = parsed.data.source ?? "p-sayfasi";
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
    source,
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
      source,
    });
    if (!error) persisted = true;
  } catch {
    persisted = false;
  }
  if (!persisted) pushFallbackInquiry(inquiry);

  return NextResponse.json({ success: true, id: inquiry.id, persisted });
}
