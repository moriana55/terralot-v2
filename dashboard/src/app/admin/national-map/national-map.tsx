"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { gradeOf } from "@/components/ScoreBadge";
import type { MapParcel } from "@/app/api/parcels-map/route";

const money = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

// ── Renkler ──────────────────────────────────────────────────────────────────
// Fırsat = yeşil, yüksek marj = parlak vurgu yeşil, normal auction = nötr gri.
const COLOR_OPP = "#16a34a";       // gerçek arbitraj fırsatı
const COLOR_OPP_HIGH = "#22e07a";  // yüksek marj (>=%50)
const NEUTRAL = "#94a3b8";         // normal auction parseli

function parcelColor(p: MapParcel): string {
  if (p.op === 1) return p.mg != null && p.mg >= 0.5 ? COLOR_OPP_HIGH : COLOR_OPP;
  // fırsat değilse: skora göre hafif tonlama (nötr ağırlıklı)
  if (p.sc != null) {
    const g = gradeOf(p.sc);
    if (g.letter.startsWith("A")) return "#0e7d97";
    if (g.letter === "B") return "#5b8aa6";
  }
  return NEUTRAL;
}

// ── Grid clustering ───────────────────────────────────────────────────────────
// 10K nokta için: ekran piksel ızgarasına göre grupla, her hücreyi tek bir
// dairede topla. Zoom/pan değişince yeniden hesaplanır. Hafif ve bağımlılıksız.
interface Cluster {
  key: string;
  lat: number; lng: number;
  count: number;
  oppCount: number;
  members: MapParcel[]; // tek-üyeli kümelerde popup için kullanılır
}

function buildClusters(
  parcels: MapParcel[],
  zoom: number,
  bounds: { n: number; s: number; e: number; w: number } | null,
): Cluster[] {
  // hücre boyutu derece cinsinden — zoom arttıkça küçülür (daha az gruplama)
  const cell = Math.max(0.04, 64 / Math.pow(2, zoom));
  const grid = new Map<string, Cluster>();
  for (const p of parcels) {
    if (bounds) {
      // görünür alana küçük bir tampon ekleyerek filtrele
      const pad = cell * 2;
      if (p.la > bounds.n + pad || p.la < bounds.s - pad || p.ln > bounds.e + pad || p.ln < bounds.w - pad) continue;
    }
    const gx = Math.floor(p.ln / cell);
    const gy = Math.floor(p.la / cell);
    const key = `${gx}:${gy}`;
    let c = grid.get(key);
    if (!c) {
      c = { key, lat: 0, lng: 0, count: 0, oppCount: 0, members: [] };
      grid.set(key, c);
    }
    c.lat += p.la; c.lng += p.ln; c.count++;
    if (p.op === 1) c.oppCount++;
    if (c.members.length < 6) c.members.push(p);
  }
  const out: Cluster[] = [];
  for (const c of grid.values()) {
    c.lat /= c.count; c.lng /= c.count;
    out.push(c);
  }
  return out;
}

function clusterRadius(count: number): number {
  if (count === 1) return 5;
  if (count < 10) return 11;
  if (count < 50) return 15;
  if (count < 200) return 19;
  if (count < 1000) return 24;
  return 30;
}

