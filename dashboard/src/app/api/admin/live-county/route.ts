import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import {
  LIVE_COUNTY_REGISTRY, buildWhere, clientFilter,
  type LiveCountyResult, type LiveSearch,
} from "@/lib/live-county";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// CANLI COUNTY SORGU — GET: seçili county'nin ArcGIS parsel servisine SUNUCUDA
// sorgu atar, normalize eder, döner. POST: seçilen satırları offmarket_leads'e
// upsert eder (lead_id deterministik → scraper kaydıyla dedupe).
//
// DÜRÜSTLÜK: sonuç o county'nin canlı ArcGIS'inden gelir. Servis yavaş/engelli
// ise NET hata döner — sahte satır ÜRETİLMEZ.
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_CAP = 200;      // interaktif sorgu — tam çekim değil
const QUERY_TIMEOUT_MS = 20000;

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const countyKey = searchParams.get("county") || "";
  const entry = LIVE_COUNTY_REGISTRY[countyKey];
  if (!entry) {
    return NextResponse.json({ error: `Bilinmeyen county: "${countyKey}"` }, { status: 400 });
  }

  const search: LiveSearch = {
    owner: searchParams.get("owner") || undefined,
    apn: searchParams.get("apn") || undefined,
    mailingState: searchParams.get("mailingState") || undefined,
    minValue: searchParams.get("minValue") ? Number(searchParams.get("minValue")) : undefined,
    maxValue: searchParams.get("maxValue") ? Number(searchParams.get("maxValue")) : undefined,
  };

  const where = buildWhere(entry, search);
  const params = new URLSearchParams({
    where,
    outFields: entry.outFields,
    returnGeometry: "false",
    orderByFields: entry.orderBy,
    resultRecordCount: String(RESULT_CAP),
    f: "json",
  });

  let json: { features?: { attributes: Record<string, unknown> }[]; error?: unknown };
  try {
    const res = await fetch(`${entry.endpoint}?${params}`, {
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (TerraLot canlı sorgu)" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `${entry.label} servisi yanıt vermedi (HTTP ${res.status}). Servis geçici olarak engelli/yavaş olabilir.`, where },
        { status: 502 },
      );
    }
    json = await res.json();
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError"
      ? `${entry.label} servisi ${QUERY_TIMEOUT_MS / 1000}sn içinde yanıt vermedi (zaman aşımı).`
      : `${entry.label} servisine ulaşılamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}`;
    return NextResponse.json({ error: msg, where }, { status: 502 });
  }

  if (json.error) {
    return NextResponse.json(
      { error: `${entry.label} ArcGIS hatası: ${JSON.stringify(json.error).slice(0, 200)}`, where },
      { status: 502 },
    );
  }

  const feats = json.features ?? [];
  const rows: LiveCountyResult[] = [];
  const seen = new Set<string>();
  for (const f of feats) {
    const r = entry.normalize(f.attributes);
    if (!r || !r.apn || seen.has(r.apn)) continue;
    seen.add(r.apn);
    rows.push(r);
  }
  const filtered = clientFilter(rows, search);

  return NextResponse.json({
    county: countyKey,
    label: entry.label,
    state: entry.state,
    live: true,
    fetchedAt: new Date().toISOString(),
    where,
    rawCount: feats.length,
    count: filtered.length,
    capped: feats.length >= RESULT_CAP,
    rows: filtered,
  });
}

// ── Kaydet ───────────────────────────────────────────────────────────────────
const clampAcres = (a: number) => Math.max(0.7, Math.min(3, a));
function estOffer(landValue: number | null, retail: number): number {
  if (landValue && landValue > 0) return Math.min(1200, Math.max(400, Math.round(landValue * 0.5)));
  return Math.min(1200, Math.max(400, Math.round(retail * 0.35)));
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let body: { countyKey?: string; rows?: LiveCountyResult[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "geçersiz json" }, { status: 400 });
  }

  const entry = body.countyKey ? LIVE_COUNTY_REGISTRY[body.countyKey] : undefined;
  if (!entry) return NextResponse.json({ error: "geçersiz countyKey" }, { status: 400 });
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "kaydedilecek satır yok" }, { status: 400 });

  const recs = rows
    .filter((r) => r && r.apn && r.owner)
    .map((r) => {
      const retail = r.acres ? Math.round(2999 * clampAcres(r.acres)) : 2999;
      const offer = estOffer(r.land_value, retail);
      return {
        lead_id: `${entry.leadIdPrefix}-${r.apn}`,
        state: entry.state, county: entry.county, region: entry.region,
        apn: r.apn, owner: r.owner,
        mailing_address: r.mailing_address, mailing_city: r.mailing_city,
        mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
        situs: r.situs, use: r.use, acres: r.acres, land_value: r.land_value,
        est_offer: offer, est_retail: retail, est_margin: retail - offer,
        absentee: r.absentee, lat: null, lng: null,
        source: `LIVE:${body.countyKey}`,
      };
    });

  if (recs.length === 0) return NextResponse.json({ error: "geçerli satır yok (owner/apn eksik)" }, { status: 400 });

  const supa = supabaseAdmin();
  const { error } = await supa.from("offmarket_leads").upsert(recs, { onConflict: "lead_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: recs.length });
}
