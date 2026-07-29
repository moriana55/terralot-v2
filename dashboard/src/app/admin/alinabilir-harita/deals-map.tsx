"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Polygon, Polyline, useMapEvents, useMap, Marker, WMSTileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";
import CountyGisLayer from "./CountyGisLayer";
import { regionPlaybook } from "@/lib/region-playbook";
import { distanceMiles, nearestRef } from "@/lib/geo-proximity";
import CopyBuyerLink from "@/components/CopyBuyerLink";
import { buildCampaign, type MohaveRow } from "@/lib/mohave-campaign";
import { buildRakipSatislarLayer, computeRakipSatislarOzet, groupRakipSatisPoints, type RakipSatisGroup, type RakipSatisPoint, type RakipSatislarData } from "@/lib/rakip-satislar";
import rakipSatislarData from "@/data/rakip-satislar.json";
import { defaultSecim, expandBuyukOyuncuRows, filterBuyukOyuncuPoints, oyuncuRenk, type BuyukOyuncu, type BuyukOyuncuPoint, type BuyukOyuncularData } from "@/lib/buyuk-oyuncular";
import { isPaketTapu, formatPaketAlimAciklama } from "@/lib/paket-tapu";

export type MapPoint = {
  id: string; lat: number; lng: number; owner: string; region: string;
  acres: number; marketValue: number | null; estOffer: number; spread: number;
  dealGrade: string | null; absentee: boolean; apn: string;
  valBasis?: string | null; comps?: number; valAsOf?: string | null; compYears?: string | null;
  state?: string | null; county?: string | null; address?: string | null;
  /** ROAD Act MH-uygunluk sinyali (likely/verify/unlikely; null = sinyal yok). */
  mh?: string | null; mhReason?: string | null;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// Bölge → ZIP (opsiyonel, yalnız AZ Mohave bilinen yerleşimler). Yoksa atlanır.
const REGION_ZIP: Record<string, string> = {
  "golden valley": "86413", meadview: "86444", kingman: "86401",
  yucca: "86438", "dolan springs": "86441", topock: "86436",
};
function zipFor(region: string | null | undefined, state: string | null | undefined): string {
  if (state && state.toUpperCase() !== "AZ") return "";
  const r = (region || "").toLowerCase();
  for (const k of Object.keys(REGION_ZIP)) if (r.includes(k)) return REGION_ZIP[k];
  return "";
}
// Discount Lots tarzı KONUM satırı: "{situs}, {region}, {state} {zip}".
// situs = MapPoint.address (kaynakta offmarket_leads.situs / SITE_ADDRESS). Boşsa
// dürüstçe "{region}, {state} (yaklaşık)".
function locationLine(p: MapPoint): string {
  const situs = (p.address || "").trim();
  const region = (p.region || "").trim();
  const state = (p.state || "").trim();
  const zip = zipFor(region, state);
  const tail = `${state}${zip ? " " + zip : ""}`.trim();
  if (situs) return [situs, region, tail].filter(Boolean).join(", ");
  return `${[region, state].filter(Boolean).join(", ") || "konum bilinmiyor"} (yaklaşık)`;
}

// Filtre eşikleri.
const BIG_SPREAD = 5000; // "spread büyük" eşiği ($)
const NEAR_COMP_MI = 10; // "rakibe yakın" eşiği (mil)
const ACCESS_MAX_MI = 25; // en yakın anayol/şehir bunu aşarsa "uzak / erişim zayıf"

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
      <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", border: "1.5px solid #94a3b8", background: "rgba(148,163,184,0.4)", marginRight: 5, verticalAlign: "middle" }} />Soluk gri kenar = uzak/erişim zayıf (anayol/şehir &gt;{ACCESS_MAX_MI}mi · grade DEĞİŞMEZ)</div>
      <div><span style={squareStyle} />Turuncu kare = parselin ~tahmini alanı (yaklaşık)</div>
      <div><span style={realBoundaryStyle} />Yeşil dolgu = <b>gerçek tapu sınırı (Regrid)</b> · seçili parsel</div>
      <div><span style={compLegendStyle} />Kırmızı elmas = <b>rakip ilanı</b> (yaklaşık konum, şehir merkezi)</div>
      <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "6px 0" }} />
      <div style={{ fontWeight: 600, color: "#64748b" }}>🏁 Rakip Satışları (tapu-kanıtlı):</div>
      <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", background: "#4c1d95", border: "1.5px solid #fff", marginRight: 5, verticalAlign: "middle" }} />Koyu mor dolu = <b>tamamlanmış satış</b> (kalıcı fiyat etiketiyle)</div>
      <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", border: "2px solid #a78bfa", background: "rgba(167,139,250,0.45)", marginRight: 5, verticalAlign: "middle" }} />Açık lila = <b>taksitli satış</b> (sürüyor)</div>
      <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", border: "2px solid #9ca3af", background: "transparent", marginRight: 5, verticalAlign: "middle" }} />Soluk gri halka = rakip stok/envanteri</div>
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
  nearAccess: boolean; // sadece yakın-erişim (≤25mi anayol/şehir) — uzakları gizle
  mhOnly: boolean; // sadece MH-uygun (ROAD Act — manufactured home koyulabilir sinyali)
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
    { k: "nearAccess", label: `Yakın-erişim ≤${ACCESS_MAX_MI}mi` },
    { k: "mhOnly", label: "🏠 MH-uygun (ROAD Act)" },
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

// ── PARSEL → SATILIK PAZARLAMA GÖRSELİ (Discount Lots / LANDIO tarzı) ────────────
// Top-down Esri uydu (parsele ortalı) + parsel sınırı overlay + kenar ölçüleri (ft)
// + TerraLot marka şeritleri → indirilebilir PNG. NO-DEP: Esri "export" REST'ten TEK
// uydu görseli alınır (CORS'lu), canvas'a çizilir, overlay programatik eklenir.
// DÜRÜST: ölçüler yaklaşık; gerçek tapu için Regrid/survey. Oblique/3D KAPSAM DIŞI.
const ESRI_EXPORT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";

// Regrid geometry → dış halka [lng,lat][]. Polygon/MultiPolygon; geçersizse null.
function extractRing(g: GeoJsonObject): [number, number][] | null {
  const gg = g as unknown as { type?: string; coordinates?: unknown };
  let ring: number[][] | null = null;
  if (gg.type === "Polygon") ring = (gg.coordinates as number[][][])?.[0] ?? null;
  else if (gg.type === "MultiPolygon") ring = (gg.coordinates as number[][][][])?.[0]?.[0] ?? null;
  if (!ring || ring.length < 4) return null;
  return ring.map((c) => [Number(c[0]), Number(c[1])] as [number, number]).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
}

