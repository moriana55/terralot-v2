"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map as MapIcon, Layers, Target, Gavel } from "lucide-react";
import type { MapParcel, MapSummary } from "@/app/api/parcels-map/route";

const NationalMap = dynamic(() => import("./national-map"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center gap-2 text-sm"
      style={{ height: "calc(100vh - 220px)", minHeight: 560, color: "var(--muted)", background: "#0b1220" }}
    >
      <Loader2 className="w-4 h-4 animate-spin" /> Harita yükleniyor…
    </div>
  ),
});

export default function NationalMapPage() {
  const [parcels, setParcels] = useState<MapParcel[]>([]);
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Katman kontrolleri
  const [showAuction, setShowAuction] = useState(true);
  const [showOpp, setShowOpp] = useState(true);
  const [stateFilter, setStateFilter] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/parcels-map", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.message || j.error || `Harita verisi yüklenemedi (${r.status})`);
        if (!alive) return;
        setParcels((j.parcels as MapParcel[]) || []);
        setSummary((j.summary as MapSummary) || null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Harita verisi yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Eyalet listesi (gerçek veriden)
  const states = useMemo(() => {
    const set = new Set<string>();
    for (const p of parcels) if (p.st) set.add(p.st);
    return Array.from(set).sort();
  }, [parcels]);

  // Eyalet filtresi uygulanmış parseller
  const filtered = useMemo(() => {
    if (stateFilter === "all") return parcels;
    return parcels.filter((p) => p.st === stateFilter);
  }, [parcels, stateFilter]);

  // Görünür sayımlar (özet panel + filtre)
  const counts = useMemo(() => {
    let opp = 0;
    const st = new Set<string>();
    for (const p of filtered) {
      if (p.op === 1) opp++;
      if (p.st) st.add(p.st);
    }
    return { total: filtered.length, opp, states: st.size };
  }, [filtered]);

  return (
    <div className="relative" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Başlık */}
      <div className="px-7 pt-6 pb-3 flex items-center gap-2 flex-wrap">
        <MapIcon className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
        <h1 className="text-2xl font-bold">Ulusal Parsel Haritası</h1>
        <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>
          {loading
            ? "yükleniyor…"
            : summary
              ? `${counts.total.toLocaleString()} parsel · ${counts.states} eyalet · ${counts.opp.toLocaleString()} fırsat`
              : ""}
        </span>
      </div>

      {error && (
        <div
          className="mx-7 mb-3 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface)", color: "var(--danger)", border: "1px solid rgba(186,26,26,0.25)" }}
        >
          {error}
        </div>
      )}

      <div className="px-7 pb-7">
        <div className="rounded-xl overflow-hidden relative" style={{ border: "1px solid var(--surface-high)" }}>
          {/* Kontrol paneli — sol üst overlay */}
          <div
            className="absolute top-3 left-3 z-[1000] rounded-xl p-3.5 w-[248px] space-y-3 backdrop-blur"
            style={{ background: "rgba(11,18,32,0.92)", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf6", boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ opacity: 0.7 }}>
              <Layers className="w-3.5 h-3.5" /> Katmanlar
            </div>

            {/* Auction katmanı */}
            <LayerToggle
              on={showAuction}
              onChange={setShowAuction}
              color="#94a3b8"
              icon={<Gavel className="w-3.5 h-3.5" />}
              label="Auction Parselleri"
              sub="Tüm tax-delinquent"
            />
            {/* Fırsat katmanı */}
            <LayerToggle
              on={showOpp}
              onChange={setShowOpp}
              color="#16a34a"
              icon={<Target className="w-3.5 h-3.5" />}
              label="Potansiyel Alım Fırsatları"
              sub="Arbitraj marjı pozitif"
            />

            {/* Eyalet filtresi */}
            <div className="pt-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ opacity: 0.6 }}>
                Eyalet
              </label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e6edf6" }}
              >
                <option value="all">Tüm ABD</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Özet */}
            <div className="pt-2 mt-1 grid grid-cols-3 gap-1.5 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <Stat n={counts.total} label="parsel" />
              <Stat n={counts.states} label="eyalet" />
              <Stat n={counts.opp} label="fırsat" accent />
            </div>
            {summary && summary.noCoords > 0 && (
              <div className="text-[10px] leading-snug" style={{ opacity: 0.55 }}>
                {summary.noCoords.toLocaleString()} parsel koordinatsız (atlandı) ·{" "}
                {summary.benchmarkAvailable ? "fırsatlar gerçek $/acre comp'larına göre" : "comp benchmark'ı yok"}
              </div>
            )}
          </div>

          {/* Legend — sağ alt overlay */}
          <div
            className="absolute bottom-3 right-3 z-[1000] rounded-lg px-3 py-2 text-[11px] space-y-1 backdrop-blur"
            style={{ background: "rgba(11,18,32,0.9)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" }}
          >
            <LegendRow color="#22e07a" label="Yüksek marjlı fırsat (≥%50)" />
            <LegendRow color="#16a34a" label="Alım fırsatı" />
            <LegendRow color="#0e7d97" label="A-grade auction" />
            <LegendRow color="#94a3b8" label="Normal auction" />
          </div>

          <NationalMap parcels={filtered} showAuction={showAuction} showOpp={showOpp} />

          {!loading && !error && filtered.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
              <span className="text-sm px-4 py-2 rounded-lg" style={{ background: "rgba(11,18,32,0.9)", color: "#cbd5e1" }}>
                Bu seçimde haritada gösterilecek konumlu parsel yok.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LayerToggle({
  on,
  onChange,
  color,
  icon,
  label,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  color: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors text-left"
      style={{ background: on ? "rgba(255,255,255,0.06)" : "transparent", opacity: on ? 1 : 0.5 }}
    >
      <span
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
        style={{ background: on ? color : "rgba(255,255,255,0.1)", color: on ? "#04130a" : "#cbd5e1" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold truncate">{label}</span>
        <span className="block text-[10px] truncate" style={{ opacity: 0.6 }}>
          {sub}
        </span>
      </span>
      <span
        className="shrink-0 w-8 h-4 rounded-full relative transition-colors"
        style={{ background: on ? color : "rgba(255,255,255,0.18)" }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
          style={{ left: on ? "18px" : "2px" }}
        />
      </span>
    </button>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-sm font-extrabold tabular-nums" style={{ color: accent ? "#22e07a" : "#e6edf6" }}>
        {n.toLocaleString()}
      </div>
      <div className="text-[9px] uppercase tracking-wider" style={{ opacity: 0.55 }}>
        {label}
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
