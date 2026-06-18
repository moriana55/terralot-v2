"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Gavel,
  Globe2,
  Home,
  Building2,
  ShieldCheck,
  CalendarClock,
  Play,
  Loader2,
  Activity,
  TrendingUp,
  Target,
  RefreshCw,
} from "lucide-react";
import { CerberusLogo } from "@/components/DealHoundLogo";

interface Bot {
  name: string;
  role: string;
  count: number;
  states: number;
  last: string | null;
  fresh24h: number;
  kind: string;
  status: string;
  coverage: string[];
}
interface HistPoint {
  date: string;
  count: number;
}
interface Fleet {
  brand: string;
  tagline: string;
  totalLeads: number;
  leads24h: number;
  successRate: number;
  lastRun: string | null;
  bots: Bot[];
  history: HistPoint[];
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || isNaN(ms)) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}dk önce`;
  if (h < 48) return `${Math.round(h)}sa önce`;
  return `${Math.round(h / 24)}g önce`;
}

// status → semantic color + label. "bağlanamadı" is set by the page on error.
const STATUS_COLOR: Record<string, string> = {
  canlı: "#0f9d58",
  gecikmeli: "#b9770a",
  durağan: "#ba1a1a",
  bağlanamadı: "#6b7280",
  "veri yok": "#6b7280",
};
function statusColor(label: string): string {
  return STATUS_COLOR[label] ?? "#6b7280";
}

const META: Record<string, { Icon: typeof Gavel; color: string }> = {
  tax: { Icon: Gavel, color: "#0e7d97" },
  national: { Icon: Globe2, color: "#3980f4" },
  retail: { Icon: Home, color: "#b9770a" },
  comp: { Icon: Building2, color: "#0f9d58" },
  calendar: { Icon: CalendarClock, color: "#b9770a" },
  dd: { Icon: ShieldCheck, color: "#ba1a1a" },
};

// Which page each bot's leads live on.
function botHref(kind: string): string {
  return kind === "tax"
    ? "/admin/acquisitions?src=tax"
    : kind === "national"
    ? "/admin/acquisitions?src=national"
    : kind === "retail"
    ? "/admin/acquisitions?src=zillow"
    : kind === "comp"
    ? "/admin/competitor-analysis"
    : kind === "calendar"
    ? "/admin/deal-map"
    : "/admin/acquisitions";
}

// Explicit light-on-dark palette for the branded hero header only.
const TXT = "#f4f7fb";
const DIM = "rgba(244,247,251,0.58)";

export function DealHoundFleet() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<{ bot: string; text: string; ok: boolean } | null>(null);

  const load = useCallback((signal?: { alive: boolean }) => {
    fetch("/api/scraper-fleet")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: Fleet) => {
        if (!signal || signal.alive) {
          setFleet(d);
          setState("ready");
        }
      })
      .catch(() => {
        if (!signal || signal.alive) setState("error");
      });
  }, []);

  useEffect(() => {
    const sig = { alive: true };
    load(sig);
    return () => {
      sig.alive = false;
    };
  }, [load]);

  const trigger = async (kind: string) => {
    // DD has no manual trigger; "calendar"/source bots map to scraper scripts.
    const botParam =
      kind === "tax" || kind === "national" || kind === "retail" || kind === "comp" || kind === "calendar"
        ? kind
        : null;
    if (!botParam) return;
    setTriggering(kind);
    setTriggerMsg(null);
    try {
      const r = await fetch("/api/scraper-fleet/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot: botParam }),
      });
      const j = await r.json().catch(() => ({}));
      setTriggerMsg({ bot: kind, text: j.message || (j.ok ? "Tetiklendi." : "Tetiklenemedi."), ok: !!j.ok });
    } catch {
      setTriggerMsg({ bot: kind, text: "Tetiklenemedi — worker'ı elle çalıştır.", ok: false });
    }
    setTriggering(null);
  };

  const heroStatus =
    state === "error"
      ? { label: "bağlanamadı", color: statusColor("bağlanamadı") }
      : !fleet?.lastRun
      ? { label: "veri yok", color: statusColor("veri yok") }
      : (() => {
          const h = (Date.now() - new Date(fleet.lastRun).getTime()) / 3_600_000;
          if (h < 30) return { label: "canlı", color: statusColor("canlı") };
          if (h < 80) return { label: "gecikmeli", color: statusColor("gecikmeli") };
          return { label: "durağan", color: statusColor("durağan") };
        })();

  const bots = fleet?.bots ?? [];
  const history = fleet?.history ?? [];
  const maxHist = Math.max(1, ...history.map((h) => h.count));

  return (
    <div className="mb-7">
      {/* ── Branded hero header ── */}
      <div
        className="relative rounded-t-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #102a55 0%, #0a1a3f 60%)",
          border: "1px solid rgba(142,209,223,0.22)",
          borderBottom: "none",
        }}
      >
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #8ed1df, #4fb8cf, transparent)" }} />
        <div className="px-6 pt-5 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 rounded-xl p-1.5" style={{ background: "rgba(142,209,223,0.10)", border: "1px solid rgba(142,209,223,0.18)" }}>
              <CerberusLogo size={40} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-[0.2em] uppercase" style={{ color: TXT }}>Cerberus</h2>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: `${heroStatus.color}28`, color: heroStatus.color }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: heroStatus.color, boxShadow: `0 0 6px ${heroStatus.color}` }} /> {heroStatus.label}
                </span>
                {fleet?.lastRun && (
                  <span className="text-[10px] hidden sm:inline" style={{ color: DIM }}>· son tarama {ago(fleet.lastRun)}</span>
                )}
                <button
                  onClick={() => { setState("loading"); load(); }}
                  className="ml-1 p-1 rounded-md transition-colors hover:bg-white/10"
                  style={{ color: DIM }}
                  title="Yenile"
                >
                  <RefreshCw className={`w-3 h-3 ${state === "loading" ? "animate-spin" : ""}`} />
                </button>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: DIM }}>{fleet?.tagline || "Üç başlı bekçi — tüm ABD'yi tarayan deal motoru"}</p>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-5 grid grid-cols-3 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Kpi icon={Target} label="Toplam lead" value={(fleet?.totalLeads ?? 0).toLocaleString()} />
            <Kpi icon={TrendingUp} label="Son 24sa" value={(fleet?.leads24h ?? 0).toLocaleString()} divider />
            <Kpi icon={Activity} label="Başarı oranı" value={`%${fleet?.successRate ?? 0}`} divider />
          </div>
        </div>
      </div>

      {/* ── Cockpit body (light) ── */}
      <div className="rounded-b-2xl border border-t-0 p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {state === "error" ? (
          <div className="rounded-xl px-4 py-8 text-center text-sm" style={{ background: "var(--status-overdue-soft)", color: "var(--danger)" }}>
            Fleet durumu yüklenemedi — Supabase bağlantısını kontrol edin.
            <div>
              <button onClick={() => { setState("loading"); load(); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>
                <RefreshCw className="w-3.5 h-3.5" /> Tekrar dene
              </button>
            </div>
          </div>
        ) : state === "loading" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--surface-high)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Per-bot status cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bots.map((b) => {
                const { Icon, color } = META[b.kind] || META.tax;
                const sc = statusColor(b.status);
                const canTrigger = b.kind !== "dd";
                const isTriggering = triggering === b.kind;
                return (
                  <div key={b.name} className="tl-card p-4 flex flex-col" style={{ boxShadow: "none" }}>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg p-1.5" style={{ background: `${color}1a` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </span>
                      <Link href={botHref(b.kind)} className="font-bold text-sm hover:underline truncate">{b.name}</Link>
                      <span className="tl-pill ml-auto" style={{ background: `${sc}1a`, color: sc }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} /> {b.status}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 mt-3">
                      <span className="text-2xl font-extrabold tl-num leading-none">{b.count.toLocaleString()}</span>
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>lead</span>
                      {b.fresh24h > 0 && (
                        <span className="text-[11px] font-semibold ml-auto" style={{ color: "var(--status-paid)" }}>
                          +{b.fresh24h.toLocaleString()} / 24sa
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] mt-2 leading-snug" style={{ color: "var(--muted)" }}>{b.role}</p>

                    {/* per-source coverage */}
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {b.states > 0 && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>
                          {b.states} eyalet
                        </span>
                      )}
                      {(b.coverage || []).map((c) => (
                        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface-low)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                        son tarama: <strong style={{ color: "var(--foreground)" }}>{ago(b.last)}</strong>
                      </span>
                      {canTrigger && (
                        <button
                          onClick={() => trigger(b.kind)}
                          disabled={isTriggering}
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                          style={{ background: "var(--primary)", color: "#fff" }}
                        >
                          {isTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Çalıştır
                        </button>
                      )}
                    </div>

                    {triggerMsg?.bot === b.kind && (
                      <p className="text-[10px] mt-2 leading-snug" style={{ color: triggerMsg.ok ? "var(--status-paid)" : "var(--muted)" }}>
                        {triggerMsg.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Run-history / activity log */}
            <div className="tl-card mt-4 p-4" style={{ boxShadow: "none" }}>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
                <h3 className="font-bold text-sm">Tarama Geçmişi</h3>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>· son 14 gün · günlük lead hacmi</span>
              </div>
              {history.every((h) => h.count === 0) ? (
                <p className="text-xs py-4 text-center" style={{ color: "var(--muted)" }}>
                  Son 14 günde kayıtlı tarama yok.
                </p>
              ) : (
                <div className="flex items-end gap-1 h-24">
                  {history.map((h) => {
                    const pct = (h.count / maxHist) * 100;
                    const day = new Date(h.date + "T00:00:00");
                    return (
                      <div key={h.date} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${h.date}: ${h.count} lead`}>
                        <span className="text-[8px] tl-num opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--muted)" }}>{h.count}</span>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${Math.max(2, pct)}%`,
                            background: h.count > 0 ? "var(--accent-ink)" : "var(--surface-high)",
                            opacity: h.count > 0 ? 0.85 : 1,
                          }}
                        />
                        <span className="text-[8px] tl-num" style={{ color: "var(--muted)" }}>{day.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, divider }: { icon: typeof Target; label: string; value: string; divider?: boolean }) {
  return (
    <div className="px-4 py-3" style={{ borderLeft: divider ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3" style={{ color: "rgba(142,209,223,0.9)" }} />
        <span className="text-[9px] uppercase tracking-widest" style={{ color: DIM }}>{label}</span>
      </div>
      <p className="text-xl font-extrabold tl-num leading-none" style={{ color: TXT }}>{value}</p>
    </div>
  );
}
