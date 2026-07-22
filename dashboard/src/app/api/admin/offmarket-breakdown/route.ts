import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { OFFMARKET_STATES, OFFMARKET_STATE_META } from "@/lib/offmarket-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET BREAKDOWN — TEK GERÇEK KAYNAK (single source of truth).
// offmarket_leads tablosunun CANLI head-count'ları: toplam + eyalet kırılımı
// (aktif eyalet listesi lib/offmarket-stats.ts'ten gelir — burada kopya YOK).
// Tüm owner-facing ekranlar (Operasyon Özeti · Ulusal Fırsatlar · Eyalet
// Haritası · Portföy) bu uçtan beslenir → rakamlar HER YERDE tutarlı, bayatlamaz.
// Sadece okur; değerleme/fiyat mantığına dokunmaz. Eksik tabloda çökmez.
// ─────────────────────────────────────────────────────────────────────────────

// Hedef eyaletler — harita renkleri/etiketleriyle birebir (tek kaynaktan türetilir).
const STATES = OFFMARKET_STATES.map((code) => {
  const m = OFFMARKET_STATE_META[code];
  return { code: m.code as string, label: m.label, region: m.region, color: m.color };
});

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