function MarketingImageModal({ p, onClose }: { p: MapPoint; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isReal, setIsReal] = useState(false);
  const [canDownload, setCanDownload] = useState(true);
  const [rawUrl, setRawUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const W = 1024, H = 1024;

    (async () => {
      // 1) parsel halkası: önce gerçek Regrid poligonu, yoksa yaklaşık kare.
      let ring: [number, number][] | null = null;
      let real = false;
      try {
        const res = await fetchRegrid(p.lat, p.lng);
        if (res.real && res.geometry) {
          const r = extractRing(res.geometry);
          if (r) { ring = r; real = true; }
        }
      } catch { /* graceful */ }
      if (!ring) ring = parcelBounds(p.lat, p.lng, p.acres).map(([la, ln]) => [ln, la] as [number, number]);
      if (!alive) return;
      setIsReal(real);

      // 2) metre-kare bbox (parsel ortalı, ~%50 pay) — distorsiyonsuz.
      const lats = ring.map((r) => r[1]);
      const lngs = ring.map((r) => r[0]);
      const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const cosL = Math.cos((cLat * Math.PI) / 180) || 1e-6;
      const latExtM = (Math.max(...lats) - Math.min(...lats)) * 111320;
      const lngExtM = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * cosL;
      const half = (Math.max(latExtM, lngExtM, 25) / 2) * 1.5;
      const dLat = half / 111320;
      const dLng = half / (111320 * cosL);
      const minLng = cLng - dLng, maxLng = cLng + dLng, minLat = cLat - dLat, maxLat = cLat + dLat;
      const url = `${ESRI_EXPORT}?bbox=${minLng},${minLat},${maxLng},${maxLat}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=png&transparent=false&f=image`;
      setRawUrl(url);

      const X = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W;
      const Y = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * H;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!alive) return;
        const cv = canvasRef.current;
        if (!cv) return;
        cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d");
        if (!ctx) { setStatus("error"); return; }
        ctx.drawImage(img, 0, 0, W, H);

        // ── parsel sınırı (çift çizgi: koyu zemin + parlak camgöbeği) ──
        ctx.beginPath();
        ring!.forEach(([ln, la], i) => { const x = X(ln), y = Y(la); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.fillStyle = "rgba(56,189,248,0.12)"; ctx.fill();
        ctx.lineJoin = "round";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(8,47,73,0.9)"; ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = "#22d3ee"; ctx.stroke();

        // ── kenar ölçüleri (ft) — en uzun ~8 kenara etiket ──
        const verts = ring!.slice();
        if (verts.length > 1) {
          const f = verts[0], l = verts[verts.length - 1];
          if (f[0] === l[0] && f[1] === l[1]) verts.pop();
        }
        const edges = verts.map((v, i) => {
          const w = verts[(i + 1) % verts.length];
          const ax = X(v[0]), ay = Y(v[1]), bx = X(w[0]), by = Y(w[1]);
          const ft = distanceMiles(v[1], v[0], w[1], w[0]) * 5280;
          return { ax, ay, bx, by, pxLen: Math.hypot(bx - ax, by - ay), ft };
        }).filter((e) => e.pxLen > 38).sort((a, b) => b.pxLen - a.pxLen).slice(0, 8);

        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const e of edges) {
          const mx = (e.ax + e.bx) / 2, my = (e.ay + e.by) / 2;
          const txt = `${Math.round(e.ft).toLocaleString("en-US")} ft`;
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = "rgba(15,23,42,0.85)";
          ctx.fillRect(mx - tw / 2 - 7, my - 12, tw + 14, 24);
          ctx.fillStyle = "#fde68a";
          ctx.fillText(txt, mx, my + 1);
        }

        // ── marka şeritleri ──
        ctx.textBaseline = "middle";
        // üst
        ctx.fillStyle = "rgba(2,6,23,0.6)"; ctx.fillRect(0, 0, W, 70);
        ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "bold 25px system-ui, sans-serif";
        ctx.fillText("≈ APPROXIMATE PROPERTY DIMENSION", 24, 36);
        ctx.textAlign = "right"; ctx.fillStyle = "#67e8f9"; ctx.font = "bold 24px system-ui, sans-serif";
        ctx.fillText("VegaLand", W - 24, 28);
        ctx.fillStyle = "#cbd5e1"; ctx.font = "11px system-ui, sans-serif";
        ctx.fillText("CERBERUS ENGINE", W - 24, 50);
        // KONUM alt-şeridi (Discount Lots tarzı "yeri direkt göster")
        ctx.fillStyle = "rgba(2,6,23,0.5)"; ctx.fillRect(0, 70, W, 34);
        ctx.textAlign = "left"; ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 17px system-ui, sans-serif";
        let locTxt = "📍 " + locationLine(p);
        if (locTxt.length > 64) locTxt = locTxt.slice(0, 63) + "…";
        ctx.fillText(locTxt, 24, 88);
        // alt
        const bh = 116;
        ctx.fillStyle = "rgba(2,6,23,0.66)"; ctx.fillRect(0, H - bh, W, bh);
        ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "bold 30px system-ui, sans-serif";
        ctx.fillText(`${(p.acres ?? 0).toFixed(2)} ACRES`, 24, H - bh + 30);
        ctx.fillStyle = "#cbd5e1"; ctx.font = "19px system-ui, sans-serif";
        const loc = [p.region, p.county, p.state].filter(Boolean).join(", ");
        ctx.fillText(loc || "—", 24, H - bh + 62);
        if (p.marketValue) {
          ctx.textAlign = "right"; ctx.fillStyle = "#86efac"; ctx.font = "bold 26px system-ui, sans-serif";
          ctx.fillText(usd(p.marketValue), W - 24, H - bh + 30);
          ctx.fillStyle = "#94a3b8"; ctx.font = "13px system-ui, sans-serif";
          ctx.fillText("≈ piyasa değeri (emsal)", W - 24, H - bh + 56);
        }
        ctx.textAlign = "left"; ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui, sans-serif";
        ctx.fillText(`${real ? "Gerçek tapu sınırı (Regrid)" : "Yaklaşık kare — gerçek tapu sınırı değil"} · Ölçüler yaklaşık · Uydu: Esri`, 24, H - 14);

        setStatus("ready");
        try { cv.toDataURL("image/png"); setCanDownload(true); } catch { setCanDownload(false); }
      };
      img.onerror = () => { if (alive) setStatus("error"); };
      img.src = url;
    })();

    return () => { alive = false; };
  }, [p]);

  const onDownload = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    try {
      const dataUrl = cv.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `terralot-${(p.apn || p.id).replace(/[^a-z0-9]+/gi, "-")}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch {
      setCanDownload(false);
      window.print(); // CORS taint → yazdır-dostu fallback
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 1200, background: "rgba(2,6,23,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a", borderRadius: 14, padding: 14, maxWidth: "min(92vw, 700px)",
          width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", color: "#e2e8f0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>📸 Satılık Pazarlama Görseli</span>
          <button onClick={onClose} aria-label="Kapat"
            style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#020617", minHeight: 220 }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: status === "ready" ? "block" : "none" }} />
          {status === "loading" && (
            <div style={{ padding: "60px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              ⏳ Uydu görseli + parsel sınırı hazırlanıyor…
            </div>
          )}
          {status === "error" && (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#fca5a5", fontSize: 13 }}>
              Uydu görseli alınamadı (ağ/CORS).{" "}
              {rawUrl && <a href={rawUrl} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>Ham uydu görselini aç ↗</a>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={onDownload}
            disabled={status !== "ready"}
            style={{
              background: status === "ready" ? "#0ea5e9" : "#334155", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: status === "ready" ? "pointer" : "default",
            }}
          >
            ⬇ Görseli indir (PNG)
          </button>
          {!canDownload && status === "ready" && (
            <button onClick={() => window.print()}
              style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              🖨 Yazdır (indirme engellendiyse)
            </button>
          )}
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Ölçüler {isReal ? "gerçek Regrid sınırından" : "yaklaşık kareden"} · {isReal ? "" : "gerçek tapu için Regrid/survey · "}top-down (oblique/3D kapsam dışı)
          </span>
        </div>
      </div>
    </div>
  );
}

// ── ⭐ MOHAVE OFF-MARKET KATMANI ("En İyi 750" reçetesi) ─────────────────────────
// 20K off-market lead'in LEAN harita noktaları — /api/admin/mohave-map-points'ten
// katman açılınca lazy fetch edilir (20K satırı her zaman indirme). Skor 0-100;
// top750 = mohave-score.ts'teki TEK sıralamanın ilk 750'si (mohave-campaign.ts
// "En İyi 750" reçetesiyle AYNI liste — iki yerde ayrı sıralama YOK).
type MohavePoint = {
  id: string; apn: string; lat: number; lng: number; owner: string; region: string;
  acres: number | null; landValue: number | null;
  mailingAddress: string; mailingCity: string; mailingState: string; mailingZip: string;
  score: number; top750: boolean;
  breakdown: { margin: number; size: number; demand: number; motivation: number };
  trs: string; estOffer: number | null; estRetail: number | null; estMargin: number | null;
  isCorporate: boolean;
};

function mohaveScoreColor(score: number): string {
  if (score >= 80) return "#059669"; // yeşil — güçlü aday
  if (score >= 60) return "#eab308"; // sarı — orta
  return "#94a3b8"; // gri — zayıf
}

// Kampanya sayfasındaki varsayılan mektup-başı maliyetle aynı ($0.89) — sadece
// haritada HIZLI bir tahmin; gerçek maliyet kampanya kurucusunda ayarlanabilir.
const DEFAULT_LETTER_COST = 0.89;

// ── 🏁 RAKİP SATIŞLARI (tapu-kanıtlı, Discount Lots/WP RE Ventures ailesi) ──────
// AYRI katman — mevcut "🟥 Rakip ilanları" (aktif ilan, kırmızı elmas) ile
// KARIŞMASIN diye mor/lila/gri paletinde. Statik JSON (src/data/rakip-satislar.json),
// build-time üretilmiş — runtime scraper bağımlılığı yok. Saf dönüşüm lib/rakip-satislar.ts.
const RAKIP_TIP_LABEL: Record<string, string> = {
  dogrulanmis_satis: "Tapu-kanıtlı SATILDI",
  satis_taksitte: "Taksitli satış (sürüyor)",
  envanter: "Rakip envanteri (stokta)",
  belirsiz: "Durum belirsiz",
};

// Kalıcı fiyat etiketleri sadece bu zoom ve üstünde görünür — uzaktan bakınca
// yalnız noktalar, yaklaşınca fiyatlar (çakışmayı zoom eşiği çözer, jitter YOK).
const RAKIP_LABEL_MIN_ZOOM = 11;

// Tek kaydın popup detayı — SEMANTİK DOĞRU:
//  - dogrulanmis_satis: fiyat = SATIŞ fiyatı, karşı taraf = GERÇEK SON ALICI.
//  - taksitli/envanter/belirsiz: county'deki son kayıtlı işlem LLC'nin KENDİ
//    ALIMIDIR (taksit bitmeden tapu devredilmez) → "LLC'nin alım kaydı"
//    (maliyet tabanı) olarak etiketlenir; "Alıcı" diye GÖSTERİLMEZ.
function RakipSatisKayitDetay({ p }: { p: RakipSatisPoint }) {
  const isSatildi = p.kayitTipi === "dogrulanmis_satis";
  const paket = isPaketTapu(p.deedParcelCount);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontWeight: 700, color: p.color, fontSize: 11 }}>
        {RAKIP_TIP_LABEL[p.kayitTipi] ?? p.kayitTipi}
      </div>
      {isSatildi ? (
        <>
          <div>
            Satış: <b>{p.fiyat != null ? usd(p.fiyat) : "—"}</b>
            {p.tarih ? ` · ${p.tarih}` : ""}
          </div>
          {p.karsiTaraf && (
            <div style={{ fontSize: 11, color: "#475569" }}>Alıcı: {p.karsiTaraf}</div>
          )}
        </>
      ) : (
        <>
          {p.fiyat != null && !paket && (
            <div style={{ fontSize: 11, color: "#475569" }}>
              LLC&apos;nin alım kaydı: <b>{usd(p.fiyat)}</b>
              {p.tarih ? ` · ${p.tarih}` : ""} <span style={{ color: "#94a3b8" }}>(maliyet tabanı)</span>
            </div>
          )}
          {p.kayitTipi === "satis_taksitte" && (
            <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>
              Son alıcı: tapu devri tamamlanınca kayda düşer
            </div>
          )}
        </>
      )}
      {/* PAKET TAPU (bulk deed): toplam fiyat GİZLENMEZ ama tek parselin fiyatıymış
          gibi de SUNULMAZ — hem toplam hem parsel-başı tahmin gösterilir. */}
      {paket && p.fiyat != null && p.birimFiyatTahmini != null && (
        <div style={{ fontSize: 11, color: "#b45309", background: "#fffbeb", borderRadius: 4, padding: "2px 5px", marginTop: 2 }}>
          {formatPaketAlimAciklama(p.fiyat, p.tarih, p.deedParcelCount as number, p.birimFiyatTahmini)}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#475569" }}>
        APN: {p.apn}{p.recordingNo ? ` · Kayıt No: ${p.recordingNo}` : ""}
      </div>
      {p.acres != null && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.acres} acre{p.bolge ? ` · ${p.bolge}` : ""}</div>
      )}
    </div>
  );
}

// Grup marker'ları + zoom-eşikli kalıcı etiketler. Aynı koordinatı paylaşan
// kayıtlar TEK marker (rozet "3 satış · $8K–$30K"); popup içinde tek tek liste.
function RakipSatislarLayer({ groups }: { groups: RakipSatisGroup[] }) {
  const [, force] = useState(0);
  const map = useMapEvents({ zoomend: () => force((n) => n + 1) });
  const showLabels = map.getZoom() >= RAKIP_LABEL_MIN_ZOOM;
  return (
    <>
      {groups.map((g) => {
        const isSatildi = g.dominantTip === "dogrulanmis_satis";
        const isTaksit = g.dominantTip === "satis_taksitte";
        const coklu = g.points.length > 1;
        const radius = (isSatildi ? 6 : isTaksit ? 5 : 4) + (coklu ? 2 : 0);
        return (
          <div key={"rs" + g.key}>
            <CircleMarker
              center={[g.lat, g.lng]}
              radius={radius}
              pathOptions={{
                color: isSatildi ? "#fff" : g.color,
                weight: isSatildi ? 1.5 : 2,
                fillColor: g.color,
                fillOpacity: isSatildi ? 0.95 : isTaksit ? 0.45 : 0.2,
              }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 200, maxHeight: 260, overflowY: "auto" }}>
                  <div style={{ fontWeight: 700, color: g.color }}>
                    🏁 {coklu ? `${g.points.length} rakip kaydı (aynı nokta)` : (RAKIP_TIP_LABEL[g.points[0].kayitTipi] ?? g.points[0].kayitTipi)}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 2 }}>
                    {g.points[0].sirketLlc || "Discount Lots (WP RE Ventures ailesi)"}
                  </div>
                  {g.points.map((p, i) => (
                    <div key={p.id} style={i > 0 || coklu ? { borderTop: "1px solid #eee", marginTop: 5, paddingTop: 3 } : undefined}>
                      <RakipSatisKayitDetay p={p} />
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontStyle: "italic" }}>
                    {g.points.every((p) => p.coordSource === "exact")
                      ? "Konum: tapu APN eşleşmesi"
                      : "Konum: yaklaşık (aynı blok/subdivision centroid'i)"}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
            {showLabels && g.label && (
              <Marker
                position={[g.lat, g.lng]}
                interactive={false}
                icon={L.divIcon({
                  className: "rakip-satis-price-label",
                  html: `<div style="transform:translate(9px,-9px);background:${isSatildi ? "#4c1d95" : "#6b7280"};color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${g.label}</div>`,
                  iconSize: [0, 0],
                })}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ── 🐋 BÜYÜK OYUNCULAR (Mohave kurumsal sahiplik röntgeni) ──────────────────────
