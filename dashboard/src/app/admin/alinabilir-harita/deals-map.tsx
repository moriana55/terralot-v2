"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Polygon, Polyline, useMapEvents, useMap, Marker, WMSTileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";
import { regionPlaybook } from "@/lib/region-playbook";
import { distanceMiles, nearestRef } from "@/lib/geo-proximity";

export type MapPoint = {
  id: string; lat: number; lng: number; owner: string; region: string;
  acres: number; marketValue: number | null; estOffer: number; spread: number;
  dealGrade: string | null; absentee: boolean; apn: string;
  valBasis?: string | null; comps?: number; valAsOf?: string | null; compYears?: string | null;
  state?: string | null; county?: string | null; address?: string | null;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// Filtre eşikleri.
const BIG_SPREAD = 5000; // "spread büyük" eşiği ($)
const NEAR_COMP_MI = 10; // "rakibe yakın" eşiği (mil)

// Değerleme temeli → insan-okur etiket (kartta "neye göre" sorusunu yanıtlar).
const BASIS_LABEL: Record<string, string> = {
  attom_region: "ATTOM bölge emsali",
  county_comp: "county emsal",
  state_comp: "eyalet emsali",
  mismatch: "⚠ doğrulama gerek",
  none: "emsal yok",
};
const GRADE_COLOR: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#94a3b8" };
const COMP_COLOR = "#dc2626";

// "Comp-var" testi (mailSafe değerli deal): gerçek piyasa değeri var + mismatch değil.
const hasComp = (p: MapPoint) =>
  p.marketValue != null && p.valBasis !== "mismatch" && p.valBasis !== "none";

// Rakip ilanı (competitor_listings) — koordinatı yok, şehir merkezine yaklaşık oturtuldu.
// Bizim yeşil dairelerden ayrışsın diye KIRMIZI ELMAS (divIcon).
type CompMarker = {
  id: string; competitor: string; title: string; acres: number | null;
  price: number | null; rawUrl: string | null; lat: number; lng: number; matched: string;
};
const compIcon = L.divIcon({
  className: "comp-marker",
  html: `<div style="width:11px;height:11px;background:${COMP_COLOR};border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,0.5)"></div>`,
  iconSize: [11, 11],
  iconAnchor: [6, 6],
});

// ── Regrid GERÇEK tapu sınırı: tek fetch, iki tüketici (poligon + popup notu) ──
// Aynı parsel için poligon çizimi ve popup durumu tek isteği paylaşır (cache).
type RegridResult = { real: boolean; geometry?: GeoJsonObject; reason?: string; parcelNumber?: string | null };
const regridCache = new Map<string, Promise<RegridResult>>();
function fetchRegrid(lat: number, lng: number): Promise<RegridResult> {
  const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  let pr = regridCache.get(k);
  if (!pr) {
    pr = fetch(`/api/admin/regrid-parcel?lat=${lat}&lng=${lng}`)
      .then((r) => r.json() as Promise<RegridResult>)
      .catch(() => ({ real: false, reason: "fetch_failed" }) as RegridResult);
    regridCache.set(k, pr);
  }
  return pr;
}

// Seçili parselin GERÇEK Regrid poligonunu çizer (varsa). Yoksa null → istemci
// yaklaşık kareye düşer. onReal ile parent'a "gerçek sınır çizildi mi" bildirir.
function RegridBoundary({ p, onReal }: { p: MapPoint; onReal: (real: boolean) => void }) {
  const [geo, setGeo] = useState<RegridResult | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRegrid(p.lat, p.lng).then((res) => { if (alive) { setGeo(res); onReal(!!res.real); } });
    return () => { alive = false; };
  }, [p.lat, p.lng, onReal]);
  if (!geo || !geo.real || !geo.geometry) return null;
  return (
    <GeoJSON
      key={"rg" + p.id}
      data={geo.geometry}
      style={() => ({ color: "#16a34a", weight: 2.5, fillColor: "#22c55e", fillOpacity: 0.18 })}
    />
  );
}

// Popup içi: Regrid sınır durumu (gerçek mi yaklaşık kare mi — dürüst).
function RegridStatus({ p }: { p: MapPoint }) {
  const [geo, setGeo] = useState<RegridResult | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRegrid(p.lat, p.lng).then((res) => { if (alive) setGeo(res); });
    return () => { alive = false; };
  }, [p.lat, p.lng]);
  if (!geo) return <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>📐 Regrid sınırı sorgulanıyor…</div>;
  if (geo.real)
    return (
      <div style={{ fontSize: 10, color: "#047857", marginTop: 2 }}>
        📐 Gerçek tapu sınırı (Regrid) çizildi{geo.parcelNumber ? ` · ${geo.parcelNumber}` : ""}
      </div>
    );
  const why = geo.reason === "no_token" ? "Regrid token yok" : geo.reason === "no_coverage" ? "bu county kapsam dışı" : "alınamadı";
  return <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>📐 Yaklaşık kare ({why}) — gerçek tapu sınırı değil</div>;
}

