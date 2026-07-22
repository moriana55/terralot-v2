"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ANA HARİTA — istemci harita katmanı (react-leaflet, sunum kalitesi).
//   - Taban: CARTO Dark Matter (token'sız) ↔ Esri World Imagery uydu.
//   - Noktalar: /api/admin/offmarket-map-clusters — 469K gerçek koordinat,
//     eyalet renkli rafine cluster baloncukları → zoom'da tekil gerçek nokta.
//   - Eyalet filtresi: seçili eyalet dışındakiler çizilmez (sayılar gerçek kalır).
//   - Popup: sunumluk kart — owner / county / acre / değer (teknik alan yok).
// DÜRÜSTLÜK KURALI: sahte koordinat serpilmez; cluster API çökerse eyalet
// merkezli GERÇEK SAYILI toplu pinlere düşülür.
// ─────────────────────────────────────────────────────────────────────────────

import { MapContainer, TileLayer, CircleMarker, Marker, Popup, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OFFMARKET_OVERVIEW_BOUNDS,
  OFFMARKET_STATE_COLORS,
  OFFMARKET_STATE_META,
  OFFMARKET_STATES,
  type OffmarketState,
} from "@/lib/offmarket-stats";
import { useOffmarketStats } from "@/lib/useOffmarketStats";

type ClusterFeature =
  | { t: "c"; lat: number; lng: number; n: number; st: string; ez: number }
  | { t: "p"; lat: number; lng: number; st: string };

type LeadDetail = {
  lead_id: string; state: string; county: string | null; region: string | null; apn: string | null;
  owner: string | null; situs: string | null; use: string | null; acres: number | null;
  land_value: number | null; est_offer: number | null; est_retail: number | null; est_margin: number | null;
  absentee: boolean | null; mailing_city: string | null; mailing_state: string | null;
};

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const compact = (n: number) =>
  n >= 100000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n);

const toBounds = (b: [number, number, number, number]) =>
  L.latLngBounds([b[1], b[0]], [b[3], b[2]]);

