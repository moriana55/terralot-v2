"use client";
import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

interface Props {
  lat: number;
  lng: number;
  title: string;
}

export default function ParcelMap({ lat, lng, title }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || token.includes("your_mapbox")) {
      setFailed(true);
      return;
    }
    let map: any;
    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !mapContainer.current) return;

        mapboxgl.accessToken = token;
        map = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [lng, lat],
          zoom: 13,
          pitch: 60,
          bearing: -20,
          antialias: true,
        });

        map.on("load", () => {
          // 3D terrain
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
          map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

          // Parcel boundary (approx square around point)
          const d = 0.004;
          const ring = [
            [lng - d, lat - d],
            [lng + d, lat - d],
            [lng + d, lat + d],
            [lng - d, lat + d],
            [lng - d, lat - d],
          ];
          map.addSource("parcel", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [ring] },
            },
          });
          map.addLayer({
            id: "parcel-fill",
            type: "fill",
            source: "parcel",
            paint: { "fill-color": "#c9a84c", "fill-opacity": 0.25 },
          });
          map.addLayer({
            id: "parcel-line",
            type: "line",
            source: "parcel",
            paint: { "line-color": "#c9a84c", "line-width": 3 },
          });

          new mapboxgl.Marker({ color: "#c9a84c" })
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setText(title))
            .addTo(map);
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");
      } catch (e) {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [lat, lng, title, token]);

  if (failed) {
    // Graceful fallback — static OpenStreetMap embed
    const bbox = `${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}`;
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden">
        <iframe
          title={title}
          className="w-full h-full border-0"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
        />
        <div className="absolute bottom-3 left-3 bg-forest-deep/80 text-cream text-xs px-3 py-1.5 rounded-full">
          Add a Mapbox token for 3D satellite terrain
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full rounded-2xl" />;
}
