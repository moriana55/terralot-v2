"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Brain, Loader2, AlertCircle, Sparkles, CheckCircle2, XCircle, Eye, MapPin } from "lucide-react";

// AI Parcel Underwriting — type an APN/address or pick a top lead, get a
// BUY/WATCH/PASS verdict with an explainable rubric. Calls POST /api/underwrite.

interface Reason { label: string; pts: number; note: string }
interface Verdict {
  resolved: boolean;
  parcel: { id: string | null; apn: string | null; state: string | null; county: string | null; acres: number | null; address: string | null };
  verdict: "BUY" | "WATCH" | "PASS";
  score: number;
  reasons: Reason[];
  signals: { compValue: number | null; perAcre: number | null; minBid: number | null; floodScore: number | null; roadAccess: string | null; popGrowth: number | null; income: number | null };
  dataGaps: string[];
  narrative: string;
  narrativeSource: "ai" | "rule-based";
  aiAvailable: boolean;
}
interface LeadLite { id: string; apn: string | null; county: string | null; state: string | null; acres: number | null; final_score: number | null }

const fmtMoney = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const VERDICT_COLOR: Record<string, string> = { BUY: "var(--grade-a)", WATCH: "var(--warn)", PASS: "var(--danger)" };
const VerdictIcon = ({ v }: { v: string }) => v === "BUY" ? <CheckCircle2 className="w-5 h-5" /> : v === "WATCH" ? <Eye className="w-5 h-5" /> : <XCircle className="w-5 h-5" />;

export default function UnderwritePage() {
  const [apn, setApn] = useState("");
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topLeads, setTopLeads] = useState<LeadLite[]>([]);

  useEffect(() => {
    supabase
      .from("tax_delinquent_properties")
      .select("id,apn,county,state,acres,final_score")
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(8)
      .then(({ data }) => setTopLeads((data as LeadLite[]) || []), () => {});
  }, []);

  const run = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/underwrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) throw new Error("Çok fazla istek — biraz bekle.");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setResult(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Underwriting başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Brain className="w-5 h-5" style={{ color: "var(--accent-ink)" }} /> AI Underwriting
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          APN/adres gir veya bir lead seç — açıklanabilir rubrik ile BUY / WATCH / PASS kararı.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>APN</label>
            <input value={apn} onChange={(e) => setApn(e.target.value)} placeholder="örn. R12345"
              className="w-full bg-[var(--surface-low)] border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--outline)" }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>veya Adres / County</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="örn. Maricopa, AZ"
              className="w-full bg-[var(--surface-low)] border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--outline)" }} />
          </div>
        </div>
        <button
          onClick={() => run({ apn: apn || undefined, address: address || undefined })}
          disabled={loading || (!apn && !address)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Underwrite
        </button>

        {topLeads.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--surface-high)" }}>
            <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--muted)" }}>Veya en iyi lead'lerden biriyle dene</p>
            <div className="flex flex-wrap gap-2">
              {topLeads.map((l) => (
                <button key={l.id} onClick={() => run({ leadId: l.id })}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5"
                  style={{ borderColor: "var(--outline)", color: "var(--accent-ink)" }}>
                  <MapPin className="w-3 h-3" /> {l.county || "?"}, {l.state || "?"} · {l.acres ?? "—"}ac · {l.final_score ?? "—"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Verdict + rubric */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-4 p-5 border-b" style={{ borderColor: "var(--surface-high)" }}>
              <ScoreBadge score={result.score} size={56} />
              <div>
                <div className="flex items-center gap-2 text-xl font-extrabold" style={{ color: VERDICT_COLOR[result.verdict] }}>
                  <VerdictIcon v={result.verdict} /> {result.verdict}
                </div>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {result.parcel.county || "?"}, {result.parcel.state || "?"} · {result.parcel.acres ?? "—"} acres
                  {result.parcel.apn ? ` · APN ${result.parcel.apn}` : ""}
                  {!result.resolved && <span className="ml-1 italic">(manuel — DB'de eşleşmedi)</span>}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Rubrik kırılımı — {result.score}/100</p>
              {result.reasons.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-[11px] w-28 shrink-0 font-semibold">{r.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pts * 3.3)}%`, background: "var(--accent-ink)" }} />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums w-10 text-right" style={{ color: "var(--accent-ink)" }}>+{r.pts}</span>
                  <span className="text-[10px] w-40 shrink-0 truncate" style={{ color: "var(--muted)" }} title={r.note}>{r.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Narrative + signals */}
          <div className="space-y-4">
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Sparkles className="w-3 h-3" /> Anlatım
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: result.narrativeSource === "ai" ? "var(--grade-a)" : "var(--muted)" }}>
                  {result.narrativeSource === "ai" ? "AI" : "kural-tabanlı"}
                </span>
              </p>
              <p className="text-sm leading-relaxed">{result.narrative}</p>
              {!result.aiAvailable && (
                <p className="text-[10px] mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>
                  💡 OPENAI_API_KEY ayarlanınca AI anlatımı otomatik aktifleşir.
                </p>
              )}
            </div>

            <div className="rounded-xl border p-5 text-xs space-y-1.5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Sinyaller</p>
              {[
                ["Comp değer", fmtMoney(result.signals.compValue)],
                ["$/acre (state)", fmtMoney(result.signals.perAcre)],
                ["Min teklif", fmtMoney(result.signals.minBid)],
                ["Sel skoru", result.signals.floodScore == null ? "—" : `${result.signals.floodScore}/100`],
                ["Yol", result.signals.roadAccess || "—"],
                ["Nüfus büyüme", result.signals.popGrowth == null ? "—" : `${(result.signals.popGrowth * 100).toFixed(1)}%`],
                ["Medyan gelir", fmtMoney(result.signals.income)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>{k}</span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </div>
              ))}
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
