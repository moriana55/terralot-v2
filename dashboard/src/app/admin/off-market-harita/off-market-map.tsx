"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 5 EYALET OFF-MARKET HARİTASI — istemci harita katmanı (react-leaflet).
// DÜRÜSTLÜK KURALI: koordinatı olmayan lead haritaya SAHTE koordinatla serpilmez.
//  - AZ · Mohave  → GERÇEK lat/lng olan noktalar (canvas renderer, 20K'ya dayanır).
//  - NM/CO/TX/FL  → parsel koordinatı yok → eyalet/county merkezinde GERÇEK SAYILI
//    "toplu county pini" (tek tek parsel çizilmez; sayı Supabase offmarket_leads gerçeği).
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

// Gerçek sayılı eyalet/county pini (koordinatsız lead'ler için toplu gösterim).
export type StatePin = {
  state: string;
  region: string;
  lat: number;
  lng: number;
  color: string;
  leads: number;
  href?: string;
};

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const fmt = (n: number) => n.toLocaleString("en-US");

export const AZ_COLOR = "#059669";

function azScoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#eab308";
  return "#94a3b8";
}

// Gerçek sayılı toplu county pini — "STATE · N lead" etiketli, tıklanabilir.
function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="background:${color};border:3px solid #fff;border-radius:14px;padding:4px 11px;font:800 13px system-ui,sans-serif;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.45);white-space:nowrap;">${label}</div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${color};margin-top:-1px;"></div>
    </div>`,
    iconSize: [160, 38],
    iconAnchor: [80, 38],
  });
}

export default function OffMarketMap({
  azPoints,
  statePins,
}: {
  azPoints: OffMarketPoint[];
  statePins: StatePin[];
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

      {/* NM · CO · TX · FL — GERÇEK sayılı toplu county pinleri. */}
      {statePins.map((s) => (
        <Marker
          key={s.state}
          position={[s.lat, s.lng]}
          icon={pinIcon(s.color, `${s.state} · ${fmt(s.leads)} lead`)}
          eventHandlers={s.href ? { click: () => { window.location.href = s.href!; } } : undefined}
        >
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 190 }}>
              <div style={{ fontWeight: 800, color: s.color }}>{s.state} · {s.region}</div>
              <div style={{ marginTop: 2, fontSize: 14, fontWeight: 700 }}>{fmt(s.leads)} off-market lead</div>
              <div style={{ color: "#475569", marginTop: 2 }}>
                Owner + posta adresi mevcut (absentee). Parsel koordinatı henüz yok → county merkezinde toplu gösterim.
              </div>
              {s.href && (
                <a href={s.href} style={{ color: s.color, fontWeight: 600, display: "inline-block", marginTop: 4 }}>
                  Envanteri aç →
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
