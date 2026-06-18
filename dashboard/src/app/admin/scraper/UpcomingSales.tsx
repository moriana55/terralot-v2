"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, MapPin, ArrowRight, RefreshCw } from "lucide-react";

interface Sale {
  id: string;
  state: string;
  county: string;
  sale_date: string | null;
  sale_type: string | null;
  parcel_list_url: string | null;
  registration_date?: string | null;
}
interface MonthGroup {
  month: string;
  label: string;
  count: number;
  sales: Sale[];
}
interface CalendarResp {
  sales: Sale[];
  months: MonthGroup[];
  total: number;
  lastScraped: string | null;
  error?: string;
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);
}

function fmtDay(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" });
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

export function UpcomingSales({ max }: { max?: number } = {}) {
  const [data, setData] = useState<CalendarResp | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = () => {
    setState("loading");
    fetch("/api/admin/upcoming-sales?view=calendar")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: CalendarResp) => {
        setData(d);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/upcoming-sales?view=calendar")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: CalendarResp) => {
        if (alive) {
          setData(d);
          setState("ready");
        }
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const total = data?.total ?? 0;
  const sourceError = !!data?.error;

  // When `max` is set (compact dashboard widget), cap the visible sales across
  // months while keeping the month grouping intact.
  let months = data?.months ?? [];
  if (max != null && months.length) {
    let remaining = max;
    const capped: MonthGroup[] = [];
    for (const m of months) {
      if (remaining <= 0) break;
      const slice = m.sales.slice(0, remaining);
      capped.push({ ...m, sales: slice });
      remaining -= slice.length;
    }
    months = capped;
  }

  return (
    <div className="tl-card mt-6">
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <CalendarClock className="w-4 h-4" style={{ color: "var(--warn)" }} />
        <h2 className="font-bold text-sm">Yaklaşan Tax-Sale Takvimi</h2>
        <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>
          · ulusal · GovEase
        </span>
        {state === "ready" && total > 0 && (
          <span className="tl-pill ml-2" style={{ background: "var(--status-pending-soft)", color: "var(--status-pending)" }}>
            {total} satış
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {data?.lastScraped && (
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>
              veri {ago(data.lastScraped)}
            </span>
          )}
          <button
            onClick={load}
            disabled={state === "loading"}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ color: "var(--muted)" }}
            title="Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {state === "loading" ? (
        <div className="px-5 py-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-14 h-8 rounded" style={{ background: "var(--surface-high)" }} />
              <div className="flex-1 h-8 rounded" style={{ background: "var(--surface-high)" }} />
            </div>
          ))}
        </div>
      ) : state === "error" ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Takvim yüklenemedi.
          </p>
          <button
            onClick={load}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5"
            style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tekrar dene
          </button>
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-10 text-center">
          <CalendarClock className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--muted)", opacity: 0.4 }} />
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {sourceError ? "Takvim kaynağı bağlı değil" : "Yaklaşan satış bulunamadı"}
          </p>
          <p className="text-xs mt-1.5 max-w-md mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>
            {sourceError ? (
              <>
                <code className="font-mono text-[11px]">upcoming_sales</code> tablosuna erişilemiyor.
                Supabase service-role anahtarını / RLS politikasını kontrol et.
              </>
            ) : (
              <>
                Henüz GovEase taraması veri döndürmedi. Kaynağı bağla:{" "}
                <code className="font-mono text-[11px]">cd scraper &amp;&amp; node govease-harvest.js</code>
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="max-h-[460px] overflow-y-auto">
          {months.map((m) => (
            <div key={m.month}>
              <div
                className="sticky top-0 z-10 flex items-center gap-2 px-5 py-2 border-b backdrop-blur"
                style={{ background: "var(--surface-low)", borderColor: "var(--border)" }}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  {m.label}
                </span>
                <span className="text-[10px]" style={{ color: "var(--muted)", opacity: 0.7 }}>
                  · {m.count} satış
                </span>
              </div>
              {m.sales.map((s) => {
                const d = daysUntil(s.sale_date);
                const soon = d != null && d <= 14;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-5 py-3 border-t transition-colors hover:bg-[var(--surface-low)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="shrink-0 w-16 text-center">
                      <p
                        className="text-sm font-extrabold tabular-nums leading-none"
                        style={{ color: soon ? "var(--danger)" : "var(--foreground)" }}
                      >
                        {d != null ? `${d}g` : "—"}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>
                        kaldı
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--muted)" }} />
                        {s.county}, {s.state}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                        {fmtDay(s.sale_date)} · {s.sale_type || "tax sale"}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {s.parcel_list_url && (
                        <a
                          href={s.parcel_list_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80"
                          style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}
                        >
                          Parsel listesi <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <Link
                        href={`/admin/acquisitions?src=tax&state=${encodeURIComponent(s.state || "")}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80"
                        style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}
                        title="Bu eyaletteki dealleri gör"
                      >
                        Dealler <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
