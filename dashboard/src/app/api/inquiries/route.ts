import { NextRequest, NextResponse } from "next/server";

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
  const body = await req.json();
  const { propertyId, propertyTitle, name, email, phone, message } = body;

  if (!name || !email || !propertyId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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

  inquiries.push(inquiry);

  return NextResponse.json({ success: true, id: inquiry.id });
}

export async function GET() {
  return NextResponse.json(inquiries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
}
