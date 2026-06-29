import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO SUMMARY — salt-okunur owner-facing KPI beslemesi.
//
// Üç honest sinyal döner:
//   1) Ham kaynak sayıları (offmarket_leads / tax_delinquent_properties) — head count.
//   2) deal_tracking pipeline funnel (stage bazlı) — VARSA gerçek; yoksa available:false.
//   3) Gerçekleşen (realized) sermaye/spread — yalnız deal_tracking'te
//      acquired_cost + sold_price DOLU satırlardan. Veri yoksa 0 / pipeline.
//
// KURALLAR: hiçbir değerleme/fiyat/teklif/spread mantığına dokunmaz. Sadece okur.
// Eksik tablo/kolonda çökmez (isMissing deseni, deal-tracking route ile aynı guard).
// ─────────────────────────────────────────────────────────────────────────────

function isMissing(msg?: string): boolean {
  return /schema cache|does not exist|could not find|relation|column/i.test(msg ?? "");
}

// Stage etiketleri acquisitions sayfasıyla birebir.
const STAGE_ORDER = ["new", "researching", "offer", "won", "owned", "listed", "sold", "dead"] as const;
const STAGE_LABELS: Record<string, string> = {
  new: "Yeni",
  researching: "Araştırılıyor",
  offer: "Teklif verildi",
  won: "Kazanıldı",
  owned: "Sahipli",
  listed: "Listede",
  sold: "Satıldı",
  dead: "Vazgeçildi",
};

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function headCount(
  s: ReturnType<typeof supabaseAdmin>,
  table: string
): Promise<{ count: number | null; missing: boolean }> {
  const { count, error } = await s.from(table).select("*", { count: "exact", head: true });
  if (error) return { count: null, missing: isMissing(error.message) };
  return { count: count ?? 0, missing: false };
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const notes: string[] = [];

  try {
    const s = supabaseAdmin();

    // 1) Ham kaynak sayıları (cheap head-count).
    const offmarket = await headCount(s, "offmarket_leads");
    if (offmarket.missing) notes.push("offmarket_leads tablosu yok.");
    const tax = await headCount(s, "tax_delinquent_properties");
    if (tax.missing) notes.push("tax_delinquent_properties tablosu yok.");

    // 2) deal_tracking pipeline funnel + realized/capital.
    const tracking = {
      available: false,
      totalTracked: 0,
      stages: [] as { stage: string; label: string; count: number }[],
      capitalDeployed: 0, // Σ acquired_cost (gerçekten sahip olunan parsellerin maliyeti)
      capitalDeals: 0,
      realizedSpread: 0, // Σ (sold_price − acquired_cost) — yalnız İKİSİ de dolu satır
      realizedDeals: 0,
      listedValue: 0, // Σ list_price (listede ama henüz satılmamış)
    };

    const { data, error } = await s
      .from("deal_tracking")
      .select("stage,acquired_cost,list_price,sold_price");

    if (error) {
      if (isMissing(error.message)) notes.push("deal_tracking tablosu yok — pipeline verisi henüz yok.");
      else notes.push(`deal_tracking okunamadı: ${error.message}`);
    } else {
      tracking.available = true;
      const stageCount = new Map<string, number>();
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        tracking.totalTracked++;
        const stage = String(row.stage || "new");
        stageCount.set(stage, (stageCount.get(stage) || 0) + 1);

        const acq = num(row.acquired_cost);
        const sold = num(row.sold_price);
        const list = num(row.list_price);
        if (acq != null && acq > 0) {
          tracking.capitalDeployed += acq;
          tracking.capitalDeals++;
        }
        if (acq != null && sold != null && sold > 0) {
          tracking.realizedSpread += sold - acq;
          tracking.realizedDeals++;
        }
        if (list != null && list > 0 && sold == null) {
          tracking.listedValue += list;
        }
      }
      // Bilinen stage'leri sabit sırada, bilinmeyenleri sona ekle.
      const seen = new Set<string>();
      for (const k of STAGE_ORDER) {
        if (stageCount.has(k)) {
          tracking.stages.push({ stage: k, label: STAGE_LABELS[k] ?? k, count: stageCount.get(k)! });
          seen.add(k);
        }
      }
      for (const [k, c] of stageCount) {
        if (!seen.has(k)) tracking.stages.push({ stage: k, label: STAGE_LABELS[k] ?? k, count: c });
      }
      tracking.capitalDeployed = Math.round(tracking.capitalDeployed);
      tracking.realizedSpread = Math.round(tracking.realizedSpread);
      tracking.listedValue = Math.round(tracking.listedValue);
    }

    return NextResponse.json({
      offmarketCount: offmarket.count,
      taxCount: tax.count,
      tracking,
      notes,
    });
  } catch (e) {
    return NextResponse.json(
      {
        offmarketCount: null,
        taxCount: null,
        tracking: { available: false, totalTracked: 0, stages: [], capitalDeployed: 0, capitalDeals: 0, realizedSpread: 0, realizedDeals: 0, listedValue: 0 },
        notes: [e instanceof Error ? e.message : "portfolio-summary failed"],
      },
      { status: 200 }
    );
  }
}
