import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DealHound 🐕 — the mega scraper. Each "hound" is a mini-bot feeding the
// acquisition pipeline. Stats are live from Supabase.
const TDP = "tax_delinquent_properties";

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  const countWhere = async (table: string, apply?: (q: any) => any) => {
    let q = s.from(table).select("*", { count: "exact", head: true });
    if (apply) q = apply(q);
    const { count } = await q;
    return count ?? 0;
  };

  // distinct states + last run for a source pattern
  const meta = async (pattern: string | null) => {
    const states = new Set<string>();
    let last: string | null = null;
    let from = 0;
    for (;;) {
      let q = s.from(TDP).select("state,scraped_at").range(from, from + 999);
      if (pattern) q = q.like("source", pattern);
      const { data } = await q;
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (r.state && r.state !== "Unknown") states.add(r.state);
        if (r.scraped_at && (!last || r.scraped_at > last)) last = r.scraped_at;
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    return { states: states.size, last };
  };

  // last scrape timestamp for competitor table
  const compLast = async () => {
    const { data } = await s.from("competitor_listings").select("scraped_at").order("scraped_at", { ascending: false }).limit(1);
    return data?.[0]?.scraped_at ?? null;
  };

  const [txCount, natCount, zilCount, compCount, ddCount, calCount] = await Promise.all([
    countWhere(TDP, (q) => q.like("source", "TAX:%")),
    countWhere(TDP, (q) => q.like("source", "SOCRATA:%")),
    countWhere(TDP, (q) => q.like("source", "ZILLOW%")),
    countWhere("competitor_listings"),
    countWhere(TDP, (q) => q.eq("dd_checked", true)),
    countWhere("upcoming_sales"),
  ]);
  // distinct states + last for the calendar
  let calStates = new Set<string>(); let calLast: string | null = null;
  {
    const { data } = await s.from("upcoming_sales").select("state,scraped_at");
    for (const r of data || []) { if (r.state) calStates.add(r.state); if (r.scraped_at && (!calLast || r.scraped_at > calLast)) calLast = r.scraped_at; }
  }
  const [txM, natM, zilM, cLast] = await Promise.all([meta("TAX:%"), meta("SOCRATA:%"), meta("ZILLOW%"), compLast()]);

  const bots = [
    { name: "Tax · TX", role: "Texas vergi-icra satışları (LGBS · MVBA · PBFCM)", count: txCount, states: txM.states, last: txM.last, kind: "tax" },
    { name: "National", role: "Ulusal açık-veri (Socrata, çok eyalet)", count: natCount, states: natM.states, last: natM.last, kind: "national" },
    { name: "Zillow", role: "Zillow arazi ilanları (RapidAPI)", count: zilCount, states: zilM.states, last: zilM.last, kind: "retail" },
    { name: "Competitor", role: "Rakip retail (Discount Lots · Rina · Landio)", count: compCount, states: 0, last: cLast, kind: "comp" },
    { name: "Takvim", role: "Yaklaşan satışlar (GovEase, ulusal)", count: calCount, states: calStates.size, last: calLast, kind: "calendar" },
    { name: "Due Diligence", role: "Yol / sel / landlocked taraması", count: ddCount, states: 0, last: null, kind: "dd" },
  ];

  const lastRun = bots.map((b) => b.last).filter(Boolean).sort().reverse()[0] || null;

  return NextResponse.json({
    brand: "Cerberus",
    tagline: "Üç başlı bekçi — tüm ABD'yi tarayan deal motoru",
    totalLeads: txCount + natCount + zilCount,
    lastRun,
    bots,
  });
}
