import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { loadTracked } from "@/lib/rakip-radar-store";
import {
  competitorStats,
  ppaHistogram,
  radarSummary,
  verificationLinks,
  isSyntheticApn,
  daysBetween,
} from "@/lib/rakip-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/rakip-radar — radar ekranının tüm verisi:
// izlenen ilanlar (DOM + fiyat geçmişi), özet kartlar, rakip performansı,
// $/acre histogramı ve son diff olayları. Salt-okunur; snapshot almak için
// POST /api/admin/rakip-radar/refresh kullanılır.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const now = new Date();
  try {
    const s = supabaseAdmin();
    const tracked = await loadTracked(s);

    const [{ data: events }, { data: runs }] = await Promise.all([
      s.from("competitor_events").select("*").order("at", { ascending: false }).limit(200),
      s.from("competitor_snapshots").select("run_at").order("run_at", { ascending: false }).limit(1),
    ]);

    const listings = tracked
      .map((t) => ({
        ...t,
        dom:
          t.status === "ACTIVE" || t.status === "PENDING"
            ? daysBetween(t.first_seen, now)
            : t.dom_days,
        syntheticApn: isSyntheticApn(t.apn),
        links: verificationLinks(t),
      }))
      .sort((a, b) => {
        // Şüpheliler üstte (aksiyon gerekiyor), sonra aktifler DOM'a göre
        const rank = (s: string) =>
          s === "SUSPECTED_SOLD" ? 0 : s === "PENDING" ? 1 : s === "ACTIVE" ? 2 : s === "SOLD_VERIFIED" ? 3 : 4;
        return rank(a.status) - rank(b.status) || (b.dom ?? 0) - (a.dom ?? 0);
      });

    return NextResponse.json({
      summary: radarSummary(tracked, now),
      competitors: competitorStats(tracked),
      histogram: ppaHistogram(tracked, now),
      listings,
      events: events ?? [],
      lastRunAt: runs?.[0]?.run_at ?? null,
      trackedCount: tracked.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "failed",
        hint: "Tablolar yoksa: npx prisma db execute --file sql/rakip_radar.sql (bkz. README Rakip Radar bölümü)",
      },
      { status: 500 }
    );
  }
}