function ClusterLayer({ parcels, showOpp }: { parcels: MapParcel[]; showOpp: boolean }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState<{ n: number; s: number; e: number; w: number } | null>(() => {
    const b = map.getBounds();
    return { n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() };
  });

  useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      setBounds({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() });
      setZoom(map.getZoom());
    },
    zoomend: () => {
      const b = map.getBounds();
      setBounds({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() });
      setZoom(map.getZoom());
    },
  });

  const clusters = useMemo(() => buildClusters(parcels, zoom, bounds), [parcels, zoom, bounds]);

  return (
    <>
      {clusters.map((c) => {
        const single = c.count === 1 ? c.members[0] : null;
        const hasOpp = c.oppCount > 0;
        // Küme rengi: içinde fırsat varsa yeşil tonu, yoksa nötr.
        const color = single
          ? parcelColor(single)
          : showOpp && hasOpp
            ? COLOR_OPP
            : NEUTRAL;
        const r = clusterRadius(c.count);
        return (
          <CircleMarker
            key={c.key}
            center={[c.lat, c.lng]}
            radius={r}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: c.count === 1 ? 0.85 : 0.55,
              weight: c.count === 1 ? 1 : 1.5,
            }}
            eventHandlers={
              c.count > 1
                ? { click: () => map.flyTo([c.lat, c.lng], Math.min(map.getZoom() + 2, 12)) }
                : undefined
            }
          >
            {c.count > 1 ? (
              <Popup>
                <b>{c.count.toLocaleString()} parsel</b>
                {showOpp && c.oppCount > 0 && (
                  <><br /><span style={{ color: COLOR_OPP, fontWeight: 700 }}>{c.oppCount} fırsat</span></>
                )}
                <br /><span style={{ fontSize: 11, opacity: 0.7 }}>Yakınlaştırmak için tıkla</span>
              </Popup>
            ) : single ? (
              <Popup>
                <ParcelPopup p={single} />
              </Popup>
            ) : null}
          </CircleMarker>
        );
      })}
    </>
  );
}

function cerberusKey(apn: string): string {
  // deal-screener ile aynı slug biçimi: apn:<temizlenmiş-apn>
  return "apn:" + apn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function ParcelPopup({ p }: { p: MapParcel }) {
  const g = p.sc != null ? gradeOf(p.sc) : null;
  const marginPct = p.mg != null ? Math.round(p.mg * 100) : null;
  return (
    <div style={{ minWidth: 190 }}>
      <b>{g?.letter ? `${g.letter} · ` : ""}{p.co || "—"}, {p.st || "—"}</b>
      {p.op === 1 && (
        <div style={{ color: COLOR_OPP, fontWeight: 700, fontSize: 12, margin: "2px 0" }}>★ Potansiyel alım fırsatı</div>
      )}
      <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
        {p.ac != null && <>Alan: {p.ac} acre<br /></>}
        Min teklif: {money(p.pr)}<br />
        {p.iv != null && <>Tahmini değer: {money(p.iv)}<br /></>}
        {marginPct != null && p.op === 1 && (
          <span style={{ color: COLOR_OPP, fontWeight: 600 }}>~%{marginPct} marj<br /></span>
        )}
        Skor: {p.sc ?? "—"}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Link href="/admin/underwrite" style={{ fontSize: 12, fontWeight: 600, color: "#0e7d97" }}>
          Underwrite →
        </Link>
        {p.ap && (
          <Link
            href={`/admin/cerberus/${encodeURIComponent(cerberusKey(p.ap))}/report`}
            style={{ fontSize: 12, fontWeight: 600, color: "#0e7d97" }}
          >
            Cerberus →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function NationalMap({
  parcels,
  showAuction,
  showOpp,
}: {
  parcels: MapParcel[];
  showAuction: boolean;
  showOpp: boolean;
}) {
  // Katman seçimi: hangi parsellerin haritada olduğunu belirler.
  const visible = useMemo(() => {
    if (showAuction && showOpp) return parcels;
    if (showOpp && !showAuction) return parcels.filter((p) => p.op === 1);
    if (showAuction && !showOpp) return parcels.filter((p) => p.op !== 1);
    return [];
  }, [parcels, showAuction, showOpp]);

  return (
    <MapContainer
      center={[39.5, -98.5]}
      zoom={4}
      minZoom={3}
      className="w-full"
      style={{ height: "calc(100vh - 220px)", minHeight: 560, background: "#0b1220" }}
      scrollWheelZoom
      preferCanvas
    >
      <TileLayer
        attribution='&copy; OSM &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ClusterLayer parcels={visible} showOpp={showOpp} />
    </MapContainer>
  );
}
