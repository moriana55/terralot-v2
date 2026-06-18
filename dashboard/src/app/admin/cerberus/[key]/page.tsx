"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, ArrowLeft, CheckCircle2, Eye, XCircle, ShieldAlert,
  MapPin, Brain, Sparkles, Info, ExternalLink, Layers,
} from "lucide-react";
import { ScoreBadge } from "@/components/ScoreBadge";

// ─────────────────────────────────────────────────────────────────────────────
// PER-LEAD ANALYSIS DRILL-DOWN ("tek tek analiz eden")
//
// The full why-this-verdict view for ONE parcel: score components, comps,
// verdict + reasons, risk flags, suggested action, narrative. Reads the
// persisted analysis (or live-analyzes if not yet processed) from
// /api/admin/cerberus/lead?key=...
// ─────────────────────────────────────────────────────────────────────────────

type Verdict = "BUY" | "WATCH" | "PASS";
const VERDICT_TR: Record<Verdict, string> = { BUY: "AL", WATCH: "BEKLE", PASS: "GEÇ" };
const VERDICT_META: Record<Verdict, { color: string; Icon: typeof CheckCircle2 }> = {
  BUY: { color: "var(--grade-a)", Icon: CheckCircle2 },
  WATCH: { color: "var(--warn)", Icon: Eye },
  PASS: { color: "var(--danger)", Icon: XCircle },
};

interface Analysis {
  parcel_key?: string; parcelKey?: string;
  apn: string | null;
  source: string | null;
  state: string | null;
  county: string | null;
  address: string | null;
  acres: number | null;
  comp_value?: number | null; compValue?: number | null;
  per_acre?: number | null; perAcre?: number | null;
  value_basis?: string; valueBasis?: string;
  value_confidence?: string; valueConfidence?: string;
  min_bid?: number | null; minBid?: number | null;
  margin: number | null;
  discount_pct?: number | null; discountPct?: number | null;
  verdict: Verdict;
  score: number;
  confidence: string;
  hard_fail?: boolean; hardFail?: boolean;
  components: { label: string; pts: number; max: number; note: string }[];
  reasons: string[];
  risk_flags?: { code: string; level: string; label: string }[];
  riskFlags?: { code: string; level: string; label: string }[];
  data_gaps?: string[]; dataGaps?: string[];
  suggested_action?: string; suggestedAction?: string;
  narrative: string;
  narrative_source?: string; narrativeSource?: string;
}

const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);

