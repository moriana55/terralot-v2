import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

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

const addressTo = z.object({
  name: z.string().trim().min(1).max(120),
  address_line1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(40),
  zip: z.string().trim().min(3).max(12),
});

const addressFrom = z
  .object({
    name: z.string().trim().max(120).optional(),
    address_line1: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(40).optional(),
    zip: z.string().trim().max(12).optional(),
  })
  .optional();

// merge_variables: shallow record of short strings only (no nested objects /
// arrays / huge blobs reaching Lob).
const mergeVars = z.record(z.string().max(60), z.string().max(500)).optional();

const lobSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send_letter"),
    to: addressTo,
    from: addressFrom,
    template: z.string().trim().max(200).optional(),
    description: z.string().trim().max(200).optional(),
    merge_variables: mergeVars,
  }),
  z.object({
    action: z.literal("send_postcard"),
    to: addressTo,
    from: addressFrom,
    front: z.string().trim().max(200).optional(),
    back: z.string().trim().max(200).optional(),
    description: z.string().trim().max(200).optional(),
    merge_variables: mergeVars,
  }),
  z.object({
    action: z.literal("verify_address"),
    address: z.object({
      address_line1: z.string().trim().min(1).max(200),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(40).optional(),
      zip: z.string().trim().max(12).optional(),
    }),
  }),
]);

type LobInput = z.infer<typeof lobSchema>;

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
        description: body.description || "TerraLot Mock Offer Letter",
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
        description: body.description || "TerraLot Mock Postcard",
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
        description: `TerraLot - ${merge_variables?.county || "Land"} offer`,
        to: {
          name: to.name,
          address_line1: to.address_line1,
          address_city: to.city,
          address_state: to.state,
          address_zip: to.zip,
        },
        from: {
          name: from?.name || "TerraLot Acquisitions",
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
        description: `TerraLot postcard - ${merge_variables?.county || "Land"}`,
        to: {
          name: to.name,
          address_line1: to.address_line1,
          address_city: to.city,
          address_state: to.state,
          address_zip: to.zip,
        },
        from: {
          name: from?.name || "TerraLot Acquisitions",
          address_line1: from?.address_line1 || "1234 Main St",
          address_city: from?.city || "Austin",
          address_state: from?.state || "TX",
          address_zip: from?.zip || "78701",
        },
        front,
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
