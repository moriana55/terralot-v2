import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { analyzeLead, type LeadAnalysis, type MarketContext } from "@/lib/cerberus/analyze";
import { enrichMany, enrichmentToApplied, type EnrichInput } from "@/lib/cerberus/enrich";
import { aiEnabled, aiNarrative } from "@/lib/ai-narrative";
import { normCounty, abbrState } from "@/lib/cerberus/analyze";
import { medianPpa } from "@/lib/land-valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// CERBERUS BATCH AUTO-ANALYZER (CRON_SECRET-protected, FAIL-CLOSED)
//
// Pulls UN-analyzed leads from the real acquisition tables, runs EACH one
// through the pure pipeline (src/lib/cerberus/analyze.ts) — normalize → comps →
// underwrite → AL/BEKLE/GEÇ verdict → risk flags — and PERSISTS the analysis to
// `lead_analyses` (idempotent upsert on parcel_key). This is the engine that
// "analyzes every single parcel one by one" and surfaces the best deals.
//
// AUTH (two accepted callers, BOTH fail closed — same posture as sync-deals):
//   1. cron / scraper job → Authorization: Bearer <CRON_SECRET> or ?secret=...
//      If CRON_SECRET is UNSET, every bearer attempt is rejected (never a no-op).
//   2. logged-in admin in the browser → the gate cookie (requireGate).
//
// IDEMPOTENT + BATCHED: only leads whose parcel_key isn't already in
// lead_analyses are analyzed (unless reanalyze:true), in capped batches, so the
// endpoint can chew a backlog and be re-run on a cron without duplicating work.
//
// HONEST: if tax_delinquent_properties has no rows, it says so and writes
// nothing. Comp value is derived from REAL market medians (competitor_listings);
// when a market lacks comps the verdict degrades to a rule-based score proxy —
// never a fabricated number. AI narrative is layered on only if OPENAI_API_KEY.
//
// OWNER MUST WIRE: apply CERBERUS_ANALYSES_SETUP.sql (creates lead_analyses +
// unique index). Without it the upsert fails and the endpoint reports it.
// ─────────────────────────────────────────────────────────────────────────────

const TDP = "tax_delinquent_properties";
const ANALYSES = "lead_analyses";
const MAX_BATCH = 500; // hard cap per invocation (keeps a single run bounded)
const DB_PAGE = 1000;
const UPSERT_CHUNK = 200;
const AI_NARRATIVE_CAP = 8; // only enrich the top-N with AI (cost/latency guard)
// ENRICHMENT IS OPT-IN + CAPPED. Hitting FREE keyless APIs (FEMA/USGS/OSM/Census)
// per parcel is slow and rate-limited, so a run only enriches when ?enrich=1 and
// only the top-N by score (the ones a human will actually act on). This stops a
// huge backlog from hammering the public APIs by accident.
const ENRICH_CAP = 25;

const bodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_BATCH).optional(),
  reanalyze: z.coerce.boolean().optional(), // re-run even already-analyzed parcels
  dryRun: z.coerce.boolean().optional(),
  enrich: z.coerce.boolean().optional(), // OPT-IN multi-source enrichment (free APIs)
  enrichCap: z.coerce.number().int().min(1).max(100).optional(),
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function bearerOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL CLOSED
  const header = req.headers.get("authorization") || "";
  const fromHeader = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const fromQuery = req.nextUrl.searchParams.get("secret") || "";
  const presented = fromHeader || fromQuery;
  return !!presented && safeEqual(presented, secret);
}

// Persist-shape mapper: LeadAnalysis → lead_analyses row.
function toRow(a: LeadAnalysis) {
  return {
    parcel_key: a.parcelKey,
    lead_id: a.leadId,
    apn: a.apn,
    source: a.source,
    state: a.state,
    county: a.county,
    address: a.address,
    acres: a.acres,
    comp_value: a.compValue,
    per_acre: a.perAcre,
    value_basis: a.valueBasis,
    value_confidence: a.valueConfidence,
    min_bid: a.minBid,
    margin: a.margin,
    discount_pct: a.discountPct,
    verdict: a.verdict,
    score: a.score,
    confidence: a.confidence,
    hard_fail: a.hardFail,
    components: a.components,
    reasons: a.reasons,
    risk_flags: a.riskFlags,
    real_signals: a.realSignals,
    enrichment: a.enrichment,
    data_gaps: a.dataGaps,
    suggested_action: a.suggestedAction,
    narrative: a.narrative,
    narrative_source: a.narrativeSource,
    pipeline_version: a.pipelineVersion,
    analyzed_at: a.analyzedAt,
  };
}

