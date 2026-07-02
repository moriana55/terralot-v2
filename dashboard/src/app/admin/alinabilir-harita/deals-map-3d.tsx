"use client";

// ── 3D DEAL HARİTASI (MapLibre GL + arazi kabartması) ────────────────────────
// 2D Leaflet haritasının SUNUM-sınıfı 3D kardeşi. Aynı MapPoint verisini alır:
//  • Altlık: Esri World Imagery (raster) — 2D ile aynı uydu.
//  • Arazi: AWS Terrain Tiles (terrarium encoding) — ÜCRETSİZ, key GEREKMEZ.
//    Kaynak: s3.amazonaws.com/elevation-tiles-prod (Mapzen mirası, AWS Open Data).
//  • Hillshade: aynı DEM'den gölgeleme → çöl topoğrafyası okunur.
//  • Parsel noktaları: A/B/C tier renkleri 2D ile birebir aynı.
//  • Spread kule modu: parsel → acre-boyutlu kare fill-extrusion, yükseklik ∝ spread.
//  • Sunum turu: en yüksek spread'li N deal'e sinematik flyTo + bilgi kartı.
// DEM yaklaşık ~30m çözünürlük; parsel-kesin kot değil (dürüst not UI'da).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPoint } from "./deals-map";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const GRADE_COLOR: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#94a3b8" };
const COMP_COLOR = "#dc2626";
const TERRAIN_DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
const TOUR_STOPS = 8; // sunum turu durak sayısı (en yüksek spread)

type CompMarker = {
  id: string; competitor: string; title: string; acres: number | null;
  price: number | null; rawUrl: string | null; lat: number; lng: number; matched: string;
};

// acres → merkez etrafında kare halka [lng,lat][] (extrusion tabanı).
// 2D'deki parcelBounds ile aynı matematik; GERÇEK tapu sınırı değil (dürüst).
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
      },
    })),
  };
}

function spreadColumnsGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points
      .filter((p) => (p.spread || 0) > 0)
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [squareRing(p.lat, p.lng, p.acres)] },
        properties: {
          id: p.id, grade: p.dealGrade ?? "",
          // yükseklik ∝ √spread (lineer olsaydı $50k kule gökyüzünü delerdi).
          // $1.5k → ~390m, $10k → ~1km; 1.2km tavan (yakın uçuşta ekranı yutmasın).
          h: Math.min(Math.round(Math.sqrt(Math.max(p.spread || 0, 0)) * 10), 1200),
          spread: p.spread || 0,
        },
      })),
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