// Parselin TAHMİNİ alanı: acres → merkeze oturmuş kare polygon. Kabaca "ne kadar yer
// kaplar" görseli — GERÇEK tapu sınırı DEĞİL (onun için Regrid parsel geometrisi gerek).
function parcelBounds(lat: number, lng: number, acres: number): [number, number][] {
  const side = Math.sqrt(Math.max(acres, 0.05) * 4046.86); // metre kenar
  const dLat = (side / 2) / 111320;
  const dLng = (side / 2) / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - dLat, lng - dLng], [lat - dLat, lng + dLng],
    [lat + dLat, lng + dLng], [lat + dLat, lng - dLng],
  ];
}

// Harita üstü açıklama kutusu — bakışta "ne neymiş" belli olsun (Ahmet'e anlatırken).
// Hem BİZİM marker'larımızı hem OSM altlık işaretlerini (üçgen=dağ, çizgiler) ayırt eder.
const dot = (c: string): React.CSSProperties => ({
  display: "inline-block", width: 10, height: 10, borderRadius: "50%",
  background: c, marginRight: 6, verticalAlign: "middle",
});
const ringStyle: React.CSSProperties = {
  display: "inline-block", width: 11, height: 11, borderRadius: "50%",
  border: "2px solid #d97706", background: "transparent", marginRight: 5, verticalAlign: "middle",
};
const squareStyle: React.CSSProperties = {
  display: "inline-block", width: 11, height: 11,
  border: "1.5px dashed #d97706", background: "rgba(245,158,11,0.15)", marginRight: 5, verticalAlign: "middle",
};
const compLegendStyle: React.CSSProperties = {
  display: "inline-block", width: 9, height: 9, background: "#dc2626",
  transform: "rotate(45deg)", marginRight: 7, marginLeft: 1, verticalAlign: "middle",
};
const realBoundaryStyle: React.CSSProperties = {
  display: "inline-block", width: 11, height: 11,
  border: "1.5px solid #16a34a", background: "rgba(34,197,94,0.2)", marginRight: 5, verticalAlign: "middle",
};

// Konum-bağımsız (flex kolon içinde durur). Aç/kapa korunur.
function MapLegend() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8,
          padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#334155",
          cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
        }}
      >
        ⓘ Açıklama
      </button>
    );
  }
  return (
    <div style={{
      background: "rgba(255,255,255,0.96)", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "9px 11px", fontSize: 11, lineHeight: 1.7, color: "#334155",
      maxWidth: 240, boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontWeight: 700 }}>Açıklama</span>
        <button onClick={() => setOpen(false)} aria-label="Açıklamayı kapat"
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 15, lineHeight: 1, color: "#94a3b8", padding: 0, marginLeft: 10 }}>×</button>
      </div>
      <div><span style={dot(GRADE_COLOR.A)} />A deal — en iyi</div>
      <div><span style={dot(GRADE_COLOR.B)} />B deal</div>
      <div><span style={dot(GRADE_COLOR.C)} />C deal</div>
      <div><span style={ringStyle} />Halka = absentee (eyalet-dışı motive sahip)</div>
      <div><span style={squareStyle} />Turuncu kare = parselin ~tahmini alanı (yaklaşık)</div>
      <div><span style={realBoundaryStyle} />Yeşil dolgu = <b>gerçek tapu sınırı (Regrid)</b> · seçili parsel</div>
      <div><span style={compLegendStyle} />Kırmızı elmas = <b>rakip ilanı</b> (yaklaşık konum, şehir merkezi)</div>
      <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "6px 0" }} />
      <div style={{ fontWeight: 600, color: "#64748b" }}>Altlık (OpenStreetMap — bizim değil):</div>
      <div>🔺 kahverengi üçgen = dağ zirvesi</div>
      <div>━ isimli kahverengi/gri çizgi = <b>yol</b> (ör. &quot;North Charles Drive&quot;)</div>
      <div><span style={{ color: "#7dd3fc" }}>┅</span> açık mavi kesik = <b>kuru dere / çöl washı</b> (yağışta akar → sel riski)</div>
      <div>🌊 FEMA Sel Tehlikesi katmanı = sağ-üst katman seçiciden aç (yaklaşık · resmî FEMA panelinden teyit)</div>
      <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "6px 0" }} />
      <div style={{ fontWeight: 600, color: "#64748b" }}>🛤️ OSM yolları (sol-alt düğme · zoom ≥ 13):</div>
      <div><span style={{ display: "inline-block", width: 16, height: 0, borderTop: "3px solid #dc2626", marginRight: 5, verticalAlign: "middle" }} />Anayol (motorway/trunk/primary)</div>
      <div><span style={{ display: "inline-block", width: 16, height: 0, borderTop: "2px solid #f97316", marginRight: 5, verticalAlign: "middle" }} />İkincil asfalt (secondary/tertiary)</div>
      <div><span style={{ display: "inline-block", width: 16, height: 0, borderTop: "2px solid #eab308", marginRight: 5, verticalAlign: "middle" }} />Asfalt sokak (residential)</div>
      <div><span style={{ display: "inline-block", width: 16, height: 0, borderTop: "2px dashed #92400e", marginRight: 5, verticalAlign: "middle" }} />Toprak/track (off-road · parsel erişimi)</div>
      <div><span style={{ display: "inline-block", width: 16, height: 0, borderTop: "1.5px dashed #78716c", marginRight: 5, verticalAlign: "middle" }} />Servis yolu</div>
      <div style={{ marginTop: 5, color: "#64748b", fontStyle: "italic" }}>
        Sağ üstten: <b>Uydu</b> = gerçek arazi · <b>🛣️ Yollar</b> = yollar+isimler üstte. Parsel detayı için marker&apos;a tıkla → popup.
      </div>
    </div>
  );
}

