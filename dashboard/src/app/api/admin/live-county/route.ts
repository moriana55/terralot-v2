import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { COUNTY_REGISTRY } from "@/lib/county-registry";
import { queryCounty, RESULT_CAP, kotaDurumu } from "@/lib/county-providers";
import type { LiveCountyResult, LiveSearch } from "@/lib/live-county-types";

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

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const countyKey = searchParams.get("county") || "";
  const entry = COUNTY_REGISTRY[countyKey];
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

  // Sağlayıcı zinciri: ücretsiz ArcGIS → Regrid (ülke geneli yedek) → yok.
  // "veri yok" ile "servis çöktü" AYRI durumlardır; hiçbir koşulda sahte satır üretilmez.
  const r = await queryCounty(countyKey, entry, search, RESULT_CAP);

  // Sert hata → 502, ama gövde yine tam şeffaf (hangi sağlayıcı ne dedi).
  const sertHata = r.status === "servis-hatasi" || r.status === "yapilandirilmamis";
  const kimlik = r.status === "kimlik-hatasi" || r.status === "kota-doldu";

  return NextResponse.json({
    county: countyKey,
    label: entry.label,
    state: entry.state,
    live: true,
    fetchedAt: r.fetchedAt,
    provider: r.provider,
    status: r.status,
    where: r.where,
    rawCount: r.rawCount,
    count: r.rows.length,
    capped: r.capped,
    rows: r.rows,
    apiCalls: r.apiCalls,
    regridKota: kotaDurumu(),
    // Hata durumunda `error` alanı doldurulur — UI zaten bunu okuyor.
    ...(sertHata || kimlik ? { error: r.message } : r.message ? { notice: r.message } : {}),
    denemeler: r.attempts.map((a) => ({
      saglayici: a.provider, durum: a.status, sureMs: a.durationMs,
      onbellek: a.cached, apiCagri: a.apiCalls, mesaj: a.message ?? null,
    })),
  }, { status: sertHata || kimlik ? 502 : 200 });
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

  const entry = body.countyKey ? COUNTY_REGISTRY[body.countyKey] : undefined;
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
