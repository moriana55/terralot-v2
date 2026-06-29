import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { geocodeApprox } from "@/lib/geo-proximity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP İLANLARINI HARİTAYA — competitor_listings'te koordinat YOK (sadece
// state/county/city). geocodeApprox ile bilinen şehir merkezine yaklaşık oturtur,
// sonra aynı şehirdekiler üst üste binmesin diye küçük DETERMİNİSTİK jitter ekler.
// Konum parsel-kesin DEĞİL — "yaklaşık (şehir merkezi)" diye dürüst etiketli döner.
// ─────────────────────────────────────────────────────────────────────────────

// id'den deterministik küçük offset (~±1km) — her render aynı yer, üst üste binmez.
function jitter(id: string): { dLat: number; dLng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h >>> 0) % 1000) / 1000;       // 0..1
  const b = (((h >>> 10) >>> 0) % 1000) / 1000; // 0..1
  return { dLat: (a - 0.5) * 0.018, dLng: (b - 0.5) * 0.018 }; // ~±1km
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();
  try {
    const { data, error } = await s
      .from("competitor_listings")
      .select("id,competitor,title,state,county,acres,price,raw_url,scraped_at")
      .limit(2000);
    if (error) return NextResponse.json({ markers: [], total: 0, reason: "table unavailable" });

    const markers = (data || [])
      .map((r) => {
        const g = geocodeApprox(r.state, r.county, r.title);
        if (!g) return null; // bilinen şehre eşleşmeyen rakip ilanı haritada gösterilmez
        const j = jitter(r.id);
        return {
          id: r.id,
          competitor: r.competitor,
          title: r.title,
          acres: r.acres,
          price: r.price,
          rawUrl: r.raw_url,
          scrapedAt: r.scraped_at,
          lat: g.lat + j.dLat,
          lng: g.lng + j.dLng,
          matched: g.matched,
          approx: true,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      markers,
      total: markers.length,
      note: "Konum YAKLAŞIK (şehir merkezi + jitter) — parsel-kesin değil. Pazarda satış kanıtı.",
    });
  } catch {
    return NextResponse.json({ markers: [], total: 0 });
  }
}
