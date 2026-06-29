"use client";

/**
 * ParcelMap — TEK parselin gerçek GeoJSON sınırını Esri uydu üstüne çizer.
 *
 * SSR YOK: Leaflet `window` ister; bu bileşen page.tsx'ten next/dynamic
 * { ssr: false } ile yüklenir (alinabilir-harita/page.tsx ile aynı kanıtlı
 * desen). deals-map.tsx'e DOKUNMADAN ayrı/küçük bir harita.
 */

import { useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature } from "geojson";
import "leaflet/dist/leaflet.css";

const HIGHLIGHT = "#8ed1df";

/** Parselin sınırına otomatik yakınlaş (fitBounds) — merkez/zoom tahminine güvenme. */
function FitBounds({ feature }: { feature: Feature }) {
  const map = useMap();
  useEffect(() => {
    try {
      const layer = L.geoJSON(feature as Parameters<typeof L.geoJSON>[0]);
      const b = layer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 18 });
    } catch {
      /* fail-soft: sınır hesaplanamazsa merkez/zoom default kalır */
    }
  }, [feature, map]);
  return null;
}

export default function ParcelMap({
  feature,
  center,
}: {
  feature: Feature;
  center: [number, number];
}) {
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; Esri World Imagery"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={22}
      />
      <GeoJSON
        key={JSON.stringify(center)}
        data={feature}
        style={{ color: HIGHLIGHT, weight: 3, fillColor: HIGHLIGHT, fillOpacity: 0.25 }}
      />
      <FitBounds feature={feature} />
    </MapContainer>
  );
}
