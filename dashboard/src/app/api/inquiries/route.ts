import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inquirySchema = z.object({
  propertyId: z.string().trim().min(1).max(200),
  propertyTitle: z.string().trim().max(300).optional(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
});

const inquiries: Array<{
  id: string;
  propertyId: string;
  propertyTitle: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
}> = [];

export async function POST(req: NextRequest) {
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

  const inquiry = {
    id: crypto.randomUUID(),
    propertyId,
    propertyTitle: propertyTitle || "",
    name,
    email,
    phone: phone || "",
    message: message || "",
    status: "NEW",
    createdAt: new Date().toISOString(),
  };

  // Prefer durable storage in the Supabase `Inquiry` table (what admin/leads
  // reads). If Supabase is unconfigured or the insert fails (e.g. the propertyId
  // isn't in the Property table yet), fall back to the in-memory list so the
  // public form never breaks. We never surface fake success on a hard error.
  let persisted = false;
  try {
    const s = supabaseAdmin();
    const { error } = await s.from("Inquiry").insert({
      id: inquiry.id,
      propertyId,
      name,
      email,
      phone: phone || null,
      message: message || null,
      status: "NEW",
    });
    if (!error) persisted = true;
  } catch {
    persisted = false;
  }

  if (!persisted) inquiries.push(inquiry);

  return NextResponse.json({ success: true, id: inquiry.id, persisted });
}

export async function GET() {
  return NextResponse.json(inquiries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
}
