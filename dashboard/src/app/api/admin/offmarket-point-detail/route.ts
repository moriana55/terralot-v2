import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET NOKTA DETAYI — haritada tek noktaya tıklanınca popup içeriği.
// Cluster katmanı noktaları lean taşır (lat/lng/state); owner, acres, land
// value gibi zengin alanlar buradan CANLI Supabase offmarket_leads'ten gelir
// (AZ Mohave popup'ıyla aynı bilgi kalitesi, tüm eyaletler için).
// Eşleşme: state + lat/lng ±0.0001° (export 1e-5° hassasiyetle yuvarlar).
// ─────────────────────────────────────────────────────────────────────────────

const EPS = 1e-4;

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const st = (p.get("st") ?? "").toUpperCase().slice(0, 2);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^[A-Z]{2}$/.test(st)) {
    return NextResponse.json({ error: "lat, lng, st gerekli" }, { status: 400 });
  }

  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("offmarket_leads")
      .select("lead_id, state, county, region, apn, owner, situs, use, acres, land_value, est_offer, est_retail, est_margin, absentee, mailing_city, mailing_state")
      .eq("state", st)
      .gte("lat", lat - EPS).lte("lat", lat + EPS)
      .gte("lng", lng - EPS).lte("lng", lng + EPS)
      .limit(5);
    if (error) throw new Error(error.message);
    return NextResponse.json({ leads: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { leads: [], note: e instanceof Error ? e.message : "point-detail failed" },
      { status: 200 }
    );
  }
}