// Keşif ajanının bulduğu en büyük 8 arsa oyuncusunun TÜM parselleri (5K+ nokta).
// Veri statik JSON (src/data/buyuk-oyuncular.json) — toggle ilk açıldığında
// dynamic import ile lazy yüklenir (ana bundle şişmez). Canvas renderer (SVG'de
// 5K nokta takılır). Saf dönüşüm/filtre lib/buyuk-oyuncular.ts.
function BuyukOyuncularLayer({
  points, oyuncular, renderer,
}: { points: BuyukOyuncuPoint[]; oyuncular: BuyukOyuncu[]; renderer: L.Renderer }) {
  return (
    <>
      {points.map((p, i) => {
        const o = oyuncular[p.oyuncuIdx];
        return (
          <CircleMarker
            key={"bo" + p.apn + i}
            center={[p.lat, p.lng]}
            radius={3.5}
            pathOptions={{
              renderer,
              color: "rgba(255,255,255,0.5)", weight: 0.6,
              fillColor: oyuncuRenk(p.oyuncuIdx), fillOpacity: 0.75,
            }}
          >
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 185 }}>
                <div style={{ fontWeight: 700, color: oyuncuRenk(p.oyuncuIdx) }}>🐋 {o?.kisaAd ?? "?"}</div>
                {o?.tip === "gelistirici" && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fffbeb", display: "inline-block", borderRadius: 4, padding: "1px 6px", marginTop: 2 }}>
                    🏗️ geliştirici — arsa-flip rakibi değil
                  </div>
                )}
                <div style={{ marginTop: 3 }}>APN: <b>{p.apn}</b></div>
                <div style={{ color: "#64748b" }}>
                  {p.acres != null ? `${p.acres} acre` : "acre yok"}
                  {p.landValue != null ? ` · land value ${usd(p.landValue)}` : ""}
                </div>
                {(p.salep != null || p.saledt) && (
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    Alım: {p.salep != null ? <b>{usd(p.salep)}</b> : "fiyat yok"}{p.saledt ? ` · ${p.saledt}` : ""}
                    <span style={{ color: "#94a3b8" }}> (county SALEP/SALEDT)</span>
                  </div>
                )}
                {/* PAKET TAPU (bulk deed): county aynı RECPTNO'ya bağlı N parselin
                    TOPLAM SALEP'ini her satıra yazıyor — toplamı gizlemeden parsel
                    başına tahmini de göster (bkz. lib/paket-tapu.ts). */}
                {isPaketTapu(p.deedParcelCount) && p.salep != null && p.birimFiyatTahmini != null && (
                  <div style={{ fontSize: 10, color: "#b45309", background: "#fffbeb", borderRadius: 4, padding: "2px 5px", marginTop: 2 }}>
                    {formatPaketAlimAciklama(p.salep, p.saledt, p.deedParcelCount, p.birimFiyatTahmini)}
                  </div>
                )}
                {o?.not && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, fontStyle: "italic" }}>{o.not}</div>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Mohave lead popup içeriği — hem "Havuz" hem "Mektup Hedefi" katmanı BUNU paylaşır
// (aynı JSX'i iki kere yazmayalım). APN + TRS + sahip + posta eyaleti + acre +
// land value + skor kırılımı + tahmini teklif/perakende/marj + "🔍 APN Doğrula"
// linki (apn-dogrula sayfası ?apn= query param'ını otomatik sorgular).
// Kurumsal/balina/kamu (isCorporate) ise: rozet + "Kampanyaya Ekle" YOK (mektup
// hedefi değil — boşa para/adres kirliliği).
function MohavePopupBody({
  p, cart, toggleCart,
}: { p: MohavePoint; cart: Map<string, MohavePoint>; toggleCart: (p: MohavePoint) => void }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 205 }}>
      <div style={{ fontWeight: 700 }}>
        {p.top750 && (
          <span style={{ background: "#eab308", color: "#1c1917", borderRadius: 3, padding: "1px 5px", marginRight: 5, fontSize: 10 }}>
            💌 Mektup Hedefi
          </span>
        )}
        {p.owner || p.apn}
      </div>
      {p.isCorporate && (
        <div style={{ marginTop: 3, display: "inline-block", fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", borderRadius: 4, padding: "2px 6px" }}>
          🏢 Kurumsal/gizli-ağ sahip — mektup hedefi DEĞİL
        </div>
      )}
      <div style={{ color: "#64748b", marginTop: 2 }}>
        {p.region || "bölge yok"} · {p.acres != null ? `${p.acres.toFixed(2)} acre` : "acre yok"} · sahip eyaleti: {p.mailingState || "—"}
      </div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
        APN: <b>{p.apn || "—"}</b>
        {p.trs && <> · TRS: <b>{p.trs}</b></>}
        {p.apn && (
          <a
            href={`/admin/apn-dogrula?apn=${encodeURIComponent(p.apn)}`}
            target="_blank" rel="noreferrer"
            style={{ marginLeft: 6, color: "#0891b2", fontWeight: 600, textDecoration: "none" }}
          >
            🔍 APN Doğrula
          </a>
        )}
      </div>
      <div style={{ marginTop: 3 }}>
        Land value: <b>{p.landValue != null ? usd(p.landValue) : "—"}</b>
      </div>
      {(p.estOffer != null || p.estRetail != null) && (
        <div style={{ fontSize: 11, color: "#475569" }}>
          Tahmini teklif: <b style={{ color: "#059669" }}>{p.estOffer != null ? usd(p.estOffer) : "—"}</b>
          {p.estRetail != null && <> · perakende: <b>{usd(p.estRetail)}</b></>}
          {p.estMargin != null && <> · marj: <b style={{ color: "#059669" }}>{usd(p.estMargin)}</b></>}
        </div>
      )}
      <div style={{ marginTop: 3, fontWeight: 700, color: mohaveScoreColor(p.score) }}>
        Skor: {p.score}/100
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>
        marj {p.breakdown.margin} · boyut {p.breakdown.size} · talep {p.breakdown.demand} · motivasyon {p.breakdown.motivation}
      </div>
      {!p.isCorporate && (
        <button
          onClick={() => toggleCart(p)}
          style={{
            marginTop: 6, border: "none", borderRadius: 5, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: cart.has(p.id) ? "#dc2626" : "#7c3aed", color: "#fff",
          }}
        >
          {cart.has(p.id) ? "✕ Sepetten çıkar" : "🛒 Kampanyaya Ekle"}
        </button>
      )}
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
  const [filters, setFilters] = useState<Filters>({ grade: "", absentee: false, comp: false, bigSpread: false, nearComp: false, multiOwner: false, nearAccess: false, mhOnly: false });
  const setF = (u: Partial<Filters>) => setFilters((p) => ({ ...p, ...u }));
  // OSM yol-tipi katmanı (varsayılan KAPALI — açınca Overpass çalışır).
  const [showRoads, setShowRoads] = useState(false);
  const [roadTypes, setRoadTypes] = useState<RoadTypes>({ highway: true, paved: true, dirt: true, service: true });
  const toggleRoadType = (c: RoadCat) => setRoadTypes((p) => ({ ...p, [c]: !p[c] }));
  const [roadsState, setRoadsState] = useState<RoadState>({ loading: false, count: 0, tooFar: false });
  // Satılık pazarlama görseli modalı (popup'tan açılır).
  const [marketImg, setMarketImg] = useState<MapPoint | null>(null);

  // 🏁 Rakip Satışları (tapu-kanıtlı) — statik JSON'dan bir kez üretilir, toggle
  // ile aç/kapa (varsayılan KAPALI, "Rakip ilanları"nı bozmaz).
  const [showRakipSatislar, setShowRakipSatislar] = useState(false);
  const rakipSatislarPoints = useMemo(
    () => buildRakipSatislarLayer(rakipSatislarData as RakipSatislarData),
    [],
  );
  const rakipSatislarOzet = useMemo(
    () => computeRakipSatislarOzet(rakipSatislarPoints),
    [rakipSatislarPoints],
  );
  // Aynı koordinatı paylaşan kayıtlar tek marker'da (etiket çakışması fix'i).
  const rakipSatisGroups = useMemo(
    () => groupRakipSatisPoints(rakipSatislarPoints),
    [rakipSatislarPoints],
  );

  // 🐋 Büyük Oyuncular — lazy dynamic import (5K+ nokta ana bundle'a girmesin).
  const [showBuyukOyuncular, setShowBuyukOyuncular] = useState(false);
  const [boData, setBoData] = useState<{ oyuncular: BuyukOyuncu[]; points: BuyukOyuncuPoint[] } | null>(null);
  const [boLoading, setBoLoading] = useState(false);
  const [boSecim, setBoSecim] = useState<Set<number>>(new Set());
  const boRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const ensureBuyukOyuncularLoaded = () => {
    if (boData || boLoading) return;
    setBoLoading(true);
    import("@/data/buyuk-oyuncular.json")
      .then((m) => {
        const d = (m.default ?? m) as unknown as BuyukOyuncularData;
        setBoData({ oyuncular: d.oyuncular ?? [], points: expandBuyukOyuncuRows(d) });
        setBoSecim(defaultSecim(d.oyuncular ?? []));
      })
      .catch(() => {})
      .finally(() => setBoLoading(false));
  };
  const boVisible = useMemo(
    () => (boData ? filterBuyukOyuncuPoints(boData.points, boSecim) : []),
    [boData, boSecim],
  );
  const toggleBoOyuncu = (i: number) =>
    setBoSecim((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  // ⭐ Mohave off-market katmanı — İKİ BAĞIMSIZ toggle (eskiden tek 3'lü döngüydü):
  //   💌 Mektup Hedefi (En İyi 750) — varsayılan AÇIK, mohave-campaign.ts#buildTop750Campaign
  //      ile AYNI seçim (kurumsal/balina/kamu elendikten SONRAKİ sıralama).
  //   ⭐ Mohave Havuzu (Tümü, 20K) — varsayılan KAPALI, ayrıntı/denetim için.
  // İkisi de aynı /api/admin/mohave-map-points fetch'ini paylaşır (lazy, ilk açılışta).
  const [showMektupHedefi, setShowMektupHedefi] = useState(true);
  const [showMohaveHavuzu, setShowMohaveHavuzu] = useState(false);
  const [mohavePoints, setMohavePoints] = useState<MohavePoint[]>([]);
  const [mohaveLoading, setMohaveLoading] = useState(false);
  const [cart, setCart] = useState<Map<string, MohavePoint>>(new Map());
  // Ayrı Canvas renderer: 20K nokta SVG yerine canvas'ta çizilir (performans),
  // diğer katmanlar (deal marker'ları vb.) varsayılan SVG renderer'da kalır.
  const mohaveRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  // Lazy fetch: yalnız kullanıcı katmanlardan biri ilk kez açıldığında tetiklenir
  // (varsayılan AÇIK olan 💌 Mektup Hedefi ilk mount'ta çağırır) — effect içinde
  // koşullu setState YOK (lint: set-state-in-effect), doğrudan handler'dan çağrılır.
  const ensureMohaveLoaded = () => {
    if (mohavePoints.length > 0 || mohaveLoading) return;
    setMohaveLoading(true);
    fetch("/api/admin/mohave-map-points")
      .then((r) => r.json())
      .then((d) => setMohavePoints(Array.isArray(d.points) ? d.points : []))
      .catch(() => {})
      .finally(() => setMohaveLoading(false));
  };
  // Varsayılan açık katman (💌 Mektup Hedefi) için ilk mount'ta bir kez yükle.
  useEffect(() => { if (showMektupHedefi) ensureMohaveLoaded(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Top-750 (mektup hedefi) — kurumsal/balina/kamu ZATEN API'de elenmiş sıralamadan.
  const top750Mohave = useMemo(
    () => (showMektupHedefi ? mohavePoints.filter((p) => p.top750) : []),
    [showMektupHedefi, mohavePoints],
  );
  // Havuz (Tümü, 20K) — top-750'de zaten ayrı/parlak çizildiği için burada
  // ÇİFT ÇİZİLMESİN diye top750 üyeleri hariç tutulur.
  const havuzMohave = useMemo(
    () => (showMohaveHavuzu ? mohavePoints.filter((p) => !p.top750) : []),
    [showMohaveHavuzu, mohavePoints],
  );

  const toggleCart = (p: MohavePoint) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id); else next.set(p.id, p);
      return next;
    });
  };

  // Sepet özeti: gerçek dedupe/maliyet motorunu (mohave-campaign.ts) YENİDEN
  // KULLAN — kopyalama yok. Aynı sahip + aynı posta adresi tek mektupta birleşir.
  const cartSummary = useMemo(() => {
    if (cart.size === 0) return null;
    const rows: MohaveRow[] = [...cart.values()].map((p) => ({
      apn: p.apn, owner: p.owner, mailing_address: p.mailingAddress, mailing_city: p.mailingCity,
      mailing_state: p.mailingState, mailing_zip: p.mailingZip, acres: p.acres, land_value: p.landValue,
      region: p.region, est_offer: 0, score: p.score,
    }));
    const c = buildCampaign(rows, {});
    return { ...c, estCost: Math.round(c.letters.length * DEFAULT_LETTER_COST) };
  }, [cart]);

  // "Kampanya Kur →": seçili APN'leri sessionStorage'a yazıp kampanya sayfasına
  // yönlendirir. Sayfa ?from=map görünce sessionStorage'ı okuyup "Haritadan
  // Seçim (N)" segmentini kurar (bkz. mohave/kampanya/page.tsx).
  const startCampaignFromCart = () => {
    const apns = [...cart.values()].map((p) => p.apn).filter(Boolean);
    if (!apns.length) return;
    try { sessionStorage.setItem("terralot_map_selection", JSON.stringify(apns)); } catch { /* gizli mod vb. — sessizce yut */ }
    window.location.href = "/admin/mohave/kampanya?from=map";
  };

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

  // Erişim/uzaklık sinyali — en yakın ŞEHİR + ANAYOL (geo-proximity, yaklaşık sabit
  // referans). dealGrade'i DEĞİŞTİRMEZ; AYRI dürüst sinyal. Parsel başına 1 kez hesap.
  const accessByPoint = useMemo(() => {
    const m = new Map<string, { far: boolean; cityMi: number | null; hwyMi: number | null }>();
    for (const p of points) {
      const city = nearestRef(p.lat, p.lng, "city");
      const hwy = nearestRef(p.lat, p.lng, "highway");
      const cityMi = city ? city.miles : null;
      const hwyMi = hwy ? hwy.miles : null;
      const far = (hwyMi != null && hwyMi > ACCESS_MAX_MI) || (cityMi != null && cityMi > ACCESS_MAX_MI);
      m.set(p.id, { far, cityMi, hwyMi });
    }
    return m;
  }, [points]);

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
      if (filters.nearAccess && accessByPoint.get(p.id)?.far) return false;
      if (filters.mhOnly && p.mh !== "likely") return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, filters, ownerCounts, nearestCompMiles, accessByPoint]);

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
          {/* Mohave County GIS — gerçek parsel sınırı + yol grid + APN; OSM'in
              içermediği isimli subdivision sokakları (Fireside Dr, Pipeline Rd…).
              Default KAPALI; açınca yüklenir. Datacenter IP'den timeout olur,
              kullanıcının residential tarayıcısından çalışır — fail-soft. */}
          <LayersControl.Overlay name="🏛️ County Parsel+Yol (Mohave GIS)">
            <CountyGisLayer />
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
          const acc = accessByPoint.get(p.id);
          // Uzak parsel → marker kenarı SOLUK GRİ + biraz şeffaf (görsel ipucu).
          // dealGrade RENGİ (fillColor) DEĞİŞMEZ — sadece kenar/şeffaflık.
          const edge = acc?.far ? "#94a3b8" : "#fff";
          const fillOp = acc?.far ? 0.55 : 0.85;
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
                pathOptions={{ color: edge, weight: acc?.far ? 1.5 : 1, fillColor: color, fillOpacity: fillOp }}
                eventHandlers={{
                  popupopen: () => { setSelected(p); setSelRealBoundary(false); },
                  popupclose: () => setSelected((s) => (s?.id === p.id ? null : s)),
                }}
              >
                <Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 180 }}>
                    {/* KONUM satırı (Discount Lots tarzı "yeri direkt göster") — situs + region + state. */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#0f172a", marginBottom: 3 }}>
                      📍 {locationLine(p)}
                    </div>
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
                    {/* ROAD Act MH-uygunluk rozeti — dürüst sinyal (mhReason teyit şerhli). */}
                    {p.mh && (
                      <div
                        title={p.mhReason ?? undefined}
                        style={{
                          marginTop: 3, display: "inline-block", fontSize: 10, fontWeight: 700,
                          borderRadius: 4, padding: "1px 6px",
                          color: p.mh === "likely" ? "#065f46" : p.mh === "verify" ? "#92400e" : "#475569",
                          background: p.mh === "likely" ? "#d1fae5" : p.mh === "verify" ? "#fef3c7" : "#f1f5f9",
                        }}
                      >
                        {p.mh === "likely" ? "🏠 MH-uygun (ROAD Act) — teyit şerhli" : p.mh === "verify" ? "🏠 MH: county teyidi şart" : "MH uygun değil"}
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
                      // ERİŞİM/UZAKLIK ROZETİ — dealGrade'den AYRI dürüst sinyal. "A deal" görünen
                      // ama dağlık + çok uzak parsel aslında zayıf; bunu görünür yapar (grade'e dokunmaz).
                      const a = acc ?? { far: false, cityMi: null, hwyMi: null };
                      const refMi = a.hwyMi ?? a.cityMi; // gösterimde anayol önce
                      const refTxt = refMi != null ? `anayol ${Math.round(a.hwyMi ?? refMi)}mi` : "mesafe yok";
                      return (
                        <div
                          style={{
                            marginTop: 5, fontSize: 11, fontWeight: 600, borderRadius: 5, padding: "3px 7px",
                            color: a.far ? "#92400e" : "#047857",
                            background: a.far ? "#fffbeb" : "#ecfdf5",
                            border: `1px solid ${a.far ? "#fcd34d" : "#a7f3d0"}`,
                          }}
                        >
                          {a.far
                            ? `⚠ Uzak — erişim zayıf (${refTxt})`
                            : `✓ Erişim iyi (${refTxt})`}
                        </div>
                      );
                    })()}
                    {(() => {
                      // Yakınlık scorecard: en yakın şehir + highway + rakip + su (hepsi yaklaşık referans).
                      const city = nearestRef(p.lat, p.lng, "city");
                      const hwy = nearestRef(p.lat, p.lng, "highway");
                      const water = nearestRef(p.lat, p.lng, "water");
                      const metro = nearestRef(p.lat, p.lng, "metro");
                      const nc = nearestCompMiles(p.lat, p.lng);
                      return (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
                          {city ? <div>🏙️ En yakın şehir: {city.name} ~{city.miles.toFixed(0)} mi</div> : null}
                          {hwy ? <div>🛣️ En yakın anayol: {hwy.name} ~{hwy.miles.toFixed(0)} mi</div> : null}
                          {metro ? <div style={{ color: "#7c3aed", fontWeight: 600 }}>🎰 {metro.name} ~{metro.miles.toFixed(0)} mi (satış kozu)</div> : null}
                          <div>
                            📍 {nc != null ? `En yakın rakip ~${nc.toFixed(1)} mi` : "rakip verisi yükleniyor"}
                            {water ? ` · 💧 ${water.name} ~${water.miles.toFixed(0)} mi` : ""}
                          </div>
                          <div style={{ fontStyle: "italic", color: "#94a3b8" }}>(yaklaşık · sabit referans noktasına)</div>
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <a href={`https://www.google.com/maps/place/${p.lat},${p.lng}/@${p.lat},${p.lng},800m/data=!3m1!1e3`} target="_blank" rel="noreferrer" style={{ color: "#0284c7" }}>🛰️ Uydu (📍 pinli)</a>
                      <button
                        onClick={() => setMarketImg(p)}
                        style={{ border: "none", background: "#0ea5e9", color: "#fff", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                      >
                        📸 Satılık görseli
                      </button>
                      <a
                        href={`/admin/parcel-sunum?id=${encodeURIComponent(p.id)}`}
                        target="_blank" rel="noreferrer"
                        style={{ background: "#0f172a", color: "#fff", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                      >
                        🖨 Tek Sayfa (PDF)
                      </a>
                      <CopyBuyerLink dealId={p.id} />
                    </div>
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
                {/* Rakip Radar'daki yaşam döngüsü kaydına atla (başlıkla arar) */}
                <a href={`/admin/rakip-radar?q=${encodeURIComponent(c.title || c.competitor)}`} style={{ color: "#0284c7", display: "block", marginTop: 2 }}>📡 Radar kaydı (DOM/satış takibi) ↗</a>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 🏁 RAKİP SATIŞLARI (tapu-kanıtlı) — koyu mor dolu = tamamlanmış satış
            (kalıcı fiyat etiketiyle), açık lila kontur = taksitli, soluk gri halka = stok/envanter.
            "Rakip ilanları" (kırmızı elmas, aktif ilan) ile KARIŞMASIN diye ayrı renk paleti. */}
        {showRakipSatislar && <RakipSatislarLayer groups={rakipSatisGroups} />}

        {/* 🐋 BÜYÜK OYUNCULAR — oyuncu başına renkli 5K+ nokta (canvas renderer). */}
        {showBuyukOyuncular && boData && (
          <BuyukOyuncularLayer points={boVisible} oyuncular={boData.oyuncular} renderer={boRenderer} />
        )}

        {/* ⭐ MOHAVE HAVUZU (Tümü, 20K) — Canvas renderer (SVG'de takılır). Soluk
            gri/sarı/yeşil skor rengi. Top-750 üyeleri BURADA YOK (ayrı katmanda,
            çift çizim olmasın diye). */}
        {havuzMohave.map((p) => (
          <CircleMarker
            key={"mv" + p.id}
            center={[p.lat, p.lng]}
            radius={3}
            pathOptions={{
              renderer: mohaveRenderer,
              color: "rgba(255,255,255,0.35)",
              weight: 0.5,
              fillColor: p.isCorporate ? "#64748b" : mohaveScoreColor(p.score),
              fillOpacity: p.isCorporate ? 0.35 : 0.5,
            }}
          >
            <Popup>
              <MohavePopupBody p={p} cart={cart} toggleCart={toggleCart} />
            </Popup>
          </CircleMarker>
        ))}

        {/* 💌 MEKTUP HEDEFİ (En İyi 750) — AYRI, belirgin katman (parlak altın,
            beyaz kalın kenar) — "Havuz"dan (20K, soluk skor rengi) görsel olarak
            KESİN ayrışsın diye. Kurumsal/balina/kamu buraya ASLA giremez (API'de
            sıralamaya girmeden elenir — bkz. mohave-map-points route.ts). */}
        {top750Mohave.map((p) => (
          <CircleMarker
            key={"t750" + p.id}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{
              renderer: mohaveRenderer,
              color: "#fff",
              weight: 2,
              fillColor: "#eab308", // parlak altın — "bizim hedefimiz"
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <MohavePopupBody p={p} cart={cart} toggleCart={toggleCart} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Satılık pazarlama görseli modalı (DOM overlay — haritanın üstünde). */}
      {marketImg && <MarketingImageModal p={marketImg} onClose={() => setMarketImg(null)} />}

      {/* ⭐ Mohave kampanya sepeti — sağ-altta (sol yığından bağımsız, LayersControl'ün altında). */}
      {cart.size > 0 && cartSummary && (
        <div style={{
          position: "absolute", bottom: 16, right: 10, zIndex: 1000, minWidth: 225,
          background: "rgba(255,255,255,0.97)", border: "1px solid #7c3aed", borderRadius: 10,
          padding: "10px 12px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
        }}>
          <div style={{ fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>🛒 Kampanya Sepeti</div>
          <div>{cart.size} parsel seçili → <b>{cartSummary.letters.length}</b> mektup (dedupe sonrası)</div>
          <div style={{ color: "#64748b", marginTop: 2 }}>
            Tahmini posta maliyeti: <b>${cartSummary.estCost.toLocaleString("en-US")}</b> (@${DEFAULT_LETTER_COST.toFixed(2)}/mektup)
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={startCampaignFromCart}
              style={{ flex: 1, border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "#7c3aed", color: "#fff" }}
            >
              Kampanya Kur →
            </button>
            <button
              onClick={() => setCart(new Map())}
              style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#475569" }}
            >
              Temizle
            </button>
          </div>
        </div>
      )}

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
          onClick={() => {
            setShowMektupHedefi((v) => {
              const next = !v;
              if (next) ensureMohaveLoaded();
              return next;
            });
          }}
          title="Mektup Hedefi: 'En İyi 750' skorlu parsel — mohave-campaign.ts#buildTop750Campaign ile AYNI seçim, kurumsal/balina/kamu sahipler ELENDİ."
          style={toggleBtnStyle(showMektupHedefi, "#ca8a04", "#a16207")}
        >
          💌 Mektup Hedefi (En İyi 750): {showMektupHedefi ? `Açık (${top750Mohave.length.toLocaleString("en-US")})` : "Kapalı"}
          {mohaveLoading ? " · ⏳" : ""}
        </button>
        <button
          onClick={() => {
            setShowMohaveHavuzu((v) => {
              const next = !v;
              if (next) ensureMohaveLoaded();
              return next;
            });
          }}
          title="Mohave Havuzu: işlenmiş 20K off-market lead'in TAMAMI (mektup hedefi 750'nin dışındakiler dahil) — denetim/ayrıntı için."
          style={toggleBtnStyle(showMohaveHavuzu, "#7c3aed", "#6d28d9")}
        >
          ⭐ Mohave Havuzu (Tümü): {showMohaveHavuzu ? `Açık (${mohavePoints.length.toLocaleString("en-US")})` : "Kapalı"}
          {mohaveLoading ? " · ⏳" : ""}
        </button>
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
          onClick={() => setShowRakipSatislar((v) => !v)}
          title="Tapu-kanıtlı rakip satışları (Discount Lots/WP RE Ventures) — 'Rakip ilanları'ndan AYRI katman"
          style={toggleBtnStyle(showRakipSatislar, "#4c1d95", "#4c1d95")}
        >
          🏁 Rakip Satışları (tapu){rakipSatislarPoints.length ? ` (${rakipSatislarPoints.length})` : ""}: {showRakipSatislar ? "Açık" : "Kapalı"}
        </button>
        {showRakipSatislar && (
          <div style={{
            background: "rgba(76,29,149,0.95)", color: "#fff", borderRadius: 8,
            padding: "6px 10px", fontSize: 11, fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            maxWidth: 230, lineHeight: 1.5,
          }}>
            {rakipSatislarOzet.rozetMetni}
            <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
              {rakipSatislarOzet.envanter} stok/belirsiz · tapu kaydı, Mohave County
            </div>
          </div>
        )}
        <button
          onClick={() => {
            setShowBuyukOyuncular((v) => {
              const next = !v;
              if (next) ensureBuyukOyuncularLoaded();
              return next;
            });
          }}
          title="Mohave'nin en büyük kurumsal arsa sahipleri (keşif ajanı, county tapu verisi) — oyuncu bazında aç/kapa legend'da"
          style={toggleBtnStyle(showBuyukOyuncular, "#0e7490", "#155e75")}
        >
          🐋 Büyük Oyuncular{boData ? ` (${boVisible.length.toLocaleString("en-US")})` : ""}: {showBuyukOyuncular ? "Açık" : "Kapalı"}{boLoading ? " · ⏳" : ""}
        </button>
        {showBuyukOyuncular && boData && (
          <div style={{
            background: "rgba(255,255,255,0.97)", border: "1px solid #0e7490", borderRadius: 8,
            padding: "8px 10px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            maxWidth: 250, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: "#0e7490", marginBottom: 3 }}>🐋 Oyuncular (tıkla → aç/kapa)</div>
            {boData.oyuncular.map((o, i) => (
              <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", opacity: boSecim.has(i) ? 1 : 0.45 }}>
                <input type="checkbox" checked={boSecim.has(i)} onChange={() => toggleBoOyuncu(i)} style={{ margin: 0 }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: oyuncuRenk(i), display: "inline-block", flexShrink: 0 }} />
                <span style={{ color: "#334155" }}>
                  {o.kisaAd} <b>({o.parselSayisi.toLocaleString("en-US")})</b>
                </span>
              </label>
            ))}
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>
              🏗️ geliştiriciler flip rakibi değil — varsayılan kapalı · kaynak: county tapu (OWNER/adres eşleşmesi)
            </div>
          </div>
        )}
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
