"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, Play, CheckCircle2, Eye, XCircle, ShieldAlert,
  Database, Cpu, Layers, TrendingUp, Radio, Brain, RefreshCw, ArrowRight,
} from "lucide-react";
import { ScoreBadge } from "@/components/ScoreBadge";
import { CerberusLogo } from "@/components/DealHoundLogo";

// ─────────────────────────────────────────────────────────────────────────────
// CERBERUS INTEL CONSOLE
//
// The ops cockpit for the per-lead auto-analysis engine. Shows the FUNNEL
// (captured → analyzed → pending), the AL/BEKLE/GEÇ breakdown, top opportunities,
// recent red-flags, per-source coverage, and a "Tümünü Analiz Et" trigger that
// fires the batch analyzer (POST /api/admin/cerberus/analyze). Everything is live
// from /api/admin/cerberus/intel — honest empty/needs-wiring states throughout.
// ─────────────────────────────────────────────────────────────────────────────

type Verdict = "BUY" | "WATCH" | "PASS";
const VERDICT_TR: Record<Verdict, string> = { BUY: "AL", WATCH: "BEKLE", PASS: "GEÇ" };
const VERDICT_META: Record<Verdict, { color: string; Icon: typeof CheckCircle2 }> = {
  BUY: { color: "var(--grade-a)", Icon: CheckCircle2 },
  WATCH: { color: "var(--warn)", Icon: Eye },
  PASS: { color: "var(--danger)", Icon: XCircle },
};

interface Intel {
  tableReady: boolean;
  captured: number;
  analyzed: number;
  pending: number;
  verdicts: Record<Verdict, number>;
  hardFails?: number;
  topOpportunities: {
    parcel_key: string; apn: string | null; state: string | null; county: string | null;
    score: number; verdict: Verdict; margin: number | null; comp_value: number | null;
    min_bid: number | null; suggested_action: string | null;
  }[];
  recentFlags: { code: string; level: string; label: string; count: number }[];
  bySource: { source: string; total: number; BUY: number; WATCH: number; PASS: number }[];
  message?: string;
}

const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);

