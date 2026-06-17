import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  propertyId: z.string().trim().min(1).max(200),
  amount: z.number().positive().max(100_000_000),
  buyerName: z.string().trim().min(1).max(100),
  buyerEmail: z.string().trim().email().max(200),
});

// PARKED until real inventory + Stripe. This endpoint does NOT collect, store,
// or log card data (previous version logged plaintext card numbers — removed).
// It only validates interest; real payments will go through Stripe Checkout.
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  // No card capture, no logging. Real flow: create a Stripe Checkout Session.
  return NextResponse.json({
    ok: false,
    pending: true,
    message: "Ödeme (Stripe) envanter aşamasında devreye alınacak. Kart verisi toplanmıyor.",
  });
}
