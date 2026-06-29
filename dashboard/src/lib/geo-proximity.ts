// Coğrafya / yakınlık motoru — hem rakip ilanlarını haritaya koymak (koordinatları yok,
// şehir merkezine yaklaşık oturturuz) hem de "yola/suya/şehre yakınlık" skorları için.
// Tüm koordinatlar SABİT referans (deterministik) — Overpass'ın "bilinmiyor"una takılmaz.
// Mesafeler kabaca referans noktasına; parsel-kesin değil, "yaklaşık" etiketiyle sun.

export type RefKind = "city" | "water" | "highway" | "metro";
export type GeoRef = { name: string; lat: number; lng: number; kind: RefKind; aka?: string[] };

// Pilot bölge = Arizona/Mohave (verinin olduğu yer) + birkaç komşu + FL örneği.
export const GEO_REFS: GeoRef[] = [
  // ── Şehirler / yerleşimler (AZ Mohave & çevre) ──
  { name: "Kingman", lat: 35.189, lng: -114.053, kind: "city" },
  { name: "Golden Valley", lat: 35.213, lng: -114.222, kind: "city", aka: ["golden vly"] },
  { name: "Meadview", lat: 36.000, lng: -114.068, kind: "city" },
  { name: "Dolan Springs", lat: 35.595, lng: -114.276, kind: "city", aka: ["dolan"] },
  { name: "Topock", lat: 34.715, lng: -114.486, kind: "city" },
  { name: "Yucca", lat: 34.868, lng: -114.143, kind: "city" },
  { name: "Bullhead City", lat: 35.148, lng: -114.568, kind: "city", aka: ["bullhead"] },
  { name: "Fort Mohave", lat: 35.005, lng: -114.575, kind: "city", aka: ["ft mohave"] },
  { name: "Lake Havasu City", lat: 34.484, lng: -114.322, kind: "city", aka: ["lake havasu", "havasu"] },
  { name: "Temple Bar Marina", lat: 36.027, lng: -114.330, kind: "city", aka: ["temple bar"] },
  { name: "Williams", lat: 35.249, lng: -112.191, kind: "city" }, // Coconino
  { name: "Flagstaff", lat: 35.198, lng: -111.651, kind: "city" }, // Coconino seat
  // FL örneği (platted)
  { name: "Alford", lat: 30.703, lng: -85.391, kind: "city", aka: ["compass lake"] }, // Jackson County FL

  // ── Su (göl/nehir) — Lake Mead yakınlığı Meadview'in satış kozu ──
  { name: "Lake Mead", lat: 36.150, lng: -114.400, kind: "water", aka: ["lake mead", "mead"] },
  { name: "Colorado River (Topock)", lat: 34.720, lng: -114.490, kind: "water", aka: ["colorado river"] },

  // ── Ana yollar (referans nokta — kabaca mesafe) ──
  { name: "I-40 (Kingman)", lat: 35.190, lng: -114.050, kind: "highway", aka: ["i-40", "i40", "interstate 40"] },
  { name: "US-93 (Kingman)", lat: 35.300, lng: -114.120, kind: "highway", aka: ["us-93", "us 93", "hwy 93"] },

  // ── Metro / büyük cazibe (satış kozu — "Vegas'a X mil / 1-2 saat") ──
  { name: "Las Vegas, NV", lat: 36.170, lng: -115.140, kind: "metro", aka: ["las vegas", "vegas"] },
  { name: "Laughlin, NV", lat: 35.168, lng: -114.573, kind: "metro", aka: ["laughlin"] },
];

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

// Haversine — iki nokta arası mil.
export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8; // dünya yarıçapı (mil)
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

// En yakın referans (verilen tür) → { name, miles }. Bulunamazsa null.
export function nearestRef(
  lat: number,
  lng: number,
  kind: RefKind,
): { name: string; miles: number } | null {
  let best: { name: string; miles: number } | null = null;
  for (const r of GEO_REFS) {
    if (r.kind !== kind) continue;
    const miles = distanceMiles(lat, lng, r.lat, r.lng);
    if (!best || miles < best.miles) best = { name: r.name, miles };
  }
  return best;
}

// Rakip ilanını (koordinatsız) şehir merkezine yaklaşık oturt: state/county/title
// içinden bilinen bir şehir adı yakala → o şehrin koordinatı. Bulunamazsa null.
export function geocodeApprox(
  state: string | null,
  county: string | null,
  title: string | null,
): { lat: number; lng: number; matched: string; approx: true } | null {
  const hay = `${norm(county)} ${norm(title)} ${norm(state)}`;
  // Önce şehir adları (en uzun-isim önce ki "lake havasu city" "havasu"dan önce yakalansın)
  const cities = GEO_REFS.filter((r) => r.kind === "city").sort((a, b) => b.name.length - a.name.length);
  for (const c of cities) {
    const keys = [norm(c.name), ...(c.aka ?? []).map(norm)];
    if (keys.some((k) => k && hay.includes(k))) {
      return { lat: c.lat, lng: c.lng, matched: c.name, approx: true };
    }
  }
  // County-only fallback (şehir değil county geçmişse): Mohave→Kingman, Coconino→Williams
  if (hay.includes("mohave")) return { lat: 35.189, lng: -114.053, matched: "Mohave (Kingman ~)", approx: true };
  if (hay.includes("coconino")) return { lat: 35.249, lng: -112.191, matched: "Coconino (Williams ~)", approx: true };
  return null;
}