export default function CerberusLeadPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [a, setA] = useState<Analysis | null>(null);
  const [meta, setMeta] = useState<{ stored: boolean; live: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/admin/cerberus/lead?key=${encodeURIComponent(key)}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.message || `Analiz yüklenemedi (${r.status})`);
        setA(j.analysis);
        setMeta({ stored: !!j.stored, live: !!j.live });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analiz yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [key]);

  // normalize snake/camel from stored vs live shapes
  const g = <T,>(snake: T | undefined, camel: T | undefined): T | undefined => (snake !== undefined ? snake : camel);
  const compValue = a ? g(a.comp_value, a.compValue) : null;
  const perAcre = a ? g(a.per_acre, a.perAcre) : null;
  const minBid = a ? g(a.min_bid, a.minBid) : null;
  const valueBasis = a ? g(a.value_basis, a.valueBasis) : undefined;
  const valueConf = a ? g(a.value_confidence, a.valueConfidence) : undefined;
  const discountPct = a ? g(a.discount_pct, a.discountPct) : null;
  const hardFail = a ? g(a.hard_fail, a.hardFail) : false;
  const riskFlags = (a ? g(a.risk_flags, a.riskFlags) : []) || [];
  const dataGaps = (a ? g(a.data_gaps, a.dataGaps) : []) || [];
  const suggestedAction = a ? g(a.suggested_action, a.suggestedAction) : "";
  const narrativeSource = a ? g(a.narrative_source, a.narrativeSource) : "rule-based";

  const mem = a ? VERDICT_META[a.verdict] || VERDICT_META.PASS : VERDICT_META.PASS;

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/cerberus" className="inline-flex items-center gap-1.5 text-sm mb-5 hover:underline" style={{ color: "var(--muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Cerberus Intel&apos;e dön
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Parsel analiz ediliyor…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {a && (
        <>
          {/* Header verdict */}
          <div className="rounded-xl border p-6 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-start gap-5 flex-wrap">
              <ScoreBadge score={a.score} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold" style={{ background: `${mem.color}1a`, color: mem.color }}>
                    <mem.Icon className="w-4 h-4" /> {VERDICT_TR[a.verdict]}
                  </span>
                  {hardFail && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: "rgba(186,26,26,0.1)", color: "var(--danger)" }}>
                      <ShieldAlert className="w-3.5 h-3.5" /> HARD FAIL
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>{a.confidence} güven</span>
                </div>
                <h1 className="text-xl font-bold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
                  {a.county || "?"}, {a.state || "?"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                  {a.address || "Adres yok"}{a.apn ? ` · APN ${a.apn}` : ""}{a.source ? ` · ${a.source}` : ""}
                </p>
                {meta?.live && (
                  <p className="text-[11px] mt-2 inline-flex items-center gap-1" style={{ color: "var(--warn)" }}>
                    <Info className="w-3 h-3" /> Anlık analiz (henüz kalıcı kaydedilmedi — &quot;Tümünü Analiz Et&quot;e bas)
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Valuation */}
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <h2 className="font-bold text-sm mb-3">Değerleme</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Acres" value={a.acres == null ? "—" : String(a.acres)} />
                <Stat label="$/acre (comp)" value={fmtMoney(perAcre)} />
                <Stat label="Comp değer" value={fmtMoney(compValue)} accent />
                <Stat label="Min teklif" value={fmtMoney(minBid)} />
                <Stat label="Kâr marjı" value={a.margin != null ? `${Math.round(a.margin * 100)}%` : "—"} accent />
                <Stat label="İndirim" value={discountPct != null ? `-${discountPct}%` : "—"} />
              </div>
              <p className="text-[11px] mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>
                Temel: <strong style={{ color: "var(--foreground)" }}>{valueBasis === "county_comp" ? "county comp" : valueBasis === "state_comp" ? "state comp" : "comp yok"}</strong>
                {valueConf ? ` · ${valueConf} güven` : ""}. Comp değer = acres × bulk-adjusted $/acre (uydurma değil; comp yoksa boş).
              </p>
            </div>

            {/* Suggested action + narrative */}
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <h2 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" style={{ color: "var(--accent-ink)" }} /> Önerilen Aksiyon
              </h2>
              <p className="text-sm font-semibold mb-3" style={{ color: mem.color }}>{suggestedAction}</p>
              <div className="flex items-center gap-1.5 mb-1.5">
                {narrativeSource === "ai" ? <Brain className="w-3.5 h-3.5" style={{ color: "var(--accent-ink)" }} /> : <Info className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />}
                <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{narrativeSource === "ai" ? "AI anlatım" : "Kural-tabanlı anlatım"}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{a.narrative}</p>
            </div>
          </div>

          {/* Score components */}
          <div className="rounded-xl border p-5 mt-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <h2 className="font-bold text-sm mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4" style={{ color: "var(--accent-ink)" }} /> Skor Bileşenleri
            </h2>
            <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>Toplam {a.score}/100 — her faset ağırlıklı katkı. Tam olarak bu parsel neden bu kararı aldı?</p>
            <div className="space-y-3">
              {a.components.map((c) => {
                const pct = c.max ? Math.min(100, (c.pts / c.max) * 100) : 0;
                return (
                  <div key={c.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{c.label}</span>
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--accent-ink)" }}>{c.pts}/{c.max}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--surface-high)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent-ink)" }} />
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>{c.note}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reasons + Risk flags */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <h2 className="font-bold text-sm mb-3">Gerekçeler</h2>
              <ul className="space-y-2">
                {a.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent-ink)" }} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" style={{ color: "var(--danger)" }} /> Risk / Red-Flag&apos;ler
              </h2>
              {riskFlags.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted)" }}>Belirgin risk bayrağı yok.</p>
              ) : (
                <ul className="space-y-2">
                  {riskFlags.map((f) => {
                    const c = f.level === "critical" ? "var(--danger)" : f.level === "warn" ? "var(--warn)" : "var(--muted)";
                    return (
                      <li key={f.code} className="flex items-start gap-2 text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: c }} />
                        <span>{f.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {dataGaps.length > 0 && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-high)" }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Veri boşlukları</p>
                  <ul className="text-[11px] space-y-0.5" style={{ color: "var(--muted)" }}>
                    {dataGaps.map((d, i) => <li key={i}>· {d}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Link href={`/admin/underwrite?apn=${encodeURIComponent(a.apn || "")}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
              <Brain className="w-4 h-4" /> AI Underwriting&apos;de aç
            </Link>
            <Link href={`/admin/acquisitions?q=${encodeURIComponent(a.apn || a.county || "")}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
              <ExternalLink className="w-4 h-4" /> Acquisitions&apos;da gör
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="font-bold tabular-nums" style={{ color: accent ? "var(--accent-ink)" : "var(--foreground)" }}>{value}</p>
    </div>
  );
}