// Rafine cluster baloncuğu — yumuşak halo + gölge, okunaklı sayı.
function clusterIcon(color: string, count: number) {
  const d = Math.round(34 + Math.min(26, Math.log10(Math.max(count, 10)) * 8));
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${d}px;height:${d}px;border-radius:50%;
      background:radial-gradient(circle at 32% 28%, ${color}f2, ${color}d9 62%, ${color}b8);
      border:2.5px solid rgba(255,255,255,0.92);
      box-shadow:0 0 0 7px ${color}2e, 0 6px 18px rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
      font:800 ${count >= 100000 ? 11.5 : 12.5}px/1 ui-sans-serif,system-ui,sans-serif;
      color:#fff;letter-spacing:0.02em;text-shadow:0 1px 2px rgba(0,0,0,0.35);
    ">${compact(count)}</div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}

// Fallback eyalet pini (yalnız cluster API çökerse — sayılar gerçek).
function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="background:${color};border:2.5px solid rgba(255,255,255,0.92);border-radius:14px;padding:5px 12px;font:800 13px ui-sans-serif,system-ui,sans-serif;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.5);white-space:nowrap;">${label}</div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${color};margin-top:-1px;"></div>
    </div>`,
    iconSize: [170, 40],
    iconAnchor: [85, 40],
  });
}

// Sunumluk popup — owner / county / acre / değer. Teknik alan yok.
function PointDetailPopup({ lat, lng, st }: { lat: number; lng: number; st: string }) {
  const [leads, setLeads] = useState<LeadDetail[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/offmarket-point-detail?lat=${lat}&lng=${lng}&st=${st}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setLeads(Array.isArray(d.leads) ? d.leads : []); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [lat, lng, st]);

  const color = OFFMARKET_STATE_COLORS[st] ?? "#8ed1df";
  const meta = OFFMARKET_STATE_META[st as OffmarketState];
  if (err) return <div style={{ fontSize: 12, color: "#e7edf7" }}>Detay yüklenemedi.</div>;
  if (leads == null)
    return <div style={{ fontSize: 12, color: "#9fb0c8", padding: "2px 0" }}>Parsel detayı yükleniyor…</div>;
  if (!leads.length) return <div style={{ fontSize: 12, color: "#e7edf7" }}>Kayıt bulunamadı.</div>;
  const p = leads[0];
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.55, minWidth: 216, color: "#e7edf7" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, letterSpacing: "0.02em" }}>
          {meta?.label ?? p.state} · {p.county ?? p.region ?? "—"} County
        </span>
      </div>
      <Row k="Sahip" v={p.owner || "—"} strong />
      <Row k="Konum" v={p.situs || p.region || "—"} />
      <Row k="Büyüklük" v={p.acres != null ? `${p.acres} acre` : "—"} />
      <Row k="Arazi değeri" v={usd(p.land_value)} accent={color} />
      {p.est_retail != null && <Row k="Hedef satış" v={usd(p.est_retail)} />}
      {leads.length > 1 && (
        <div style={{ marginTop: 5, fontSize: 11, color: "#8b9ab3" }}>Bu noktada {leads.length} kayıt</div>
      )}
    </div>
  );
}

function Row({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <span style={{ color: "#8b9ab3" }}>{k}</span>
      <span style={{ fontWeight: strong ? 700 : 600, color: accent ?? "#e7edf7", textAlign: "right" }}>{v}</span>
    </div>
  );
}

// Çip tıklamasında eyalete / genel bakışa akıcı uçuş.
function FlyController({ flyCmd }: { flyCmd: { id: number; st: OffmarketState | null } }) {
  const map = useMap();
  const lastId = useRef(0);
  useEffect(() => {
    if (flyCmd.id === lastId.current) return;
    lastId.current = flyCmd.id;
    const b = flyCmd.st ? OFFMARKET_STATE_META[flyCmd.st].bounds : OFFMARKET_OVERVIEW_BOUNDS;
    map.flyToBounds(toBounds(b), { duration: 1.1, padding: [40, 40], easeLinearity: 0.2 });
  }, [flyCmd, map]);
  return null;
}

// Cluster/nokta katmanı — pan/zoom'da bbox'ı sunucudan tazeler.
function ClusterLayer({
  stateFilter,
  satellite,
  onError,
}: {
  stateFilter: OffmarketState | null;
  satellite: boolean;
  onError?: () => void;
}) {
  const map = useMap();
  const [features, setFeatures] = useState<ClusterFeature[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedRef = useRef(false);
  // 469K noktayı SVG değil canvas'a çiz — SVG'de tarayıcı takılır.
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  const load = useCallback(() => {
    if (failedRef.current) return;
    const b = map.getBounds().pad(0.2);
    const z = map.getZoom();
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const st = stateFilter ? `&st=${stateFilter}` : "";
    fetch(
      `/api/admin/offmarket-map-clusters?w=${b.getWest().toFixed(4)}&s=${b.getSouth().toFixed(4)}&e=${b.getEast().toFixed(4)}&n=${b.getNorth().toFixed(4)}&z=${z}${st}`,
      { signal: ac.signal }
    )
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => {
        if (ac.signal.aborted) return;
        if (d.note && !Array.isArray(d.features)) throw new Error(d.note);
        if (d.note && !(d.features as unknown[]).length && !d.meta?.totalPoints) throw new Error(d.note);
        setFeatures(d.features ?? []);
      })
      .catch((e) => {
        if (ac.signal.aborted || e?.name === "AbortError") return;
        failedRef.current = true;
        onError?.();
      });
  }, [map, stateFilter, onError]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 250);
  }, [load]);

  useMapEvents({ moveend: schedule, zoomend: schedule });
  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  // Filtre değişse de eski cevap ekranda kalmasın (sunucu filtresine ek emniyet).
  const visible = stateFilter ? features.filter((f) => f.st === stateFilter) : features;

  return (
    <>
      {visible.map((f, i) =>
        f.t === "c" ? (
          <Marker
            key={`c${f.st}${f.lat}${f.lng}${f.n}`}
            position={[f.lat, f.lng]}
            icon={clusterIcon(OFFMARKET_STATE_COLORS[f.st] ?? "#8ed1df", f.n)}
            eventHandlers={{ click: () => map.flyTo([f.lat, f.lng], Math.max(f.ez, map.getZoom() + 1), { duration: 0.7 }) }}
          />
        ) : (
          <CircleMarker
            key={`p${f.st}${f.lat}${f.lng}${i}`}
            center={[f.lat, f.lng]}
            radius={satellite ? 4 : 3.5}
            pathOptions={{
              renderer,
              // Uyduda daha kalın beyaz kontur — koyu zeminde de okunur.
              color: satellite ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
              weight: satellite ? 1.2 : 0.7,
              fillColor: OFFMARKET_STATE_COLORS[f.st] ?? "#8ed1df",
              fillOpacity: satellite ? 0.95 : 0.8,
            }}
          >
            <Popup>
              <PointDetailPopup lat={f.lat} lng={f.lng} st={f.st} />
            </Popup>
          </CircleMarker>
        )
      )}
    </>
  );
}

export default function MainMap({
  satellite,
  stateFilter,
  flyCmd,
}: {
  satellite: boolean;
  stateFilter: OffmarketState | null;
  flyCmd: { id: number; st: OffmarketState | null };
}) {
  const [fallback, setFallback] = useState(false);
  const handleError = useCallback(() => setFallback(true), []);
  const { counts } = useOffmarketStats(); // yalnız fallback pinlerinde kullanılır

  return (
    <>
      {/* Sunum teması: koyu popup kartı + koyu attribution + koyu zoom butonları */}
      <style>{`
        .tl-mainmap { background: #0b1220; }
        .tl-mainmap .leaflet-popup-content-wrapper {
          background: rgba(13, 20, 36, 0.96); color: #e7edf7; border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 12px 34px rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
        }
        .tl-mainmap .leaflet-popup-content { margin: 12px 14px; }
        .tl-mainmap .leaflet-popup-tip { background: rgba(13, 20, 36, 0.96); }
        .tl-mainmap .leaflet-popup-close-button { color: #8b9ab3 !important; }
        .tl-mainmap .leaflet-control-attribution {
          background: rgba(8,12,24,0.6) !important; color: #6b7a94 !important;
          font-size: 9px; backdrop-filter: blur(4px);
        }
        .tl-mainmap .leaflet-control-attribution a { color: #8b9ab3 !important; }
        .tl-mainmap .leaflet-control-zoom a {
          background: rgba(13,20,36,0.9) !important; color: #c6d3e6 !important;
          border-color: rgba(255,255,255,0.12) !important;
        }
        .tl-mainmap .leaflet-control-zoom a:hover { background: rgba(30,42,66,0.95) !important; }
      `}</style>
      <MapContainer
        bounds={toBounds(OFFMARKET_OVERVIEW_BOUNDS)}
        className="tl-mainmap h-full w-full"
        style={{ background: "#0b1220" }}
        zoomControl={false}
        maxZoom={19}
        minZoom={3}
        scrollWheelZoom
      >
        <ZoomControl position="bottomright" />
        {satellite ? (
          <TileLayer
            key="sat"
            attribution="&copy; Esri — World Imagery"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            key="dark"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
        )}

        <FlyController flyCmd={flyCmd} />
        {!fallback && <ClusterLayer stateFilter={stateFilter} satellite={satellite} onError={handleError} />}

        {/* FALLBACK — cluster API çökerse eyalet merkezli dürüst pinler. */}
        {fallback &&
          OFFMARKET_STATES.filter((st) => !stateFilter || st === stateFilter).map((st) => {
            const m = OFFMARKET_STATE_META[st];
            return (
              <Marker
                key={st}
                position={[m.lat, m.lng]}
                icon={pinIcon(m.color, `${st} · ${(counts[st] ?? 0).toLocaleString("en-US")} lead`)}
              >
                <Popup>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, minWidth: 200, color: "#e7edf7" }}>
                    <div style={{ fontWeight: 800, color: m.color }}>{m.label} · {m.region}</div>
                    <div style={{ marginTop: 2, fontSize: 14, fontWeight: 700 }}>
                      {(counts[st] ?? 0).toLocaleString("en-US")} off-market lead
                    </div>
                    <div style={{ color: "#8b9ab3", marginTop: 2, fontSize: 11.5 }}>
                      Nokta katmanı geçici olarak yüklenemedi — bölge merkezinde toplu gösterim (sayılar gerçek).
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </>
  );
}
