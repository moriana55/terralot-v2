"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Polygon, useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";
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

function MapLegend() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "absolute", bottom: 16, left: 10, zIndex: 1000,
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
      position: "absolute", bottom: 16, left: 10, zIndex: 1000,
      background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8,
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
      <div><span style={squareStyle} />Turuncu kare = parselin ~tahmini alanı (yakınlaşınca hepsi · tıklayınca koyu)</div>
      <div><span style={compLegendStyle} />Kırmızı elmas = <b>rakip ilanı</b> (yaklaşık konum, şehir merkezi)</div>
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
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [showAreas, setShowAreas] = useState(true);
  const [competitors, setCompetitors] = useState<CompMarker[]>([]);
  const [showComp, setShowComp] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/competitor-map")
      .then((r) => r.json())
      .then((d) => { if (alive) setCompetitors(Array.isArray(d.markers) ? d.markers : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
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

        {/* Parsel tahmini alanları — toggle ile aç/kapa (iç içe girince kapatabilirsin). */}
        {showAreas && <ParcelAreas points={points} />}
        {showAreas && selected && (
          <Polygon
            positions={parcelBounds(selected.lat, selected.lng, selected.acres)}
            pathOptions={{ color: "#b45309", weight: 2.5, dashArray: "6 4", fillColor: "#f59e0b", fillOpacity: 0.2 }}
          />
        )}

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
                eventHandlers={{
                  popupopen: () => setSelected(p),
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
                      // Yakınlık: en yakın RAKİP ilanı (pazar kanıtı) + en yakın su (Lake Mead vb.).
                      const water = nearestRef(p.lat, p.lng, "water");
                      let nc: number | null = null;
                      for (const c of competitors) {
                        const m = distanceMiles(p.lat, p.lng, c.lat, c.lng);
                        if (nc == null || m < nc) nc = m;
                      }
                      return (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                          📍 {nc != null ? `En yakın rakip ~${nc.toFixed(1)} mi` : "rakip verisi yükleniyor"}
                          {water ? ` · ${water.name} ~${water.miles.toFixed(0)} mi` : ""}
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
      <button
        onClick={() => setShowAreas((v) => !v)}
        title="Parselin tahmini alanı kutularını aç/kapat"
        style={{
          position: "absolute", top: 10, left: 10, zIndex: 1000,
          background: showAreas ? "#f59e0b" : "rgba(255,255,255,0.95)",
          color: showAreas ? "#fff" : "#334155",
          border: `1px solid ${showAreas ? "#d97706" : "#e2e8f0"}`,
          borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        }}
      >
        🟧 Parsel alanları: {showAreas ? "Açık" : "Kapalı"}
      </button>
      <button
        onClick={() => setShowComp((v) => !v)}
        title="Rakip ilanlarını aç/kapat"
        style={{
          position: "absolute", top: 48, left: 10, zIndex: 1000,
          background: showComp ? "#dc2626" : "rgba(255,255,255,0.95)",
          color: showComp ? "#fff" : "#334155",
          border: `1px solid ${showComp ? "#b91c1c" : "#e2e8f0"}`,
          borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        }}
      >
        🟥 Rakip ilanları{competitors.length ? ` (${competitors.length})` : ""}: {showComp ? "Açık" : "Kapalı"}
      </button>
      <MapLegend />
    </div>
  );
}
