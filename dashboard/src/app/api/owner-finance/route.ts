import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { monthlyPayment } from "@/lib/flip-calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OWNER-FINANCE MARKETPLACE — guarded CRUD-lite over owner_finance_listings.
//
//   GET    /api/owner-finance                 → all listings (admin)
//   GET    /api/owner-finance?status=active   → filter by status (public-ish view)
//   POST   /api/owner-finance                 → create  { ...fields }
//   POST   /api/owner-finance  { id, ...patch, _action:"update" }  → update
//   POST   /api/owner-finance  { id, _action:"delete" }            → delete
//   POST   /api/owner-finance  { _action:"screen", ... }           → credit STUB
//
// The monthly_payment is computed server-side from price/down/apr/term so the
// stored value always matches the canonical flip-calc amortization formula.
// Returns empty list gracefully if the table doesn't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

interface ListingInput {
  parcel_ref?: string | null;
  title?: string | null;
  state?: string | null;
  county?: string | null;
  acres?: number | null;
  price: number;
  down_payment?: number | null;
  down_pct?: number | null;
  apr?: number | null;
  term_months?: number | null;
  status?: string | null;
  description?: string | null;
}

function computeMonthly(i: ListingInput): number {
  const price = Number(i.price) || 0;
  const down = i.down_payment != null
    ? Number(i.down_payment)
    : i.down_pct != null
      ? price * (Number(i.down_pct) / 100)
      : 0;
  const financed = Math.max(0, price - down);
  return monthlyPayment(financed, Number(i.apr) || 0, Number(i.term_months) || 0);
}

