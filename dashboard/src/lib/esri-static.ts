// Esri World Imagery static export — parcel-centered satellite image URL.
// Same pattern as /admin/parcel-sunum (client <img>, no API key needed).

const ESRI_EXPORT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";

/** Satellite image centered on lat/lng; padMeters = half-width of the bbox. */
export function esriStaticUrl(lat: number, lng: number, padMeters: number, w: number, h: number): string {
  const cos = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const dLat = padMeters / 111320;
  const dLng = padMeters / (111320 * cos);
  return `${ESRI_EXPORT}?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=png&transparent=false&f=image`;
}

/** Pad that frames a parcel of `acres` with some breathing room (min 120 m). */
export function parcelPadMeters(acres: number): number {
  return Math.max(Math.sqrt(Math.max(acres, 0) * 4046.86) * 1.6, 120);
}