// Yakınlaşınca (zoom ≥ 12) görüş alanındaki TÜM parsellerin tahmini alanını KALICI çizer
// (aynı anda birden çok). Performans için sadece görünür + en fazla 400 parsel.
function ParcelAreas({ points }: { points: MapPoint[] }) {
  const [, force] = useState(0);
  const map = useMapEvents({
    moveend: () => force((n) => n + 1),
    zoomend: () => force((n) => n + 1),
  });
  if (map.getZoom() < 12) return null;
  const b = map.getBounds();
  const visible = points.filter((p) => b.contains([p.lat, p.lng] as [number, number])).slice(0, 400);
  return (
    <>
      {visible.map((p) => (
        <Polygon
          key={"pa" + p.id}
          positions={parcelBounds(p.lat, p.lng, p.acres)}
          pathOptions={{ color: "#d97706", weight: 1.5, dashArray: "5 4", fillColor: "#f59e0b", fillOpacity: 0.1 }}
        />
      ))}
    </>
  );
}

// Popup açılınca dd-check'i çağırır → ⚡ elektrik + 🛣️ yol rozeti.
// Sadece tıklanan parsel için çalışır (Leaflet popup içeriği lazy mount).
function EnrichBadges({ lat, lng }: { lat: number; lng: number }) {
  const [state, setState] = useState<{ loading: boolean; power?: Record<string, unknown>; road?: Record<string, unknown>; err?: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    fetch(`/api/dd-check?lat=${lat}&lon=${lng}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setState({ loading: false, power: d.power, road: d.road }); })
      .catch(() => { if (alive) setState({ loading: false, err: true }); });
    return () => { alive = false; };
  }, [lat, lng]);

  if (state.loading) return <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>⚡🛣️ çevre kontrol ediliyor…</div>;
  if (state.err) return <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Çevre verisi alınamadı</div>;

  const p = (state.power ?? {}) as Record<string, unknown>;
  const r = (state.road ?? {}) as Record<string, unknown>;
  const powerBadge = p.hasPower === true
    ? { t: `⚡ Elektrik ${p.proximity === "onsite" ? "bitişik" : "yakın"} (~${p.nearestPowerMeters}m)`, c: "#047857", bg: "#ecfdf5" }
    : p.hasPower === false
    ? { t: "⚡ Off-grid (şebeke yok)", c: "#92400e", bg: "#fffbeb" }
    : { t: "⚡ Elektrik: bilinmiyor", c: "#64748b", bg: "#f1f5f9" };
  const roadBadge = r.hasRoadAccess === true
    ? { t: `🛣️ ${r.surface === "paved" ? "Asfalt" : r.surface === "gravel" ? "Stabilize" : r.surface === "dirt" ? "Toprak" : "Yol"} ${r.accessType === "direct" ? "erişimi" : "yakın"} (~${r.nearestRoadMeters}m)`, c: "#1d4ed8", bg: "#eff6ff" }
    : r.hasRoadAccess === false
    ? { t: "🛣️ Yol erişimi YOK (landlocked)", c: "#b91c1c", bg: "#fef2f2" }
    : { t: "🛣️ Yol: bilinmiyor", c: "#64748b", bg: "#f1f5f9" };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
      {[powerBadge, roadBadge].map((b, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 600, color: b.c, background: b.bg, borderRadius: 4, padding: "2px 6px" }}>{b.t}</span>
      ))}
    </div>
  );
}

// ── OSM YOL-TİPİ VEKTÖR KATMANI (Overpass, client-side) ─────────────────────────
// Esri overlay sadece anayolları gösterir; çöldeki TOPRAK/track yollar (parsele
// erişim!) uydu'da kaybolur. Çözüm: görüş alanı (bbox) için OSM yollarını tarayıcıdan
// Overpass ile çek, highway tipine göre renkli Polyline çiz. SADECE katman AÇIKKEN +
// zoom ≥ minZoom çalışır; moveend/zoomend debounce'lu; bbox-cache'li; graceful.
const ROAD_MIN_ZOOM = 13;
const ROAD_DEBOUNCE_MS = 600;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

type RoadCat = "highway" | "paved" | "dirt" | "service";
type RoadTypes = Record<RoadCat, boolean>;
const ROAD_CAT_LABEL: Record<RoadCat, string> = {
  highway: "Anayol",
  paved: "Asfalt",
  dirt: "Toprak (track)",
  service: "Servis",
};

interface RoadStyle { cat: RoadCat; color: string; weight: number; dash?: string }

// highway tag + surface → kategori + renk. Bilinmeyen/yaya-only tipler null (atla).
function classifyRoad(tags: Record<string, string>): RoadStyle | null {
  const hw = tags.highway;
  if (!hw) return null;
  const surf = (tags.surface || "").toLowerCase();
  const unpaved = /unpaved|dirt|ground|gravel|sand|earth|compacted|fine_gravel|grass|rock|pebble/.test(surf);
  if (["motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"].includes(hw))
    return { cat: "highway", color: "#dc2626", weight: 3 };
  if (["secondary", "tertiary", "secondary_link", "tertiary_link"].includes(hw))
    return { cat: "paved", color: "#f97316", weight: 2.5 };
  if (["residential", "unclassified", "living_street", "road"].includes(hw))
    return unpaved
      ? { cat: "dirt", color: "#92400e", weight: 2, dash: "5 5" }
      : { cat: "paved", color: "#eab308", weight: 2 };
  if (["track", "path", "bridleway"].includes(hw))
    return { cat: "dirt", color: "#92400e", weight: 2, dash: "5 5" };
  if (hw === "service")
    return unpaved
      ? { cat: "dirt", color: "#92400e", weight: 1.8, dash: "5 5" }
      : { cat: "service", color: "#78716c", weight: 1.5, dash: "3 4" };
  return null; // footway/cycleway/steps vb. → atla
}

type OsmWay = { id: number; tags: Record<string, string>; geometry: { lat: number; lon: number }[] };
type OverpassEl = { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

export type RoadState = { loading: boolean; count: number; tooFar: boolean };

// Yalnız showRoads açıkken MOUNT edilir (parent: {showRoads && <OsmRoads/>}).
// Böylece kapanınca state doğal olarak temizlenir (efekt içinde senkron setState yok).
function OsmRoads({
  types, report,
}: { types: RoadTypes; report: (s: RoadState) => void }) {
  const map = useMap();
  const [ways, setWays] = useState<OsmWay[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef(new Map<string, OsmWay[]>());
  const reqIdRef = useRef(0);

  useEffect(() => {
    const bboxKey = (b: L.LatLngBounds) =>
      [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((n) => n.toFixed(2)).join(",");

    const run = () => {
      if (map.getZoom() < ROAD_MIN_ZOOM) {
        setWays([]);
        report({ loading: false, count: 0, tooFar: true });
        return;
      }
      const b = map.getBounds();
      const key = bboxKey(b);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setWays(cached);
        report({ loading: false, count: cached.length, tooFar: false });
        return;
      }
      const myId = ++reqIdRef.current;
      report({ loading: true, count: 0, tooFar: false });
      const q = `[out:json][timeout:25];way["highway"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()});out geom;`;
      fetch(`${OVERPASS_URL}?data=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { elements?: OverpassEl[] }) => {
          if (myId !== reqIdRef.current) return; // bayat istek — at
          const w: OsmWay[] = (d.elements ?? [])
            .filter((e) => e.type === "way" && Array.isArray(e.geometry) && e.geometry.length > 1)
            .map((e) => ({ id: e.id, tags: e.tags ?? {}, geometry: e.geometry as { lat: number; lon: number }[] }));
          cacheRef.current.set(key, w);
          if (cacheRef.current.size > 40) {
            const oldest = cacheRef.current.keys().next().value;
            if (oldest) cacheRef.current.delete(oldest);
          }
          setWays(w);
          report({ loading: false, count: w.length, tooFar: false });
        })
        .catch(() => {
          if (myId === reqIdRef.current) report({ loading: false, count: 0, tooFar: false });
        });
    };

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, ROAD_DEBOUNCE_MS);
    };
    map.on("moveend", schedule);
    map.on("zoomend", schedule);
    run(); // ilk yükleme

    return () => {
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [map, report]);

  return (
    <>
      {ways.map((w) => {
        const cls = classifyRoad(w.tags);
        if (!cls || !types[cls.cat]) return null;
        const positions = w.geometry.map((g) => [g.lat, g.lon] as [number, number]);
        return (
          <Polyline
            key={"osm" + w.id}
            positions={positions}
            pathOptions={{ color: cls.color, weight: cls.weight, dashArray: cls.dash, opacity: 0.9 }}
          />
        );
      })}
    </>
  );
}

