"use client";

import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { gradeOf } from "@/components/ScoreBadge";

export interface MapDeal { id: string; lat: number; lng: number; county: string; state: string; final_score: number | null; minimum_bid: number | null; judgment_amount: number | null; }
export interface MapCatalyst { company: string; project: string; county: string; state: string; lat: number; lng: number; investmentB: number; sector: string; }
export interface MapSale { id: string; county: string; state: string; sale_date: string | null; lat: number | null; lng: number | null; }

const GRADE_COLOR: Record<string, string> = { "--grade-a": "#0f9d58", "--grade-b": "#0e7d97", "--grade-c": "#b9770a", "--grade-d": "#8a8b92" };
const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

const factoryIcon = L.divIcon({
  className: "",
  html: `<div style="background:#0a1a3f;border:2px solid #ffb43c;border-radius:8px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🏭</div>`,
  iconSize: [26, 26], iconAnchor: [13, 13],
});

export default function CerberusMap({ deals, catalysts, sales }: { deals: MapDeal[]; catalysts: MapCatalyst[]; sales: MapSale[] }) {
  return (
    <MapContainer center={[39.5, -98.5]} zoom={4} className="w-full" style={{ height: "640px", background: "#aadaff" }} scrollWheelZoom>
      <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Upcoming sales — amber rings */}
      {sales.filter(s => s.lat && s.lng).map(s => (
        <CircleMarker key={"s" + s.id} center={[s.lat!, s.lng!]} radius={7} pathOptions={{ color: "#ffb43c", weight: 2, fillOpacity: 0 }}>
          <Popup><b>📅 Yaklaşan satış</b><br />{s.county}, {s.state}<br />{s.sale_date}</Popup>
        </CircleMarker>
      ))}

      {/* Deals — colored by grade */}
      {deals.map(d => {
        const g = d.final_score != null ? gradeOf(d.final_score) : null;
        const color = g ? GRADE_COLOR[g.varName] : "#8a8b92";
        const disc = d.judgment_amount && d.minimum_bid ? Math.round(((d.judgment_amount - d.minimum_bid) / d.judgment_amount) * 100) : null;
        return (
          <CircleMarker key={d.id} center={[d.lat, d.lng]} radius={5} pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 1 }}>
            <Popup>
              <b>{g?.letter || "—"} · {d.county}, {d.state}</b><br />
              Teklif {money(d.minimum_bid)} · Değer {money(d.judgment_amount)}{disc != null ? ` · -${disc}%` : ""}<br />
              Skor {d.final_score ?? "—"}
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Megaprojects — factory pins */}
      {catalysts.map((c, i) => (
        <Marker key={"c" + i} position={[c.lat, c.lng]} icon={factoryIcon}>
          <Popup><b>🏭 {c.company}</b><br />{c.project} · ${c.investmentB}B<br />{c.county} County, {c.state}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
