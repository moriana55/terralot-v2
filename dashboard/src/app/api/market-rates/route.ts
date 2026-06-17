import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Median retail $/acre per state from competitor listings — a real market
// benchmark to sanity-check assessed values. Only states with enough listings.
const FULL: Record<string, string> = {
  alabama: "AL", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new mexico": "NM", "new york": "NY", "north carolina": "NC", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "south carolina": "SC", tennessee: "TN",
  texas: "TX", utah: "UT", virginia: "VA", washington: "WA", wisconsin: "WI", wyoming: "WY",
};
const ABBR = new Set(Object.values(FULL));

function normState(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Za-z]{2}$/.test(t) && ABBR.has(t.toUpperCase())) return t.toUpperCase();
  const low = t.toLowerCase();
  for (const [name, ab] of Object.entries(FULL)) if (low === name || low.startsWith(name + " ")) return ab;
  return null;
}
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

  const s = supabaseAdmin();
  const { data } = await s.from("competitor_listings").select("state,price,acres");
  const by: Record<string, number[]> = {};
  for (const r of data || []) {
    const st = normState(r.state);
    if (st && r.price > 0 && r.acres > 0) (by[st] ||= []).push(r.price / r.acres);
  }
  const rates = Object.entries(by)
    .map(([state, arr]) => ({ state, perAcre: Math.round(median(arr) || 0), n: arr.length }))
    .filter((r) => r.n >= 3) // need a few listings to trust the median
    .sort((a, b) => b.n - a.n);
  return NextResponse.json({ rates });
}
