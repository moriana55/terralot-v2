import { z } from "zod";

const LOB_BASE = "https://api.lob.com/v1";

const outreachLobSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send_letter"),
    to: z.object({
      name: z.string().trim().min(1).max(120),
      address_line1: z.string().trim().min(1).max(200),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(2).max(40),
      zip: z.string().trim().min(3).max(12),
    }),
    template: z.string().trim().max(200).optional(),
    description: z.string().trim().max(200).optional(),
    merge_variables: z.record(z.string().max(60), z.string().max(500)).optional(),
  }),
  z.object({
    action: z.literal("send_postcard"),
    to: z.object({
      name: z.string().trim().min(1).max(120),
      address_line1: z.string().trim().min(1).max(200),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(2).max(40),
      zip: z.string().trim().min(3).max(12),
    }),
    front: z.string().trim().max(200).optional(),
    back: z.string().trim().max(200).optional(),
    description: z.string().trim().max(200).optional(),
    merge_variables: z.record(z.string().max(60), z.string().max(500)).optional(),
  }),
]);

type OutreachLobInput = z.infer<typeof outreachLobSchema>;

export async function sendOutreachLob(raw: unknown): Promise<Record<string, unknown>> {
  const parsed = outreachLobSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid_lob_payload" };
  const body: OutreachLobInput = parsed.data;
  const apiKey = process.env.LOB_API_KEY;

  if (!apiKey) {
    const prefix = body.action === "send_postcard" ? "psc" : "ltr";
    return {
      id: `${prefix}_${crypto.randomUUID()}`,
      description: body.description || "TerraLot Mock Outreach",
      to: body.to,
      status: "processed",
      sandbox: true,
    };
  }

  const endpoint = body.action === "send_postcard" ? `${LOB_BASE}/postcards` : `${LOB_BASE}/letters`;
  const isPostcard = body.action === "send_postcard";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: body.description,
      to: {
        name: body.to.name,
        address_line1: body.to.address_line1,
        address_city: body.to.city,
        address_state: body.to.state,
        address_zip: body.to.zip,
      },
      from: {
        name: "TerraLot Acquisitions",
        address_line1: "1234 Main St",
        address_city: "Austin",
        address_state: "TX",
        address_zip: "78701",
      },
      ...(isPostcard
        ? { front: body.front, back: body.back, size: "6x9" }
        : { file: body.template, color: false }),
      merge_variables: body.merge_variables,
    }),
  });

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data) return { error: "Lob returned invalid JSON" };
  return response.ok ? data : { ...data, error: data.error || `Lob HTTP ${response.status}` };
}