export default function DealsMap3D({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [extrude, setExtrude] = useState(false);
  const [showComp, setShowComp] = useState(true);
  const [competitors, setCompetitors] = useState<CompMarker[]>([]);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  // Sunum turu durumu
  const [tourIdx, setTourIdx] = useState<number | null>(null); // null = tur kapalı
  const tourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const topDeals = useMemo(
    () => [...points].sort((a, b) => (b.spread || 0) - (a.spread || 0)).slice(0, TOUR_STOPS),
    [points]
  );

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
          { id: "sat", type: "raster", source: "esri" },
          // Hillshade uydu ÜSTÜNDE hafif — topoğrafya derinliği (çöl tepeleri okunur).
          { id: "hillshade", type: "hillshade", source: "demHill", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#1e293b" } },
          { id: "roads", type: "raster", source: "esriRoads", paint: { "raster-opacity": 0.9 } },
        ],
        terrain: { source: "dem", exaggeration: 1.4 },
        sky: { "sky-color": "#7dd3fc", "horizon-color": "#e0f2fe", "fog-color": "#e2e8f0", "sky-horizon-blend": 0.6 },
      },
      center: [cLng, cLat],
      zoom: 9,
      pitch: 55,
      bearing: -15,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }), "top-left");
    map.addControl(new maplibregl.TerrainControl({ source: "dem", exaggeration: 1.4 }), "top-left");

    map.on("load", () => {
      // ── parsel noktaları (tier renkleri 2D ile aynı) ──
      map.addSource("deals", { type: "geojson", data: pointsToGeoJSON(pointsRef.current) });
      // absentee halkası (amber, altta)
      map.addLayer({
        id: "deal-absentee", type: "circle", source: "deals",
        filter: ["==", ["get", "absentee"], 1],
        paint: {
          "circle-radius": ["case", ["==", ["get", "grade"], "A"], 10, 8],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#d97706", "circle-stroke-width": 2,
          "circle-pitch-alignment": "map",
        },
      });
      map.addLayer({
        id: "deal-dots", type: "circle", source: "deals",
        paint: {
          "circle-radius": ["case", ["==", ["get", "grade"], "A"], 7, 5],
          "circle-color": ["match", ["get", "grade"], "A", GRADE_COLOR.A, "B", GRADE_COLOR.B, "C", GRADE_COLOR.C, "#cbd5e1"],
          "circle-stroke-color": "#fff", "circle-stroke-width": 1.2,
          "circle-opacity": 0.9,
          "circle-pitch-alignment": "map",
        },
      });
      // ── spread kuleleri (başta gizli — toggle açar) ──
      map.addSource("columns", { type: "geojson", data: spreadColumnsGeoJSON(pointsRef.current) });
      map.addLayer({
        id: "spread-columns", type: "fill-extrusion", source: "columns",
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": ["match", ["get", "grade"], "A", GRADE_COLOR.A, "B", GRADE_COLOR.B, "C", GRADE_COLOR.C, "#cbd5e1"],
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
      map.on("click", "deal-dots", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id) setSelected(pointsRef.current.find((p) => p.id === id) ?? null);
      });
      map.on("click", "spread-columns", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id) setSelected(pointsRef.current.find((p) => p.id === id) ?? null);
      });
      map.on("click", "comp-dots", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as Record<string, unknown>;
        new maplibregl.Popup({ offset: 10 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-size:12px;line-height:1.5"><b style="color:${COMP_COLOR}">🟥 RAKİP — ${pr.competitor}</b><br/>${pr.title}<br/>` +
            `${pr.acres ? pr.acres + " acre" : ""}${pr.price ? " · $" + Number(pr.price).toLocaleString() : ""}` +
            `<div style="font-size:10px;color:#94a3b8">Konum yaklaşık (şehir merkezi)</div></div>`
          )
          .addTo(map);
      });
      for (const layer of ["deal-dots", "spread-columns", "comp-dots"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
      setReady(true);
    });

    return () => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Rakip ilanları (2D ile aynı endpoint).
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/competitor-map")
      .then((r) => r.json())
      .then((d) => { if (alive) setCompetitors(Array.isArray(d.markers) ? d.markers : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Veri değişince kaynakları tazele (grade filtresi server-side → points değişir).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("deals") as maplibregl.GeoJSONSource | undefined)?.setData(pointsToGeoJSON(points));
    (map.getSource("columns") as maplibregl.GeoJSONSource | undefined)?.setData(spreadColumnsGeoJSON(points));
  }, [points, ready]);
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
    // Kule modunda noktaları soluklaştır (kuleler zaten tier-renkli).
    map.setPaintProperty("deal-dots", "circle-opacity", extrude ? 0.25 : 0.9);
  }, [extrude, ready]);

  // ── Sunum turu: durak durak flyTo ──
  const flyToStop = useCallback((idx: number) => {
    const map = mapRef.current;
    const stop = topDeals[idx];
    if (!map || !stop) return;
    map.flyTo({
      center: [stop.lng, stop.lat],
      zoom: 14.5,
      pitch: 62,
      bearing: (idx % 2 ? -1 : 1) * (20 + idx * 7), // her durakta hafif farklı açı — sinematik
      duration: 3800,
      essential: true,
    });
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
    setTourIdx(null);
  }, []);
  const nextStop = useCallback(() => {
    setTourIdx((i) => {
      if (i == null) return null;
      const n = i + 1;
      if (n >= topDeals.length) return null; // tur bitti
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

  const tourDeal = tourIdx != null ? topDeals[tourIdx] : null;

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

      {/* ── Sol-alt kontrol yığını (2D ile aynı hizada) ── */}
      <div style={{ position: "absolute", bottom: 16, left: 10, zIndex: 20, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <button onClick={() => (tourIdx == null ? startTour() : stopTour())} style={btn3d(tourIdx != null, "#7c3aed", "#6d28d9")}>
          🎬 Sunum turu{tourIdx != null ? ` · ${tourIdx + 1}/${topDeals.length} (durdur)` : ` (top ${Math.min(TOUR_STOPS, topDeals.length)})`}
        </button>
        <button onClick={() => setExtrude((v) => !v)} style={btn3d(extrude, "#0e7490", "#155e75")} title="Parselleri spread'e orantılı 3D kule olarak göster">
          📊 Spread kuleleri: {extrude ? "Açık" : "Kapalı"}
        </button>
        <button onClick={() => setShowComp((v) => !v)} style={btn3d(showComp, "#dc2626", "#b91c1c")}>
          🟥 Rakip ilanları{competitors.length ? ` (${competitors.length})` : ""}: {showComp ? "Açık" : "Kapalı"}
        </button>
        <div style={{ background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 11, lineHeight: 1.7, color: "#334155", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", maxWidth: 230 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>3D Arazi</div>
          <div><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GRADE_COLOR.A, marginRight: 6 }} />A deal · <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GRADE_COLOR.B, marginRight: 6, marginLeft: 4 }} />B · <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GRADE_COLOR.C, marginRight: 6, marginLeft: 4 }} />C</div>
          <div><span style={{ display: "inline-block", width: 9, height: 9, background: COMP_COLOR, transform: "rotate(45deg)", marginRight: 7 }} />Rakip ilanı (yaklaşık)</div>
          <div style={{ color: "#64748b" }}>Sağ tık / iki parmak: eğ &amp; döndür · 🏔 düğmesi: 3D araziyi aç/kapa</div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>Kot: AWS Terrain (~30m) — parsel-kesin değil · 1.4× abartı</div>
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
