"use client";

/**
 * APN Sorgula — bir parsel numarası (APN) gir, Mohave County GIS'ten RESMÎ
 * (authoritative) parsel kaydını çek, gerçek parseli göster.
 *
 * NEDEN CLIENT-SIDE FETCH: Mohave ArcGIS sorgu ucu residential IP'den çalışır,
 * datacenter'dan timeout olur. Bu yüzden sorgu MUTLAKA tarayıcıdan atılır —
 * asla server-side değil. (CountyGisLayer.tsx ile aynı dürüst kısıt.)
 *
 * Servis (scraper/mohave-offmarket.mjs ile birebir aynı): layer 38, alan PARCEL.
 *   https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query
 *
 * Harita Leaflet ister (window) → ParcelMap next/dynamic { ssr:false } ile gelir.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileSearch, Loader2, Search, Satellite, Map as MapIcon, AlertTriangle } from "lucide-react";
import type { Feature, FeatureCollection } from "geojson";

const ParcelMap = dynamic(() => import("./parcel-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

const QUERY_BASE =
  "https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query";

const ACCENT = "#8ed1df";

type ParcelProps = Record<string, string | number | null>;

/** Girilen APN'den denenecek aday değerler (tireli + tiresiz + biçimlenmiş). */
function apnCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  const out = new Set<string>();
  if (trimmed) out.add(trimmed);
  if (digits) out.add(digits);
  // Mohave biçimi genelde ###-##-### (book-map-parcel = 8 hane).
  if (digits.length === 8) {
    out.add(`${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`);
  }
  return [...out];
}

/** Geometriden basit ağırlık merkezi (Google linki + harita merkezi için). */
function centroidOf(feature: Feature): [number, number] | null {
  const coords: [number, number][] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      coords.push([c[0] as number, c[1] as number]);
    } else if (Array.isArray(c)) {
      c.forEach(walk);
    }
  };
  if (feature.geometry && "coordinates" in feature.geometry) {
    walk((feature.geometry as { coordinates: unknown }).coordinates);
  }
  if (!coords.length) return null;
  const sum = coords.reduce((a, [lng, lat]) => [a[0] + lng, a[1] + lat], [0, 0]);
  // GeoJSON = [lng, lat]; Leaflet/Google = [lat, lng]
  return [sum[1] / coords.length, sum[0] / coords.length];
}

