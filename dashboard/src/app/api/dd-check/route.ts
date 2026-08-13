import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { runDueDiligence } from "@/lib/due-diligence";

const coordSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const parsed = coordSchema.safeParse({
    lat: req.nextUrl.searchParams.get("lat"),
    lon: req.nextUrl.searchParams.get("lon"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "valid lat/lon required" }, { status: 400 });
  }

  return NextResponse.json(await runDueDiligence(parsed.data.lat, parsed.data.lon));
}
