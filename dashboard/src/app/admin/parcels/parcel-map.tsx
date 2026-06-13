"use client";

import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

interface ParcelFeature {
  type: "Feature";
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
  properties: Record<string, string | number | null>;
}

interface Props {
  center: [number, number];
  parcels: ParcelFeature[];
  selected: ParcelFeature | null;
  onSelect: (f: ParcelFeature) => void;
  onMapClick: (lat: number, lng: number) => void;
}

const pinIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { duration: 1 });
  }, [center, map]);
  return null;
}

export default function ParcelMap({ center, parcels, selected, onSelect, onMapClick }: Props) {
  const geoJsonData = useMemo(() => {
    if (parcels.length === 0) return null;
    return {
      type: "FeatureCollection" as const,
      features: parcels,
    };
  }, [parcels]);

  const selectedGeoJson = useMemo(() => {
    if (!selected) return null;
    return {
      type: "FeatureCollection" as const,
      features: [selected],
    };
  }, [selected]);

  return (
    <MapContainer center={center} zoom={6} className="w-full h-full" style={{ minHeight: "500px", background: "#f0f0f0" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri"
        opacity={0.3}
      />

      <MapClickHandler onMapClick={onMapClick} />
      <RecenterMap center={center} />

      {geoJsonData && (
        <GeoJSON
          key={JSON.stringify(geoJsonData).slice(0, 100)}
          data={geoJsonData}
          style={() => ({
            color: "#3980f4",
            weight: 2,
            fillColor: "#3980f4",
            fillOpacity: 0.1,
          })}
          onEachFeature={(feature, layer) => {
            layer.on("click", () => onSelect(feature as ParcelFeature));
          }}
        />
      )}

      {selectedGeoJson && (
        <GeoJSON
          key={"selected-" + JSON.stringify(selectedGeoJson).slice(0, 50)}
          data={selectedGeoJson}
          style={() => ({
            color: "#006c49",
            weight: 3,
            fillColor: "#006c49",
            fillOpacity: 0.25,
          })}
        />
      )}

      {parcels.map((f, i) => {
        const coords = f.geometry.type === "MultiPolygon"
          ? (f.geometry.coordinates as number[][][][])[0][0][0]
          : (f.geometry.coordinates as number[][][])[0][0];
        return (
          <Marker key={i} position={[coords[1], coords[0]]} icon={pinIcon} eventHandlers={{ click: () => onSelect(f) }}>
            <Popup>
              <strong>{f.properties.address || f.properties.parcelnumb || `Parcel ${i + 1}`}</strong>
              {f.properties.owner && <br />}
              {f.properties.owner && <span>{f.properties.owner}</span>}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
