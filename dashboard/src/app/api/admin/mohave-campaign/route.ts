import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import mohave from "@/data/mohave-offmarket.json";
import { buildCampaign, campaignToCsv, type CampaignFilter, type MohaveRow } from "@/lib/mohave-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE MEKTUP KAMPANYASI API — segment → sahip-dedupe → Lob-ready CSV.
// Kaynak: mohave-offmarket.json (gerçek county verisi). ?format=csv tam listeyi
// indirir; aksi halde özet + ilk 120 mektup önizlemesi döner. Admin-gated:
// est_offer içeren çıktı hiçbir public yüzeye gitmez.
// ─────────────────────────────────────────────────────────────────────────────

const ROWS = ((mohave as { rows?: MohaveRow[] }).rows ?? []) as MohaveRow[];

// Bölge listesi bir kez hesaplanır (filtre dropdown'u için).
const REGIONS = [...new Set(ROWS.map((r) => (r.region || "").trim()).filter(Boolean))].sort();

const numParam = (v: string | null): number | undefined => {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("ownerScope");
  const filter: CampaignFilter = {
    region: sp.get("region") || undefined,
    minAcres: numParam(sp.get("minAcres")),
    maxAcres: numParam(sp.get("maxAcres")),
    maxLandValue: numParam(sp.get("maxLandValue")),
    minScore: numParam(sp.get("minScore")),
    ownerScope: scope === "absentee" || scope === "instate" ? scope : "all",
    minParcels: numParam(sp.get("minParcels")),
  };

  const c = buildCampaign(ROWS, filter);

  if (sp.get("format") === "csv") {
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(campaignToCsv(c.letters), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mohave-kampanya-${stamp}-${c.letters.length}mektup.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    summary: {
      letters: c.letters.length,
      parcels: c.parcels,
      totalAcres: Math.round(c.totalAcres * 10) / 10,
      totalOffer: Math.round(c.totalOffer),
      skippedNoAddress: c.skippedNoAddress,
      sourceRows: ROWS.length,
    },
    regions: REGIONS,
    preview: c.letters.slice(0, 120),
  });
}
