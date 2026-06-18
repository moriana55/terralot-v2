"use client";

import { useState } from "react";
import { Loader2, Droplets, Route, Search, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface DDResult {
  flood: {
    floodZone: string | null;
    zoneSubtype: string | null;
    inSFHA: boolean;
    insuranceRequired: boolean;
    riskScore: number | null;
    riskLabel: string;
    error?: string;
  };
  road: {
    hasRoadAccess: boolean | null;
    nearestRoadMeters: number | null;
    accessType: string;
    nearestRoadName: string | null;
    surface: string;
    roadClass: string | null;
    accessNote: string;
    error?: string;
  };
}

const RISK_CONFIG: Record<string, { color: string; bg: string; label: string; icon: typeof CheckCircle2 }> = {
  minimal:       { color: "#22c55e", bg: "rgba(34,197,94,0.08)",    label: "Minimal Risk",       icon: CheckCircle2 },
  moderate:      { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",   label: "Moderate Risk",      icon: AlertTriangle },
  high:          { color: "#ef4444", bg: "rgba(239,68,68,0.08)",    label: "High Risk",          icon: XCircle },
  very_high:     { color: "#991b1b", bg: "rgba(153,27,27,0.08)",    label: "Very High Risk",     icon: XCircle },
  undetermined:  { color: "#6b7280", bg: "rgba(107,114,128,0.08)", label: "Undetermined",       icon: AlertTriangle },
  unknown:       { color: "#6b7280", bg: "rgba(107,114,128,0.08)", label: "Unknown",            icon: AlertTriangle },
};

const SURFACE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  paved:   { icon: "🟢", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  gravel:  { icon: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  dirt:    { icon: "🟠", color: "#f97316", bg: "rgba(249,115,22,0.08)" },
  unknown: { icon: "⚪", color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

const ACCESS_LABEL: Record<string, string> = {
  direct: "Direct Access",
  near: "Nearby Access",
  landlocked: "Landlocked ⚠️",
  unknown: "Unknown",
};

export default function DDCheckerPage() {
  const [lat, setLat] = useState("31.89");
  const [lon, setLon] = useState("-109.68");
  const [apn, setApn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DDResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!lat || !lon) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/dd-check?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const flood = result?.flood;
  const road = result?.road;
  const riskCfg = RISK_CONFIG[flood?.riskLabel ?? "unknown"];
  const surfaceCfg = SURFACE_CONFIG[road?.surface ?? "unknown"];
  const RiskIcon = riskCfg?.icon ?? AlertTriangle;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">DD Checker</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>FEMA flood zone + road access — enter coordinates and run</p>

      {/* Input */}
      <div className="rounded-xl border p-5 mb-6 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--muted)" }}>Latitude</label>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="31.89"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
              style={{ background: "var(--surface-high)", borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--muted)" }}>Longitude</label>
            <input value={lon} onChange={e => setLon(e.target.value)} placeholder="-109.68"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
              style={{ background: "var(--surface-high)", borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--muted)" }}>APN (optional)</label>
            <input value={apn} onChange={e => setApn(e.target.value)} placeholder="301-42-0180"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
              style={{ background: "var(--surface-high)", borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </div>
        </div>
        <button onClick={run} disabled={loading || !lat || !lon}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
          style={{ background: "var(--primary)", color: "white", opacity: loading ? 0.7 : 1 }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Checking…" : "Run DD Check"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm mb-4" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Flood Card */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)" }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              <Droplets className="w-5 h-5" style={{ color: "#60a5fa" }} />
              <h2 className="font-bold">Flood Risk</h2>
              {flood?.floodZone && (
                <span className="ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>
                  Zone {flood.floodZone}{flood.zoneSubtype ? ` — ${flood.zoneSubtype}` : ""}
                </span>
              )}
            </div>

            {flood?.error ? (
              <div className="px-5 py-4 text-sm" style={{ color: "var(--muted)" }}>Error: {flood.error}</div>
            ) : (
              <div className="px-5 py-5" style={{ background: "var(--surface)" }}>
                {/* Risk badge */}
                <div className="flex items-center gap-4 mb-5 p-4 rounded-xl" style={{ background: riskCfg.bg }}>
                  <RiskIcon className="w-8 h-8 shrink-0" style={{ color: riskCfg.color }} />
                  <div>
                    <p className="font-bold text-lg" style={{ color: riskCfg.color }}>{riskCfg.label}</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Risk score: <strong style={{ color: riskCfg.color }}>{flood?.riskScore ?? "?"}/100</strong>
                    </p>
                  </div>
                  {flood?.riskScore != null && (
                    <div className="ml-auto w-20 h-20 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke={riskCfg.color} strokeWidth="3"
                          strokeDasharray={`${flood.riskScore} 100`} strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Flood Zone" value={flood?.floodZone ?? "Not mapped"} />
                  <InfoRow label="SFHA" value={flood?.inSFHA ? "Yes — Special Flood Hazard Area" : "No"} valueColor={flood?.inSFHA ? "#ef4444" : "#22c55e"} />
                  <InfoRow label="Insurance" value={flood?.insuranceRequired ? "Required" : "Not required"} valueColor={flood?.insuranceRequired ? "#ef4444" : "#22c55e"} />
                  <InfoRow label="Risk Label" value={flood?.riskLabel ?? "—"} />
                </div>
              </div>
            )}
          </div>

          {/* Road Card */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)" }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              <Route className="w-5 h-5" style={{ color: "#5aa9ff" }} />
              <h2 className="font-bold">Road Access</h2>
              {road && (
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: road.accessType === "direct" ? "rgba(34,197,94,0.1)" : road.accessType === "landlocked" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    color: road.accessType === "direct" ? "#22c55e" : road.accessType === "landlocked" ? "#ef4444" : "#f59e0b" }}>
                  {ACCESS_LABEL[road.accessType]}
                </span>
              )}
            </div>

            {road?.error ? (
              <div className="px-5 py-4 text-sm" style={{ color: "var(--muted)" }}>Error: {road.error}</div>
            ) : (
              <div className="px-5 py-5" style={{ background: "var(--surface)" }}>
                {/* Surface badge */}
                <div className="flex items-center gap-4 mb-5 p-4 rounded-xl" style={{ background: surfaceCfg.bg }}>
                  <span className="text-3xl">{surfaceCfg.icon}</span>
                  <div>
                    <p className="font-bold text-lg" style={{ color: surfaceCfg.color }}>{road?.accessNote}</p>
                    <p className="text-sm capitalize" style={{ color: "var(--muted)" }}>Surface: {road?.surface}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Has Road Access" value={road?.hasRoadAccess ? "Yes" : "No"} valueColor={road?.hasRoadAccess ? "#22c55e" : "#ef4444"} />
                  <InfoRow label="Access Type" value={ACCESS_LABEL[road?.accessType ?? "unknown"]} />
                  <InfoRow label="Nearest Road" value={road?.nearestRoadName ?? "Unnamed"} />
                  <InfoRow label="Distance" value={road?.nearestRoadMeters != null ? `${road.nearestRoadMeters}m` : "—"} />
                  <InfoRow label="Road Class" value={road?.roadClass ?? "—"} />
                  <InfoRow label="Surface" value={road?.surface ?? "—"} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: "var(--surface-high)" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-sm font-semibold truncate" style={{ color: valueColor ?? "var(--foreground)" }}>{value}</p>
    </div>
  );
}
