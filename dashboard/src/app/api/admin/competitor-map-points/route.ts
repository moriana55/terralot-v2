import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP İLAN NOKTALARI — /api/admin/competitor-map-points
// `competitor_listings` tablosundan GERÇEK koordinatlı (lat/lng dolu) rakip
// ilanlarını döner. Koordinatlar competitor-scraper-v2.mjs ile ilan
// sayfalarından/API'lerinden birebir alınır — yaklaşık/jitter konum YOK
// (eski /api/admin/competitor-map şehir-merkezi yaklaşımının aksine).
// Harita tarafında toggle kapalıyken bu route hiç çağrılmaz.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CompetitorMapPoint = {
  id: string;
  competitor: string;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  price: number | null;
  monthly_payment: number | null;
  raw_url: string | null;
  lat: number;
  lng: number;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("competitor_listings")
      .select("id,competitor,title,state,county,acres,price,monthly_payment,raw_url,lat,lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("competitor");
    if (error) throw error;

    const points = (data ?? []) as CompetitorMapPoint[];
    const byCompetitor: Record<string, number> = {};
    for (const p of points) byCompetitor[p.competitor] = (byCompetitor[p.competitor] ?? 0) + 1;

    return NextResponse.json(
      { points, meta: { total: points.length, byCompetitor } },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (e) {
    return NextResponse.json(
      { points: [], meta: { total: 0, byCompetitor: {} }, note: e instanceof Error ? e.message : "hata" },
      { status: 500 }
    );
  }
}
