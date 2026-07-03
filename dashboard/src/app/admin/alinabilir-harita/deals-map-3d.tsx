"use client";

// ── 3D DEAL HARİTASI (MapLibre GL + arazi kabartması) ────────────────────────
// 2D Leaflet haritasının SUNUM-sınıfı 3D kardeşi. Aynı MapPoint verisini alır:
//  • Altlık: Esri World Imagery (raster) — 2D ile aynı uydu.
//  • Arazi: AWS Terrain Tiles (terrarium encoding) — ÜCRETSİZ, key GEREKMEZ.
//    Kaynak: s3.amazonaws.com/elevation-tiles-prod (Mapzen mirası, AWS Open Data).
//  • Hillshade: aynı DEM'den gölgeleme → çöl topoğrafyası okunur.
//  • Parsel noktaları: A/B/C tier renkleri 2D ile birebir aynı.
//  • GERÇEK Regrid tapu sınırları: zoom ≥ 12'de görünür bölge için 2D ile AYNI
//    endpoint'ten (/api/admin/regrid-parcel) parça parça yüklenir; tier-renkli
//    parlak kontur + dış glow + hover'da parlayan dolgu. Seçili/tur parseli
//    amber nabız (pulse) konturla vurgulanır.
//  • Spread kule modu: GERÇEK poligon varsa gerçek şekil extrude edilir;
//    yoksa acre-boyutlu kare fallback, yükseklik ∝ spread.
//  • Sunum turu: en yüksek spread'li N deal'e sinematik uçuş; gerçek sınır
//    varsa kamera sınırı kadraja alır (fitBounds + pitch) + amber vurgu.
// DEM yaklaşık ~30m çözünürlük; parsel-kesin kot değil (dürüst not UI'da).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPoint } from "./deals-map";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const GRADE_COLOR: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#94a3b8" };
// Sınır konturları uyduda "pop" etsin diye tier renklerinin PARLAK tonları.
const GRADE_BRIGHT: Record<string, string> = { A: "#34d399", B: "#38bdf8", C: "#cbd5e1" };
const COMP_COLOR = "#dc2626";
const TERRAIN_DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
const TOUR_STOPS = 8; // sunum turu durak sayısı (en yüksek spread)
// OSM bina ayak izleri: OpenFreeMap vektör tile (ÜCRETSİZ, key GEREKMEZ,
// openmaptiles şeması → "building" katmanı render_height/render_min_height taşır).
const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";
const BUILDING_MIN_ZOOM = 14;

// ── Regrid sınır yükleme ayarları ──
const BOUNDARY_MIN_ZOOM = 12; // bu zoom altında sadece noktalar (3000 parsel × istek = olmaz)
const BOUNDARY_BATCH = 24; // görünüm başına en fazla istek (API rate limit 60/dk — pay bırak)
const BOUNDARY_CONCURRENCY = 6;
const BOUNDARY_DEBOUNCE_MS = 700;

type CompMarker = {
  id: string; competitor: string; title: string; acres: number | null;
  price: number | null; rawUrl: string | null; lat: number; lng: number; matched: string;
};

// ── Regrid GERÇEK tapu sınırı cache'i (modül-seviye → 2D/3D geçişinde kalıcı) ──
// real:false da cache'lenir (no_coverage/no_token → tekrar sormaya gerek yok).
// Ağ/429 hatası CACHE'LENMEZ → sonraki harekette yeniden denenir (graceful).
type GeoEntry = { real: boolean; geometry?: GeoJSON.Geometry };
const geoCache = new Map<string, GeoEntry>();
const geoPending = new Set<string>();

async function fetchParcelGeo(p: MapPoint): Promise<GeoEntry | null> {
  try {
    const res = await fetch(`/api/admin/regrid-parcel?lat=${p.lat}&lng=${p.lng}`);
    if (!res.ok) return null; // 429/5xx → cache'leme, sonra tekrar dene
    const d = (await res.json()) as { real?: boolean; geometry?: GeoJSON.Geometry };
    const entry: GeoEntry = d.real && d.geometry ? { real: true, geometry: d.geometry } : { real: false };
    geoCache.set(p.id, entry);
    return entry;
  } catch {
    return null;
  }
}

// Geometri → [batı, güney, doğu, kuzey] bbox (fitBounds için).
function geometryBounds(g: GeoJSON.Geometry): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      const x = c[0] as number, y = c[1] as number;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) c.forEach(eat);
  };
  const gg = g as { coordinates?: unknown };
  if (!gg.coordinates) return null;
  eat(gg.coordinates);
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [minX, minY, maxX, maxY];
}

