import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api-guard";

const REGRID_TOKEN = process.env.REGRID_API_TOKEN || "";
const BASE = "https://app.regrid.com/api/v2";

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;

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

  let url = "";
  const headers = { Authorization: `Bearer ${REGRID_TOKEN}`, Accept: "application/json" };

  if (endpoint === "point") {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (!lat || !lng) return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
    url = `${BASE}/parcels/point?lat=${lat}&lon=${lng}&token=${REGRID_TOKEN}`;
  } else if (endpoint === "address") {
    const query = searchParams.get("query");
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
    url = `${BASE}/parcels/address?query=${encodeURIComponent(query)}&token=${REGRID_TOKEN}`;
  } else if (endpoint === "owner") {
    const owner = searchParams.get("owner");
    if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });
    url = `${BASE}/parcels/owner?owner=${encodeURIComponent(owner)}&token=${REGRID_TOKEN}`;
  } else {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
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
