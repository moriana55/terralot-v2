import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real sourcing funnel: counties scanned -> records -> evaluable -> deal tiers.
export async function GET() {
  const s = supabaseAdmin();
  const TABLE = "tax_delinquent_properties";

  const count = async (apply?: (q: ReturnType<typeof base>) => unknown) => {
    const base = () => s.from(TABLE).select("*", { count: "exact", head: true });
    let q = base();
    if (apply) q = apply(q) as ReturnType<typeof base>;
    const { count } = await q;
    return count ?? 0;
  };

  const [total, evaluable, score45, score70, score90, struckOff, withOwner, taxCount] = await Promise.all([
    count(),
    count((q) => q.not("deal_score", "is", null).gt("deal_score", 0)),
    count((q) => q.gte("deal_score", 45)),
    count((q) => q.gte("deal_score", 70)),
    count((q) => q.gte("deal_score", 90)),
    count((q) => q.like("source", "%STRUCK%")),
    count((q) => q.not("owner_name", "is", null)),
    count((q) => q.like("source", "TAX:%")),
  ]);

  // Distinct counties/states via a light server-side sweep.
  const counties = new Set<string>();
  const states = new Set<string>();
  let from = 0;
  for (;;) {
    const { data } = await s.from(TABLE).select("county,state").range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.county) counties.add(`${r.state || ""}/${r.county}`);
      if (r.state) states.add(r.state);
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  return NextResponse.json({
    total,
    evaluable,
    states: states.size,
    counties: counties.size,
    taxCount,
    score45,
    score70,
    score90,
    struckOff,
    withOwner,
  });
}
