import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cerberus 🐕 — the deal-hunting scraper fleet. Each "bot" is a mini-scraper
// feeding the acquisition pipeline. All stats are live from Supabase; anything
// without a real source is returned as an honest zero/empty (never fabricated).
const TDP = "tax_delinquent_properties";

// Per-bot coverage metadata (which counties / sources each bot hunts). This is
// configuration, not a metric — it describes what the bot is wired to scrape.
const COVERAGE: Record<string, string[]> = {
  tax: ["LGBS (TX)", "MVBA (TX)", "PBFCM (TX)"],
  national: ["Socrata open-data (multi-state)"],
  retail: ["Zillow land (RapidAPI)"],
  comp: ["Discount Lots", "Rina", "Landio"],
  calendar: ["GovEase (national)"],
  dd: ["Road / flood / landlocked enrich"],
};

const DAY_MS = 86_400_000;

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  try {
    const countWhere = async (table: string, apply?: (q: any) => any) => {
      let q = s.from(table).select("*", { count: "exact", head: true });
      if (apply) q = apply(q);
      const { count } = await q;
      return count ?? 0;
    };

    // distinct states + last run + 24h fresh count for a source pattern.
    // Bounded to MAX_PAGES so a very large table can't make this hang/timeout.
    const MAX_PAGES = 60; // 60k rows scanned worst-case
    const since24h = new Date(Date.now() - DAY_MS).toISOString();
    const meta = async (pattern: string | null) => {
      const states = new Set<string>();
      let last: string | null = null;
      let fresh24h = 0;
      let from = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        let q = s.from(TDP).select("state,scraped_at").range(from, from + 999);
        if (pattern) q = q.like("source", pattern);
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        for (const r of data) {
          if (r.state && r.state !== "Unknown") states.add(r.state);
          if (r.scraped_at && (!last || r.scraped_at > last)) last = r.scraped_at;
          if (r.scraped_at && r.scraped_at >= since24h) fresh24h++;
        }
        if (data.length < 1000) break;
        from += 1000;
      }
      return { states: states.size, last, fresh24h };
    };

    // last scrape timestamp + 24h count for competitor table
    const compMeta = async () => {
      const { data } = await s
        .from("competitor_listings")
        .select("scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(1000);
      let last: string | null = null;
      let fresh24h = 0;
      for (const r of data || []) {
        if (r.scraped_at && (!last || r.scraped_at > last)) last = r.scraped_at;
        if (r.scraped_at && r.scraped_at >= since24h) fresh24h++;
      }
      return { last, fresh24h };
    };

    const [txCount, natCount, zilCount, compCount, ddCount, calCount] = await Promise.all([
      countWhere(TDP, (q) => q.like("source", "TAX:%")),
      countWhere(TDP, (q) => q.like("source", "SOCRATA:%")),
      countWhere(TDP, (q) => q.like("source", "ZILLOW%")),
      countWhere("competitor_listings"),
      countWhere(TDP, (q) => q.eq("dd_checked", true)),
      countWhere("upcoming_sales"),
    ]);

    // distinct states + last + 24h for the calendar
    const calStates = new Set<string>();
    let calLast: string | null = null;
    let calFresh = 0;
    {
      const { data } = await s.from("upcoming_sales").select("state,scraped_at");
      for (const r of data || []) {
        if (r.state) calStates.add(r.state);
        if (r.scraped_at && (!calLast || r.scraped_at > calLast)) calLast = r.scraped_at;
        if (r.scraped_at && r.scraped_at >= since24h) calFresh++;
      }
    }

    const [txM, natM, zilM, compM] = await Promise.all([
      meta("TAX:%"),
      meta("SOCRATA:%"),
      meta("ZILLOW%"),
      compMeta(),
    ]);

    // Honest per-bot status from freshest timestamp.
    const statusOf = (iso: string | null): string => {
      if (!iso) return "durağan";
      const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
      if (isNaN(h)) return "durağan";
      if (h < 30) return "canlı"; // nightly cron healthy
      if (h < 80) return "gecikmeli";
      return "durağan";
    };

    const bots = [
      {
        name: "Tax · TX",
        role: "Texas vergi-icra satışları (LGBS · MVBA · PBFCM)",
        count: txCount,
        states: txM.states,
        last: txM.last,
        fresh24h: txM.fresh24h,
        kind: "tax",
        status: statusOf(txM.last),
        coverage: COVERAGE.tax,
      },
      {
        name: "National",
        role: "Ulusal açık-veri (Socrata, çok eyalet)",
        count: natCount,
        states: natM.states,
        last: natM.last,
        fresh24h: natM.fresh24h,
        kind: "national",
        status: statusOf(natM.last),
        coverage: COVERAGE.national,
      },
      {
        name: "Zillow",
        role: "Zillow arazi ilanları (RapidAPI)",
        count: zilCount,
        states: zilM.states,
        last: zilM.last,
        fresh24h: zilM.fresh24h,
        kind: "retail",
        status: statusOf(zilM.last),
        coverage: COVERAGE.retail,
      },
      {
        name: "Competitor",
        role: "Rakip retail (Discount Lots · Rina · Landio)",
        count: compCount,
        states: 0,
        last: compM.last,
        fresh24h: compM.fresh24h,
        kind: "comp",
        status: statusOf(compM.last),
        coverage: COVERAGE.comp,
      },
      {
        name: "Takvim",
        role: "Yaklaşan satışlar (GovEase, ulusal)",
        count: calCount,
        states: calStates.size,
        last: calLast,
        fresh24h: calFresh,
        kind: "calendar",
        status: statusOf(calLast),
        coverage: COVERAGE.calendar,
      },
      {
        name: "Due Diligence",
        role: "Yol / sel / landlocked taraması",
        count: ddCount,
        states: 0,
        last: null, // DD enrich has no per-row scrape timestamp source yet
        fresh24h: 0,
        kind: "dd",
        status: ddCount > 0 ? "canlı" : "durağan",
        coverage: COVERAGE.dd,
      },
    ];

    const lastRun = bots.map((b) => b.last).filter(Boolean).sort().reverse()[0] || null;

    // Run history: last 14 days of lead-scrape volume, derived from real
    // scraped_at timestamps (honest — empty days show zero).
    const history = await buildHistory(s, since(14));

    // KPIs
    const totalLeads = txCount + natCount + zilCount;
    const leads24h = bots.reduce((sum, b) => sum + (b.fresh24h || 0), 0);
    // Success rate = share of source-bots (excluding DD enrich) that are "canlı".
    const sourceBots = bots.filter((b) => b.kind !== "dd");
    const liveBots = sourceBots.filter((b) => b.status === "canlı").length;
    const successRate = sourceBots.length ? Math.round((liveBots / sourceBots.length) * 100) : 0;

    return NextResponse.json({
      brand: "Cerberus",
      tagline: "Üç başlı bekçi — tüm ABD'yi tarayan deal motoru",
      totalLeads,
      leads24h,
      successRate,
      lastRun,
      bots,
      history,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "fleet_query_failed", message: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}

function since(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

// Build a day-bucketed lead-volume history from tax_delinquent_properties.
async function buildHistory(s: any, sinceIso: string) {
  const buckets = new Map<string, number>();
  // seed the last 14 day keys so empty days render as zero (honest)
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(key, 0);
  }
  let from = 0;
  const MAX_PAGES = 60;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await s
      .from(TDP)
      .select("scraped_at")
      .gte("scraped_at", sinceIso)
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      if (!r.scraped_at) continue;
      const key = String(r.scraped_at).slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}