async function queryMohave(
  field: string,
  value: string,
): Promise<FeatureCollection> {
  const where = `${field}='${value.replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    where,
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  // Tarayıcıdan (residential IP) — 20sn timeout.
  const res = await fetch(`${QUERY_BASE}?${params}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as FeatureCollection & { error?: { message?: string } };
  if (j?.error) throw new Error(j.error.message || "ArcGIS sorgu hatası");
  return j;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// İnsan-okur etiketler (varsa öne çıkar; gerisi ham tabloda).
const HIGHLIGHTS: { keys: string[]; label: string; fmt?: (v: string | number) => string }[] = [
  { keys: ["PARCEL", "APN", "PARCELNUM"], label: "APN / Parsel" },
  { keys: ["OWNER"], label: "Sahip" },
  { keys: ["OWNER_2"], label: "Sahip 2" },
  { keys: ["SITE_ADDRESS"], label: "Site (situs) adresi" },
  { keys: ["MAILING_ADDRESS"], label: "Posta adresi" },
  { keys: ["PARCEL_SIZE"], label: "Dönüm (acre)" },
  { keys: ["LANDVALUE"], label: "Arazi değeri", fmt: (v) => usd(Number(v)) },
  { keys: ["FULL_CASH_VALUE"], label: "Tam değer (full cash)", fmt: (v) => usd(Number(v)) },
  { keys: ["PROPUSE", "USE_CODE"], label: "Kullanım" },
  { keys: ["LEGAL_DESCRIPTION"], label: "Yasal tanım" },
];

function pick(props: ParcelProps, keys: string[]): string | number | null {
  for (const k of keys) {
    const hit = Object.keys(props).find((pk) => pk.toUpperCase() === k);
    if (hit != null && props[hit] != null && props[hit] !== "") return props[hit];
  }
  return null;
}

export default function ApnSorgulaPage() {
  const [apn, setApn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [usedQuery, setUsedQuery] = useState<string | null>(null);

  const props = (feature?.properties ?? {}) as ParcelProps;
  const centroid = feature ? centroidOf(feature) : null;

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setFeature(null);
    setUsedQuery(null);

    const candidates = apnCandidates(apn);
    if (!candidates.length) {
      setError("Lütfen bir APN (parsel numarası) girin. Örn: 209-06-171 veya 20906171");
      return;
    }

    setLoading(true);
    // Önce doğrulanmış alan PARCEL, sonra olası alternatif APN — tireli/tiresiz dene.
    const attempts: { field: string; value: string }[] = [];
    for (const v of candidates) attempts.push({ field: "PARCEL", value: v });
    for (const v of candidates) attempts.push({ field: "APN", value: v });

    let lastErr: Error | null = null;
    let anySuccess = false;
    try {
      for (const a of attempts) {
        try {
          const fc = await queryMohave(a.field, a.value);
          anySuccess = true;
          if (fc.features && fc.features.length > 0) {
            setFeature(fc.features[0] as Feature);
            setUsedQuery(`${a.field}='${a.value}'`);
            setLoading(false);
            return;
          }
        } catch (err) {
          // Alan adı yanlışsa (örn. APN yoksa) ArcGIS hata döndürür — sıradakine geç.
          lastErr = err instanceof Error ? err : new Error(String(err));
        }
      }
      // Buraya geldiyse: ya hiç kayıt yok ya da hep hata.
      if (anySuccess) {
        setError(
          "Bu APN için kayıt bulunamadı. Numarayı kontrol edin (tireli/tiresiz) — " +
            "ya da alan adı bu serviste farklı olabilir. Şu an yalnızca Mohave County desteklenir.",
        );
      } else if (lastErr?.name === "TimeoutError" || lastErr?.message?.includes("aborted")) {
        setError(
          "Sorgu zaman aşımına uğradı. Mohave GIS yalnızca residential IP'den (kendi tarayıcınız) " +
            "yanıt verir; datacenter/VPN'den timeout olabilir. Tekrar deneyin.",
        );
      } else {
        setError(
          "Mohave GIS'e ulaşılamadı (ağ/CORS/timeout). Bu sorgu tarayıcınızdan atılır; " +
            "VPN/ad-blocker kapatıp tekrar deneyin. Detay: " + (lastErr?.message ?? "bilinmiyor"),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const googleUrl = centroid
    ? `https://www.google.com/maps/search/?api=1&query=${centroid[0]},${centroid[1]}`
    : null;

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-5xl">
        {/* Başlık */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#0891b2" }}>
          <FileSearch className="h-3.5 w-3.5" /> APN Sorgula · Resmî Parsel Kaydı
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Parsel Numarası ile Sorgula</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bir APN (parsel numarası) girin; <span className="font-semibold text-slate-700">Mohave County GIS</span>{" "}
          servisinden gerçek parsel kaydını ve sınırını getirir.
        </p>

        {/* Arama kutusu */}
        <form onSubmit={onSearch} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={apn}
              onChange={(e) => setApn(e.target.value)}
              placeholder="209-06-171  veya  20906171"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#0f172a" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Sorgula
          </button>
        </form>

        {/* Kaynak etiketi + dürüst not */}
        <div className="mt-3 space-y-1 text-[11px] text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Kaynak:</span> Mohave County GIS — resmî parsel kaydı (authoritative)
          </div>
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-amber-500" />
            <span>
              Tarayıcıdan yüklenir (residential IP); datacenter&apos;dan timeout olabilir. Şu an Mohave County;
              başka county için ayrı servis gerekir.
            </span>
          </div>
        </div>

        {/* Hata */}
        {error && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {/* Sonuç */}
        {feature && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {/* Harita */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ height: 420 }}>
              {centroid ? (
                <ParcelMap feature={feature} center={centroid} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Bu kayıtta geometri yok (sınır çizilemiyor).
                </div>
              )}
            </div>

            {/* Detay paneli */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Parsel Detayı</h2>
                <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold" style={{ color: "#0891b2" }}>
                  authoritative
                </span>
              </div>
              {usedQuery && (
                <p className="mt-1 text-[10px] text-slate-400">eşleşen sorgu: <code>{usedQuery}</code></p>
              )}

              {/* Öne çıkanlar */}
              <dl className="mt-3 space-y-1.5">
                {HIGHLIGHTS.map((h) => {
                  const v = pick(props, h.keys);
                  if (v == null) return null;
                  return (
                    <div key={h.label} className="flex justify-between gap-3 text-[13px]">
                      <dt className="shrink-0 text-slate-500">{h.label}</dt>
                      <dd className="text-right font-medium text-slate-900">{h.fmt ? h.fmt(v) : String(v)}</dd>
                    </div>
                  );
                })}
              </dl>

              {/* Aksiyon butonları */}
              <div className="mt-4 flex flex-wrap gap-2">
                {googleUrl && (
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Satellite className="h-3.5 w-3.5" /> 🛰️ Google&apos;da aç
                  </a>
                )}
                <a
                  href="/admin/alinabilir-harita"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <MapIcon className="h-3.5 w-3.5" /> 🗺️ Ana haritada gör
                </a>
              </div>

              {/* Ham alanlar (dürüstlük: gelen her şey) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
                  Tüm alanlar (ham GIS kaydı)
                </summary>
                <div className="mt-2 max-h-52 overflow-auto rounded-lg bg-slate-50 p-2">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {Object.entries(props).map(([k, v]) => (
                        <tr key={k} className="border-b border-slate-100 last:border-0">
                          <td className="py-0.5 pr-3 font-mono text-slate-400">{k}</td>
                          <td className="py-0.5 text-slate-700">{v == null ? "—" : String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
