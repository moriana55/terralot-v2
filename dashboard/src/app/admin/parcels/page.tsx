"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, MapPin, User, Ruler, DollarSign, Layers, Loader2, AlertCircle, ChevronRight, X } from "lucide-react";
import dynamic from "next/dynamic";

const ParcelMap = dynamic(() => import("./parcel-map"), { ssr: false });

interface ParcelFeature {
  type: "Feature";
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
  properties: Record<string, string | number | null>;
}

interface RegridResponse {
  type?: "FeatureCollection";
  features?: ParcelFeature[];
  error?: string;
  _mock?: boolean;
}

type SearchMode = "address" | "owner" | "coordinates";

export default function ParcelsPage() {
  const [mode, setMode] = useState<SearchMode>("address");
  const [query, setQuery] = useState("");
  const [lat, setLat] = useState("32.7767");
  const [lng, setLng] = useState("-96.7970");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ParcelFeature[]>([]);
  const [selected, setSelected] = useState<ParcelFeature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([32.7767, -96.797]);
  const [mapClickCoords, setMapClickCoords] = useState<[number, number] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (overrideLat?: number, overrideLng?: number) => {
    setLoading(true);
    setError(null);
    setSelected(null);

    let url = "/api/regrid?";
    if (mode === "address") {
      if (!query.trim()) { setLoading(false); return; }
      url += `endpoint=address&query=${encodeURIComponent(query)}`;
    } else if (mode === "owner") {
      if (!query.trim()) { setLoading(false); return; }
      url += `endpoint=owner&owner=${encodeURIComponent(query)}`;
    } else {
      const useLat = overrideLat ?? parseFloat(lat);
      const useLng = overrideLng ?? parseFloat(lng);
      url += `endpoint=point&lat=${useLat}&lng=${useLng}`;
    }

    try {
      const res = await fetch(url);
      const data: RegridResponse = await res.json();
      setMock(!!data._mock);
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else if (data.features && data.features.length > 0) {
        setResults(data.features);
        const first = data.features[0];
        if (first.geometry) {
          const coords = first.geometry.type === "MultiPolygon"
            ? (first.geometry.coordinates as number[][][][])[0][0][0]
            : (first.geometry.coordinates as number[][][])[0][0];
          setMapCenter([coords[1], coords[0]]);
        }
      } else {
        setResults([]);
        setError("No parcels found");
      }
    } catch {
      setError("Failed to fetch data");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mode, query, lat, lng]);

  const handleMapClick = useCallback((clickLat: number, clickLng: number) => {
    setMapClickCoords([clickLat, clickLng]);
    setLat(clickLat.toFixed(6));
    setLng(clickLng.toFixed(6));
    setMode("coordinates");
  }, []);

  useEffect(() => {
    if (mapClickCoords) {
      search(mapClickCoords[0], mapClickCoords[1]);
      setMapClickCoords(null);
    }
  }, [mapClickCoords, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  const p = selected?.properties;

  return (
    <div className="p-8 h-[calc(100vh-0px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Parcel Explorer</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Search parcels via Regrid API — click the map or search by address / owner
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-5">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--outline)" }}>
          {(["address", "owner", "coordinates"] as SearchMode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setResults([]); setSelected(null); setError(null); }}
              className="px-3 py-2 text-xs font-semibold transition-colors capitalize"
              style={{
                background: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "white" : "var(--muted)",
              }}>
              {m}
            </button>
          ))}
        </div>

        {mode === "coordinates" ? (
          <div className="flex gap-2 flex-1">
            <input ref={inputRef} type="text" value={lat} onChange={(e) => setLat(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Latitude"
              className="flex-1 px-4 py-2 rounded-lg text-sm border outline-none"
              style={{ borderColor: "var(--outline)", background: "var(--surface)" }} />
            <input type="text" value={lng} onChange={(e) => setLng(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Longitude"
              className="flex-1 px-4 py-2 rounded-lg text-sm border outline-none"
              style={{ borderColor: "var(--outline)", background: "var(--surface)" }} />
          </div>
        ) : (
          <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "address" ? "123 Main St, Dallas, TX" : "John Smith"}
            className="flex-1 px-4 py-2 rounded-lg text-sm border outline-none"
            style={{ borderColor: "var(--outline)", background: "var(--surface)" }} />
        )}

        <button onClick={() => search()} disabled={loading}
          className="px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          style={{ background: "var(--primary)", color: "white", opacity: loading ? 0.6 : 1 }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {mock && results.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-xs font-semibold"
          style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.4)", color: "#a16207" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          ⚠️ Örnek (mock) parsel — REGRID_API_TOKEN tanımlı değil. Gerçek parsel verisi için token ekle.
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-0">
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
          <ParcelMap center={mapCenter} parcels={results} selected={selected} onSelect={setSelected} onMapClick={handleMapClick} />
        </div>

        {/* Results / Detail sidebar */}
        <div className="overflow-y-auto space-y-3">
          {selected && p ? (
            <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm">{p.address || p.parcelnumb || "Parcel"}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {[p.city || p.situs_city, p.state2 || p.situs_state, p.zip || p.situs_zip].filter(Boolean).join(", ")}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-black/5">
                  <X className="w-4 h-4" style={{ color: "var(--muted)" }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {p.owner && (
                  <InfoCard icon={User} label="Owner" value={String(p.owner)} />
                )}
                {(p.ll_gisacre || p.gisacre) && (
                  <InfoCard icon={Ruler} label="Acres" value={`${Number(p.ll_gisacre || p.gisacre).toFixed(2)} ac`} />
                )}
                {(p.market_value || p.mkt_val || p.assessed_value) && (
                  <InfoCard icon={DollarSign} label="Value" value={`$${Number(p.market_value || p.mkt_val || p.assessed_value).toLocaleString()}`} />
                )}
                {(p.zoning || p.usecode || p.usedesc) && (
                  <InfoCard icon={Layers} label="Use/Zoning" value={String(p.usedesc || p.zoning || p.usecode)} />
                )}
                {p.parcelnumb && (
                  <InfoCard icon={MapPin} label="APN" value={String(p.parcelnumb)} />
                )}
                {(p.ll_gissqft || p.sqft) && (
                  <InfoCard icon={Ruler} label="Sq Ft" value={Number(p.ll_gissqft || p.sqft).toLocaleString()} />
                )}
              </div>

              {/* All properties expandable */}
              <details className="group">
                <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1" style={{ color: "var(--muted)" }}>
                  <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                  All Fields ({Object.keys(p).length})
                </summary>
                <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                  {Object.entries(p).filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px] py-0.5 border-b" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                      <span style={{ color: "var(--muted)" }}>{k}</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ) : results.length > 0 ? (
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                {results.length} parcels found
              </p>
              <div className="space-y-1.5">
                {results.map((f, i) => (
                  <button key={i} onClick={() => setSelected(f)}
                    className="w-full text-left p-3 rounded-lg transition-colors hover:bg-black/[0.02] flex items-center gap-3"
                    style={{ background: selected === f ? "rgba(57,128,244,0.06)" : "transparent" }}>
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: "var(--tertiary)" }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{f.properties.address || f.properties.parcelnumb || `Parcel ${i + 1}`}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--muted)" }}>
                        {f.properties.owner ? `Owner: ${f.properties.owner}` : ""}
                        {f.properties.ll_gisacre ? ` · ${Number(f.properties.ll_gisacre).toFixed(1)} ac` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 ml-auto shrink-0" style={{ color: "var(--muted)" }} />
                  </button>
                ))}
              </div>
            </div>
          ) : !loading && !error ? (
            <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
              <MapPin className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">Search for parcels</p>
              <p className="text-xs">Search by address, owner name, or click anywhere on the map</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: "var(--surface-high)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color: "var(--muted)" }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}
