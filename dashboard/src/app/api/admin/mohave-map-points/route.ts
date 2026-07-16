import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import mohave from "@/data/mohave-offmarket.json";
import {
  computeOwnerParcelCounts, computeRegionMedians, rankByOffmarketScore, scoreRowBreakdown,
  type ScoreRow,
} from "@/lib/mohave-score";
import { isGovOwner, selectTop750EligibleRows, type MohaveRow } from "@/lib/mohave-campaign";
import { isCorporateOrWhaleOwner } from "@/lib/whale-owners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE HARİTA NOKTA KATMANI — "⭐ En İyi 750" haritada nokta olarak gösterilsin
// diye 20K off-market lead'in LEAN (dar) sürümü. Ağır sahalar (situs, legal, vb.)
// atılır; sadece harita+popup+sepet için gereken alanlar döner. Skor + top750
// üyeliği TEK yerde (mohave-score.ts → rankByOffmarketScore) hesaplanır —
// mohave-campaign.ts'teki "En İyi 750" reçetesiyle AYNI sıralamayı paylaşır.
//
// KURUMSAL/BALİNA TEMİZLİĞİ (2026-07-13): top-750 penceresi artık kamu VE
// kurumsal/gizli-ağ sahipleri (whale-owners.ts) sıralamaya girmeden ELENEREK
// hesaplanır — mohave-campaign.ts#selectTop750EligibleRows ile AYNI havuz.
// Böylece haritadaki "⭐ Top-750" rozeti hiçbir zaman gerçekte mektup
// ATILAMAYACAK bir kurumsal parsele düşmez. Kurumsal satırlar haritada
// SİLİNMEZ (Havuz/Tümü katmanında görünür kalır) ama `isCorporate: true`
// bayrağıyla gri/ayrı işaretlenir ve top750 asla true olmaz.
// ─────────────────────────────────────────────────────────────────────────────

type RawRow = MohaveRow & { lat?: number; lng?: number; twn_rng_sec?: string; est_retail?: number; est_margin?: number };
const ROWS = ((mohave as { rows?: RawRow[] }).rows ?? []) as RawRow[];
const TOP_N = 750;

// Modül yüklenince BİR KEZ hesapla — 20K satırlık skor/medyan işini her istekte tekrar yapma.
const ELIGIBLE_FOR_TOP750 = selectTop750EligibleRows(ROWS) as RawRow[];
const RANKED_ELIGIBLE = rankByOffmarketScore(ELIGIBLE_FOR_TOP750 as ScoreRow[]);
const TOP750_APNS = new Set(RANKED_ELIGIBLE.slice(0, TOP_N).map((r) => String(r.apn ?? "")));
// Skor/breakdown TÜM satırlar için (kurumsal dahil) — harita "Tümü" katmanında
// görünürlüğünü sürdürsün, sadece top750 bayrağı ve mektup uygunluğu değişir.
const REGION_MEDIANS = computeRegionMedians(ROWS as ScoreRow[]);
const OWNER_COUNTS = computeOwnerParcelCounts(ROWS as ScoreRow[]);

export interface MohaveMapPoint {
  id: string;
  apn: string;
  lat: number;
  lng: number;
  owner: string;
  region: string;
  acres: number | null;
  landValue: number | null;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  score: number;
  top750: boolean;
  breakdown: { margin: number; size: number; demand: number; motivation: number };
  /** Township-Range-Section (county kaydı) — popup'ta "bunu nereden biliyorsun" doğrulaması için. */
  trs: string;
  estOffer: number | null;
  estRetail: number | null;
  estMargin: number | null;
  /** Kurumsal/kamu/balina-ağ sahibi mi (whale-owners.ts + isGovOwner) — true ise mektup hedefi DEĞİL. */
  isCorporate: boolean;
}

// Bir kez hesapla, her isteğe aynı diziyi dön (immutable, GC'ye nazik).
const POINTS: MohaveMapPoint[] = (() => {
  const out: MohaveMapPoint[] = [];
  for (const r of ROWS) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue; // koordinatsız satır haritada gösterilemez
    const bd = scoreRowBreakdown(r, REGION_MEDIANS, OWNER_COUNTS);
    const apn = String(r.apn ?? "");
    const estOffer = r.est_offer ?? null;
    const estRetail = r.est_retail ?? null;
    const estMargin = r.est_margin ?? (estOffer != null && estRetail != null ? estRetail - estOffer : null);
    out.push({
      id: apn || `${lat},${lng}`,
      apn,
      lat,
      lng,
      owner: r.owner ?? "",
      region: r.region ?? "",
      acres: r.acres ?? null,
      landValue: r.land_value ?? null,
      mailingAddress: r.mailing_address ?? "",
      mailingCity: r.mailing_city ?? "",
      mailingState: r.mailing_state ?? "",
      mailingZip: r.mailing_zip ?? "",
      score: bd.total,
      top750: TOP750_APNS.has(apn),
      breakdown: { margin: bd.margin, size: bd.size, demand: bd.demand, motivation: bd.motivation },
      trs: r.twn_rng_sec ?? "",
      estOffer,
      estRetail,
      estMargin,
      isCorporate: isGovOwner(r.owner) || isCorporateOrWhaleOwner(r.owner, r.mailing_address),
    });
  }
  return out;
})();

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: POINTS.length,
    top750Count: TOP750_APNS.size,
    corporateCount: POINTS.filter((p) => p.isCorporate).length,
    points: POINTS,
  });
}
