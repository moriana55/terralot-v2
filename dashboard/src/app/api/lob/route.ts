import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { lobSchema, type LobInput } from "@/lib/lob-schema";
import { POSTCARD_FRONT_HTML } from "@/lib/mailer-data";

export const runtime = "nodejs";

const LOB_API_KEY = process.env.LOB_API_KEY;
const LOB_BASE = "https://api.lob.com/v1";

// ─────────────────────────────────────────────────────────────────────────────
// LOB DIRECT-MAIL PROXY (admin-only)
//
// SECURITY: This endpoint proxies to the paid Lob API (real money per letter).
// It MUST be admin-gated + rate-limited + input-validated. Previously it had
// none of these — any anonymous caller could send arbitrary JSON to Lob and
// burn the account. Now: requireGate (fail-closed), rate limit, and a zod
// discriminated union so only the three known actions with well-formed payloads
// reach the upstream API.
// ─────────────────────────────────────────────────────────────────────────────

// Şema src/lib/lob-schema.ts'e taşındı (node:test ile test edilebilsin diye).
// Postcard front/back artık max(10_000): Quick Send gövdesi back'ten geçer.

// Parse an upstream Lob response safely; returns a 502 if the body isn't JSON.
async function lobJson(res: Response): Promise<NextResponse> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Lob returned invalid JSON" }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.ok ? 200 : 400 });
}

function lobAuthHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

export async function POST(req: NextRequest) {
  // 1) admin gate (fail-closed) + rate limit — protects the paid upstream.
  const limited = enforceRateLimit(req, { limit: 20 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  // 2) validate input
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = lobSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body: LobInput = parsed.data;

  // 3) sandbox mock when no key — lets the demo run with zero spend.
  if (!LOB_API_KEY) {
    if (body.action === "send_letter") {
      return NextResponse.json({
        id: `ltr_${Math.random().toString(36).substring(2, 15)}`,
        description: body.description || "VegaLand Mock Offer Letter",
        to: body.to,
        from: body.from,
        url: "https://s3-us-west-2.amazonaws.com/assets.lob.com/letters/ltr_demo.pdf",
        expected_delivery_date: new Date(Date.now() + 5 * 86_400_000).toISOString().split("T")[0],
        status: "processed",
        sandbox: true,
      });
    }
    if (body.action === "send_postcard") {
      return NextResponse.json({
        id: `psc_${Math.random().toString(36).substring(2, 15)}`,
        description: body.description || "VegaLand Mock Postcard",
        to: body.to,
        from: body.from,
        url: "https://s3-us-west-2.amazonaws.com/assets.lob.com/postcards/psc_demo.pdf",
        expected_delivery_date: new Date(Date.now() + 4 * 86_400_000).toISOString().split("T")[0],
        status: "processed",
        sandbox: true,
      });
    }
    // verify_address
    return NextResponse.json({
      valid_address: true,
      components: {
        primary_number: "123",
        street_name: "MAIN",
        street_suffix: "ST",
        city: body.address.city || "Austin",
        state: body.address.state || "TX",
        zip_code: body.address.zip || "78701",
      },
      sandbox: true,
    });
  }

  // 4) real upstream calls (key present)
  if (body.action === "send_letter") {
    const { to, from, template, merge_variables } = body;
    const res = await fetch(`${LOB_BASE}/letters`, {
      method: "POST",
      headers: lobAuthHeaders(),
      body: JSON.stringify({
        description: `VegaLand - ${merge_variables?.county || "Land"} offer`,
        to: {
          name: to.name,
          address_line1: to.address_line1,
          address_city: to.city,
          address_state: to.state,
          address_zip: to.zip,
        },
        from: {
          name: from?.name || "VegaLand Acquisitions",
          address_line1: from?.address_line1 || "1234 Main St",
          address_city: from?.city || "Austin",
          address_state: from?.state || "TX",
          address_zip: from?.zip || "78701",
        },
        file: template,
        color: false,
        merge_variables,
      }),
    });
    return lobJson(res);
  }

  if (body.action === "send_postcard") {
    const { to, from, front, back, merge_variables } = body;
    const res = await fetch(`${LOB_BASE}/postcards`, {
      method: "POST",
      headers: lobAuthHeaders(),
      body: JSON.stringify({
        description: `VegaLand postcard - ${merge_variables?.county || "Land"}`,
        to: {
          name: to.name,
          address_line1: to.address_line1,
          address_city: to.city,
          address_state: to.state,
          address_zip: to.zip,
        },
        from: {
          name: from?.name || "VegaLand Acquisitions",
          address_line1: from?.address_line1 || "1234 Main St",
          address_city: from?.city || "Austin",
          address_state: from?.state || "TX",
          address_zip: from?.zip || "78701",
        },
        // Lob gerçek API'de postcard için front + back ZORUNLU. Quick Send
        // gövdeyi back'e koyar; front göndermeyen eski çağıranlar için markalı
        // varsayılan ön yüz devreye girer (istek sessizce içeriksiz gitmesin).
        front: front || POSTCARD_FRONT_HTML,
        back,
        size: "6x9",
        merge_variables,
      }),
    });
    return lobJson(res);
  }

  // verify_address
  const { address } = body;
  const res = await fetch(`${LOB_BASE}/us_verifications`, {
    method: "POST",
    headers: lobAuthHeaders(),
    body: JSON.stringify({
      primary_line: address.address_line1,
      city: address.city,
      state: address.state,
      zip_code: address.zip,
    }),
  });
  return lobJson(res);
}