// acres → merkez etrafında kare halka [lng,lat][] (extrusion tabanı).
// 2D'deki parcelBounds ile aynı matematik; GERÇEK tapu sınırı değil (fallback).
function squareRing(lat: number, lng: number, acres: number): [number, number][] {
  const side = Math.sqrt(Math.max(acres, 0.05) * 4046.86);
  const dLat = side / 2 / 111320;
  const dLng = side / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - dLng, lat - dLat], [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat], [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

function pointsToGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id, grade: p.dealGrade ?? "", spread: p.spread || 0,
        absentee: p.absentee ? 1 : 0,
        // Gerçek Regrid sınırı yüklü mü? Yüklüyse yüksek zoom'da nokta küçülüp
        // soluklaşır (sınır+dolgu zaten oradadır); yoksa nokta BÜYÜK kalır.
        hasGeo: geoCache.get(p.id)?.real ? 1 : 0,
      },
    })),
  };
}

// Cache'te GERÇEK sınırı olan parseller → sınır katmanı FeatureCollection'ı.
function parcelBoundariesGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const p of points) {
    const e = geoCache.get(p.id);
    if (!e?.real || !e.geometry) continue;
    features.push({
      type: "Feature",
      geometry: e.geometry,
      properties: { id: p.id, grade: p.dealGrade ?? "", spread: p.spread || 0 },
    });
  }
  return { type: "FeatureCollection", features };
}

function spreadColumnsGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points
      .filter((p) => (p.spread || 0) > 0)
      .map((p) => {
        // GERÇEK Regrid poligonu varsa gerçek şekli extrude et; yoksa kare fallback.
        const e = geoCache.get(p.id);
        const geometry: GeoJSON.Geometry =
          e?.real && e.geometry && (e.geometry.type === "Polygon" || e.geometry.type === "MultiPolygon")
            ? e.geometry
            : { type: "Polygon", coordinates: [squareRing(p.lat, p.lng, p.acres)] };
        return {
          type: "Feature" as const,
          geometry,
          properties: {
            id: p.id, grade: p.dealGrade ?? "",
            // yükseklik ∝ √spread (lineer olsaydı $50k kule gökyüzünü delerdi).
            // $1.5k → ~390m, $10k → ~1km; 1.2km tavan (yakın uçuşta ekranı yutmasın).
            h: Math.min(Math.round(Math.sqrt(Math.max(p.spread || 0, 0)) * 10), 1200),
            spread: p.spread || 0,
            real: e?.real ? 1 : 0,
          },
        };
      }),
  };
}

function compsToGeoJSON(comps: CompMarker[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: comps.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: { id: c.id, competitor: c.competitor, title: c.title, price: c.price ?? 0, acres: c.acres ?? 0 },
    })),
  };
}

const btn3d = (active: boolean, on = "#0f172a", border = "#0f172a"): React.CSSProperties => ({
  background: active ? on : "rgba(255,255,255,0.95)",
  color: active ? "#fff" : "#334155",
  border: `1px solid ${active ? border : "#e2e8f0"}`,
  borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", textAlign: "left",
});

// Tier rengine göre MapLibre match ifadesi (tekrarları önler).
const gradeMatch = (colors: Record<string, string>, fallback: string) =>
  ["match", ["get", "grade"], "A", colors.A, "B", colors.B, "C", colors.C, fallback] as unknown as maplibregl.ExpressionSpecification;

// ── Nokta boyutu: zoom'la büyür (uyduda kaybolmasın). Yüksek zoom'da GERÇEK
// sınırı yüklü parselin noktası küçülür (sınır devralır); sınırı olmayan BÜYÜK kalır.
const aSize = (a: number, other: number) =>
  ["case", ["==", ["get", "grade"], "A"], a, other];
const DOT_RADIUS = ["interpolate", ["linear"], ["zoom"],
  8, aSize(6, 4.5),
  12, aSize(10, 8),
  14, ["case", ["==", ["get", "hasGeo"], 1], 4.5, aSize(13, 11)],
  16, ["case", ["==", ["get", "hasGeo"], 1], 3.5, aSize(15, 12.5)],
] as unknown as maplibregl.ExpressionSpecification;
const DOT_OPACITY = ["interpolate", ["linear"], ["zoom"],
  12, 0.92,
  14, ["case", ["==", ["get", "hasGeo"], 1], 0.35, 0.95],
] as unknown as maplibregl.ExpressionSpecification;
const RING_RADIUS = ["interpolate", ["linear"], ["zoom"],
  8, aSize(9, 7.5),
  12, aSize(13, 11),
  14, ["case", ["==", ["get", "hasGeo"], 1], 7, aSize(16, 14)],
  16, ["case", ["==", ["get", "hasGeo"], 1], 6, aSize(18, 15.5)],
] as unknown as maplibregl.ExpressionSpecification;

