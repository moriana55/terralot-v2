import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { PRICING } from "@/lib/pricing";
import { regionPlaybook } from "@/lib/region-playbook";
import { mhEligibility, mhMailLine } from "@/lib/mh-eligibility";
import { afterSend, markResponded, CADENCE_TOTAL_STEPS } from "@/lib/cadence";

// outreach_cadence.sql uygulanmadan önce kadans kolonları yok olabilir; insert
// o kolonlarla patlarsa bu desenle tanıyıp kolonsuz tekrar deneriz (graceful).
function isMissingColumn(msg?: string | null): boolean {
  return /schema cache|does not exist|could not find|column/i.test(msg ?? "");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// ONE-CLICK OWNER OUTREACH
//
//   GET  /api/outreach?leadId=...   → recent outreach_events for a lead (+ history)
//   POST /api/outreach              → generate deal-sheet, send via Lob, log event
//        body: { leadId, channel?:"letter"|"postcard", type?:"offer", offerPct?, send?:true }
//
// Flow:
//   1. Load the lead from tax_delinquent_properties.
//   2. Build a deal-sheet (offer price from comp/min-bid math + merge vars).
//   3. If send=true, call the existing /api/lob route (letter|postcard). When
//      LOB_API_KEY is absent, /api/lob already returns a sandbox mock — we mark
//      the event status "mock" so the UI shows a clear preview + TODO.
//   4. Insert an outreach_events row (graceful if the table is missing).
// ─────────────────────────────────────────────────────────────────────────────

const FULL: Record<string, string> = {
  Texas: "TX", Florida: "FL", Georgia: "GA", Tennessee: "TN", "North Carolina": "NC",
  "New York": "NY", Arizona: "AZ", "New Mexico": "NM", Colorado: "CO", California: "CA",
  Arkansas: "AR", Nevada: "NV", Kentucky: "KY",
};
const abbr = (s: string | null): string | null => {
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return FULL[s] ?? null;
};
const normCounty = (c: string | null) => (c || "").toUpperCase().replace(/ COUNTY$/i, "").trim();

interface Lead {
  id: string;
  apn: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  minimum_bid: number | null;
  judgment_amount: number | null;
  final_score: number | null;
  owner_name: string | null;
  owner_address: string | null;
  property_address: string | null;
  market_value: number | null;
  land_value: number | null;
}

// Parse a free-text owner_address into Lob address components (best-effort).
function parseAddress(raw: string | null): { line1: string; city: string; state: string; zip: string } | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { line1: raw, city: "", state: "", zip: "" };
  const last = parts[parts.length - 1];
  const m = last.match(/([A-Z]{2})\s+(\d{5})/i);
  return {
    line1: parts[0],
    city: parts.length >= 3 ? parts[parts.length - 2] : "",
    state: m ? m[1].toUpperCase() : "",
    zip: m ? m[2] : "",
  };
}

