"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Hammer, Loader2, AlertCircle, Sparkles, MapPin, Map, Droplets, Mountain, Home } from "lucide-react";

// Buildability / Zoning AI — heuristic build feasibility for raw land.
// POST /api/buildability with leadId or manual fields.

interface Reason { label: string; pts: number; note: string }
interface Result {
  resolved: boolean;
  parcel: { id: string | null; state: string | null; county: string | null; acres: number | null };
  score: number;
  verdict: string;
  zoning: { code: string; label: string };
  subdivision: { lots: number; note: string };
  septicWell: { feasible: boolean; note: string };
  signals: { roadAccess: string | null; floodScore: number | null; slopePct: number | null };
  reasons: Reason[];
  dataGaps: string[];
  narrative: string;
  narrativeSource: "ai" | "rule-based";
  aiAvailable: boolean;
}
interface LeadLite { id: string; county: string | null; state: string | null; acres: number | null; final_score: number | null }

export default function BuildabilityPage() {
  const [acres, setAcres] = useState("");
  const [loc, setLoc] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadLite[]>([]);

  useEffect(() => {
    supabase.from("tax_delinquent_properties")
      .select("id,county,state,acres,final_score")
      .not("acres", "is", null)
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(8)
      .then(({ data }) => setLeads((data as LeadLite[]) || []), () => {});
  }, []);

  const run = async (payload: Record<string, unknown>) => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/buildability", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      if (res.status === 429) throw new Error("Çok fazla istek — biraz bekle.");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setResult(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Başarısız");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Hammer className="w-5 h-5" style={{ color: "var(--accent-ink)" }} /> Buildability AI
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Ham arazi inşa edilebilirliği — olası imar, bölünme, septik/kuyu, eğim & sel sezgisel analizi.
        </p>
      </div>

      <div className="rounded-xl border p-5 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Acres</label>
            <input value={acres} onChange={(e) => setAcres(e.target.value)} placeholder="örn. 5"
              className="w-full bg-[var(--surface-low)] border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--outline)" }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>County, State</label>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="örn. Maricopa, AZ"
              className="w-full bg-[var(--surface-low)] border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--outline)" }} />
          </div>
        </div>
        <button onClick={() => {
          const [c, st] = loc.split(",").map((x) => x.trim());
          run({ acres: acres ? Number(acres) : undefined, county: c || undefined, state: st || undefined });
        }} disabled={loading || !acres}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#fff" }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analiz et
        </button>

        {leads.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--surface-high)" }}>
            <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--muted)" }}>Veya bir lead seç (lat/lng varsa canlı sel/yol)</p>
            <div className="flex flex-wrap gap-2">
              {leads.map((l) => (
                <button key={l.id} onClick={() => run({ leadId: l.id })}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5" style={{ borderColor: "var(--outline)", color: "var(--accent-ink)" }}>
                  <MapPin className="w-3 h-3" /> {l.county || "?"}, {l.state || "?"} · {l.acres ?? "—"}ac
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}><AlertCircle className="w-4 h-4" /> {error}</div>}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border p-5 flex items-center gap-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <ScoreBadge score={result.score} size={56} />
              <div>
                <p className="text-xl font-extrabold">{result.verdict}</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {result.parcel.county || "?"}, {result.parcel.state || "?"} · {result.parcel.acres ?? "—"} acres
                  {!result.resolved && <span className="ml-1 italic">(manuel)</span>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Map className="w-3 h-3" /> Olası imar</p>
                <p className="font-bold text-sm">{result.zoning.code}</p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>{result.zoning.label}</p>
              </div>
              <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Home className="w-3 h-3" /> Bölünme</p>
                <p className="font-bold text-sm">≈{result.subdivision.lots} lot</p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>{result.subdivision.note}</p>
              </div>
              <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Droplets className="w-3 h-3" /> Septik/Kuyu</p>
                <p className="font-bold text-sm" style={{ color: result.septicWell.feasible ? "var(--grade-a)" : "var(--warn)" }}>{result.septicWell.feasible ? "Mümkün" : "Riskli"}</p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>{result.septicWell.note}</p>
              </div>
            </div>

            <div className="rounded-xl border p-5 space-y-2" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Mountain className="w-3 h-3" /> İnşa edilebilirlik kırılımı — {result.score}/100</p>
              {result.reasons.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-[11px] w-28 shrink-0 font-semibold">{r.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pts * 3.3)}%`, background: "var(--accent-ink)" }} />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums w-10 text-right" style={{ color: "var(--accent-ink)" }}>+{r.pts}</span>
                  <span className="text-[10px] w-32 shrink-0 truncate" style={{ color: "var(--muted)" }} title={r.note}>{r.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Sparkles className="w-3 h-3" /> Anlatım
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: result.narrativeSource === "ai" ? "var(--grade-a)" : "var(--muted)" }}>
                  {result.narrativeSource === "ai" ? "AI" : "kural-tabanlı"}
                </span>
              </p>
              <p className="text-sm leading-relaxed">{result.narrative}</p>
            </div>

            {result.dataGaps.length > 0 && (
              <div className="rounded-xl border p-4 text-xs" style={{ background: "rgba(255,180,60,0.06)", borderColor: "rgba(255,180,60,0.2)" }}>
                <p className="font-bold mb-1" style={{ color: "var(--warn)" }}>Veri boşlukları</p>
                <ul className="list-disc list-inside" style={{ color: "var(--muted)" }}>
                  {result.dataGaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
