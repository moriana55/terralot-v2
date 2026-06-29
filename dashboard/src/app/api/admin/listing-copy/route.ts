import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { aiEnabled, aiNarrative } from "@/lib/ai-narrative";
import { regionPlaybook } from "@/lib/region-playbook";
import { buildFinancePlan, COMPASS_DEFAULT } from "@/lib/owner-finance";
import { buildListingCopy, type ListingCopy, type ListingFinance } from "@/lib/listing-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// SATILIK İLAN METNİ ÜRETECİ — /api/admin/listing-copy
//
// Bir parselin GERÇEK sinyallerini alır ve satışa-hazır, bölgeye-uygun ilan
// metni döner: { title, description, bullets }. Admin-gated + rate-limited
// (diğer admin route'lar gibi).
//
// İKİ KATMAN (underwrite/buildability ile aynı desen):
//   1) DETERMINISTIK ŞABLON (lib/listing-copy) — OPENAI_API_KEY OLMADAN çalışır.
//      Gerçek deal verisini LANDiO-tarzı metne döker; region-playbook'tan dürüst
//      zoning/izin şerhini taşır; finans verisi varsa owner-finance presetinden
//      "$X down / $Y/mo / no credit check" satırı ekler.
//   2) AI CİLASI — OPENAI_API_KEY varsa modeli aynı şablonu cilalaması için
//      çağırır (strict JSON ister). Parse/çağrı başarısızsa → şablona düşer.
//
// DÜRÜSTLÜK: metin TASLAK; yayınlamadan gözden geçir. Zone/izin alıcıya
// doğrulatılır (region-playbook'un CONFIRM şerhi). Uydurma rakam yok — finans
// satırı yalnızca marketValue/finance verisi varsa çıkar.
// ─────────────────────────────────────────────────────────────────────────────

const schema = z.object({
  acres: z.coerce.number().finite().nonnegative().max(1_000_000).nullish(),
  county: z.string().trim().max(120).nullish(),
  state: z.string().trim().max(60).nullish(),
  region: z.string().trim().max(120).nullish(),
  situs: z.string().trim().max(300).nullish(),
  marketValue: z.coerce.number().finite().nonnegative().max(1_000_000_000).nullish(),
  nearestCity: z.string().trim().max(120).nullish(),
  nearestRoad: z.string().trim().max(160).nullish(),
  // Opsiyonel açık owner-finance şartı; verilmezse marketValue'dan Compass preset türetilir.
  downUsd: z.coerce.number().finite().nonnegative().max(1_000_000_000).nullish(),
  monthly: z.coerce.number().finite().nonnegative().max(10_000_000).nullish(),
  termMonths: z.coerce.number().int().positive().max(600).nullish(),
  ratePct: z.coerce.number().finite().nonnegative().max(100).nullish(),
  downPct: z.coerce.number().finite().min(0).max(100).nullish(),
  // finans satırlarını tamamen kapatmak isteyen çağıran için.
  noFinance: z.coerce.boolean().nullish(),
});

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const raw = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  // Bölge satış-açısı + dürüst zoning/izin şerhi (eşleşme yoksa güvenli default).
  const pb = regionPlaybook({
    state: b.state ?? null,
    county: b.county ?? null,
    region: b.region ?? b.county ?? null,
    address: b.situs ?? null,
  });

  // Owner-finance şartı: açık alanlar > marketValue'dan Compass preset.
  // UYDURMA YOK: hiçbir finans sinyali yoksa plan null → finans satırı çıkmaz.
  let finance: ListingFinance | null = null;
  if (!b.noFinance) {
    if (b.downUsd != null || b.monthly != null) {
      finance = {
        down: b.downUsd ?? null,
        monthly: b.monthly ?? null,
        termMonths: b.termMonths ?? null,
        cashPrice: b.marketValue ?? null,
      };
    } else if (b.marketValue != null && b.marketValue > 0) {
      const plan = buildFinancePlan({
        salePrice: b.marketValue,
        annualRatePct: b.ratePct ?? COMPASS_DEFAULT.ratePct,
        termMonths: b.termMonths ?? COMPASS_DEFAULT.months,
        downPaymentPct: b.downPct ?? COMPASS_DEFAULT.downPaymentPct,
        cashPrice: b.marketValue,
      });
      if (plan) {
        finance = {
          down: plan.downPayment,
          monthly: plan.monthlyPayment,
          termMonths: plan.termMonths,
          cashPrice: b.marketValue,
        };
      }
    }
  }

  // 1) Deterministik şablon — her zaman üretir (AI'sız çalışan taban).
  const template = buildListingCopy(
    {
      acres: b.acres ?? null,
      county: b.county ?? null,
      state: b.state ?? null,
      situs: b.situs ?? null,
      marketValue: b.marketValue ?? null,
      nearestCity: b.nearestCity ?? null,
      nearestRoad: b.nearestRoad ?? null,
    },
    pb,
    finance,
  );

  // 2) AI cilası — yalnızca OPENAI_API_KEY varsa; başarısızsa şablona düşer.
  let listing: ListingCopy = template;
  let source: "ai" | "template" = "template";
  if (aiEnabled()) {
    const ai = await aiNarrative({
      maxTokens: 600,
      system:
        "You are a US raw-land listing copywriter (LANDiO / Discount Lots style). " +
        "Polish the given draft into a sell-ready listing. Keep ALL facts and the honest zoning/permitted-use caveat — do NOT invent acreage, prices, utilities, or legal claims. " +
        "Return STRICT JSON only: {\"title\": string, \"description\": string (~100-130 words), \"bullets\": string[] (4-7 short items)}. No markdown, no commentary.",
      prompt:
        `Region sales angle (for tone, do not copy verbatim): ${pb.salesAngle}\n` +
        `Permitted-use note to preserve: ${honestForPrompt(template)}\n\n` +
        `Draft to polish:\nTITLE: ${template.title}\nDESCRIPTION: ${template.description}\nBULLETS:\n- ${template.bullets.join("\n- ")}`,
    });
    const polished = ai ? safeParseListing(ai) : null;
    if (polished) {
      listing = polished;
      source = "ai";
    }
  }

  return NextResponse.json({
    listing,
    source,
    aiAvailable: aiEnabled(),
    region: pb.region,
    confidence: pb.confidence,
    matchBasis: pb.matchBasis,
    financeApplied: finance != null,
    // Dürüstlük: bu metin taslak — yayınlamadan gözden geçir; zone/izin alıcıya doğrulatılır.
    disclaimer: "Taslak metin — yayınlamadan gözden geçir. Zone/izin/POA kuralları alıcı tarafından county'den doğrulatılır.",
  });
}

// Şablonun teyit/izin cümlesini AI'a "bunu koru" diye taşımak için son cümleyi çek.
function honestForPrompt(t: ListingCopy): string {
  const parts = t.description.split(/(?<=\.)\s+/);
  const last = parts[parts.length - 1] || t.description;
  return last;
}

// AI çıktısını güvenli parse et: strict JSON bekleriz; ```json fence'i temizle.
function safeParseListing(text: string): ListingCopy | null {
  try {
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const obj = JSON.parse(t.slice(start, end + 1));
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    const bullets = Array.isArray(obj.bullets)
      ? obj.bullets.filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0).map((x: string) => x.trim())
      : [];
    if (!title || !description || bullets.length === 0) return null;
    return { title, description, bullets };
  } catch {
    return null;
  }
}
