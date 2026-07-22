"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 7 EYALET OFF-MARKET HARİTASI — istemci harita katmanı (react-leaflet).
// TEK SİSTEM, 7 EYALET: ~469K koordinatlı lead'in TAMAMI sunucu tarafı
// supercluster'dan gelir (/api/admin/offmarket-map-clusters).
//   - Uzak zoom  → eyalet renkli cluster baloncukları (sayılar GERÇEK kayıt sayısı)
//   - Yakın zoom → her kayıt TEK TEK gerçek nokta (örnekleme/atlama YOK)
//   - Noktaya tıkla → canlı Supabase detayı (owner, acres, land value) popup'ta
//   - Katman anahtarı: OSM harita ↔ Esri uydu (AZ'deki davranışın aynısı, hepsine)
// DÜRÜSTLÜK KURALI: sahte koordinat serpilmez; cluster API çökerse county
// merkezli GERÇEK SAYILI toplu pinlere geri düşülür (eski davranış).
// ─────────────────────────────────────────────────────────────────────────────

import { MapContainer, TileLayer, CircleMarker, Marker, Popup, LayersControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Eyalet renkleri — lejant/breakdown ile birebir.
export const STATE_COLORS: Record<string, string> = {
  AZ: "#059669", NM: "#2563eb", CO: "#dc2626", TX: "#d97706", FL: "#7c3aed", AR: "#0891b2", NC: "#be185d",
};

// Cluster API cevabı.
type ClusterFeature =
  | { t: "c"; lat: number; lng: number; n: number; st: string; ez: number }
  | { t: "p"; lat: number; lng: number; st: string };
type ClusterMeta = { generatedAt: string; totalPoints: number; byState: Record<string, number> };

// Fallback county pini (eski davranış — sadece cluster API çökerse).
export type StatePin = {
  state: string;
  region: string;
  lat: number;
  lng: number;
  color: string;
  leads: number;
  href?: string;
};

type LeadDetail = {
  lead_id: string; state: string; county: string | null; region: string | null; apn: string | null;
  owner: string | null; situs: string | null; use: string | null; acres: number | null;
  land_value: number | null; est_offer: number | null; est_retail: number | null; est_margin: number | null;
  absentee: boolean | null; mailing_city: string | null; mailing_state: string | null;
};

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const fmt = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => (n >= 100000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

// Eyalet renkli cluster baloncuğu — çap kayıt sayısıyla (log) büyür.
function clusterIcon(color: string, count: number) {
  const d = Math.round(30 + Math.min(28, Math.log10(Math.max(count, 10)) * 9));
  return L.divIcon({
    className: "",
    html: `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:800 ${count >= 100000 ? 11 : 12}px system-ui,sans-serif;color:#fff;">${compact(count)}</div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}

// Fallback county pini (eski görsel dil).
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

// Popup içeriği — tıklanınca canlı Supabase detayı (AZ popup kalitesi, 7 eyalet).
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

  const color = STATE_COLORS[st] ?? "#334155";
  if (err) return <div style={{ fontSize: 12 }}>Detay yüklenemedi.</div>;
  if (leads == null) return <div style={{ fontSize: 12, color: "#64748b" }}>Detay yükleniyor…</div>;
  if (!leads.length) return <div style={{ fontSize: 12 }}>Kayıt bulunamadı.</div>;
  const p = leads[0];
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 200 }}>
      <div style={{ fontWeight: 700, color }}>{p.state} · {p.county ?? p.region ?? "—"}</div>
      <div style={{ marginTop: 2 }}>Sahip: <b>{p.owner || "—"}</b></div>
      <div style={{ color: "#475569" }}>
        {(p.situs || p.region || "—")} · {p.acres != null ? `${p.acres} acre` : "acre —"}
      </div>
      <div style={{ color: "#475569" }}>Land value: {usd(p.land_value)}</div>
      {p.est_offer != null && (
        <div style={{ color: "#475569" }}>Teklif {usd(p.est_offer)} → satış {usd(p.est_retail)} (marj {usd(p.est_margin)})</div>
      )}
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
        APN {p.apn ?? "—"}{p.absentee ? " · absentee" : ""}{leads.length > 1 ? ` · bu noktada ${leads.length} kayıt` : ""}
      </div>
    </div>
  );
}

// Cluster/nokta katmanı — pan/zoom'da bbox'ı sunucudan tazeler.
function ClusterLayer({ onMeta, onError }: { onMeta?: (m: ClusterMeta) => void; onError?: () => void }) {
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
    fetch(
      `/api/admin/offmarket-map-clusters?w=${b.getWest().toFixed(4)}&s=${b.getSouth().toFixed(4)}&e=${b.getEast().toFixed(4)}&n=${b.getNorth().toFixed(4)}&z=${z}`,
      { signal: ac.signal }
    )
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => {
        if (ac.signal.aborted) return;
        if (d.note && !Array.isArray(d.features)) throw new Error(d.note);
        if (d.note && !(d.features as unknown[]).length && !d.meta?.totalPoints) throw new Error(d.note);
        setFeatures(d.features ?? []);
        if (d.meta?.totalPoints && onMeta) onMeta(d.meta as ClusterMeta);
      })
      .catch((e) => {
        if (ac.signal.aborted || e?.name === "AbortError") return;
        failedRef.current = true;
        onError?.();
      });
  }, [map, onMeta, onError]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 250);
  }, [load]);

  useMapEvents({ moveend: schedule, zoomend: schedule });
  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  return (
    <>
      {features.map((f, i) =>
        f.t === "c" ? (
          <Marker
            key={`c${f.st}${f.lat}${f.lng}${f.n}`}
            position={[f.lat, f.lng]}
            icon={clusterIcon(STATE_COLORS[f.st] ?? "#334155", f.n)}
            eventHandlers={{ click: () => map.flyTo([f.lat, f.lng], Math.max(f.ez, map.getZoom() + 1), { duration: 0.6 }) }}
          />
        ) : (
          <CircleMarker
            key={`p${f.st}${f.lat}${f.lng}${i}`}
            center={[f.lat, f.lng]}
            radius={3}
            pathOptions={{
              renderer,
              color: "rgba(255,255,255,0.35)",
              weight: 0.5,
              fillColor: STATE_COLORS[f.st] ?? "#334155",
              fillOpacity: 0.65,
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

export default function OffMarketMap({
  statePins,
  onMeta,
}: {
  /** Fallback: cluster API çökerse county merkezli gerçek sayılı pinler. */
  statePins: StatePin[];
  onMeta?: (m: ClusterMeta) => void;
}) {
  const [fallback, setFallback] = useState(false);
  const handleError = useCallback(() => setFallback(true), []);

  return (
    <MapContainer
      center={[33.5, -100.0]}
      zoom={5}
      className="w-full"
      style={{ height: "640px", background: "#aadaff" }}
      scrollWheelZoom
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Harita (OSM)">
          <TileLayer attribution="&copy; OSM" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Uydu (Esri)">
          <TileLayer
            attribution="&copy; Esri — World Imagery"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {!fallback && <ClusterLayer onMeta={onMeta} onError={handleError} />}

      {/* FALLBACK — cluster API çökerse eski dürüst county pinleri. */}
      {fallback &&
        statePins.map((s) => (
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
                  Nokta katmanı geçici olarak yüklenemedi → county merkezinde toplu gösterim (sayılar gerçek).
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
