"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string; lat: number; lng: number; owner: string; region: string;
  acres: number; marketValue: number | null; estOffer: number; spread: number;
  dealGrade: string | null; absentee: boolean; apn: string;
  valBasis?: string | null; comps?: number; valAsOf?: string | null; compYears?: string | null;
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

function MapLegend() {
  return (
    <div style={{
      position: "absolute", bottom: 16, left: 10, zIndex: 1000,
      background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "9px 11px", fontSize: 11, lineHeight: 1.7, color: "#334155",
      maxWidth: 240, boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>Açıklama</div>
      <div><span style={dot(GRADE_COLOR.A)} />A deal — en iyi</div>
      <div><span style={dot(GRADE_COLOR.B)} />B deal</div>
      <div><span style={dot(GRADE_COLOR.C)} />C deal</div>
      <div><span style={ringStyle} />Halka = absentee (eyalet-dışı motive sahip)</div>
      <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "6px 0" }} />
      <div style={{ fontWeight: 600, color: "#64748b" }}>Altlık (OpenStreetMap — bizim değil):</div>
      <div>🔺 kahverengi üçgen = dağ zirvesi</div>
      <div>━ isimli kahverengi/gri çizgi = <b>yol</b> (ör. "North Charles Drive")</div>
      <div><span style={{ color: "#7dd3fc" }}>┅</span> açık mavi kesik = <b>kuru dere / çöl washı</b> (yağışta akar → sel riski)</div>
      <div>┄ kesik gri çizgi = ilçe sınırı · ▦ paralel = demiryolu</div>
      <div style={{ marginTop: 5, color: "#64748b", fontStyle: "italic" }}>
        Sağ üstten: <b>"Uydu"</b> = gerçek arazi · <b>"🛣️ Yollar"</b> = yollar+isimler üstte (uydu'da bile kalın/net). Parselin yol/elektrik/sel detayı için marker'a tıkla → popup.
      </div>
    </div>
  );
}

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
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
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
        </LayersControl>

        {points.map((p) => {
          const color = GRADE_COLOR[p.dealGrade ?? ""] ?? "#cbd5e1";
          const r = p.dealGrade === "A" ? 6 : 4;
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
                    <div>Piyasa: <b>{p.valBasis === "mismatch" ? "⚠ comp uyumsuz — doğrula" : p.marketValue ? usd(p.marketValue) : "comp gerekli"}</b></div>
                    {p.marketValue != null && (
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        {BASIS_LABEL[p.valBasis ?? "none"] ?? p.valBasis}
                        {p.comps ? ` · ${p.comps} emsal` : ""}
                        {p.compYears ? ` (${p.compYears})` : p.valAsOf ? ` · ${p.valAsOf.slice(0, 10)}` : ""}
                      </div>
                    )}
                    <div>Teklif: <b style={{ color: "#059669" }}>{p.estOffer ? usd(p.estOffer) : "—"}</b> · Spread: <b style={{ color: "#059669" }}>{p.spread ? usd(p.spread) : "—"}</b></div>
                    <a href={`https://www.google.com/maps/@${p.lat},${p.lng},600m/data=!3m1!1e3`} target="_blank" rel="noreferrer" style={{ color: "#0284c7" }}>🛰️ Uydu</a>
                    <EnrichBadges lat={p.lat} lng={p.lng} />
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>
      <MapLegend />
    </div>
  );
}
