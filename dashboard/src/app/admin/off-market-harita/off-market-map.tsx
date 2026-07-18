"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 5 EYALET OFF-MARKET HARİTASI — istemci harita katmanı (react-leaflet).
// DÜRÜSTLÜK KURALI: koordinatı olmayan lead haritaya SAHTE koordinatla serpilmez.
//  - AZ · Mohave  → GERÇEK lat/lng olan noktalar (canvas renderer, 20K'ya dayanır).
//  - NM · Luna    → lat/lng YOK → tek "toplu county pini" (Deming/Luna merkezi, 157 lead).
//  - CO/TX/FL     → 0 kullanılabilir lead → içi boş "hedef" işareti (kesikli), 0 lead.
// Harita altyapısı mevcut alinabilir-harita/deals-map.tsx ile aynı: MapContainer +
// L.canvas({padding:0.5}) renderer ile binlerce CircleMarker performanslı çizilir.
// ─────────────────────────────────────────────────────────────────────────────

import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";

export type OffMarketPoint = {
  id: string;
  lat: number;
  lng: number;
  owner: string;
  region: string;
  acres: number | null;
  landValue: number | null;
  score: number;
};

export type TargetState = {
  state: string;
  county: string;
  lat: number;
  lng: number;
  color: string;
};

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

// Eyalet renkleri (lejantla birebir eşleşir).
export const AZ_COLOR = "#059669"; // gerçek noktalar (yeşil)
export const NM_COLOR = "#2563eb"; // county pini (mavi)

// AZ off-market skor rengi — güçlü/orta/zayıf (deals-map ile aynı eşikler).
function azScoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#eab308";
  return "#94a3b8";
}

// NM Luna toplu county pini — koordinatı olmayan 157 lead'i TEK noktada, dürüstçe
// "county merkezi" olarak gösterir (tek tek parsel çizilmez).
function lunaIcon(leads: number) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="background:${NM_COLOR};border:3px solid #fff;border-radius:14px;padding:3px 9px;font:700 12px system-ui,sans-serif;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap;">Luna, NM · ${leads} lead</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${NM_COLOR};margin-top:-1px;"></div>
    </div>`,
    iconSize: [120, 34],
    iconAnchor: [60, 34],
  });
}

// CO/TX/FL boş "hedef" işareti — içi boş, kesikli halka. Veri YOK, sadece footprint.
function targetIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border:2.5px dashed ${color};border-radius:50%;background:${color}1f;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function OffMarketMap({
  azPoints,
  lunaLeads,
  targets,
}: {
  azPoints: OffMarketPoint[];
  lunaLeads: number;
  targets: TargetState[];
}) {
  // 20K noktayı SVG değil canvas'a çiz — SVG'de tarayıcı takılır.
  const azRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  return (
    <MapContainer
      center={[33.5, -100.0]}
      zoom={5}
      className="w-full"
      style={{ height: "640px", background: "#aadaff" }}
      scrollWheelZoom
    >
      <TileLayer attribution="&copy; OSM" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* AZ · Mohave — GERÇEK koordinatlı noktalar (canvas renderer). */}
      {azPoints.map((p) => (
        <CircleMarker
          key={"az" + p.id}
          center={[p.lat, p.lng]}
          radius={3}
          pathOptions={{
            renderer: azRenderer,
            color: "rgba(255,255,255,0.35)",
            weight: 0.5,
            fillColor: azScoreColor(p.score),
            fillOpacity: 0.6,
          }}
        >
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 190 }}>
              <div style={{ fontWeight: 700, color: AZ_COLOR }}>AZ · Mohave</div>
              <div style={{ marginTop: 2 }}>
                Sahip: <b>{p.owner || "—"}</b>
              </div>
              <div style={{ color: "#475569" }}>
                {p.region || "—"} · {p.acres != null ? `${p.acres} acre` : "acre —"}
              </div>
              <div style={{ color: "#475569" }}>Land value: {usd(p.landValue)}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Skor {p.score}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* NM · Luna — toplu county pini (koordinat YOK, tek merkez nokta). */}
      <Marker
        position={[32.27, -107.76]}
        icon={lunaIcon(lunaLeads)}
        eventHandlers={{ click: () => { window.location.href = "/admin/luna"; } }}
      >
        <Popup>
          <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 180 }}>
            <div style={{ fontWeight: 700, color: NM_COLOR }}>Luna, NM · {lunaLeads} lead</div>
            <div style={{ color: "#475569", marginTop: 2 }}>
              Parsel koordinatı henüz yok → tek county pini (Deming / Luna merkezi).
            </div>
            <a href="/admin/luna" style={{ color: NM_COLOR, fontWeight: 600, display: "inline-block", marginTop: 4 }}>
              Luna envanterini aç →
            </a>
          </div>
        </Popup>
      </Marker>

      {/* CO/TX/FL — boş "hedef" işaretleri (kesikli halka, 0 lead). */}
      {targets.map((t) => (
        <Marker key={t.state} position={[t.lat, t.lng]} icon={targetIcon(t.color)}>
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 180 }}>
              <div style={{ fontWeight: 700, color: t.color }}>
                {t.state} · {t.county}
              </div>
              <div style={{ color: "#475569", marginTop: 2 }}>PropStream&apos;den gelecek · 0 lead</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                Hedef eyalet footprint&apos;i — veri henüz çekilmedi.
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