// ── Renklendir / Filtrele paneli (pure client, dep yok) ─────────────────────────
type Filters = {
  grade: "" | "A" | "B" | "C";
  absentee: boolean;
  comp: boolean;
  bigSpread: boolean;
  nearComp: boolean;
  multiOwner: boolean;
};
const chipStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
  border: `1px solid ${active ? "#0f172a" : "#e2e8f0"}`,
  background: active ? "#0f172a" : "#fff", color: active ? "#fff" : "#475569",
});
// Yol kategorisi → temsil rengi (filtre çipi noktası).
const ROAD_CAT_COLOR: Record<RoadCat, string> = {
  highway: "#dc2626", paved: "#eab308", dirt: "#92400e", service: "#78716c",
};
function FilterPanel({
  f, setF, visible, total, roads,
}: {
  f: Filters; setF: (u: Partial<Filters>) => void; visible: number; total: number;
  roads: { show: boolean; types: RoadTypes; toggleType: (c: RoadCat) => void; state: RoadState };
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8,
          padding: "6px 11px", fontSize: 12, fontWeight: 600, color: "#334155",
          cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        }}
      >
        ⚙ Filtre & Renk{visible !== total ? ` · ${visible}/${total}` : ""}
      </button>
    );
  }
  const checks: { k: keyof Filters; label: string }[] = [
    { k: "absentee", label: "Absentee" },
    { k: "comp", label: "Comp-var" },
    { k: "bigSpread", label: `Spread ≥ $${(BIG_SPREAD / 1000).toFixed(0)}k` },
    { k: "nearComp", label: `Rakibe ≤${NEAR_COMP_MI}mi` },
    { k: "multiOwner", label: "Çoklu-parsel sahip" },
  ];
  const roadCats: RoadCat[] = ["highway", "paved", "dirt", "service"];
  return (
    <div style={{
      background: "rgba(255,255,255,0.97)", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "9px 11px", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", maxWidth: 250,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>Filtre & Renk</span>
        <button onClick={() => setOpen(false)} aria-label="Kapat"
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 15, lineHeight: 1, color: "#94a3b8", padding: 0 }}>×</button>
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Deal notu</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 7 }}>
        {(["", "A", "B", "C"] as const).map((g) => (
          <span key={g || "all"} onClick={() => setF({ grade: g })}
            style={{ ...chipStyle(f.grade === g), ...(g && f.grade === g ? { background: GRADE_COLOR[g], borderColor: GRADE_COLOR[g] } : {}) }}>
            {g || "Hepsi"}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {checks.map((c) => (
          <span key={c.k} onClick={() => setF({ [c.k]: !f[c.k] } as Partial<Filters>)} style={chipStyle(!!f[c.k])}>{c.label}</span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 7 }}>
        Görünür: <b style={{ color: "#0f172a" }}>{visible.toLocaleString()}</b> / {total.toLocaleString()} parsel
      </div>

      {/* ── Yol tipleri (OSM vektör) ── */}
      <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 8, paddingTop: 7 }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
          <span>Yol tipleri (OSM)</span>
          {roads.show && (
            <span style={{ color: "#0f172a" }}>
              {roads.state.tooFar ? "🔎 yakınlaş ≥13" : roads.state.loading ? "⏳ yükleniyor…" : `${roads.state.count} yol`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", opacity: roads.show ? 1 : 0.45 }}>
          {roadCats.map((c) => (
            <span key={c} onClick={() => roads.toggleType(c)}
              style={{ ...chipStyle(roads.types[c]), display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ROAD_CAT_COLOR[c], display: "inline-block" }} />
              {ROAD_CAT_LABEL[c]}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>
          {roads.show
            ? "Veri: OpenStreetMap — tüm çöl tracklar haritalı olmayabilir."
            : "Yolları görmek için “🛤️ Yollar (OSM)” düğmesini aç (zoom ≥ 13)."}
        </div>
      </div>
    </div>
  );
}

const toggleBtnStyle = (active: boolean, on: string, onBorder: string): React.CSSProperties => ({
  background: active ? on : "rgba(255,255,255,0.95)",
  color: active ? "#fff" : "#334155",
  border: `1px solid ${active ? onBorder : "#e2e8f0"}`,
  borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", textAlign: "left",
});

export default function DealsMap({ points }: { points: MapPoint[] }) {
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [selRealBoundary, setSelRealBoundary] = useState(false);
  const [showAreas, setShowAreas] = useState(true);
  const [competitors, setCompetitors] = useState<CompMarker[]>([]);
  const [showComp, setShowComp] = useState(true);
  const [filters, setFilters] = useState<Filters>({ grade: "", absentee: false, comp: false, bigSpread: false, nearComp: false, multiOwner: false });
  const setF = (u: Partial<Filters>) => setFilters((p) => ({ ...p, ...u }));
  // OSM yol-tipi katmanı (varsayılan KAPALI — açınca Overpass çalışır).
  const [showRoads, setShowRoads] = useState(false);
  const [roadTypes, setRoadTypes] = useState<RoadTypes>({ highway: true, paved: true, dirt: true, service: true });
  const toggleRoadType = (c: RoadCat) => setRoadTypes((p) => ({ ...p, [c]: !p[c] }));
  const [roadsState, setRoadsState] = useState<RoadState>({ loading: false, count: 0, tooFar: false });

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/competitor-map")
      .then((r) => r.json())
      .then((d) => { if (alive) setCompetitors(Array.isArray(d.markers) ? d.markers : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Sahip kümeleme: owner → parsel sayısı (motive toplu satıcı kozu).
  const ownerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) {
      const o = (p.owner || "").trim().toLowerCase();
      if (o) m.set(o, (m.get(o) || 0) + 1);
    }
    return m;
  }, [points]);
  const ownerCount = (o: string | undefined) => ownerCounts.get((o || "").trim().toLowerCase()) || 0;

  // En yakın rakip mesafesi (mil) — filtre + popup için.
  const nearestCompMiles = useMemo(() => {
    return (lat: number, lng: number): number | null => {
      let best: number | null = null;
      for (const c of competitors) {
        const m = distanceMiles(lat, lng, c.lat, c.lng);
        if (best == null || m < best) best = m;
      }
      return best;
    };
  }, [competitors]);

  // Görünür parseller — filtreden geçenler.
  const visiblePoints = useMemo(() => {
    return points.filter((p) => {
      if (filters.grade && p.dealGrade !== filters.grade) return false;
      if (filters.absentee && !p.absentee) return false;
      if (filters.comp && !hasComp(p)) return false;
      if (filters.bigSpread && !(p.spread >= BIG_SPREAD)) return false;
      if (filters.multiOwner && ownerCount(p.owner) < 2) return false;
      if (filters.nearComp) {
        const m = nearestCompMiles(p.lat, p.lng);
        if (m == null || m > NEAR_COMP_MI) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, filters, ownerCounts, nearestCompMiles]);

  if (!points.length) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      {/* Zoom +/− sol-üstte TEK BAŞINA kalsın (Leaflet varsayılanı). Diğer tüm UI sol-altta. */}
      <MapContainer center={[lat, lng]} zoom={9} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        {/* Altlık katmanı seçici: Sokak (OSM) ↔ Uydu (Esri) — çöl arsasında yolu/araziyi uydu'da gör. */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Sokak (OSM)">
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Uydu (Esri)">
            <TileLayer
              attribution="&copy; Esri World Imagery"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          {/* Şeffaf yol+isim overlay'i — uydu'nun BİLE üstünde yolları kalın/isimli gösterir. */}
          <LayersControl.Overlay checked name="🛣️ Yollar + isimler (üstte)">
            <TileLayer
              attribution="&copy; Esri World Transportation"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.Overlay>
          {/* FEMA NFHL sel-tehlike katmanı (WMS) — varsayılan KAPALI; açınca yüklenir.
              Dürüst: yaklaşık görsel; resmî sel-bölgesi kararı için FEMA panelinden teyit. */}
          <LayersControl.Overlay name="🌊 FEMA Sel Tehlikesi (NFHL · yaklaşık)">
            <WMSTileLayer
              url="https://hazards.fema.gov/arcgis/services/public/NFHL/MapServer/WMSServer"
              layers="28"
              format="image/png"
              transparent
              opacity={0.5}
              attribution="FEMA NFHL — sel tehlike bölgeleri (yaklaşık)"
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* OSM yol-tipi vektör katmanı (Overpass) — markerların ALTINDA çizilir.
            Sadece showRoads açıkken MOUNT (kapanınca temizlenir). */}
        {showRoads && <OsmRoads types={roadTypes} report={setRoadsState} />}

        {/* Parsel tahmini alanları — toggle ile aç/kapa (iç içe girince kapatabilirsin). Filtreli set. */}
        {showAreas && <ParcelAreas points={visiblePoints} />}
        {/* Seçili parsel: gerçek Regrid sınırı varsa onu çiz; yoksa yaklaşık kare. */}
        {selected && <RegridBoundary p={selected} onReal={setSelRealBoundary} />}
        {showAreas && selected && !selRealBoundary && (
          <Polygon
            positions={parcelBounds(selected.lat, selected.lng, selected.acres)}
            pathOptions={{ color: "#b45309", weight: 2.5, dashArray: "6 4", fillColor: "#f59e0b", fillOpacity: 0.2 }}
          />
        )}

        {visiblePoints.map((p) => {
          const color = GRADE_COLOR[p.dealGrade ?? ""] ?? "#cbd5e1";
          const r = p.dealGrade === "A" ? 6 : 4;
          const oc = ownerCount(p.owner);
          return (
            <div key={p.id}>
              {/* Absentee = eyalet-dışı motive sahip → marker'ın etrafında amber halka (tıklamadan belli). */}
              {p.absentee && (
                <CircleMarker
                  center={[p.lat, p.lng]}
                  radius={r + 3}
                  pathOptions={{ color: "#d97706", weight: 2, fillOpacity: 0, interactive: false }}
                />
              )}
              <CircleMarker
                center={[p.lat, p.lng]}
                radius={r}
                pathOptions={{ color: "#fff", weight: 1, fillColor: color, fillOpacity: 0.85 }}
                eventHandlers={{
                  popupopen: () => { setSelected(p); setSelRealBoundary(false); },
                  popupclose: () => setSelected((s) => (s?.id === p.id ? null : s)),
                }}
              >
                <Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 180 }}>
                    <div style={{ fontWeight: 700 }}>
                      {p.dealGrade && (
                        <span style={{ background: GRADE_COLOR[p.dealGrade], color: "#fff", borderRadius: 3, padding: "1px 5px", marginRight: 5 }}>{p.dealGrade}</span>
                      )}
                      {p.owner || p.apn}
                    </div>
                    <div style={{ color: "#64748b" }}>{p.region} · {p.acres?.toFixed(2)} acre {p.absentee ? "· absentee" : ""}</div>
                    {oc > 1 && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", marginTop: 2 }}>
                        🏠 Bu sahipte {oc} parsel (toplu satıcı kozu)
                      </div>
                    )}
                    <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "5px 0" }} />
                    <div>Piyasa: <b>{p.valBasis === "mismatch" ? "⚠ comp uyumsuz — doğrula" : p.marketValue ? usd(p.marketValue) : "comp gerekli"}</b></div>
                    {p.marketValue != null && (
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        {BASIS_LABEL[p.valBasis ?? "none"] ?? p.valBasis}
                        {p.comps ? ` · ${p.comps} emsal` : ""}
                        {p.compYears ? ` (${p.compYears})` : p.valAsOf ? ` · ${p.valAsOf.slice(0, 10)}` : ""}
                      </div>
                    )}
                    <div>Teklif: <b style={{ color: "#059669" }}>{p.estOffer ? usd(p.estOffer) : "—"}</b> · Spread: <b style={{ color: "#059669" }}>{p.spread ? usd(p.spread) : "—"}</b></div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>🟧 Haritada ~{p.acres?.toFixed(2)} acre tahmini alan (kare yaklaşık, gerçek tapu sınırı değil)</div>
                    <RegridStatus p={p} />
                    {(() => {
                      // Bölge satış-açısı + dürüst zoning notu (region-playbook; config'de yoksa güvenli default).
                      const pb = regionPlaybook({ state: p.state, county: p.county, region: p.region, address: p.address });
                      return (
                        <div style={{ marginTop: 6, padding: "5px 7px", background: "#f8fafc", borderRadius: 5, fontSize: 10, lineHeight: 1.45 }}>
                          <div style={{ color: "#0f172a" }}><b>Satış açısı:</b> {pb.salesAngle}</div>
                          <div style={{ color: "#b45309", marginTop: 2 }}>⚠ {pb.zoningNote}</div>
                        </div>
                      );
                    })()}
                    {(() => {
                      // Yakınlık scorecard: en yakın şehir + highway + rakip + su (hepsi yaklaşık referans).
                      const city = nearestRef(p.lat, p.lng, "city");
                      const hwy = nearestRef(p.lat, p.lng, "highway");
                      const water = nearestRef(p.lat, p.lng, "water");
                      const nc = nearestCompMiles(p.lat, p.lng);
                      return (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
                          {city ? <div>🏙️ En yakın şehir: {city.name} ~{city.miles.toFixed(0)} mi</div> : null}
                          {hwy ? <div>🛣️ En yakın anayol: {hwy.name} ~{hwy.miles.toFixed(0)} mi</div> : null}
                          <div>
                            📍 {nc != null ? `En yakın rakip ~${nc.toFixed(1)} mi` : "rakip verisi yükleniyor"}
                            {water ? ` · 💧 ${water.name} ~${water.miles.toFixed(0)} mi` : ""}
                          </div>
                          <div style={{ fontStyle: "italic", color: "#94a3b8" }}>(yaklaşık · sabit referans noktasına)</div>
                        </div>
                      );
                    })()}
                    <a href={`https://www.google.com/maps/@${p.lat},${p.lng},600m/data=!3m1!1e3`} target="_blank" rel="noreferrer" style={{ color: "#0284c7", display: "inline-block", marginTop: 6 }}>🛰️ Uydu</a>
                    <EnrichBadges lat={p.lat} lng={p.lng} />
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}

        {/* RAKİP ilanları (🟥 kırmızı elmas) — yaklaşık şehir-merkezi konumu. */}
        {showComp && competitors.map((c) => (
          <Marker key={"c" + c.id} position={[c.lat, c.lng]} icon={compIcon}>
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 170 }}>
                <div style={{ fontWeight: 700, color: COMP_COLOR }}>🟥 RAKİP — {c.competitor}</div>
                <div style={{ color: "#64748b", marginTop: 2 }}>{c.title}</div>
                <div style={{ marginTop: 4 }}>{c.acres ? `${c.acres} acre` : ""}{c.price ? ` · $${c.price.toLocaleString()}` : ""}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>Konum yaklaşık (≈{c.matched} şehir merkezi) — parsel-kesin değil</div>
                {c.rawUrl && <a href={c.rawUrl} target="_blank" rel="noreferrer" style={{ color: "#0284c7", display: "inline-block", marginTop: 4 }}>İlanı aç ↗</a>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ── Sol-ALT kontrol yığını (dikey): filtre paneli + toggle'lar + legend.
          Sol-ÜST'ü Leaflet zoom +/− için BOŞ bırakıyoruz; sağ-üst LayersControl. ── */}
      <div style={{
        position: "absolute", bottom: 16, left: 10, zIndex: 1000,
        display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start",
        maxHeight: "calc(100% - 90px)", overflowY: "auto",
      }}>
        <FilterPanel
          f={filters} setF={setF} visible={visiblePoints.length} total={points.length}
          roads={{ show: showRoads, types: roadTypes, toggleType: toggleRoadType, state: roadsState }}
        />
        <button
          onClick={() => setShowAreas((v) => !v)}
          title="Parselin tahmini alanı kutularını aç/kapat"
          style={toggleBtnStyle(showAreas, "#f59e0b", "#d97706")}
        >
          🟧 Parsel alanları: {showAreas ? "Açık" : "Kapalı"}
        </button>
        <button
          onClick={() => setShowComp((v) => !v)}
          title="Rakip ilanlarını aç/kapat"
          style={toggleBtnStyle(showComp, "#dc2626", "#b91c1c")}
        >
          🟥 Rakip ilanları{competitors.length ? ` (${competitors.length})` : ""}: {showComp ? "Açık" : "Kapalı"}
        </button>
        <button
          onClick={() => { if (showRoads) setRoadsState({ loading: false, count: 0, tooFar: false }); setShowRoads((v) => !v); }}
          title="OSM yol-tipi katmanı (Overpass) — açınca zoom ≥ 13'te yollar çizilir"
          style={toggleBtnStyle(showRoads, "#0f766e", "#115e59")}
        >
          🛤️ Yollar (OSM){showRoads ? (roadsState.tooFar ? " · yakınlaş ≥13" : roadsState.loading ? " · ⏳" : roadsState.count ? ` · ${roadsState.count}` : "") : ""}: {showRoads ? "Açık" : "Kapalı"}
        </button>
        <MapLegend />
      </div>
    </div>
  );
}
