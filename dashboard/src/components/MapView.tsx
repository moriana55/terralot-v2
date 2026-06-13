"use client";

import { useEffect, useRef, useState } from "react";
import type { Property } from "@/lib/data";

interface MapViewProps {
  properties: Property[];
  onMarkerClick?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
  showParcelBounds?: boolean;
}

function generateParcelBounds(lat: number, lng: number, acres: number): [number, number][] {
  const sqMeters = acres * 4046.86;
  const side = Math.sqrt(sqMeters);
  const latOffset = (side / 2) / 111320;
  const lngOffset = (side / 2) / (111320 * Math.cos(lat * Math.PI / 180));
  return [
    [lat - latOffset, lng - lngOffset],
    [lat - latOffset, lng + lngOffset],
    [lat + latOffset, lng + lngOffset],
    [lat + latOffset, lng - lngOffset],
  ];
}

export default function MapView({ properties, onMarkerClick, center, zoom = 4, className = "", showParcelBounds = true }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<"satellite" | "dark" | "topo">("satellite");

  const tileUrls: Record<string, { url: string; attr: string }> = {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attr: '&copy; <a href="https://www.esri.com/">Esri</a>',
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
    topo: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
  };

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      const defaultCenter: [number, number] = center || [37.5, -98.0];
      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(defaultCenter, zoom);

      const tile = tileUrls[mapStyle];
      const tileLayer = L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: 19 }).addTo(map);
      (map as unknown as Record<string, L.TileLayer>)._activeLayer = tileLayer;

      const icon = L.divIcon({
        className: "terralot-marker",
        html: `<div style="width:28px;height:28px;background:#8ed1df;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      properties.forEach((p) => {
        if (showParcelBounds && zoom >= 10) {
          const bounds = generateParcelBounds(p.coordinates.lat, p.coordinates.lng, p.acres);
          L.polygon(bounds as L.LatLngExpression[], {
            color: "#8ed1df",
            weight: 2,
            fillColor: "#8ed1df",
            fillOpacity: 0.15,
            dashArray: "6 4",
          }).addTo(map);
        }

        const marker = L.marker([p.coordinates.lat, p.coordinates.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:200px;padding:4px;">
            <strong style="font-size:14px;color:#1a1a1a;">${p.title}</strong><br/>
            <span style="color:#666;font-size:12px;">${p.county}, ${p.state}</span><br/>
            <div style="margin-top:6px;display:flex;gap:12px;align-items:baseline;">
              <strong style="color:#2563eb;font-size:16px;">$${p.price.toLocaleString()}</strong>
              <span style="color:#666;font-size:11px;">${p.acres} acres · $${p.monthlyPayment}/mo</span>
            </div>
          </div>`,
          { closeButton: false }
        );
        if (onMarkerClick) {
          marker.on("click", () => onMarkerClick(p.id));
        }
      });

      if (properties.length > 1 && !center) {
        const bounds = L.latLngBounds(properties.map((p) => [p.coordinates.lat, p.coordinates.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      mapInstance.current = map;
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    import("leaflet").then((L) => {
      const map = mapInstance.current!;
      const old = (map as unknown as Record<string, L.TileLayer>)._activeLayer;
      if (old) map.removeLayer(old);
      const tile = tileUrls[mapStyle];
      const newLayer = L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: 19 }).addTo(map);
      (map as unknown as Record<string, L.TileLayer>)._activeLayer = newLayer;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className={`w-full h-full min-h-[300px] ${className}`} style={{ background: "#1a1a2e" }} />
      <div className="absolute top-3 right-3 z-[1000] flex gap-1 p-1 rounded-lg" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
        {(["satellite", "dark", "topo"] as const).map(s => (
          <button key={s} onClick={() => setMapStyle(s)}
            className="px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors"
            style={{
              background: mapStyle === s ? "#8ed1df" : "transparent",
              color: mapStyle === s ? "#000" : "#aaa",
            }}>
            {s === "satellite" ? "SAT" : s === "dark" ? "DARK" : "TOPO"}
          </button>
        ))}
      </div>
    </div>
  );
}
