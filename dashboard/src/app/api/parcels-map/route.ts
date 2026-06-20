import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { saneAcres, saneBid, medianPpa, intrinsicValue, DISCOUNT_CAP } from "@/lib/land-valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// PARCELS-MAP — ulusal harita için hafif, salt-okunur uç.
//
// tax_delinquent_properties tablosundaki KOORDINATLI tüm parselleri döndürür.
// Her parsel için, arbitraj radarındaki AYNI mantıkla (acres × county/state
// medyan $/acre, bulk-adjusted, outlier temizlenmiş) intrinsic değer hesaplanır
// ve min-bid'in altında işlem gören parseller "fırsat" (opp) olarak işaretlenir.
// Hiçbir değer uydurulmaz: acreage veya comp yoksa marj null kalır, parsel yine
// haritada gösterilir ama "fırsat" katmanına girmez.
//
// Payload'ı küçük tutmak için kısa alan adları kullanılır:
//   id, la(t), ln(g), st(ate), co(unty), ac(res), pr(ice/min-bid),
//   sc(ore final_score), mg (margin 0..1 | null), op (1 = fırsat), iv (intrinsic)
// ─────────────────────────────────────────────────────────────────────────────

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
const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").replace(/\(county n\/a\)/i, "").trim();

export interface MapParcel {
  id: string;
  ap: string | null; // apn — Cerberus tear-sheet linki için
  la: number; ln: number;
  st: string | null; co: string | null;
  ac: number | null;
  pr: number | null;
  sc: number | null;
  mg: number | null; // 0..1 marj, comp varsa
  iv: number | null; // intrinsic değer
  op: 0 | 1; // 1 = gerçek arbitraj fırsatı (intrinsic > price, marj eşiği geçti)
}

export interface MapSummary {
  total: number;        // tablodaki toplam parsel
  mapped: number;       // koordinatlı (haritada gösterilen)
  noCoords: number;     // koordinatsız (atlanan)
  states: number;       // benzersiz eyalet
  opportunities: number; // fırsat katmanındaki parsel
  valued: number;       // dürüstçe değer biçilebilen
  benchmarkAvailable: boolean;
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  // Fırsat eşiği: intrinsic değerin min-bid'e göre en az bu kadar üstünde olması.
  // Param yoksa varsayılan %25 (Number(null) === 0 tuzağından kaçınmak için
  // önce null kontrolü yapıyoruz).
  const rawGapParam = req.nextUrl.searchParams.get("minGap");
  const rawGap = rawGapParam == null ? NaN : Number(rawGapParam);
  const minGap = Number.isFinite(rawGap) ? Math.max(0, Math.min(100, rawGap)) : 25; // % indirim

  // 1) county + state median $/acre tabloları (outlier temizlenmiş) ----------
  const stateRates: Record<string, number> = {};
  const countyRates: Record<string, number> = {};
  let benchmarkAvailable = false;
  try {
    const { data } = await s.from("competitor_listings").select("state,county,price,acres");
    const byState: Record<string, { price: unknown; acres: unknown }[]> = {};
    const byCounty: Record<string, { price: unknown; acres: unknown }[]> = {};
    for (const r of (data as { state: string; county: string; price: number; acres: number }[]) || []) {
      const st = normState(r.state);
      if (!st) continue;
      (byState[st] ||= []).push({ price: r.price, acres: r.acres });
      const cty = normCounty(r.county);
      if (cty) (byCounty[`${st}/${cty}`] ||= []).push({ price: r.price, acres: r.acres });
    }
    for (const [k, arr] of Object.entries(byState)) { const m = medianPpa(arr); if (m) stateRates[k] = m; }
    for (const [k, arr] of Object.entries(byCounty)) { const m = medianPpa(arr); if (m) countyRates[k] = m; }
    benchmarkAvailable = Object.keys(stateRates).length > 0;
  } catch { /* graceful */ }

  // 2) tüm koordinatlı parselleri tara --------------------------------------
  const parcels: MapParcel[] = [];
  const stateSet = new Set<string>();
  let mapped = 0, valued = 0, opportunities = 0;

  try {
    let from = 0;
    for (;;) {
      const { data, error } = await s
        .from("tax_delinquent_properties")
        .select("id,apn,lat,lng,state,county,acres,minimum_bid,judgment_amount,final_score")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .range(from, from + 999);
      if (error) break;
      if (!data || data.length === 0) break;
      for (const r of data as Record<string, unknown>[]) {
        const la = Number(r.lat), ln = Number(r.lng);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
        // ABD ana kara + Alaska/Hawaii kabaca: sayı hatalarını ele
        if (la < 18 || la > 72 || ln < -180 || ln > -65) continue;
        mapped++;

        const st = normState(r.state as string);
        if (st) stateSet.add(st);
        const cty = normCounty(r.county as string);
        const acres = saneAcres(r.acres);
        const price = saneBid(r.minimum_bid) ?? saneBid(r.judgment_amount);

        const countyRate = st ? countyRates[`${st}/${cty}`] ?? null : null;
        const stateRate = st ? stateRates[st] ?? null : null;
        const { value: intrinsic } = intrinsicValue({ acres, countyRate, stateRate });

        let margin: number | null = null;
        let op: 0 | 1 = 0;
        if (intrinsic != null && price != null && price > 0) {
          valued++;
          if (intrinsic > price) {
            const rawDiscount = Math.round(((intrinsic - price) / intrinsic) * 100);
            const discountPct = Math.min(rawDiscount, DISCOUNT_CAP);
            margin = Math.max(0, Math.min(1, (intrinsic - price) / intrinsic));
            if (discountPct >= minGap) { op = 1; opportunities++; }
          } else {
            margin = 0;
          }
        }

        parcels.push({
          id: r.id as string,
          ap: (r.apn as string) ?? null,
          la: Math.round(la * 1e5) / 1e5,
          ln: Math.round(ln * 1e5) / 1e5,
          st: (r.state as string) ?? null,
          co: (r.county as string) ?? null,
          ac: acres,
          pr: price,
          sc: (r.final_score as number) ?? null,
          mg: margin == null ? null : Math.round(margin * 100) / 100,
          iv: intrinsic,
          op,
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch { /* graceful */ }

  // 3) toplam + koordinatsız sayımı (şeffaflık) -----------------------------
  let total = mapped;
  try {
    const { count } = await s.from("tax_delinquent_properties").select("*", { count: "exact", head: true });
    if (typeof count === "number") total = count;
  } catch { /* graceful */ }

  const summary: MapSummary = {
    total,
    mapped,
    noCoords: Math.max(0, total - mapped),
    states: stateSet.size,
    opportunities,
    valued,
    benchmarkAvailable,
  };

  return NextResponse.json({ summary, parcels });
}
