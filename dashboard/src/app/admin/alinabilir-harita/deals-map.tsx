"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string; lat: number; lng: number; owner: string; region: string;
  acres: number; marketValue: number | null; estOffer: number; spread: number;
  dealGrade: string | null; absentee: boolean; apn: string;
  valBasis?: string | null; comps?: number; valAsOf?: string | null;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// Değerleme temeli → insan-okur etiket (kartta "neye göre" sorusunu yanıtlar).
const BASIS_LABEL: Record<string, string> = {
  attom_region: "ATTOM bölge emsali",
  county_comp: "county emsal",
  state_comp: "eyalet emsali",
  mismatch: "⚠ doğrulama gerek",
  none: "emsal yok",
};
const GRADE_COLOR: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#94a3b8" };

// Popup açılınca dd-check'i çağırır → ⚡ elektrik + 🛣️ yol rozeti.
// Sadece tıklanan parsel için çalışır (Leaflet popup içeriği lazy mount).
function EnrichBadges({ lat, lng }: { lat: number; lng: number }) {
  const [state, setState] = useState<{ loading: boolean; power?: any; road?: any; err?: boolean }>({ loading: true });
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

  const p = state.power ?? {}, r = state.road ?? {};
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
              {p.marketValue != null && (
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {BASIS_LABEL[p.valBasis ?? "none"] ?? p.valBasis}
                  {p.comps ? ` · ${p.comps} emsal` : ""}
                  {p.valAsOf ? ` · ${p.valAsOf.slice(0, 10)}` : ""}
                </div>
              )}
              <div>Teklif: <b style={{ color: "#059669" }}>{p.estOffer ? usd(p.estOffer) : "—"}</b> · Spread: <b style={{ color: "#059669" }}>{p.spread ? usd(p.spread) : "—"}</b></div>
              <a href={`https://www.google.com/maps/@${p.lat},${p.lng},600m/data=!3m1!1e3`} target="_blank" rel="noreferrer" style={{ color: "#0284c7" }}>🛰️ Uydu</a>
              <EnrichBadges lat={p.lat} lng={p.lng} />
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
