"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string; lat: number; lng: number; owner: string; region: string;
  acres: number; marketValue: number | null; estOffer: number; spread: number;
  dealGrade: string | null; absentee: boolean; apn: string;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const GRADE_COLOR: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#94a3b8" };

export default function DealsMap({ points }: { points: MapPoint[] }) {
  if (!points.length) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  return (
    <MapContainer center={[lat, lng]} zoom={9} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.dealGrade === "A" ? 6 : 4}
          pathOptions={{
            color: "#fff", weight: 1,
            fillColor: GRADE_COLOR[p.dealGrade ?? ""] ?? "#cbd5e1",
            fillOpacity: 0.85,
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
              <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "5px 0" }} />
              <div>Piyasa: <b>{p.marketValue ? usd(p.marketValue) : "comp gerekli"}</b></div>
              <div>Teklif: <b style={{ color: "#059669" }}>{p.estOffer ? usd(p.estOffer) : "—"}</b> · Spread: <b style={{ color: "#059669" }}>{p.spread ? usd(p.spread) : "—"}</b></div>
              <a href={`https://www.google.com/maps/@${p.lat},${p.lng},600m/data=!3m1!1e3`} target="_blank" rel="noreferrer" style={{ color: "#0284c7" }}>🛰️ Uydu</a>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