export default function CerberusIntelPage() {
  const [intel, setIntel] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/cerberus/intel", { cache: "no-store" });
      if (!r.ok) throw new Error(`Intel yüklenemedi (${r.status})`);
      setIntel(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Intel yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAll = useCallback(async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const r = await fetch("/api/admin/cerberus/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 500 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRunMsg(j.message || j.note || `Analiz başarısız (${r.status})`);
      } else if (j.analyzed === 0) {
        setRunMsg(j.message || "Analiz edilecek yeni lead yok (backlog boş).");
      } else {
        const vc = j.verdictCounts || {};
        setRunMsg(
          `${j.analyzed} parsel analiz edildi → AL ${vc.BUY ?? 0} · BEKLE ${vc.WATCH ?? 0} · GEÇ ${vc.PASS ?? 0}` +
          (j.aiEnriched ? ` · ${j.aiEnriched} AI anlatım` : "") +
          (j.remainingBacklog ? ` · ${j.remainingBacklog} kaldı (tekrar çalıştır)` : "")
        );
      }
      await load();
    } catch {
      setRunMsg("Tetiklenemedi — endpoint'e ulaşılamadı.");
    } finally {
      setRunning(false);
    }
  }, [load]);

  const funnel = useMemo(() => {
    if (!intel) return null;
    const total = intel.captured || 0;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    const av = intel.analyzed || 0;
    const vpct = (n: number) => (av ? Math.round((n / av) * 100) : 0);
    return { total, pct, av, vpct };
  }, [intel]);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-xl p-2" style={{ background: "var(--primary)" }}>
            <CerberusLogo size={30} />
          </span>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">Cerberus Intel</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Her parseli tek tek analiz eden istihbarat motoru — yakala, analiz et, en iyi fırsatı yüzeye çıkar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Yenile
          </button>
          <button onClick={runAll} disabled={running || !intel?.tableReady}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
            style={{ background: "var(--primary)", color: "#fff" }}
            title={!intel?.tableReady ? "Önce migration'ı uygula" : "Backlog'u analiz et"}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Tümünü Analiz Et
          </button>
        </div>
      </div>

      {runMsg && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm mb-5"
          style={{ background: "var(--surface-low)", color: "var(--foreground)", border: "1px solid var(--outline)" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--grade-a)" }} /> {runMsg}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Intel yükleniyor…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Migration not applied */}
      {intel && !intel.tableReady && (
        <div className="max-w-2xl mx-auto text-center py-14 px-6 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)" }}>
          <Database className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent-ink)" }} />
          <p className="text-sm font-semibold mb-1">Analiz tablosu henüz yok</p>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Cerberus, sonuçları <code className="font-mono">lead_analyses</code> tablosuna yazar. Bu tabloyu oluşturmak için migration&apos;ı uygula:
          </p>
          <div className="text-left rounded-lg p-3 font-mono text-[11px] leading-relaxed" style={{ background: "var(--surface-low)", color: "var(--foreground)" }}>
            <p style={{ color: "var(--muted)" }}># Supabase SQL editöründe çalıştır</p>
            <p>CERBERUS_ANALYSES_SETUP.sql</p>
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
            Yakalanan lead sayısı: <strong style={{ color: "var(--foreground)" }}>{intel.captured.toLocaleString()}</strong> · analize hazır.
          </p>
        </div>
      )}

      {intel && intel.tableReady && funnel && (
        <>
          {/* FUNNEL */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <FunnelCard Icon={Database} label="Yakalanan" value={intel.captured} sub="tüm leadler" tone="var(--accent-ink)" />
            <FunnelCard Icon={Cpu} label="Analiz Edilen" value={intel.analyzed} sub={`%${funnel.total ? Math.round((intel.analyzed / funnel.total) * 100) : 0} kapsama`} tone="var(--primary)" />
            <FunnelCard Icon={Layers} label="Kuyrukta" value={intel.pending} sub="henüz analiz edilmedi" tone="var(--warn)" />
            <FunnelCard Icon={ShieldAlert} label="Hard-Fail" value={intel.hardFails ?? 0} sub="kritik risk kapanı" tone="var(--danger)" />
          </div>

          {/* coverage bar */}
          <div className="rounded-xl border p-4 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Analiz kapsaması</span>
              <span className="text-xs font-mono tabular-nums" style={{ color: "var(--accent-ink)" }}>
                {intel.analyzed.toLocaleString()} / {intel.captured.toLocaleString()}
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${funnel.total ? Math.min(100, (intel.analyzed / funnel.total) * 100) : 0}%`, background: "var(--primary)" }} />
            </div>
            {intel.pending > 0 && (
              <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                {intel.pending.toLocaleString()} parsel kuyrukta — <button onClick={runAll} disabled={running} className="underline font-semibold" style={{ color: "var(--accent-ink)" }}>Tümünü Analiz Et</button>&apos;e bas.
              </p>
            )}
          </div>

          {/* VERDICT BREAKDOWN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {(["BUY", "WATCH", "PASS"] as Verdict[]).map((v) => {
              const { color, Icon } = VERDICT_META[v];
              const n = intel.verdicts[v] || 0;
              const pct = funnel.av ? Math.round((n / funnel.av) * 100) : 0;
              return (
                <div key={v} className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5" style={{ color }} />
                    <span className="font-bold text-sm" style={{ color }}>{VERDICT_TR[v]}</span>
                    <span className="ml-auto text-2xl font-extrabold tabular-nums">{n.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>analiz edilenlerin %{pct}&apos;i</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* TOP OPPORTUNITIES */}
            <div className="lg:col-span-2 rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--grade-a)" }} />
                <h2 className="font-bold text-sm">En İyi Fırsatlar</h2>
                <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>skora göre azalan</span>
              </div>
              {intel.topOpportunities.length === 0 ? (
                <p className="text-center text-sm py-12" style={{ color: "var(--muted)" }}>Henüz analiz yok — &quot;Tümünü Analiz Et&quot;e bas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                        {["Skor", "Karar", "County", "Marj", "Comp", "Min Teklif", ""].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {intel.topOpportunities.map((o) => {
                        const { color, Icon } = VERDICT_META[o.verdict] || VERDICT_META.PASS;
                        return (
                          <tr key={o.parcel_key} className="border-b hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                            <td className="px-4 py-2.5"><ScoreBadge score={o.score} size={32} /></td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${color}1a`, color }}>
                                <Icon className="w-3.5 h-3.5" /> {VERDICT_TR[o.verdict]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-semibold">{o.county || "?"}, {o.state || "?"}</span>
                              {o.apn && <span className="block text-[10px] font-mono" style={{ color: "var(--muted)" }}>{o.apn}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-bold tabular-nums" style={{ color: o.margin != null ? "var(--accent-ink)" : "var(--muted)" }}>{o.margin != null ? `${Math.round(o.margin * 100)}%` : "—"}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(o.comp_value)}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(o.min_bid)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <Link href={`/admin/cerberus/${encodeURIComponent(o.parcel_key)}`}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                                style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>
                                Analiz <ArrowRight className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RED-FLAGS + SOURCES */}
            <div className="space-y-6">
              <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4" style={{ color: "var(--danger)" }} />
                  <h2 className="font-bold text-sm">Red-Flag&apos;ler</h2>
                </div>
                {intel.recentFlags.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Henüz risk bayrağı yok.</p>
                ) : (
                  <div className="space-y-2">
                    {intel.recentFlags.map((f) => {
                      const c = f.level === "critical" ? "var(--danger)" : f.level === "warn" ? "var(--warn)" : "var(--muted)";
                      return (
                        <div key={f.code} className="flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] leading-snug">{f.label}</p>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: c }}>{f.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
                  <h2 className="font-bold text-sm">Kaynak Kapsaması</h2>
                </div>
                {intel.bySource.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Kaynak verisi yok.</p>
                ) : (
                  <div className="space-y-2.5">
                    {intel.bySource.slice(0, 8).map((src) => (
                      <div key={src.source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold truncate max-w-[150px]" title={src.source}>{src.source}</span>
                          <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--muted)" }}>{src.total}</span>
                        </div>
                        <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                          <div style={{ width: `${(src.BUY / src.total) * 100}%`, background: "var(--grade-a)" }} />
                          <div style={{ width: `${(src.WATCH / src.total) * 100}%`, background: "var(--warn)" }} />
                          <div style={{ width: `${(src.PASS / src.total) * 100}%`, background: "var(--danger)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* honesty footer */}
          <div className="mt-6 rounded-xl border p-4 text-[11px] leading-relaxed" style={{ background: "var(--surface-low)", borderColor: "var(--outline)", color: "var(--muted)" }}>
            <p className="flex items-center gap-1.5 mb-1" style={{ color: "var(--foreground)" }}>
              <Brain className="w-3.5 h-3.5" /> Ne gerçek, ne bağlanmayı bekliyor
            </p>
            <p>
              Skor, marj ve kararlar <strong style={{ color: "var(--foreground)" }}>gerçek</strong> (kural-tabanlı buy-box + competitor_listings medyanları). Comp olmayan pazarlarda karar skor proxy&apos;sine düşer (düşük güven, uydurma sayı yok).
              AI anlatımı <code className="font-mono">OPENAI_API_KEY</code> ile, canlı parcel zenginleştirme <code className="font-mono">REGRID</code>, direct-mail <code className="font-mono">LOB</code> ile devreye girer. Cron için <code className="font-mono">CRON_SECRET</code> + <code className="font-mono">CERBERUS_ANALYSES_SETUP.sql</code> gerekir.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function FunnelCard({ Icon, label, value, sub, tone }: { Icon: typeof Database; label: string; value: number; sub: string; tone: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: tone }} />
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
      <p className="text-3xl font-extrabold tabular-nums" style={{ color: tone }}>{value.toLocaleString()}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}