// Build the blind-offer deal-sheet.
//
//   ROADMAP RULE (BUILD-PLANI-DEMO.md #3 / yol haritası):
//     offer = market_value × offerPct   where offerPct ∈ [15, 25]%.
//
//   We anchor the offer to the parcel's MARKET VALUE (Regrid/county assessed
//   land value — real data, never fabricated), not the tax-sale minimum bid.
//   That matches how land wholesalers actually pencil a blind offer: a small
//   fraction of resale value so there's room to flip / owner-finance.
//
//   `marketValueOverride` lets a caller (e.g. the cheap-land/[id] "Mektup at" or
//   "Owner-Finance ile Sat" flow) pass the deal's real marketValue/landValue
//   straight from cheap-land.json. When it's absent we fall back to the lead's
//   own market_value/land_value columns. If no market value is known at all we
//   return offerPrice=null and an honest "fair cash price" — we do NOT invent a
//   number off the min bid.
//   `useCodeOverride`: tax_delinquent_properties satırında assessor kullanım
//   kodu kolonu yok — caller (ör. ucuz-arsa detayından gelen akış) elindeki
//   useCode'u geçebilir; yoksa MH sinyali sadece bölge playbook'undan türer.
function buildDealSheet(
  lead: Lead,
  offerPct: number,
  marketValueOverride?: number | null,
  useCodeOverride?: string | null
) {
  const minBid = lead.minimum_bid ?? lead.judgment_amount ?? 0;
  const marketValue =
    (marketValueOverride && marketValueOverride > 0 ? marketValueOverride : null) ??
    (lead.market_value && lead.market_value > 0 ? lead.market_value : null) ??
    (lead.land_value && lead.land_value > 0 ? lead.land_value : null);
  // offer = market_value × offerPct% (blind offer, leaves flip/owner-finance spread)
  // 2026-06-29: küçük-parsel %15 capi kaldırıldı (pricing.ts ile aynı — sahip kırılmasın).
  const offer = marketValue != null ? Math.round(marketValue * (offerPct / 100)) : null;
  const st = abbr(lead.state);
  const cty = normCounty(lead.county);
  const title = `${lead.acres ? lead.acres + "-Acre" : "Parcel"}${cty ? " — " + cty + ", " + (st || "") : ""}`;
  // Bölgeye göre DOĞRU satış dili + dürüst zoning notu (region-playbook; config'de
  // yoksa güvenli default). Mektup bölgeye uygun açıyı kullansın diye merge var'a
  // beslenir; ASLA blanket hukuki vaat değil (lib KIRMIZI ÇİZGİ ile garanti).
  const pb = regionPlaybook({ state: lead.state, county: lead.county, region: lead.county, address: lead.property_address });
  // MH (ROAD Act) satış kozu — mh-eligibility tek kaynak. SADECE "likely"
  // parselde mektuba satır girer (mhMailLine verify/unlikely/null → null);
  // satırın kendisi "buyer to verify with the county" şerhini içerir.
  const mh = mhEligibility({
    useCode: useCodeOverride ?? null,
    acres: lead.acres,
    state: lead.state,
    county: lead.county,
    region: lead.county,
    address: lead.property_address,
  });
  const mhLine = mhMailLine(mh.status);
  return {
    title,
    apn: lead.apn,
    state: st,
    county: cty || lead.county,
    acres: lead.acres,
    minimumBid: minBid || null,
    marketValue: marketValue,
    offerPrice: offer,
    offerPct: offerPct,
    score: lead.final_score,
    propertyAddress: lead.property_address,
    mh: { status: mh.status, reason: mh.reason, mailLine: mhLine },
    playbook: {
      region: pb.region,
      salesAngle: pb.salesAngle,
      allowedUses: pb.allowedUses,
      zoningNote: pb.zoningNote,
      installmentNote: pb.installmentNote ?? null,
      confidence: pb.confidence,
      matchBasis: pb.matchBasis,
    },
    merge_variables: {
      owner_name: lead.owner_name || "Property Owner",
      county: cty || lead.county || "",
      state: st || lead.state || "",
      acres: lead.acres ? String(lead.acres) : "",
      offer: offer != null ? `$${offer.toLocaleString()}` : "a fair cash price",
      offer_amount: offer != null ? offer.toLocaleString() : "",
      apn: lead.apn || "",
      // Bölge-uygun satış dili (mektup template'i bu değişkenleri kullanabilir).
      sales_angle: pb.salesAngle,
      zoning_note: pb.zoningNote,
      // MH kozu: template {{mh_note}} kullanabilir — "likely" değilse boş string
      // (satır hiç basılmaz), böylece şablon her lead'de güvenle aynı kalır.
      mh_note: mhLine ?? "",
    },
  };
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const leadId = req.nextUrl.searchParams.get("leadId");
  const s = supabaseAdmin();
  try {
    let q = s.from("outreach_events").select("*").order("created_at", { ascending: false }).limit(200);
    if (leadId) q = q.eq("lead_ref", leadId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ events: [], reason: "table unavailable" });
    return NextResponse.json({ events: data || [] });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 20 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!body.leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const channel = body.channel === "postcard" ? "postcard" : "letter";
  const type = (body.type as string) || "offer";
  // blind offer = market_value × OFFER_PCT (pricing.ts tek kaynak; kart=gösterilen
  // ile mailer=giden teklif AYNI). Clamp [15,25] — bozuk input absürt teklif üretemez.
  const defaultPct = Math.round(PRICING.OFFER_PCT * 100);
  const rawPct = typeof body.offerPct === "number" ? body.offerPct : defaultPct;
  const offerPct = Math.min(25, Math.max(15, rawPct));
  // Optional: caller passes the deal's real market value (Regrid/landValue) so
  // the offer is anchored to resale value even when the lead row lacks it.
  const marketValueOverride =
    typeof body.marketValue === "number" && body.marketValue > 0 ? body.marketValue : null;
  // Optional: caller passes the assessor use code (lead row lacks that column)
  // so the MH signal can use the strongest source instead of region-only.
  const useCodeOverride =
    typeof body.useCode === "string" && body.useCode.trim() ? body.useCode.trim().slice(0, 80) : null;
  const doSend = body.send !== false; // default: send
  // KADANS: bu gönderim kaçıncı dokunuş? Manuel tek teklif → 1 (offer). Tick
  // route'u Touch 2/3 için 2/3 geçer. [1..toplam] arası clamp.
  const rawStep = typeof body.sequenceStep === "number" ? Math.trunc(body.sequenceStep) : 1;
  const sequenceStep = Math.min(CADENCE_TOTAL_STEPS, Math.max(1, rawStep));

  const s = supabaseAdmin();

  // 1) load lead
  let lead: Lead | null = null;
  try {
    const { data } = await s.from("tax_delinquent_properties").select("*").eq("id", body.leadId).maybeSingle();
    lead = (data as Lead) ?? null;
  } catch { /* graceful */ }
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  // 2) deal-sheet (offer anchored to market value × offerPct)
  const sheet = buildDealSheet(lead, offerPct, marketValueOverride, useCodeOverride);
  const addr = parseAddress(lead.owner_address);

  // 3) send via existing /api/lob (it mocks when LOB_API_KEY is absent)
  let lobResult: Record<string, unknown> | null = null;
  let status: "sent" | "mock" | "failed" | "queued" = "queued";
  let providerId: string | null = null;
  let errMsg: string | null = null;

  if (doSend) {
    if (!addr || !addr.line1 || !addr.state || !addr.zip) {
      status = "failed";
      errMsg = "owner_address eksik/parse edilemedi — Lob için tam adres gerekli";
    } else {
      try {
        const base = req.nextUrl.origin;
        const lobBody = {
          action: channel === "postcard" ? "send_postcard" : "send_letter",
          to: { name: lead.owner_name || "Property Owner", address_line1: addr.line1, city: addr.city, state: addr.state, zip: addr.zip },
          merge_variables: sheet.merge_variables,
          // template/front/back left to Lob defaults / mock; real templates are a TODO
          ...(channel === "postcard"
            ? { front: "tmpl_front_placeholder", back: "tmpl_back_placeholder" }
            : { template: "tmpl_letter_placeholder" }),
          description: `VegaLand ${type} — ${sheet.county || ""}`,
        };
        const r = await fetch(`${base}/api/lob`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
          body: JSON.stringify(lobBody),
        });
        lobResult = await r.json().catch(() => null);
        if (lobResult && (lobResult.id || lobResult.sandbox)) {
          providerId = (lobResult.id as string) || null;
          status = lobResult.sandbox ? "mock" : "sent";
        } else {
          status = "failed";
          errMsg = (lobResult?.error as string) || "Lob gönderimi başarısız";
        }
      } catch (e) {
        status = "failed";
        errMsg = String(e);
      }
    }
  }

  // 4) log outreach_events (+ kadans işaretçisi). Gönderim başarılıysa diziyi
  //    bu dokunuşa göre ilerlet (sequence_step + sıradaki next_action_at). Kolonlar
  //    yoksa (migration uygulanmamış) kolonsuz tekrar dene — demo asla patlamaz.
  const base = {
    lead_ref: lead.id,
    channel,
    type,
    status,
    provider_id: providerId,
    recipient_name: lead.owner_name,
    recipient_address: lead.owner_address,
    payload_json: { sheet, lob: lobResult },
    error: errMsg,
  };
  // Yalnızca gerçekten gönderildiyse (sent/mock) kadansı ilerlet; failed/queued
  // diziyi ileriye taşımasın (sonra tekrar denenebilsin).
  const advanced = status === "sent" || status === "mock";
  const cadence = advanced ? afterSend(sequenceStep, new Date()) : {};

  let eventId: string | null = null;
  let cadenceApplied = false;
  try {
    const { data, error } = await s
      .from("outreach_events")
      .insert({ ...base, ...cadence })
      .select("id")
      .maybeSingle();
    if (error) {
      if (advanced && isMissingColumn(error.message)) {
        // kadans kolonları yok → kolonsuz tekrar dene
        const { data: d2 } = await s.from("outreach_events").insert(base).select("id").maybeSingle();
        eventId = (d2?.id as string) || null;
      }
    } else {
      eventId = (data?.id as string) || null;
      cadenceApplied = advanced;
    }
  } catch { /* graceful — table may not exist yet */ }

  return NextResponse.json({
    eventId,
    status,
    channel,
    sequenceStep,
    cadence: cadenceApplied ? cadence : null,
    dealSheet: sheet,
    recipient: addr,
    lob: lobResult,
    error: errMsg,
    note:
      status === "mock"
        ? "LOB_API_KEY yok — gönderim mock/sandbox. Gerçek Lob template'leri + key TODO."
        : status === "failed"
          ? "Gönderilemedi — detay için error alanına bak."
          : "Gönderildi.",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/outreach  → kadansı DURDUR (sahip yanıt verdi).
//   body: { leadId, responded?: true }
// Lead'in en yeni outreach_event satırını responded=true + status=paused yapar.
// Kadans kolonları yoksa graceful no-op ({ ok:false, reason }).
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!body.leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  if (body.responded === false) return NextResponse.json({ ok: false, reason: "responded=false desteklenmiyor" });

  const s = supabaseAdmin();
  try {
    // En yeni satır kadans işaretçisini taşır — onu durdur.
    const { data: recent } = await s
      .from("outreach_events")
      .select("id")
      .eq("lead_ref", body.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!recent?.id) return NextResponse.json({ ok: false, reason: "lead için outreach kaydı yok" });

    const { error } = await s.from("outreach_events").update(markResponded()).eq("id", recent.id);
    if (error) {
      if (isMissingColumn(error.message)) {
        return NextResponse.json({ ok: false, reason: "kadans kolonları yok — outreach_cadence.sql uygula" });
      }
      return NextResponse.json({ ok: false, reason: error.message });
    }
    return NextResponse.json({ ok: true, leadId: body.leadId, eventId: recent.id });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: String(e) });
  }
}
