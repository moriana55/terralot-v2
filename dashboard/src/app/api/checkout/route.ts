import { NextRequest, NextResponse } from "next/server";

// PARKED until real inventory + Stripe. This endpoint does NOT collect, store,
// or log card data (previous version logged plaintext card numbers — removed).
// It only validates interest; real payments will go through Stripe Checkout.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { propertyId, amount, buyerName, buyerEmail } = body || {};
  if (!propertyId || !amount || !buyerName || !buyerEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  // No card capture, no logging. Real flow: create a Stripe Checkout Session.
  return NextResponse.json({
    ok: false,
    pending: true,
    message: "Ödeme (Stripe) envanter aşamasında devreye alınacak. Kart verisi toplanmıyor.",
  });
}
