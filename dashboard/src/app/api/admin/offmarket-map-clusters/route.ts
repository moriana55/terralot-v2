import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { gunzipSync } from "zlib";
import path from "path";
import Supercluster from "supercluster";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET HARİTA CLUSTER KATMANI — tüm eyaletlerdeki (~484K) koordinatlı lead'in
// TAMAMI (örnekleme YOK) zoom'a göre cluster'lanarak servis edilir.
//   - Veri: src/data/offmarket-map-points.json.gz (scraper/export-map-points.mjs
//     üretir; kaynak Supabase offmarket_leads, 1e-5° hassasiyet).
//   - Eyalet başına AYRI supercluster indeksi → cluster baloncukları eyalet
//     rengini korur, lejantla birebir.
//   - Cluster'lar zoom'landıkça GERÇEK tek tek noktalara açılır; hiçbir kayıt
//     atlanmaz, sahte koordinat üretilmez (dürüstlük kuralı).
// İstek: GET ?w=&s=&e=&n=&z=[&st=TX]  (bbox + zoom + opsiyonel eyalet filtresi)
//        → { features, meta }. st verilirse yalnız o eyaletin indeksi taranır
//        (Ana Harita'nın eyalet filtre çipleri — payload küçülür, sayılar gerçek).
// ─────────────────────────────────────────────────────────────────────────────

type PtsFile = { generatedAt: string; states: string[]; byState: Record<string, number>; pts: [number, number, number][] };

const CLUSTER_RADIUS = 60; // px — AZ nokta yoğunluğunda okunur baloncuk
const CLUSTER_MAX_ZOOM = 14; // bu zoom'dan sonra HER kayıt tek tek nokta

// Modül yüklenince BİR KEZ: gz oku → eyalet başına indeks kur (yüzbinlerce nokta).
const DATA = (() => {
  const file = path.join(process.cwd(), "src", "data", "offmarket-map-points.json.gz");
  try {
    const raw = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as PtsFile;
    const perState: { state: string; index: Supercluster }[] = [];
    for (let si = 0; si < raw.states.length; si++) {
      const feats: Supercluster.PointFeature<Record<string, never>>[] = [];
      for (const [lat5, lng5, s] of raw.pts) {
        if (s !== si) continue;
        feats.push({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng5 / 1e5, lat5 / 1e5] },
        });
      }
      if (!feats.length) continue;
      const index = new Supercluster({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM, minPoints: 3 });
      index.load(feats);
      perState.push({ state: raw.states[si], index });
    }
    return {
      perState,
      meta: { generatedAt: raw.generatedAt, totalPoints: raw.pts.length, byState: raw.byState },
      error: null as string | null,
    };
  } catch (e) {
    return {
      perState: [] as { state: string; index: Supercluster }[],
      meta: { generatedAt: "", totalPoints: 0, byState: {} as Record<string, number> },
      error: e instanceof Error ? e.message : "offmarket-map-points.json.gz okunamadı",
    };
  }
})();

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export async function GET(req: NextRequest) {
  // Harita pan/zoom'u sık istek atar — bu uca daha geniş pencere tanı.
  const limited = enforceRateLimit(req, { limit: 300 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  if (DATA.error) {
    return NextResponse.json({ features: [], meta: DATA.meta, note: DATA.error }, { status: 200 });
  }

  const p = req.nextUrl.searchParams;
  const w = Math.max(-180, num(p.get("w"), -180));
  const s = Math.max(-85, num(p.get("s"), -85));
  const e = Math.min(180, num(p.get("e"), 180));
  const n = Math.min(85, num(p.get("n"), 85));
  const z = Math.min(22, Math.max(0, Math.round(num(p.get("z"), 5))));
  // Opsiyonel eyalet filtresi — yalnız bilinen eyalet kodları (2 harf) kabul edilir.
  const stRaw = (p.get("st") ?? "").toUpperCase();
  const stFilter = /^[A-Z]{2}$/.test(stRaw) ? stRaw : null;

  // t:"c" = cluster baloncuğu (n = gerçek kayıt sayısı, ez = açılma zoom'u)
  // t:"p" = GERÇEK tek kayıt noktası
  const features: Array<
    | { t: "c"; lat: number; lng: number; n: number; st: string; ez: number }
    | { t: "p"; lat: number; lng: number; st: string }
  > = [];

  for (const { state, index } of DATA.perState) {
    if (stFilter && state !== stFilter) continue;
    for (const f of index.getClusters([w, s, e, n], z)) {
      const [lng, lat] = f.geometry.coordinates;
      const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number };
      if (props.cluster) {
        let ez = CLUSTER_MAX_ZOOM + 1;
        try {
          ez = Math.min(index.getClusterExpansionZoom(props.cluster_id!), CLUSTER_MAX_ZOOM + 1);
        } catch { /* varsayılan kalır */ }
        features.push({ t: "c", lat, lng, n: props.point_count ?? 0, st: state, ez });
      } else {
        features.push({ t: "p", lat, lng, st: state });
      }
    }
  }

  return NextResponse.json({ features, meta: DATA.meta });
}