// Build the market context (state + county median $/acre) ONCE from real
// competitor_listings so the pure pipeline never touches the DB per-lead.
async function buildMarketContext(s: ReturnType<typeof supabaseAdmin>): Promise<MarketContext> {
  const stateRates: Record<string, number> = {};
  const countyRates: Record<string, number> = {};
  try {
    const byState: Record<string, { price: unknown; acres: unknown }[]> = {};
    const byCounty: Record<string, { price: unknown; acres: unknown }[]> = {};
    let from = 0;
    for (let page = 0; page < 30; page++) {
      const { data, error } = await s
        .from("competitor_listings")
        .select("state,county,price,acres")
        .range(from, from + DB_PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data as { state: string; county: string; price: unknown; acres: unknown }[]) {
        const st = abbrState(r.state);
        if (!st) continue;
        (byState[st] ||= []).push({ price: r.price, acres: r.acres });
        const cty = normCounty(r.county);
        if (cty) (byCounty[`${st}/${cty}`] ||= []).push({ price: r.price, acres: r.acres });
      }
      if (data.length < DB_PAGE) break;
      from += DB_PAGE;
    }
    for (const [st, rows] of Object.entries(byState)) {
      const m = medianPpa(rows);
      if (m != null) stateRates[st] = m;
    }
    for (const [key, rows] of Object.entries(byCounty)) {
      const m = medianPpa(rows, 4); // need a few comps for a county-level median
      if (m != null) countyRates[key] = m;
    }
  } catch {
    /* graceful — empty context just means score-proxy verdicts */
  }

  // GERÇEK county demografisi (county_demographics) — talep fasetini besler, böylece
  // lead satırında nüfus büyümesi olmasa bile karar ACS verisine dayanır (underwrite ile tutarlı).
  const demographics: Record<string, { popGrowth5y?: number | null; medianIncome?: number | null; population?: number | null }> = {};
  try {
    let from = 0;
    for (let page = 0; page < 10; page++) {
      const { data, error } = await s
        .from("county_demographics")
        .select("state,county,pop_growth_5y,median_household_income,population")
        .range(from, from + DB_PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data as { state: string; county: string; pop_growth_5y: number | null; median_household_income: number | null; population: number | null }[]) {
        const st = abbrState(r.state);
        const cty = normCounty(r.county);
        if (!st || !cty) continue;
        demographics[`${st}/${cty}`] = {
          popGrowth5y: r.pop_growth_5y,
          medianIncome: r.median_household_income,
          population: r.population,
        };
      }
      if (data.length < DB_PAGE) break;
      from += DB_PAGE;
    }
  } catch { /* graceful */ }

  return { stateRates, countyRates, demographics };
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 6, windowMs: 60_000 });
  if (limited) return limited;

  const cronAuthed = bearerOk(req);
  if (!cronAuthed) {
    const unauth = await requireGate(req);
    if (unauth) return unauth;
    if (!process.env.ADMIN_PASSWORD && !process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "unauthorized", message: "CRON_SECRET veya ADMIN_PASSWORD ayarlı değil — analiz reddedildi (fail-closed)." },
        { status: 401 }
      );
    }
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const limit = parsed.data.limit ?? MAX_BATCH;
  const reanalyze = !!parsed.data.reanalyze;
  const dryRun = !!parsed.data.dryRun;
  // Opt-in via body OR ?enrich=1 query (documented: keeps free APIs from being hammered).
  const enrich = !!parsed.data.enrich || req.nextUrl.searchParams.get("enrich") === "1";
  const enrichCap = Math.min(parsed.data.enrichCap ?? ENRICH_CAP, 100);

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  // 1) Already-analyzed parcel keys (so we only chew the backlog) ----------------
  const analyzedKeys = new Set<string>();
  if (!reanalyze) {
    try {
      let from = 0;
      for (let page = 0; page < 30; page++) {
        const { data, error } = await s.from(ANALYSES).select("parcel_key").range(from, from + DB_PAGE - 1);
        if (error) break; // table may not exist yet — treated as "nothing analyzed"
        if (!data || data.length === 0) break;
        for (const r of data as { parcel_key: string }[]) if (r.parcel_key) analyzedKeys.add(r.parcel_key);
        if (data.length < DB_PAGE) break;
        from += DB_PAGE;
      }
    } catch { /* graceful */ }
  }

  // 2) Pull candidate leads -----------------------------------------------------
  // İKİ HAVUZ birleştirilir ki batch hem yüksek-skorlu leadleri hem de COMP
  // ÜRETEBİLEN (acreage + fiyat dolu) parselleri kapsasın. Aksi halde sadece
  // final_score DESC çekilince, gerçek değer açığı/marj taşıyan comp'lu parseller
  // (genelde düşük final_score'lu) batch'e hiç girmez ve "En İyi Fırsatlar"
  // tablosu boş comp_value ile kalır.
  const SELECT_COLS =
    "id,dedup_key,apn,source,state,county,property_address,owner_name,acres,minimum_bid,judgment_amount,final_score,deal_score,discount_pct,savings,liquidity_score,county_pop_growth,road_access,flood_score,dd_checked,lat,lng,sale_date,raw_url";
  const overPull = Math.min(limit * 4, 2000);
  let leads: Record<string, unknown>[] = [];
  try {
    // Havuz A: en yüksek final_score (Cerberus'un öne çıkardığı leadler).
    const scoredP = s
      .from(TDP)
      .select(SELECT_COLS)
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(overPull);
    // Havuz B: acreage + fiyatı dolu (dürüst intrinsic/comp/marj üretebilecek) parseller.
    // minimum_bid ASC → ucuz girişli, yüksek-marj olasılığı yüksek parseller önce.
    const compableP = s
      .from(TDP)
      .select(SELECT_COLS)
      .gt("acres", 0)
      .gt("minimum_bid", 0)
      .order("minimum_bid", { ascending: true })
      .limit(overPull);
    const [scoredRes, compableRes] = await Promise.all([scoredP, compableP]);
    if (scoredRes.error) {
      return NextResponse.json({ error: "source_query_failed", message: scoredRes.error.message }, { status: 500 });
    }
    // ID bazında birleştir (dedup); önce comp'lu parseller (demo değeri), sonra skorlular.
    const merged = new Map<string, Record<string, unknown>>();
    for (const r of (compableRes.data as Record<string, unknown>[]) || []) merged.set(String(r.id), r);
    for (const r of (scoredRes.data as Record<string, unknown>[]) || []) if (!merged.has(String(r.id))) merged.set(String(r.id), r);
    leads = [...merged.values()];
  } catch (e) {
    return NextResponse.json({ error: "source_query_failed", message: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }

  const totalCaptured = leads.length;
  if (totalCaptured === 0) {
    return NextResponse.json({
      ok: true,
      analyzed: 0,
      message: "tax_delinquent_properties boş — analiz edilecek lead yok. Önce /api/admin/sync-deals ile lead yükle.",
      ownerActions: ["Scraper çıktısını /api/admin/sync-deals ile Supabase'e senkronla.", "CERBERUS_ANALYSES_SETUP.sql migration'ını uygula."],
    });
  }

  // 3) Market context (real medians) --------------------------------------------
  const ctx = await buildMarketContext(s);

  // 4) Analyze the backlog one-by-one (pure) ------------------------------------
  const analyses: LeadAnalysis[] = [];
  const leadByKey = new Map<string, Record<string, unknown>>(); // for enrichment re-analyze
  const seen = new Set<string>();
  let skippedNoIdentity = 0;
  let skippedAlready = 0;
  for (const lead of leads) {
    if (analyses.length >= limit) break;
    const a = analyzeLead(lead, ctx);
    if (!a) { skippedNoIdentity++; continue; }
    if (seen.has(a.parcelKey)) continue; // within-batch dedup
    if (!reanalyze && analyzedKeys.has(a.parcelKey)) { skippedAlready++; continue; }
    seen.add(a.parcelKey);
    leadByKey.set(a.parcelKey, lead);
    analyses.push(a);
  }

  // 4b) OPT-IN multi-source ENRICHMENT (free keyless APIs), top-N by score only.
  // Politely throttled (small concurrency + delay in enrichMany) so a backlog
  // never hammers FEMA/USGS/OSM/Census. Re-analyzes the enriched parcels so the
  // verdict/flags use REAL flood zone + road-access + demographics.
  let enriched = 0;
  if (enrich && analyses.length) {
    const top = [...analyses].sort((x, y) => y.score - x.score).slice(0, enrichCap);
    const inputs: EnrichInput[] = top.map((a) => ({
      lat: typeof (leadByKey.get(a.parcelKey)?.lat) === "number" ? (leadByKey.get(a.parcelKey)!.lat as number) : null,
      lng: typeof (leadByKey.get(a.parcelKey)?.lng) === "number" ? (leadByKey.get(a.parcelKey)!.lng as number) : null,
      address: a.address,
      state: a.state,
      county: a.county,
    }));
    const results = await enrichMany(inputs, { concurrency: 2, delayMs: 350 });
    for (let i = 0; i < top.length; i++) {
      const e = results[i];
      if (!e || e.sourcesOk.length === 0) continue; // nothing measured → keep heuristic
      const lead = leadByKey.get(top[i].parcelKey);
      if (!lead) continue;
      const re = analyzeLead(lead, ctx, enrichmentToApplied(e));
      if (re) {
        const idx = analyses.findIndex((x) => x.parcelKey === top[i].parcelKey);
        if (idx >= 0) analyses[idx] = re;
        enriched++;
      }
    }
  }

  // 5) AI narrative for the top opportunities only (env-gated, cost-bounded) -----
  let aiEnriched = 0;
  if (aiEnabled() && analyses.length) {
    const top = [...analyses].sort((x, y) => y.score - x.score).slice(0, AI_NARRATIVE_CAP);
    await Promise.all(
      top.map(async (a) => {
        const ai = await aiNarrative({
          system: "You are a land-acquisition underwriter. Be concise (<110 words), decisive, reference the numbers. One tight paragraph, no markdown headers. Respond in Turkish.",
          prompt: `Parsel underwriting. Verdict=${a.verdict}, skor=${a.score}/100. Konum: ${a.county || "?"}, ${a.state || "?"} · ${a.acres ?? "?"} acre. Comp değer: ${a.compValue != null ? "$" + a.compValue.toLocaleString() : "bilinmiyor"}; min teklif: ${a.minBid != null ? "$" + a.minBid.toLocaleString() : "bilinmiyor"}. Skor bileşenleri: ${a.components.map((c) => `${c.label}=${c.pts}/${c.max}`).join("; ")}. Riskler: ${a.riskFlags.map((f) => f.label).join("; ") || "yok"}. Kısa AL/BEKLE/GEÇ gerekçesi yaz.`,
        });
        if (ai) { a.narrative = ai; a.narrativeSource = "ai"; aiEnriched++; }
      })
    );
  }

  const verdictCounts = { BUY: 0, WATCH: 0, PASS: 0 };
  for (const a of analyses) verdictCounts[a.verdict]++;

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      captured: totalCaptured,
      analyzed: analyses.length,
      skippedAlready,
      skippedNoIdentity,
      verdictCounts,
      enriched,
      enrichApplied: enrich,
      aiEnriched,
      sample: analyses.slice(0, 3),
    });
  }

  if (analyses.length === 0) {
    return NextResponse.json({
      ok: true,
      captured: totalCaptured,
      analyzed: 0,
      skippedAlready,
      skippedNoIdentity,
      message: reanalyze ? "Analiz edilecek geçerli lead yok." : "Tüm leadler zaten analiz edilmiş (backlog boş).",
    });
  }

  // 6) Persist (idempotent upsert on parcel_key, batched) -----------------------
  const rows = analyses.map(toRow);
  let upserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error, count } = await s
      .from(ANALYSES)
      .upsert(chunk, { onConflict: "parcel_key", ignoreDuplicates: false, count: "exact" });
    if (error) errors.push(error.message);
    else upserted += count ?? chunk.length;
  }

  const status = errors.length && upserted === 0 ? 500 : 200;
  return NextResponse.json(
    {
      ok: errors.length === 0,
      captured: totalCaptured,
      analyzed: analyses.length,
      upserted,
      skippedAlready,
      skippedNoIdentity,
      verdictCounts,
      enriched,
      enrichApplied: enrich,
      aiEnriched,
      aiAvailable: aiEnabled(),
      remainingBacklog: Math.max(0, totalCaptured - analyzedKeys.size - analyses.length),
      errors: errors.length ? errors.slice(0, 5) : undefined,
      note: errors.length
        ? "Upsert başarısız — muhtemelen `lead_analyses` tablosu/unique index yok. CERBERUS_ANALYSES_SETUP.sql'i uygula."
        : undefined,
    },
    { status }
  );
}

// GET probe — confirm wiring + see live counts without writing anything.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const cronAuthed = bearerOk(req);
  if (!cronAuthed) {
    const unauth = await requireGate(req);
    if (unauth) return unauth;
  }

  let s;
  try {
    s = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const head = async (table: string) => {
    try {
      const { count } = await s.from(table).select("*", { count: "exact", head: true });
      return count ?? 0;
    } catch {
      return null; // table missing
    }
  };
  const [captured, analyzed] = await Promise.all([head(TDP), head(ANALYSES)]);

  return NextResponse.json({
    ok: true,
    endpoint: "cerberus/analyze",
    cronSecretConfigured: !!process.env.CRON_SECRET,
    aiAvailable: aiEnabled(),
    tableReady: analyzed !== null,
    captured,
    analyzed,
    pending: captured != null && analyzed != null ? Math.max(0, captured - analyzed) : null,
    usage: "POST { limit?, reanalyze?, dryRun? } with Authorization: Bearer $CRON_SECRET",
    ownerActions: analyzed === null ? ["CERBERUS_ANALYSES_SETUP.sql'i Supabase SQL editöründe çalıştır."] : undefined,
  });
}
