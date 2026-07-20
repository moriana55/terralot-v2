import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET BREAKDOWN — TEK GERÇEK KAYNAK (single source of truth).
// offmarket_leads tablosunun CANLI head-count'ları: toplam + 5 eyalet kırılımı.
// Tüm owner-facing ekranlar (Operasyon Özeti · Ulusal Fırsatlar · 5 Eyalet
// Haritası · Portföy) bu uçtan beslenir → rakamlar HER YERDE tutarlı, bayatlamaz.
// Sadece okur; değerleme/fiyat mantığına dokunmaz. Eksik tabloda çökmez.
// ─────────────────────────────────────────────────────────────────────────────

// Hedef eyaletler — harita renkleri/etiketleriyle birebir.
const STATES: { code: string; label: string; region: string; color: string }[] = [
  { code: "TX", label: "Texas", region: "Trans-Pecos + statewide", color: "#d97706" },
  { code: "FL", label: "Florida", region: "Charlotte + Highlands + statewide", color: "#7c3aed" },
  { code: "NM", label: "New Mexico", region: "Valencia + Luna", color: "#2563eb" },
  { code: "CO", label: "Colorado", region: "Costilla + Las Animas", color: "#dc2626" },
  { code: "AZ", label: "Arizona", region: "Mohave", color: "#059669" },
];

function isMissing(msg?: string): boolean {
  return /schema cache|does not exist|could not find|relation|column/i.test(msg ?? "");
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();

    // Toplam (state filtresiz) + eyalet başına head-count paralel.
    const totalP = s.from("offmarket_leads").select("state", { count: "exact", head: true });
    const stateP = STATES.map((st) =>
      s.from("offmarket_leads").select("state", { count: "exact", head: true }).eq("state", st.code)
    );
    const [totalRes, ...stateRes] = await Promise.all([totalP, ...stateP]);

    if (totalRes.error && isMissing(totalRes.error.message)) {
      return NextResponse.json(
        { total: null, byState: [], note: "offmarket_leads tablosu yok." },
        { status: 200 }
      );
    }

    const byState = STATES.map((st, i) => ({
      state: st.code,
      label: st.label,
      region: st.region,
      color: st.color,
      count: stateRes[i]?.count ?? 0,
    })).sort((a, b) => b.count - a.count);

    const total = totalRes.count ?? byState.reduce((s, x) => s + x.count, 0);

    return NextResponse.json({ total, byState, states: byState.length });
  } catch (e) {
    return NextResponse.json(
      { total: null, byState: [], note: e instanceof Error ? e.message : "offmarket-breakdown failed" },
      { status: 200 }
    );
  }
}
