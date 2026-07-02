import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// REGRID GERÇEK PARSEL SINIRI — haritadaki "yaklaşık kare" yerine GERÇEK tapu
// poligonu (ll_geom). Yalnız REGRID_API_TOKEN varsa + o county Regrid kapsamında
// ise gerçek geometriyi döner; aksi halde graceful { real:false } → istemci
// yaklaşık kareye düşer. DÜRÜST: "gerçek tapu sınırı (Regrid)" vs "yaklaşık kare".
//
// Salt-okuma proxy; lat/lng sınırlanmış sayı (upstream URL'ye enjeksiyon olmaz).
// Mevcut /api/regrid'in aksine: token yokken SAHTE kare döndürmez — dürüstçe
// real:false der (istemci kendi gerçek-konumlu karesini çizer).
// ─────────────────────────────────────────────────────────────────────────────

const REGRID_TOKEN = process.env.REGRID_API_TOKEN || "";
const BASE = "https://app.regrid.com/api/v2";

function bad(reason: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ real: false, reason, ...extra }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  if (!REGRID_TOKEN) return bad("no_token"); // token yok → yaklaşık kareye düş

  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return bad("bad_coords");
  }

  const url = `${BASE}/parcels/point?lat=${lat}&lon=${lng}&token=${encodeURIComponent(REGRID_TOKEN)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return bad("upstream_error", { status: res.status });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return bad("invalid_json");
    }
    // Regrid v2, FeatureCollection'ı `parcels` anahtarına sarar:
    // { "parcels": { "type":"FeatureCollection", "features":[...] } }
    // Eski/düz şekil de desteklenir (top-level features) — iki şekli de oku.
    type Feat = { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };
    const raw = data as { features?: Feat[]; parcels?: { features?: Feat[] } };
    const features = Array.isArray(raw.parcels?.features) ? raw.parcels.features : raw.features;
    const feat = Array.isArray(features) ? features[0] : undefined;
    const geom = feat?.geometry;
    if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon") || !geom.coordinates) {
      return bad("no_coverage"); // bu county Regrid'de yok / poligon dönmedi
    }
    // v2'de parsel öznitelikleri properties.fields altında; düz shape da desteklenir.
    const rawProps = (feat?.properties ?? {}) as Record<string, unknown>;
    const props = (rawProps.fields as Record<string, unknown> | undefined) ?? rawProps;
    return NextResponse.json({
      real: true,
      geometry: geom,
      address: (props.address as string) ?? null,
      parcelNumber: (props.parcelnumb as string) ?? null,
      acres: (props.ll_gisacre as number) ?? (props.gisacre as number) ?? null,
    });
  } catch (e) {
    return bad("fetch_failed", { message: e instanceof Error ? e.message : "error" });
  }
}