// ── Rule-based credit screening STUB ──────────────────────────────────────────
// TODO: replace with a real bureau pull (Experian/Equifax/TransUnion via a
// CRA-compliant provider). For now we derive a 300–850-style score from the
// few self-reported inputs a buyer would give on an owner-finance application.
// This is NOT a credit decision — it's an internal pre-qualification heuristic.
interface ScreenInput {
  monthlyIncome?: number;     // gross monthly income ($)
  monthlyDebt?: number;       // existing monthly debt obligations ($)
  downAmount?: number;        // proposed down payment ($)
  price?: number;             // listing price ($)
  monthlyPaymentEst?: number; // proposed installment ($)
  yearsEmployed?: number;     // employment tenure (years)
  priorDefaults?: number;     // # of prior land-contract defaults (self-reported)
}
function screenCredit(s: ScreenInput) {
  const income = Math.max(0, s.monthlyIncome ?? 0);
  const debt = Math.max(0, s.monthlyDebt ?? 0);
  const pmt = Math.max(0, s.monthlyPaymentEst ?? 0);
  const price = Math.max(0, s.price ?? 0);
  const down = Math.max(0, s.downAmount ?? 0);

  // Debt-to-income AFTER the new payment (lower is better).
  const dti = income > 0 ? (debt + pmt) / income : 1;
  // Down payment ratio (higher is better).
  const downRatio = price > 0 ? down / price : 0;
  const tenure = Math.max(0, s.yearsEmployed ?? 0);
  const defaults = Math.max(0, s.priorDefaults ?? 0);

  // Start mid-band and adjust.
  let score = 600;
  // DTI: <0.28 great, >0.50 bad
  if (dti <= 0.28) score += 90;
  else if (dti <= 0.36) score += 50;
  else if (dti <= 0.43) score += 10;
  else if (dti <= 0.5) score -= 40;
  else score -= 110;
  // Down payment: >=20% strong skin-in-the-game
  if (downRatio >= 0.2) score += 70;
  else if (downRatio >= 0.1) score += 30;
  else if (downRatio >= 0.05) score += 5;
  else score -= 30;
  // Tenure
  score += Math.min(40, tenure * 8);
  // Prior defaults are heavily penalized
  score -= defaults * 80;

  score = Math.max(300, Math.min(850, Math.round(score)));
  const tier =
    score >= 720 ? "EXCELLENT" : score >= 660 ? "GOOD" : score >= 600 ? "FAIR" : "SUBPRIME";
  const decision =
    score >= 660 ? "APPROVE" : score >= 600 ? "REVIEW" : "DECLINE";

  const factors = [
    { label: "DTI (yeni ödeme dahil)", value: `${Math.round(dti * 100)}%`, ok: dti <= 0.43 },
    { label: "Peşinat oranı", value: `${Math.round(downRatio * 100)}%`, ok: downRatio >= 0.1 },
    { label: "İş tenür", value: `${tenure} yıl`, ok: tenure >= 1 },
    { label: "Geçmiş temerrüt", value: `${defaults}`, ok: defaults === 0 },
  ];

  return {
    score,
    tier,
    decision,
    factors,
    disclaimer:
      "STUB heuristik — gerçek kredi kararı DEĞİL. TODO: CRA-uyumlu bureau (Experian/Equifax) entegrasyonu.",
  };
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  // GET salt-okunur owner-finance vitrini içindir → PUBLIC (gate yok). Yalnızca
  // yayındaki (status=active) ilanlar çekilir; yazma uçları (POST) korumalı kalır.

  const status = req.nextUrl.searchParams.get("status");
  const s = supabaseAdmin();
  try {
    let q = s.from("owner_finance_listings").select("*").order("updated_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    // owner_finance_listings tablosu yoksa/boşsa → vitrini Property tablosundaki
    // gerçek AVAILABLE ilanlardan besle (her ilan zaten owner-finance şartlı:
    // downPayment + monthlyPayment + interestRate + term). Mock değil, gerçek
    // scraper-türevli envanter; sayfa boş kalmasın diye fallback.
    if (error || !data || data.length === 0) {
      const fb = await ownerFinanceFromProperty(s);
      return NextResponse.json({ listings: fb });
    }
    return NextResponse.json({ listings: data });
  } catch {
    try {
      const fb = await ownerFinanceFromProperty(supabaseAdmin());
      return NextResponse.json({ listings: fb });
    } catch {
      return NextResponse.json({ listings: [] });
    }
  }
}

// Property tablosundaki yayındaki (AVAILABLE) ilanları owner-finance vitrininin
// beklediği şekle (snake_case) çevirir. Uydurma seed kayıtları (kısa sayısal id)
// hariç tutulur — vitrinle aynı davranış.
async function ownerFinanceFromProperty(s: ReturnType<typeof supabaseAdmin>) {
  const { data } = await s
    .from("Property")
    .select("id,title,state,county,acres,price,downPayment,monthlyPayment,term,interestRate,description")
    .eq("status", "AVAILABLE")
    .order("featured", { ascending: false });
  type P = {
    id: string; title: string; state: string; county: string; acres: number;
    price: number; downPayment: number; monthlyPayment: number; term: number;
    interestRate: number; description: string;
  };
  return ((data ?? []) as P[])
    .filter((p) => !/^\d{1,2}$/.test(p.id))
    .map((p) => ({
      id: p.id,
      title: p.title,
      state: p.state,
      county: p.county,
      acres: p.acres,
      price: p.price,
      down_payment: p.downPayment,
      down_pct: p.price ? Math.round((p.downPayment / p.price) * 100) : null,
      apr: p.interestRate,
      term_months: p.term,
      monthly_payment: p.monthlyPayment,
      description: p.description,
    }));
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = (body._action as string) || "create";
  const s = supabaseAdmin();

  // Credit screening is pure-compute; no DB needed.
  if (action === "screen") {
    return NextResponse.json({ screening: screenCredit(body as ScreenInput) });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
      const { error } = await s.from("owner_finance_listings").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const input = body as unknown as ListingInput;
  if (input.price == null || Number.isNaN(Number(input.price))) {
    return NextResponse.json({ error: "price required" }, { status: 400 });
  }
  const monthly = computeMonthly(input);
  const record = {
    parcel_ref: input.parcel_ref ?? null,
    title: input.title ?? null,
    state: input.state ?? null,
    county: input.county ?? null,
    acres: input.acres ?? null,
    price: Number(input.price),
    down_payment: input.down_payment ?? null,
    down_pct: input.down_pct ?? null,
    apr: input.apr ?? null,
    term_months: input.term_months ?? null,
    monthly_payment: monthly,
    status: input.status ?? "draft",
    description: input.description ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    if (action === "update") {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const { data, error } = await s
        .from("owner_finance_listings")
        .update(record)
        .eq("id", body.id)
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ listing: data, monthly });
    }
    const { data, error } = await s
      .from("owner_finance_listings")
      .insert(record)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ listing: data, monthly });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
