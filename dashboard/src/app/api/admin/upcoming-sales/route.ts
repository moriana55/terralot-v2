import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarded service-role access to the RLS-protected `upcoming_sales` table.
// Two views:
//   default          → geo points with coords (admin/deal-map)
//   ?view=calendar   → full upcoming tax-sale list, grouped by month (admin/scraper takvim)
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const view = req.nextUrl.searchParams.get("view");

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    // Honest "source not connected" rather than a crash/blank.
    return NextResponse.json(
      { sales: [], months: [], total: 0, lastScraped: null, error: "supabase_unconfigured" },
      { status: 200 }
    );
  }

  // ── Calendar view: full upcoming list grouped by month ──
  if (view === "calendar") {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await s
        .from("upcoming_sales")
        .select("id,state,county,sale_date,sale_type,parcel_list_url,registration_date,scraped_at")
        .gte("sale_date", today)
        .order("sale_date", { ascending: true })
        .limit(500);

      if (error) {
        return NextResponse.json(
          { sales: [], months: [], total: 0, lastScraped: null, error: error.message },
          { status: 200 }
        );
      }

      const rows = data ?? [];

      // Group by YYYY-MM for a clean month-by-month calendar.
      const monthMap = new Map<
        string,
        { month: string; label: string; count: number; sales: typeof rows }
      >();
      let lastScraped: string | null = null;
      for (const r of rows) {
        if (r.scraped_at && (!lastScraped || r.scraped_at > lastScraped)) lastScraped = r.scraped_at;
        if (!r.sale_date) continue;
        const key = r.sale_date.slice(0, 7); // YYYY-MM
        if (!monthMap.has(key)) {
          const d = new Date(key + "-01T00:00:00");
          const label = d.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
          monthMap.set(key, { month: key, label, count: 0, sales: [] });
        }
        const m = monthMap.get(key)!;
        m.count += 1;
        m.sales.push(r);
      }

      const months = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

      return NextResponse.json({
        sales: rows,
        months,
        total: rows.length,
        lastScraped,
      });
    } catch (e) {
      return NextResponse.json(
        { sales: [], months: [], total: 0, lastScraped: null, error: e instanceof Error ? e.message : "failed" },
        { status: 200 }
      );
    }
  }

  // ── Default: geo points for the deal map ──
  try {
    const { data, error } = await s
      .from("upcoming_sales")
      .select("id,county,state,sale_date,lat,lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(200);
    if (error) return NextResponse.json({ sales: [], error: error.message }, { status: 200 });
    return NextResponse.json({ sales: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { sales: [], error: e instanceof Error ? e.message : "failed" },
      { status: 200 }
    );
  }
}
