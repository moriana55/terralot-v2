import { NextRequest, NextResponse } from "next/server";

const checkouts: Array<{
  id: string;
  propertyId: string;
  propertyTitle: string;
  amount: number;
  type: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  cardName: string;
  cardNumber: string;
  status: string;
  createdAt: string;
}> = [];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { 
    propertyId, propertyTitle, amount, type, 
    buyerName, buyerEmail, buyerPhone, cardName, cardNumber 
  } = body;

  if (!propertyId || !amount || !buyerName || !buyerEmail || !buyerPhone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create a smoke test checkout record
  const checkout = {
    id: crypto.randomUUID(),
    propertyId,
    propertyTitle: propertyTitle || "Unknown Parcel",
    amount,
    type, // "DOWN_PAYMENT" | "CASH_FULL"
    buyerName,
    buyerEmail,
    buyerPhone,
    cardName: cardName || "",
    cardNumber: cardNumber || "", // Masked credit card number from the front-end
    status: "HELD_PENDING_VERIFICATION",
    createdAt: new Date().toISOString(),
  };

  checkouts.push(checkout);

  // Print lead details in console for real-time monitoring
  console.log(`\n🔥 [SMOKE TEST LEAD CAPTURED] 🔥`);
  console.log(`👤 Name:       ${checkout.buyerName}`);
  console.log(`✉️ Email:      ${checkout.buyerEmail}`);
  console.log(`📞 Phone:      ${checkout.buyerPhone}`);
  console.log(`📍 Parcel:     ${checkout.propertyTitle} (ID: ${checkout.propertyId})`);
  console.log(`💰 Plan:       ${checkout.type} - Amount: $${checkout.amount}`);
  console.log(`🔒 Commitment: PLEDGED SECURE HOLD (No Card Input)`);
  console.log(`------------------------------------\n`);

  return NextResponse.json({ 
    success: true, 
    id: checkout.id,
    demo: true,
    message: "Lead successfully recorded in the smoke test database."
  });
}

export async function GET() {
  return NextResponse.json(checkouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
}
