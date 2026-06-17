import { NextRequest, NextResponse } from "next/server";

const LOB_API_KEY = process.env.LOB_API_KEY;
const LOB_BASE = "https://api.lob.com/v1";

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

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { action } = body;

  if (!LOB_API_KEY) {
    // Return a mocked successful response for sandbox demonstration
    if (action === "send_letter") {
      return NextResponse.json({
        id: `ltr_${Math.random().toString(36).substring(2, 15)}`,
        description: body.description || "TerraLot Mock Offer Letter",
        to: body.to,
        from: body.from,
        url: "https://s3-us-west-2.amazonaws.com/assets.lob.com/letters/ltr_demo.pdf",
        expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "processed",
        sandbox: true
      });
    }
    if (action === "send_postcard") {
      return NextResponse.json({
        id: `psc_${Math.random().toString(36).substring(2, 15)}`,
        description: body.description || "TerraLot Mock Postcard",
        to: body.to,
        from: body.from,
        url: "https://s3-us-west-2.amazonaws.com/assets.lob.com/postcards/psc_demo.pdf",
        expected_delivery_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "processed",
        sandbox: true
      });
    }
    if (action === "verify_address") {
      return NextResponse.json({
        valid_address: true,
        components: {
          primary_number: "123",
          street_name: "MAIN",
          street_suffix: "ST",
          city: body.address?.city || "Austin",
          state: body.address?.state || "TX",
          zip_code: body.address?.zip || "78701",
        },
        sandbox: true
      });
    }
  }

  if (action === "send_letter") {
    const { to, from, template, merge_variables } = body;

    const res = await fetch(`${LOB_BASE}/letters`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
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

  if (action === "send_postcard") {
    const { to, from, front, back, merge_variables } = body;

    const res = await fetch(`${LOB_BASE}/postcards`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
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

  if (action === "verify_address") {
    const { address } = body;

    const res = await fetch(`${LOB_BASE}/us_verifications`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        primary_line: address.address_line1,
        city: address.city,
        state: address.state,
        zip_code: address.zip,
      }),
    });

    return lobJson(res);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
