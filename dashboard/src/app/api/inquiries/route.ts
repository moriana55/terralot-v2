import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { pushFallbackInquiry, fallbackInquiries } from "@/lib/parcel-inquiry-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── ESKİ UÇ, YENİ HEDEF ──────────────────────────────────────────────────────
// Bu uç eskiden Supabase `Inquiry` tablosuna yazıyordu. Talep hunisi tek tabloda
// (`parcel_inquiries`) birleştirildi; uç SİLİNMEDİ ki dışarıdaki eski
// entegrasyonlar/formlar kırılmasın — sadece hedefi değişti.
// propertyId → parcel_id, propertyTitle → parcel_title.
const SOURCES = ["p-sayfasi", "ilan-detay", "rezervasyon", "ana-sayfa-bulten", "landforever"] as const;

const inquirySchema = z.object({
  propertyId: z.string().trim().min(1).max(200),
  propertyTitle: z.string().trim().max(300).optional(),
  name: z.string().trim().min(1).max(100),
  // E-posta artık zorunlu değil: telefonla gelen lead de kabul edilir (en az biri şart).
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.enum(SOURCES).optional(),
  // Honeypot — botlar her alanı doldurur, insan bunu görmez.
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  // Public lead-capture endpoint (no auth by design). Rate-limit per IP so it
  // can't be used for spam / form-flooding.
  const limited = enforceRateLimit(req, { limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { propertyId, propertyTitle, name, email, phone, message } = parsed.data;
  const source = parsed.data.source ?? "ilan-detay";
  if (!email && !(phone && phone.trim())) {
    return NextResponse.json({ error: "Provide an email or phone number" }, { status: 400 });
  }

  const inquiry = {
    id: crypto.randomUUID(),
    parcel_id: propertyId,
    parcel_title: propertyTitle || "",
    name,
    email: email || "",
    phone: phone || "",
    message: message || "",
    status: "NEW",
    source,
    created_at: new Date().toISOString(),
  };

  // Kalıcı yol: Supabase `parcel_inquiries`. Başarısız olursa lead'i bellek-içi
  // tampona koy (admin ekranı "geçici" etiketiyle gösterir) — form asla sessizce
  // veri kaybetmesin. Sahte başarı dönmüyoruz: `persisted` alanı gerçeği söyler.
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

// Bellek-içi tampon SADECE kalıcılaşamayan (bozuk durum) lead'leri tutar ve PII
// içerir → herkese açık olamaz. Admin okuması /api/admin/parcel-inquiries'ten
// yapılır; burada da fail-closed bir gate var.
export async function GET(req: NextRequest) {
  const unauth = await requireGate(req);
  if (unauth) return unauth;
  return NextResponse.json(fallbackInquiries());
}
