"use client";

/**
 * CountyGisLayer — Mohave County (Arizona) GIS parsel + YOL grid overlay.
 *
 * NEDEN: OSM çöl subdivision'larındaki isimli iç sokakları ("Fireside Dr",
 * "Pipeline Rd" gibi) çoğu zaman içermez; ama county GIS bunları + gerçek
 * parsel sınırı + APN ile tutar. Discount Lots / Google'ın gösterdiği grid budur.
 *
 * NASIL: react-leaflet sarmalayıcısına bağlı kalmadan, kendi L.TileLayer
 * alt-sınıfımızı kuruyoruz. Her 256px tile için tile'ın Web-Mercator (EPSG:3857)
 * bbox'unu hesaplayıp ArcGIS `/export` ucundan ŞEFFAF PNG istiyoruz.
 *
 * DÜRÜST/FAIL-SOFT: Uç datacenter IP'lerinden timeout olur; kullanıcının
 * residential tarayıcısından çalışır. Yüklenemeyen tile'lar SESSİZCE boş kalır —
 * haritayı asla çökertmez (Leaflet tileerror'u yutar + errorTileUrl boş).
 */

import { useEffect } from "react";
import { useLeafletContext } from "@react-leaflet/core";
import L from "leaflet";

/**
 * TEK kaynak sabiti — servisi değiştirmek için sadece burayı düzenle.
 * Mohave County ArcGIS dynamic MapServer (parsel + yol + APN katmanları dahil).
 */
export const COUNTY_GIS_BASE_URL =
  "https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/export";

// Web-Mercator (EPSG:3857) sabitleri — standart XYZ tile matematiği.
const TILE_SIZE = 256;
const ORIGIN_SHIFT = 20037508.342789244; // Math.PI * 6378137

/** Bir XYZ tile'ının EPSG:3857 bbox'unu [minx,miny,maxx,maxy] döndürür. */
function tileBbox3857(x: number, y: number, z: number): [number, number, number, number] {
  const resolution = (2 * ORIGIN_SHIFT) / (TILE_SIZE * Math.pow(2, z));
  const minx = x * TILE_SIZE * resolution - ORIGIN_SHIFT;
  const maxx = (x + 1) * TILE_SIZE * resolution - ORIGIN_SHIFT;
  const maxy = ORIGIN_SHIFT - y * TILE_SIZE * resolution;
  const miny = ORIGIN_SHIFT - (y + 1) * TILE_SIZE * resolution;
  return [minx, miny, maxx, maxy];
}

/**
 * L.TileLayer alt-sınıfı: her tile için ArcGIS export URL'i üretir.
 * react-leaflet'in resmî bir sarmalayıcısına ihtiyaç duymadan, imperatif eklenir.
 */
const CountyGisTileLayer = L.TileLayer.extend({
  getTileUrl(coords: L.Coords) {
    const [minx, miny, maxx, maxy] = tileBbox3857(coords.x, coords.y, coords.z);
    const params = new URLSearchParams({
      bbox: `${minx},${miny},${maxx},${maxy}`,
      bboxSR: "3857",
      imageSR: "3857",
      size: `${TILE_SIZE},${TILE_SIZE}`,
      format: "png32",
      transparent: "true",
      f: "image",
    });
    return `${COUNTY_GIS_BASE_URL}?${params.toString()}`;
  },
});

/**
 * Wrapper: react-leaflet bağlamını okuyup katmanı imperatif ekler/çıkarır.
 *
 * NOT: LayersControl.Overlay'in onay-kutusu DOĞRU çalışsın diye katmanı doğrudan
 * map'e değil, bağlamın `layerContainer`'ına (yani kontrole) ekliyoruz — tıpkı
 * react-leaflet'in kendi `useLayerLifecycle`'ı gibi. Böylece overlay default
 * UNCHECKED kalır ve kutu işaretlenince haritaya eklenir. (createLayerComponent
 * gibi resmî bir sarmalayıcıya bağlı DEĞİLİZ; bağlamı elle kullanıyoruz.)
 */
export default function CountyGisLayer() {
  const context = useLeafletContext();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const layer = new (CountyGisTileLayer as unknown as new (
      url: string,
      opts: L.TileLayerOptions,
    ) => L.TileLayer)("", {
      opacity: 0.85,
      crossOrigin: true,
      // FAIL-SOFT: yüklenemeyen tile'lar boş kalsın; harita çökmesin.
      errorTileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      maxZoom: 22,
      attribution:
        "Mohave County GIS — gerçek parsel sınırı + yol grid + APN (sadece kapsanan county; residential IP'den yüklenir)",
    });

    // tileerror'u sessizce yut — konsolu kirletme, haritayı bozma.
    layer.on("tileerror", () => {
      /* fail-soft: no-op */
    });

    // layerContainer = LayersControl.Overlay (varsa) yoksa map'in kendisi.
    const container = context.layerContainer ?? context.map;
    container.addLayer(layer);
    return () => {
      context.layerContainer?.removeLayer(layer);
      context.map.removeLayer(layer);
    };
  }, [context]);

  return null;
}
