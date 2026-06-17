import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { aiEnabled, aiNarrative } from "@/lib/ai-narrative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Input contract — coordinates bounded, strings length-capped, numbers finite.
// Identify a parcel by leadId OR supply manual fields. Coerced so JSON numbers
// or numeric strings both work; rejects junk with a 400 instead of crashing.
const buildabilitySchema = z.object({
  leadId: z.string().trim().min(1).max(100).optional(),
  acres: z.coerce.number().finite().nonnegative().max(1_000_000).optional(),
  state: z.string().trim().max(60).optional(),
  county: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  slopePct: z.coerce.number().finite().min(0).max(100).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// BUILDABILITY / ZONING AI
//
// Input (POST JSON): { leadId? } OR { acres?, state?, county?, lat?, lng? }
//
// Produces a buildability summary for raw land using rule-based heuristics +
// live dd-check (flood/road). Outputs:
//   • likely zoning class (heuristic by acreage + rural/urban proxy)
//   • subdivision potential (lot yield estimate from acreage)
//   • septic + well feasibility heuristics (acreage + flood + access)
//   • slope/flood from dd-check (slope from slope_pct column when available)
//   • a 0..100 buildability score + clearly-marked DATA GAPS
//
// Heuristics are explicit and conservative; nothing is presented as a survey.
// Optional AI narrative when OPENAI_API_KEY exists; deterministic otherwise.
//
// HEURISTIC RUBRIC (buildability 0..100):
//   access        30  road access (landlocked = 0; driveway/utility ingress)
//   flood         25  inverse FEMA flood risk (SFHA severely limits build)
//   slope         15  inverse slope (steep = costly grading)  [gap if unknown]
//   septicWell    20  parcel size vs min lot for on-site septic+well
//   size          10  usable acreage for a standard residential footprint
// ─────────────────────────────────────────────────────────────────────────────

const FULL2: Record<string, string> = {
  Texas: "TX", Florida: "FL", Georgia: "GA", Tennessee: "TN", "North Carolina": "NC",
  "New York": "NY", Arizona: "AZ", "New Mexico": "NM", Colorado: "CO", California: "CA",
  Arkansas: "AR", Nevada: "NV", Kentucky: "KY",
};
const abbr = (s: string | null): string | null => (!s ? null : /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : FULL2[s] ?? null);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Heuristic zoning class from acreage (rural raw-land typical bands).
function guessZoning(acres: number | null): { code: string; label: string } {
  if (acres == null) return { code: "UNKNOWN", label: "Bilinmiyor (county GIS doğrula)" };
  if (acres >= 40) return { code: "AG", label: "Tarım / Açık alan (büyük parsel)" };
  if (acres >= 10) return { code: "RR", label: "Kırsal yerleşim (Rural Residential)" };
  if (acres >= 2) return { code: "R1", label: "Düşük yoğunluklu konut" };
  if (acres >= 0.25) return { code: "R-SF", label: "Tekil konut lotu" };
  return { code: "R-INFILL", label: "Infill / küçük lot (kentsel)" };
}

// On-site septic + well typically needs ~0.5–1 acre minimum (varies by county/state).
function septicWellFeasibility(acres: number | null, floodScore: number | null): { ok: boolean; note: string; score: number } {
  if (acres == null) return { ok: false, note: "Parsel büyüklüğü bilinmiyor", score: 0.4 };
  if (acres < 0.25) return { ok: false, note: "Çok küçük — kanalizasyon/şebeke su şart olabilir", score: 0.15 };
  if (floodScore != null && floodScore >= 80) return { ok: false, note: "Sel bölgesi — septik saha izni zor", score: 0.2 };
  if (acres >= 1) return { ok: true, note: "Septik + kuyu için yeterli alan (perc testi gerekir)", score: 1 };
  return { ok: true, note: "Septik mümkün ama sınırda — county min lot ölçüsünü doğrula", score: 0.7 };
}

function subdivisionPotential(acres: number | null): { lots: number; note: string } {
  if (acres == null || acres < 2) return { lots: 1, note: "Bölünme potansiyeli düşük" };
  // conservative: assume ~1 lot per 1.25 acre for RR (roads/setbacks eat ~20%)
  const lots = Math.max(1, Math.floor((acres * 0.8) / 1.25));
  return { lots, note: lots > 1 ? `≈${lots} lota bölünebilir (kaba; plat onayı gerekir)` : "Bölünme sınırlı" };
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const raw = await req.json().catch(() => ({}));
  const parsed = buildabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const body = parsed.data;
  if (!body.leadId && body.acres == null && !(body.state && body.county)) {
    return NextResponse.json(
      { error: "missing_parcel", message: "leadId ya da (acres veya state+county) gerekli." },
      { status: 400 }
    );
  }
  const s = supabaseAdmin();

  let lead: Record<string, unknown> | null = null;
  if (body.leadId) {
    try {
      const { data } = await s.from("tax_delinquent_properties").select("*").eq("id", body.leadId).maybeSingle();
      lead = (data as Record<string, unknown>) ?? null;
    } catch { /* graceful */ }
  }

  const acres = (lead?.acres as number) ?? body.acres ?? null;
  const state = abbr((lead?.state as string) ?? body.state ?? null);
  const county = (lead?.county as string) ?? body.county ?? null;
  const lat = (lead?.lat as number) ?? body.lat ?? null;
  const lng = (lead?.lng as number) ?? body.lng ?? null;
  let slopePct = (lead?.slope_pct as number) ?? body.slopePct ?? null;
  let floodScore = (lead?.flood_score as number) ?? null;
  let roadAccess = (lead?.road_access as string) ?? null;

  const dataGaps: string[] = [];

  // live dd-check for flood + road
  if (lat && lng && (floodScore == null || roadAccess == null)) {
    try {
      const r = await fetch(`${req.nextUrl.origin}/api/dd-check?lat=${lat}&lon=${lng}`, {
        headers: { cookie: req.headers.get("cookie") || "" },
      });
      const j = await r.json();
      floodScore = floodScore ?? j?.flood?.riskScore ?? null;
      roadAccess = roadAccess ?? j?.road?.accessType ?? null;
    } catch { /* graceful */ }
  }
  if (floodScore == null) dataGaps.push("flood risk (no lat/lng or FEMA unavailable)");
  if (roadAccess == null) dataGaps.push("road access (no lat/lng)");
  if (slopePct == null) dataGaps.push("slope/topography (slope_pct not enriched)");
  if (acres == null) dataGaps.push("acreage");

  // ── Heuristic facets (0..1) ──
  const accessN = roadAccess === "direct" ? 1 : roadAccess === "near" ? 0.7 : roadAccess === "landlocked" ? 0 : 0.5;
  const floodN = floodScore == null ? 0.5 : clamp(1 - floodScore / 100, 0, 1);
  const slopeN = slopePct == null ? 0.6 : clamp(1 - slopePct / 30, 0, 1); // 0%→1, 30%+→0
  const sw = septicWellFeasibility(acres, floodScore);
  const sizeN = acres == null ? 0.4 : clamp(Math.min(1, acres / 1), 0, 1);

  const parts = {
    access: 30 * accessN,
    flood: 25 * floodN,
    slope: 15 * slopeN,
    septicWell: 20 * sw.score,
    size: 10 * sizeN,
  };
  let score = Math.round(parts.access + parts.flood + parts.slope + parts.septicWell + parts.size);
  if (roadAccess === "landlocked") score = Math.min(score, 35); // landlocked caps buildability
  score = clamp(score);

  const zoning = guessZoning(acres);
  const subdivision = subdivisionPotential(acres);

  const verdict = score >= 65 ? "Buildable" : score >= 45 ? "Conditional" : "Difficult";

  // narrative
  const det = `${county || "Parsel"}${state ? ", " + state : ""} (${acres ?? "?"} ac): inşa edilebilirlik ${score}/100 — ${verdict}. ` +
    `Olası imar: ${zoning.label} (${zoning.code}). ` +
    `${roadAccess === "landlocked" ? "⚠️ Landlocked — yol erişimi yok, bu en büyük engel. " : `Yol erişimi: ${roadAccess || "bilinmiyor"}. `}` +
    `${floodScore != null ? (floodScore >= 80 ? "Sel bölgesi — inşaat ciddi kısıtlı. " : "Sel riski düşük. ") : "Sel verisi yok. "}` +
    `${sw.note}. ${subdivision.note}. ` +
    (slopePct == null ? "Eğim verisi yok — DEM ile zenginleştir. " : `Eğim ~%${slopePct}. `) +
    "(Kural-tabanlı tahmin; resmi imar/perc testi yerine geçmez.)";

  let narrative = det;
  let narrativeSource: "ai" | "rule-based" = "rule-based";
  if (aiEnabled()) {
    const ai = await aiNarrative({
      system: "You are a land development feasibility analyst. Be concise (<110 words), practical, flag the biggest constraint first. No markdown headers.",
      prompt: `Assess raw-land buildability. Location: ${county || "?"}, ${state || "?"}, ${acres ?? "?"} acres. ` +
        `Likely zoning: ${zoning.code}. Road access: ${roadAccess || "unknown"}. Flood risk score: ${floodScore ?? "unknown"}/100. ` +
        `Slope: ${slopePct ?? "unknown"}%. Septic/well: ${sw.note}. Subdivision: ${subdivision.note}. Score ${score}/100 (${verdict}). ` +
        `Data gaps: ${dataGaps.join(", ") || "none"}. Give a practical buildability read for an investor.`,
    });
    if (ai) { narrative = ai; narrativeSource = "ai"; }
  }

  return NextResponse.json({
    resolved: !!lead?.id,
    parcel: { id: (lead?.id as string) ?? null, state, county, acres },
    score,
    verdict,
    zoning,
    subdivision,
    septicWell: { feasible: sw.ok, note: sw.note },
    signals: { roadAccess, floodScore, slopePct },
    reasons: [
      { label: "Yol erişimi", pts: Math.round(parts.access), note: roadAccess || "bilinmiyor" },
      { label: "Sel riski", pts: Math.round(parts.flood), note: floodScore == null ? "bilinmiyor" : floodScore >= 80 ? "yüksek" : "düşük" },
      { label: "Eğim", pts: Math.round(parts.slope), note: slopePct == null ? "bilinmiyor" : `%${slopePct}` },
      { label: "Septik/Kuyu", pts: Math.round(parts.septicWell), note: sw.note },
      { label: "Kullanılabilir alan", pts: Math.round(parts.size), note: acres == null ? "bilinmiyor" : `${acres} ac` },
    ],
    dataGaps,
    narrative,
    narrativeSource,
    aiAvailable: aiEnabled(),
  });
}
