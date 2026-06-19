import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

const REGRID_TOKEN = process.env.REGRID_API_TOKEN || "";
const BASE = "https://app.regrid.com/api/v2";

// Validates only what the chosen endpoint needs. Coordinates are bounded numbers
// so they can't smuggle anything into the upstream URL; query/owner are length-
// capped strings (and URL-encoded below).
const regridSchema = z.object({
  endpoint: z.enum(["point", "address", "owner"]),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  query: z.string().trim().min(1).max(300).optional(),
  owner: z.string().trim().min(1).max(200).optional(),
});

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  // Admin-gated (no-op under Clerk). Proxies a paid/token'd upstream — must not
  // be anonymously reachable.
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get("endpoint");

  // Mock Sandbox Fallback if no token is configured
  if (!REGRID_TOKEN) {
    const mockLat = parseFloat(searchParams.get("lat") || "32.7767");
    const mockLng = parseFloat(searchParams.get("lng") || "-96.7970");
    const mockQuery = searchParams.get("query") || "104 Pinewood Dr, Dallas, TX";
    const mockOwner = searchParams.get("owner") || "Sarah J. Jenkins";

    // Create a square polygon around the coordinates
    const size = 0.003;
    const mockGeometry = {
      type: "Polygon",
      coordinates: [[
        [mockLng - size, mockLat - size],
        [mockLng + size, mockLat - size],
        [mockLng + size, mockLat + size],
        [mockLng - size, mockLat + size],
        [mockLng - size, mockLat - size]
      ]]
    };

    return NextResponse.json({
      type: "FeatureCollection",
      _mock: true, // REGRID_API_TOKEN yok → sahte örnek parsel (UI uyarı göstermeli)
      features: [
        {
          type: "Feature",
          geometry: mockGeometry,
          properties: {
            address: endpoint === "address" ? mockQuery : `${Math.floor(Math.random() * 800) + 100} Rural Route Rd, Socorro, NM`,
            city: endpoint === "address" ? "Dallas" : "Socorro",
            situs_city: "Socorro",
            state2: endpoint === "address" ? "TX" : "NM",
            situs_state: "NM",
            zip: "87801",
            situs_zip: "87801",
            owner: endpoint === "owner" ? `${mockOwner} (Absentee)` : `${mockOwner || "William H. Harrison"} (Absentee Owner)`,
            ll_gisacre: 12.4,
            gisacre: 12.4,
            market_value: 18500,
            zoning: "R-1 Rural Residential",
            usedesc: "Vacant Single Family Res",
            parcelnumb: `APN-${Math.floor(Math.random() * 800 + 100)}-NM-${Math.floor(Math.random() * 90 + 10)}`,
            ll_gissqft: 540144
          }
        }
      ]
    });
  }

  const parsed = regridSchema.safeParse({
    endpoint,
    lat: searchParams.get("lat") ?? undefined,
    lng: searchParams.get("lng") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    owner: searchParams.get("owner") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  let url = "";
  const headers = { Authorization: `Bearer ${REGRID_TOKEN}`, Accept: "application/json" };

  if (p.endpoint === "point") {
    if (p.lat == null || p.lng == null) return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
    url = `${BASE}/parcels/point?lat=${p.lat}&lon=${p.lng}&token=${encodeURIComponent(REGRID_TOKEN)}`;
  } else if (p.endpoint === "address") {
    if (!p.query) return NextResponse.json({ error: "query required" }, { status: 400 });
    url = `${BASE}/parcels/address?query=${encodeURIComponent(p.query)}&token=${encodeURIComponent(REGRID_TOKEN)}`;
  } else {
    if (!p.owner) return NextResponse.json({ error: "owner required" }, { status: 400 });
    url = `${BASE}/parcels/owner?owner=${encodeURIComponent(p.owner)}&token=${encodeURIComponent(REGRID_TOKEN)}`;
  }

  try {
    const res = await fetch(url, { headers });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return NextResponse.json({ error: "Upstream returned invalid JSON" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