export default function DealsMap3D({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [extrude, setExtrude] = useState(false);
  const [showComp, setShowComp] = useState(true);
  const [competitors, setCompetitors] = useState<CompMarker[]>([]);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  // Kamera eğik mi? (pitch > 5°) — kuş bakışından 3D'ye dönüş düğmesi için.
  const [pitched, setPitched] = useState(true);
  // OSM 3D binalar (OpenFreeMap) — varsayılan KAPALI; zoom ≥ 14'te etkili.
  const [showBuildings, setShowBuildings] = useState(false);
  // Regrid sınır durumu: geoVersion cache her büyüyünce artar → kaynaklar tazelenir.
  const [geoVersion, setGeoVersion] = useState(0);
  const [boundaryLoading, setBoundaryLoading] = useState(0); // uçuştaki istek sayısı
  // Sunum turu durumu
  const [tourIdx, setTourIdx] = useState<number | null>(null); // null = tur kapalı
  const tourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const hoveredIdRef = useRef<string | null>(null);
  const tourStopIdRef = useRef<string | null>(null); // aktif tur durağı (geç gelen sınırla yeniden kadrajlama)

  const topDeals = useMemo(
    () => [...points].sort((a, b) => (b.spread || 0) - (a.spread || 0)).slice(0, TOUR_STOPS),
    [points]
  );

  // Cache'teki gerçek sınır sayısı (legend rozeti).
  const boundaryCount = useMemo(() => {
    void geoVersion;
    let n = 0;
    for (const p of points) if (geoCache.get(p.id)?.real) n++;
    return n;
  }, [points, geoVersion]);

  // ── Görünüm alanındaki parseller için Regrid sınırlarını parça parça yükle ──
  // Zoom ≥ 12 + debounce; merkeze en yakın BOUNDARY_BATCH parsel; eşzamanlılık sınırlı.
  const loadViewportBoundaries = useCallback(async () => {
    const map = mapRef.current;
    if (!map || map.getZoom() < BOUNDARY_MIN_ZOOM) return;
    const b = map.getBounds();
    const c = map.getCenter();
    const candidates = pointsRef.current
      .filter((p) => !geoCache.has(p.id) && !geoPending.has(p.id) && b.contains([p.lng, p.lat]))
      .map((p) => ({ p, d: (p.lat - c.lat) ** 2 + (p.lng - c.lng) ** 2 }))
      .sort((a, z) => a.d - z.d)
      .slice(0, BOUNDARY_BATCH)
      .map((x) => x.p);
    if (!candidates.length) return;
    for (const p of candidates) geoPending.add(p.id);
    setBoundaryLoading((n) => n + candidates.length);
    const queue = [...candidates];
    let gotAny = false;
    const worker = async () => {
      for (;;) {
        const p = queue.shift();
        if (!p) return;
        const entry = await fetchParcelGeo(p);
        geoPending.delete(p.id);
        setBoundaryLoading((n) => Math.max(0, n - 1));
        if (entry?.real) gotAny = true;
      }
    };
    await Promise.all(Array.from({ length: BOUNDARY_CONCURRENCY }, worker));
    if (gotAny) setGeoVersion((v) => v + 1);
  }, []);

  // ── Harita kurulumu (bir kez) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const pts = pointsRef.current;
    const cLat = pts.length ? pts.reduce((s, p) => s + p.lat, 0) / pts.length : 35.2;
    const cLng = pts.length ? pts.reduce((s, p) => s + p.lng, 0) / pts.length : -113.8;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Stil elle: raster uydu + terrarium DEM. Harici stil servisi/key YOK.
      style: {
        version: 8,
        sources: {
          esri: { type: "raster", tiles: [ESRI_SAT], tileSize: 256, maxzoom: 19, attribution: "© Esri World Imagery" },
          esriRoads: { type: "raster", tiles: [ESRI_ROADS], tileSize: 256, maxzoom: 19, attribution: "© Esri World Transportation" },
          dem: { type: "raster-dem", tiles: [TERRAIN_DEM], tileSize: 256, encoding: "terrarium", maxzoom: 13, attribution: "Terrain: AWS Open Data / Mapzen" },
          demHill: { type: "raster-dem", tiles: [TERRAIN_DEM], tileSize: 256, encoding: "terrarium", maxzoom: 13 },
        },
        layers: [
          // raster-fade-duration: yeni tile'lar yumuşak geçsin — farklı çekim
          // tarihli Esri karoları arasındaki sert dikiş daha az göze batar.
          { id: "sat", type: "raster", source: "esri", paint: { "raster-fade-duration": 400 } },
          // Hillshade uydu ÜSTÜNDE hafif — topoğrafya derinliği (çöl tepeleri okunur).
          { id: "hillshade", type: "hillshade", source: "demHill", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#1e293b" } },
          { id: "roads", type: "raster", source: "esriRoads", paint: { "raster-opacity": 0.9, "raster-fade-duration": 400 } },
        ],
        terrain: { source: "dem", exaggeration: 1.4 },
        // Ufka doğru SICAK PUS (fog): uzak/düşük-çözünürlük karolar pusun içinde
        // erir → farklı tile-vintage dikişi maskelenir + derinlik hissi. İnce ayar:
        // hafif sıcak (çöl toprağıyla uyumlu), gri çorba değil.
        sky: {
          "sky-color": "#7dd3fc", "horizon-color": "#eadfca", "fog-color": "#e7dcc6",
          "sky-horizon-blend": 0.6, "fog-ground-blend": 0.55, "horizon-fog-blend": 0.75,
        },
      },
      center: [cLng, cLat],
      zoom: 9,
      pitch: 55,
      bearing: -15,
      // 60° tavan: en uzak/en kötü LOD karoları hiç kadraja girmesin (dikiş azalır).
      maxPitch: 60,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }), "top-left");
    map.addControl(new maplibregl.TerrainControl({ source: "dem", exaggeration: 1.4 }), "top-left");

    map.on("load", () => {
      // ── OSM 3D binalar (OpenFreeMap vektör, key'siz) — varsayılan gizli ──
      // Çöl uydusuna uyan sıcak gri-ten dolgu; yükseklik OSM render_height'tan,
      // etiketsiz binalarda ~4.5m. Parsel sınır katmanlarından ÖNCE eklenir →
      // sınırlar/vurgular binaların üzerinde çizilir (asla örtülmez).
      map.addSource("openfreemap", { type: "vector", url: OPENFREEMAP_TILEJSON });
      map.addLayer({
        id: "osm-buildings", type: "fill-extrusion", source: "openfreemap",
        "source-layer": "building", minzoom: BUILDING_MIN_ZOOM,
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": "#d8c9ae",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 4.5],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.85,
          "fill-extrusion-vertical-gradient": true,
        },
      });

      // ── GERÇEK Regrid tapu sınırları (zoom ≥ 12'de yüklenir) ──
      // promoteId: feature-state (hover) id olarak properties.id kullanılsın.
      map.addSource("parcels", { type: "geojson", data: parcelBoundariesGeoJSON(pointsRef.current), promoteId: "id" });
      // 1) Dış GLOW — aynı çizgi, geniş + düşük opaklık + blur (MapLibre glow hilesi).
      map.addLayer({
        id: "parcel-glow", type: "line", source: "parcels", minzoom: 10.5,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": gradeMatch(GRADE_BRIGHT, "#e2e8f0"),
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 16, 14],
          "line-opacity": 0.28,
          "line-blur": 4,
        },
      });
      // 2) Yarı-şeffaf tier dolgusu — hover'da parlar (feature-state).
      map.addLayer({
        id: "parcel-fill", type: "fill", source: "parcels", minzoom: 10.5,
        paint: {
          "fill-color": gradeMatch(GRADE_BRIGHT, "#e2e8f0"),
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.32, 0.1],
        },
      });
      // 3) Ana kontur — parlak tier rengi, ince beyaz iç his için yüksek opaklık.
      map.addLayer({
        id: "parcel-line", type: "line", source: "parcels", minzoom: 10.5,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": gradeMatch(GRADE_BRIGHT, "#e2e8f0"),
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.8, 16, 3.2],
          "line-opacity": 0.95,
        },
      });
      // 4) Seçili / tur parseli vurgusu — amber nabız (filter dışarıdan güncellenir).
      map.addLayer({
        id: "parcel-hl-fill", type: "fill", source: "parcels",
        filter: ["in", ["get", "id"], ["literal", []]],
        paint: { "fill-color": "#fbbf24", "fill-opacity": 0.22 },
      });
      map.addLayer({
        id: "parcel-hl-glow", type: "line", source: "parcels",
        filter: ["in", ["get", "id"], ["literal", []]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f59e0b", "line-width": 14, "line-opacity": 0.35, "line-blur": 6 },
      });
      map.addLayer({
        id: "parcel-hl-line", type: "line", source: "parcels",
        filter: ["in", ["get", "id"], ["literal", []]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fde68a", "line-width": 3.5, "line-opacity": 1 },
      });

      // ── parsel noktaları (tier renkleri 2D ile aynı) ──
      map.addSource("deals", { type: "geojson", data: pointsToGeoJSON(pointsRef.current) });
      // absentee halkası (amber, altta)
      map.addLayer({
        id: "deal-absentee", type: "circle", source: "deals",
        filter: ["==", ["get", "absentee"], 1],
        paint: {
          "circle-radius": RING_RADIUS,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#d97706",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 3],
          "circle-stroke-opacity": DOT_OPACITY,
          "circle-pitch-alignment": "map",
        },
      });
      map.addLayer({
        id: "deal-dots", type: "circle", source: "deals",
        paint: {
          "circle-radius": DOT_RADIUS,
          "circle-color": gradeMatch(GRADE_COLOR, "#cbd5e1"),
          // Kalın beyaz hale — uydu zeminde nokta "pop" eder.
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 13, 2.5],
          "circle-opacity": DOT_OPACITY,
          "circle-pitch-alignment": "map",
        },
      });
      // ── spread kuleleri (başta gizli — toggle açar) ──
      map.addSource("columns", { type: "geojson", data: spreadColumnsGeoJSON(pointsRef.current) });
      map.addLayer({
        id: "spread-columns", type: "fill-extrusion", source: "columns",
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": gradeMatch(GRADE_COLOR, "#cbd5e1"),
          "fill-extrusion-height": ["get", "h"],
          "fill-extrusion-opacity": 0.82,
        },
      });
      // ── rakip ilanları (kırmızı, elmas hissi için kare stroke) ──
      map.addSource("comps", { type: "geojson", data: compsToGeoJSON([]) });
      map.addLayer({
        id: "comp-dots", type: "circle", source: "comps",
        paint: {
          "circle-radius": 5, "circle-color": COMP_COLOR,
          "circle-stroke-color": "#fff", "circle-stroke-width": 1.5,
          "circle-pitch-alignment": "map",
        },
      });

      // Tıklama → bilgi kartı (React overlay; MapLibre popup yerine — stil tutarlı).
      const selectById = (id: string | undefined) => {
        if (!id) return;
        const p = pointsRef.current.find((x) => x.id === id) ?? null;
        setSelected(p);
        // Sınır cache'te yoksa tek parsel için hemen getir (vurgu çizilsin).
        if (p && !geoCache.has(p.id) && !geoPending.has(p.id)) {
          geoPending.add(p.id);
          setBoundaryLoading((n) => n + 1);
          fetchParcelGeo(p).then((e) => {
            geoPending.delete(p.id);
            setBoundaryLoading((n) => Math.max(0, n - 1));
            if (e?.real) setGeoVersion((v) => v + 1);
          });
        }
      };
      map.on("click", "deal-dots", (e) => selectById(e.features?.[0]?.properties?.id as string | undefined));
      map.on("click", "spread-columns", (e) => selectById(e.features?.[0]?.properties?.id as string | undefined));
      map.on("click", "parcel-fill", (e) => selectById(e.features?.[0]?.properties?.id as string | undefined));
      map.on("click", "comp-dots", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as Record<string, unknown>;
        new maplibregl.Popup({ offset: 10 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-size:12px;line-height:1.5"><b style="color:${COMP_COLOR}">🟥 RAKİP — ${pr.competitor}</b><br/>${pr.title}<br/>` +
            `${pr.acres ? pr.acres + " acre" : ""}${pr.price ? " · $" + Number(pr.price).toLocaleString() : ""}` +
            `<div style="font-size:10px;color:#94a3b8">Konum yaklaşık (şehir merkezi)</div>` +
            `<a href="/admin/rakip-radar?q=${encodeURIComponent(String(pr.title || pr.competitor || ""))}" style="color:#0284c7">📡 Radar kaydı ↗</a></div>`
          )
          .addTo(map);
      });
      // Hover: parsel dolgusu parlar (feature-state) + işaretçi.
      map.on("mousemove", "parcel-fill", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (!id || id === hoveredIdRef.current) return;
        if (hoveredIdRef.current) map.setFeatureState({ source: "parcels", id: hoveredIdRef.current }, { hover: false });
        hoveredIdRef.current = id;
        map.setFeatureState({ source: "parcels", id }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "parcel-fill", () => {
        if (hoveredIdRef.current) map.setFeatureState({ source: "parcels", id: hoveredIdRef.current }, { hover: false });
        hoveredIdRef.current = null;
        map.getCanvas().style.cursor = "";
      });
      for (const layer of ["deal-dots", "spread-columns", "comp-dots"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
      setReady(true);
    });
    // Eğim değişince düğme etiketi güncellensin (kullanıcı elle eğse de).
    map.on("pitchend", () => setPitched(map.getPitch() > 5));

    return () => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Harita hareketi → görünümdeki sınırları debounce'lu yükle (zoom ≥ 12).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void loadViewportBoundaries(); }, BOUNDARY_DEBOUNCE_MS);
    };
    map.on("moveend", schedule);
    map.on("zoomend", schedule);
    schedule(); // ilk yükleme (kullanıcı zaten yakınsa)
    return () => {
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
      if (timer) clearTimeout(timer);
    };
  }, [ready, loadViewportBoundaries]);

  // Rakip ilanları (2D ile aynı endpoint).
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/competitor-map")
      .then((r) => r.json())
      .then((d) => { if (alive) setCompetitors(Array.isArray(d.markers) ? d.markers : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Veri/cache değişince kaynakları tazele (grade filtresi server-side → points değişir;
  // geoVersion → yeni Regrid sınırları geldi → sınır + kule geometrileri güncellenir).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("deals") as maplibregl.GeoJSONSource | undefined)?.setData(pointsToGeoJSON(points));
    (map.getSource("columns") as maplibregl.GeoJSONSource | undefined)?.setData(spreadColumnsGeoJSON(points));
    (map.getSource("parcels") as maplibregl.GeoJSONSource | undefined)?.setData(parcelBoundariesGeoJSON(points));
  }, [points, geoVersion, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("comps") as maplibregl.GeoJSONSource | undefined)?.setData(compsToGeoJSON(showComp ? competitors : []));
  }, [competitors, showComp, ready]);

  // Kule modu görünürlüğü.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("spread-columns", "visibility", extrude ? "visible" : "none");
    // Kule modunda noktaları soluklaştır (kuleler zaten tier-renkli);
    // kapanınca zoom-duyarlı varsayılan opaklık ifadesine geri dön.
    map.setPaintProperty("deal-dots", "circle-opacity", extrude ? 0.25 : DOT_OPACITY);
    // Kule modunda düz sınır dolgusu/konturu gizle (extrusion zaten gerçek şekil).
    for (const l of ["parcel-glow", "parcel-fill", "parcel-line"]) {
      map.setLayoutProperty(l, "visibility", extrude ? "none" : "visible");
    }
  }, [extrude, ready]);

  // OSM 3D binalar görünürlüğü.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("osm-buildings", "visibility", showBuildings ? "visible" : "none");
  }, [showBuildings, ready]);

  const tourDeal = tourIdx != null ? topDeals[tourIdx] : null;

  // ── Seçili + tur parseli vurgusu: amber filtre + nabız animasyonu ──
  const highlightIds = useMemo(() => {
    const ids: string[] = [];
    if (selected) ids.push(selected.id);
    if (tourDeal && tourDeal.id !== selected?.id) ids.push(tourDeal.id);
    return ids;
  }, [selected, tourDeal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const filter = ["in", ["get", "id"], ["literal", highlightIds]] as maplibregl.FilterSpecification;
    for (const l of ["parcel-hl-fill", "parcel-hl-glow", "parcel-hl-line"]) map.setFilter(l, filter);
    if (!highlightIds.length) return;
    // Nabız: kontur genişliği + glow opaklığı sinüsle salınır (sunumda dikkat çeker).
    let raf = 0;
    const t0 = performance.now();
    const pulse = (t: number) => {
      const s = (Math.sin((t - t0) / 280) + 1) / 2; // 0..1
      if (map.getLayer("parcel-hl-line")) map.setPaintProperty("parcel-hl-line", "line-width", 2.5 + s * 2.5);
      if (map.getLayer("parcel-hl-glow")) map.setPaintProperty("parcel-hl-glow", "line-opacity", 0.22 + s * 0.3);
      raf = requestAnimationFrame(pulse);
    };
    raf = requestAnimationFrame(pulse);
    return () => cancelAnimationFrame(raf);
  }, [highlightIds, ready]);

  // ── Sunum turu: durak durak uçuş — gerçek sınır varsa kadraja al (fitBounds) ──
  const flyToStop = useCallback((idx: number) => {
    const map = mapRef.current;
    const stop = topDeals[idx];
    if (!map || !stop) return;
    tourStopIdRef.current = stop.id;
    const bearing = (idx % 2 ? -1 : 1) * (20 + idx * 7); // her durakta hafif farklı açı — sinematik
    const flyFallback = () => {
      map.flyTo({ center: [stop.lng, stop.lat], zoom: 14.5, pitch: 58, bearing, duration: 3800, essential: true });
    };
    const flyToGeometry = (g: GeoJSON.Geometry) => {
      const bb = geometryBounds(g);
      if (!bb) return flyFallback();
      // cameraForBounds sınırı kadrajlar; pitch'i uçuşta ekliyoruz (pay için hafif geri).
      const cam = map.cameraForBounds(new maplibregl.LngLatBounds([bb[0], bb[1]], [bb[2], bb[3]]), {
        padding: 110, bearing, maxZoom: 16.8,
      });
      if (!cam) return flyFallback();
      map.flyTo({ ...cam, zoom: Math.min((cam.zoom ?? 14.5) - 0.25, 16.5), pitch: 56, duration: 3800, essential: true });
    };
    const cached = geoCache.get(stop.id);
    if (cached?.real && cached.geometry) return flyToGeometry(cached.geometry);
    if (cached) return flyFallback(); // sınır yok (no_coverage) — merkez uçuşu
    // Sınır henüz sorulmamış → getir; uçuşu bekletme (önce merkeze uç, sınır
    // gelince vurgu görünür + hâlâ bu duraktaysak kamerayı sınıra kadrajla).
    flyFallback();
    if (!geoPending.has(stop.id)) {
      geoPending.add(stop.id);
      fetchParcelGeo(stop).then((e) => {
        geoPending.delete(stop.id);
        if (e?.real) {
          setGeoVersion((v) => v + 1);
          if (e.geometry && tourStopIdRef.current === stop.id) flyToGeometry(e.geometry);
        }
      });
    }
  }, [topDeals]);

  const startTour = () => {
    if (!topDeals.length) return;
    setSelected(null);
    setTourIdx(0);
    flyToStop(0);
  };
  const stopTour = useCallback(() => {
    if (tourTimer.current) clearTimeout(tourTimer.current);
    tourTimer.current = null;
    tourStopIdRef.current = null;
    setTourIdx(null);
  }, []);
  const nextStop = useCallback(() => {
    setTourIdx((i) => {
      if (i == null) return null;
      const n = i + 1;
      if (n >= topDeals.length) { tourStopIdRef.current = null; return null; } // tur bitti
      flyToStop(n);
      return n;
    });
  }, [topDeals.length, flyToStop]);
  // Otomatik ilerleme: her durakta uçuş (≈3.8s) + okuma payı (≈4.2s).
  useEffect(() => {
    if (tourIdx == null) return;
    tourTimer.current = setTimeout(nextStop, 8000);
    return () => { if (tourTimer.current) clearTimeout(tourTimer.current); };
  }, [tourIdx, nextStop]);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

      {/* Üstte ince sıcak-pus degradesi (ekran-uzayı) — ufuktaki tile dikişini
          yumuşatan ikinci sigorta; tıklamayı engellemez. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "18%", zIndex: 5, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(231,220,198,0.4), rgba(231,220,198,0.12) 55%, transparent)" }} />

      {/* ── Regrid sınır yükleme göstergesi (üst-orta, göze batmayan) ── */}
      {boundaryLoading > 0 && (
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 25, background: "rgba(15,23,42,0.85)", color: "#e2e8f0", borderRadius: 999, padding: "5px 13px", fontSize: 11, fontWeight: 600, boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
          📐 Regrid tapu sınırları yükleniyor… ({boundaryLoading})
        </div>
      )}

      {/* ── Sol-alt kontrol yığını (2D ile aynı hizada) ── */}
      <div style={{ position: "absolute", bottom: 16, left: 10, zIndex: 20, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        {/* Görünüm düğmesi: kuş bakışı ↔ eğik. Kuş bakışına inen kullanıcı
            sağ-tık sürüklemeyi bilmese de tek tıkla 3D'ye döner. */}
        <button
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            map.easeTo({ pitch: pitched ? 0 : 55, duration: 1200, essential: true });
          }}
          style={btn3d(pitched, "#0f766e", "#115e59")}
          title="Kuş bakışı (dik) ile eğik 3D görünüm arasında geçiş — merkez/zoom korunur"
        >
          {pitched ? "⬇ Kuş bakışına geç" : "🏔 Eğik görünüme dön (3D)"}
        </button>
        <button onClick={() => (tourIdx == null ? startTour() : stopTour())} style={btn3d(tourIdx != null, "#7c3aed", "#6d28d9")}>
          🎬 Sunum turu{tourIdx != null ? ` · ${tourIdx + 1}/${topDeals.length} (durdur)` : ` (top ${Math.min(TOUR_STOPS, topDeals.length)})`}
        </button>
        <button onClick={() => setExtrude((v) => !v)} style={btn3d(extrude, "#0e7490", "#155e75")} title="Parselleri spread'e orantılı 3D kule olarak göster (gerçek Regrid şekli varsa o extrude edilir)">
          📊 Spread kuleleri: {extrude ? "Açık" : "Kapalı"}
        </button>
        <button onClick={() => setShowComp((v) => !v)} style={btn3d(showComp, "#dc2626", "#b91c1c")}>
          🟥 Rakip ilanları{competitors.length ? ` (${competitors.length})` : ""}: {showComp ? "Açık" : "Kapalı"}
        </button>
        <button onClick={() => setShowBuildings((v) => !v)} style={btn3d(showBuildings, "#78716c", "#57534e")} title="OSM bina ayak izlerini 3D olarak göster (OpenFreeMap · zoom ≥ 14)">
          🏢 3D Binalar: {showBuildings ? "Açık" : "Kapalı"}
        </button>
        <div style={{ background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 11, lineHeight: 1.7, color: "#334155", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", maxWidth: 230 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>3D Arazi</div>
          <div><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GRADE_COLOR.A, marginRight: 6 }} />A deal · <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GRADE_COLOR.B, marginRight: 6, marginLeft: 4 }} />B · <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GRADE_COLOR.C, marginRight: 6, marginLeft: 4 }} />C</div>
          <div><span style={{ display: "inline-block", width: 11, height: 11, border: `2px solid ${GRADE_BRIGHT.A}`, background: "rgba(52,211,153,0.15)", borderRadius: 2, marginRight: 6, verticalAlign: "middle" }} />Parlak kontur = <b>gerçek tapu sınırı (Regrid)</b>{boundaryCount ? ` · ${boundaryCount} yüklü` : ""}</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Sınırlar zoom ≥ {BOUNDARY_MIN_ZOOM}&apos;de görünür bölge için yüklenir · seçili/tur parseli amber yanıp söner</div>
          <div><span style={{ display: "inline-block", width: 9, height: 9, background: COMP_COLOR, transform: "rotate(45deg)", marginRight: 7 }} />Rakip ilanı (yaklaşık)</div>
          <div style={{ color: "#64748b" }}>Sağ tık / iki parmak: eğ &amp; döndür · 🏔 düğmesi: 3D araziyi aç/kapa</div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>Kot: AWS Terrain (~30m) — parsel-kesin değil · 1.4× abartı · Kuleler: Regrid şekli varsa gerçek, yoksa ~kare · 🏢 Binalar: OSM/OpenFreeMap, zoom ≥ {BUILDING_MIN_ZOOM}</div>
        </div>
      </div>

      {/* ── Tıklanan parsel bilgi kartı ── */}
      {selected && !tourDeal && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 30, background: "rgba(255,255,255,0.97)", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 13px", fontSize: 12, lineHeight: 1.6, color: "#0f172a", boxShadow: "0 6px 24px rgba(0,0,0,0.25)", width: 250 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>
              {selected.dealGrade && <span style={{ background: GRADE_COLOR[selected.dealGrade] ?? "#cbd5e1", color: "#fff", borderRadius: 3, padding: "1px 6px", marginRight: 6 }}>{selected.dealGrade}</span>}
              {selected.owner || selected.apn}
            </span>
            <button onClick={() => setSelected(null)} aria-label="Kapat" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#94a3b8", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ color: "#64748b" }}>{[selected.region, selected.county, selected.state].filter(Boolean).join(", ")}</div>
          <div>{selected.acres?.toFixed(2)} acre{selected.absentee ? " · absentee" : ""} · APN {selected.apn || "—"}</div>
          <div>Piyasa: <b>{selected.marketValue ? usd(selected.marketValue) : "comp gerekli"}</b></div>
          <div>Teklif: <b style={{ color: "#059669" }}>{selected.estOffer ? usd(selected.estOffer) : "—"}</b> · Spread: <b style={{ color: "#059669" }}>{selected.spread ? usd(selected.spread) : "—"}</b></div>
          <div style={{ fontSize: 10, marginTop: 2, color: geoCache.get(selected.id)?.real ? "#047857" : "#94a3b8" }}>
            {geoCache.get(selected.id)?.real
              ? "📐 Gerçek tapu sınırı (Regrid) vurgulandı"
              : geoCache.has(selected.id)
                ? "📐 Bu parsel için Regrid sınırı yok (kapsam dışı) — nokta/kare yaklaşık"
                : "📐 Regrid sınırı sorgulanıyor…"}
          </div>
          <a
            href={`/admin/parcel-sunum?id=${encodeURIComponent(selected.id)}`}
            target="_blank" rel="noreferrer"
            style={{ display: "inline-block", marginTop: 7, background: "#0ea5e9", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
          >
            🖨 Tek Sayfa Sunum (PDF)
          </a>
        </div>
      )}

      {/* ── Sunum turu bilgi kartı ── */}
      {tourDeal && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 30, background: "rgba(15,23,42,0.94)", border: "1px solid #334155", borderRadius: 12, padding: "13px 15px", fontSize: 13, lineHeight: 1.65, color: "#e2e8f0", boxShadow: "0 8px 30px rgba(0,0,0,0.4)", width: 265 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1 }}>
            🎬 Sunum turu · Durak {tourIdx! + 1}/{topDeals.length}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
            {tourDeal.dealGrade && <span style={{ background: GRADE_COLOR[tourDeal.dealGrade] ?? "#cbd5e1", color: "#fff", borderRadius: 3, padding: "1px 6px", marginRight: 6, fontSize: 12 }}>{tourDeal.dealGrade}</span>}
            {[tourDeal.county, tourDeal.state].filter(Boolean).join(", ") || tourDeal.region}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{tourDeal.region} · {tourDeal.acres?.toFixed(2)} acre</div>
          <div style={{ fontSize: 10, marginTop: 2, color: geoCache.get(tourDeal.id)?.real ? "#4ade80" : "#94a3b8" }}>
            {geoCache.get(tourDeal.id)?.real ? "📐 Gerçek tapu sınırı kadrajda (Regrid)" : "📐 Sınır: Regrid kapsamına göre"}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
            <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Piyasa</div><b>{tourDeal.marketValue ? usd(tourDeal.marketValue) : "—"}</b></div>
            <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Teklif</div><b>{tourDeal.estOffer ? usd(tourDeal.estOffer) : "—"}</b></div>
            <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Spread</div><b style={{ color: "#4ade80" }}>{tourDeal.spread ? usd(tourDeal.spread) : "—"}</b></div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={nextStop} style={{ flex: 1, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sonraki ➔</button>
            <button onClick={stopTour} style={{ background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Bitir</button>
          </div>
        </div>
      )}
    </div>
  );
}
