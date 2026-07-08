import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import {
  competitorLandscape,
  competitorSignals,
  likelySold,
  salesStats,
  type RawListing,
  type TrackedRow,
  type SaleRow,
} from "@/lib/competitor-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tablo henüz kurulmamışsa (migration uygulanmadıysa) sessizce boş dön —
// ekranın "manzara" kısmı yine competitor_listings'ten çalışsın.
function tableMissing(msg: string | undefined): boolean {
  return !!msg && /Could not find the table|does not exist|schema cache/i.test(msg);
}

// GET /api/admin/competitor-radar — üç kaynağı toplulaştırır:
//   • competitor_listings → rakip manzarası (hemen çalışır, ~291 satır)
//   • competitor_tracked  → satış sinyali (zamanla dolar; tablo yoksa boş)
//   • competitor_sales    → PropStream doğrulanmış satışlar (tablo yoksa boş)
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const now = new Date();
  const s = supabaseAdmin();
  const warnings: string[] = [];

  try {
    // 1) Ham ilanlar (manzara) — bu tablo mevcut kabul edilir.
    const listings: RawListing[] = [];
    {
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await s
          .from("competitor_listings")
          .select("competitor,title,state,county,acres,price")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`competitor_listings okunamadı: ${error.message}`);
        listings.push(...((data ?? []) as RawListing[]));
        if (!data || data.length < PAGE) break;
      }
    }

    // 2) İzlenen ilanlar (satış sinyali) — tablo yoksa graceful boş.
    let tracked: TrackedRow[] = [];
    {
      const { data, error } = await s
        .from("competitor_tracked")
        .select("listing_key,competitor,title,state,county,acres,first_seen,last_seen,current_price,status,disappeared_at,dom_days");
      if (error) {
        if (tableMissing(error.message)) warnings.push("competitor_tracked tablosu yok — satış sinyali için rakip-radar snapshot'ı gerekli (sql/rakip_radar.sql).");
        else warnings.push(`competitor_tracked: ${error.message}`);
      } else tracked = (data ?? []) as TrackedRow[];
    }

    // 3) PropStream doğrulanmış satışlar — tablo yoksa graceful boş.
    let sales: SaleRow[] = [];
    let salesInstalled = true;
    {
      const { data, error } = await s
        .from("competitor_sales")
        .select("competitor_name,price,acres,sale_date,state,county");
      if (error) {
        salesInstalled = false;
        if (tableMissing(error.message)) warnings.push("competitor_sales tablosu yok — PropStream import için sql/competitor_sales.sql uygula.");
        else warnings.push(`competitor_sales: ${error.message}`);
      } else sales = (data ?? []) as SaleRow[];
    }

    return NextResponse.json({
      landscape: competitorLandscape(listings),
      listingCount: listings.length,
      signals: competitorSignals(tracked, now),
      likelySold: likelySold(tracked),
      trackedCount: tracked.length,
      sales: salesStats(sales),
      salesCount: sales.length,
      salesInstalled,
      warnings,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "failed",
        hint: "competitor_listings okunamadı — Supabase env / RLS kontrol et.",
      },
      { status: 500 }
    );
  }
}
