import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { HOT_COUNTIES_CAP, HOT_STATES_CAP } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Counties ranked by opportunity heat: # of A-grade deals + megaproject + upcoming sale.
const CATALYST_COUNTIES = new Set([
  "AZ/MARICOPA", "OH/LICKING", "TX/WILLIAMSON", "NY/ONONDAGA", "TX/GRAYSON",
  "TN/HAYWOOD", "KY/HARDIN", "GA/BRYAN", "NC/RANDOLPH", "KS/JOHNSON",
  "GA/MORGAN", "TX/TAYLOR", "LA/RICHLAND",
]);
const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  // sweep deals
  const agg: Record<string, { state: string; county: string; total: number; aGrade: number; best: number }> = {};
  let from = 0;
  for (;;) {
    const { data } = await s.from("tax_delinquent_properties").select("state,county,final_score").range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (!r.state || !r.county) continue;
      const nc = normCounty(r.county);
      if (!nc || nc === r.state.toUpperCase()) continue; // skip unresolved (e.g. "MD (county n/a)")
      const key = `${r.state}/${nc}`;
      const a = (agg[key] ||= { state: r.state, county: normCounty(r.county), total: 0, aGrade: 0, best: 0 });
      a.total++;
      const sc = r.final_score ?? 0;
      if (sc >= 70) a.aGrade++;
      if (sc > a.best) a.best = sc;
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  // upcoming-sale counties
  const saleCounties = new Set<string>();
  const { data: sales } = await s.from("upcoming_sales").select("state,county");
  for (const r of sales || []) if (r.state && r.county) saleCounties.add(`${r.state}/${normCounty(r.county)}`);

  const counties = Object.values(agg).map((a) => {
    const hasCatalyst = CATALYST_COUNTIES.has(`${a.state}/${a.county}`);
    const hasSale = saleCounties.has(`${a.state}/${a.county}`);
    const heat = a.aGrade + (hasCatalyst ? 8 : 0) + (hasSale ? 4 : 0);
    return { ...a, hasCatalyst, hasSale, heat };
  }).sort((x, y) => y.heat - x.heat).slice(0, HOT_COUNTIES_CAP);

  // state-level rollup
  const st: Record<string, { state: string; total: number; aGrade: number; counties: number; catalysts: number }> = {};
  for (const a of Object.values(agg)) {
    const x = (st[a.state] ||= { state: a.state, total: 0, aGrade: 0, counties: 0, catalysts: 0 });
    x.total += a.total; x.aGrade += a.aGrade; x.counties++;
    if (CATALYST_COUNTIES.has(`${a.state}/${a.county}`)) x.catalysts++;
  }
  const states = Object.values(st).sort((a, b) => b.aGrade - a.aGrade || b.total - a.total).slice(0, HOT_STATES_CAP);

  return NextResponse.json({ counties, states });
}
