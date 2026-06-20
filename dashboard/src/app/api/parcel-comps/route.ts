import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// RAW-LAND COMPS ENGINE
//
// GET /api/parcel-comps?state=TX&county=Grayson&acres=5
//
// Pulls comparable parcels from competitor_listings (and sold rows when the
// optional status/sold_price columns exist), filtered by:
//   • same state (required) + same county (preferred; falls back to state-only)
//   • acreage within ±30% of the subject (the band is configurable via ?band)
//
// Returns nearby comps with median $/acre, an acreage-adjusted subject value,
// the date range covered, and the comp count. Graceful empty state when the
// table/columns are missing or no comps match.
// ─────────────────────────────────────────────────────────────────────────────

const FULL: Record<string, string> = {
  alabama: "AL", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  florida: "FL", georgia: "GA", idaho: "ID", kentucky: "KY", louisiana: "LA",
  nevada: "NV", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  ohio: "OH", oklahoma: "OK", oregon: "OR", tennessee: "TN", texas: "TX", utah: "UT",
};
const ABBR = new Set(Object.values(FULL));
function normState(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Za-z]{2}$/.test(t) && ABBR.has(t.toUpperCase())) return t.toUpperCase();
  const low = t.toLowerCase();
  for (const [name, ab] of Object.entries(FULL)) if (low === name || low.startsWith(name + " ")) return ab;
  return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null;
}
const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").trim();
const median = (a: number[]) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const state = normState(sp.get("state"));
  const county = normCounty(sp.get("county"));
  const acres = Number(sp.get("acres") || "0");
  const band = Math.min(0.9, Math.max(0.1, Number(sp.get("band") || "0.30"))); // ±30% default

  if (!state) return NextResponse.json({ comps: [], summary: { count: 0, reason: "state required" } });

  const s = supabaseAdmin();

  interface RawComp {
    competitor?: string | null; title?: string | null; state?: string | null; county?: string | null;
    acres?: number | null; price?: number | null; status?: string | null; sold_price?: number | null;
    sold_date?: string | null; scraped_at?: string | null; created_at?: string | null; raw_url?: string | null;
  }

  let raw: RawComp[] = [];
  let hasSoldCols = true;
  try {
    // ÖNEMLİ: competitor_listings.state kirli ("FL" / "Florida" / "FL " hepsi var).
    // DB'de eq("state","FL") yapmak comp'ların büyük kısmını kaçırır; tüm satırları
    // çekip normState() ile normalize ederek eşleştiririz (underwrite/arbitrage ile tutarlı).
    const rich = await s.from("competitor_listings")
      .select("competitor,title,state,county,acres,price,status,sold_price,sold_date,scraped_at,created_at,raw_url")
      .gt("acres", 0).gt("price", 0).limit(5000);
    if (rich.error) {
      // columns may not exist yet → fall back to the base schema
      hasSoldCols = false;
      const fb = await s.from("competitor_listings")
        .select("competitor,title,state,county,acres,price,scraped_at,created_at,raw_url")
        .gt("acres", 0).gt("price", 0).limit(5000);
      raw = ((fb.data as RawComp[]) || []).filter((r) => normState(r.state ?? null) === state);
    } else {
      raw = ((rich.data as RawComp[]) || []).filter((r) => normState(r.state ?? null) === state);
    }
  } catch {
    return NextResponse.json({ comps: [], summary: { count: 0, reason: "table unavailable" } });
  }

  // acreage band filter (skip when no subject acreage given)
  const lo = acres > 0 ? acres * (1 - band) : 0;
  const hi = acres > 0 ? acres * (1 + band) : Infinity;

  const inCounty: RawComp[] = [];
  const inState: RawComp[] = [];
  for (const r of raw) {
    if (!(r.acres! >= lo && r.acres! <= hi)) continue;
    (normCounty(r.county ?? null) === county && county ? inCounty : inState).push(r);
  }
  // prefer county comps; widen to state when too few
  const scope = inCounty.length >= 3 ? "county" : "state";
  const pool = inCounty.length >= 3 ? inCounty : [...inCounty, ...inState];

  const comps = pool.map((r) => {
    const sold = hasSoldCols && (r.status === "sold" || r.sold_price);
    const effPrice = sold && r.sold_price ? r.sold_price : r.price!;
    const date = (sold && r.sold_date) || r.scraped_at || r.created_at || null;
    return {
      competitor: r.competitor ?? null,
      title: r.title ?? null,
      county: r.county ?? null,
      acres: r.acres!,
      price: effPrice,
      perAcre: Math.round(effPrice / r.acres!),
      sold: !!sold,
      date,
      rawUrl: r.raw_url ?? null,
    };
  }).sort((a, b) => a.perAcre - b.perAcre);

  const perAcreArr = comps.map((c) => c.perAcre);
  const medPerAcre = median(perAcreArr);
  const dates = comps.map((c) => c.date).filter(Boolean) as string[];
  dates.sort();

  const adjustedValue = medPerAcre != null && acres > 0 ? Math.round(medPerAcre * acres) : null;

  return NextResponse.json({
    comps: comps.slice(0, 40),
    summary: {
      count: comps.length,
      scope, // "county" | "state"
      band,
      medianPerAcre: medPerAcre,
      adjustedValue,
      soldCount: comps.filter((c) => c.sold).length,
      hasSoldData: hasSoldCols,
      dateRange: dates.length ? { from: dates[0]?.slice(0, 10), to: dates[dates.length - 1]?.slice(0, 10) } : null,
      subject: { state, county: county || null, acres: acres || null },
    },
  });
}
