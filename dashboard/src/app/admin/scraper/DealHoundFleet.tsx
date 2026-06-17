"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gavel, Globe2, Home, Building2, ShieldCheck, CalendarClock } from "lucide-react";
import { CerberusLogo } from "@/components/DealHoundLogo";

interface Bot { name: string; role: string; count: number; states: number; last: string | null; kind: string; }
interface Fleet { brand: string; tagline: string; totalLeads: number; lastRun: string | null; bots: Bot[]; }

function ago(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || isNaN(ms)) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}dk önce`;
  if (h < 48) return `${Math.round(h)}sa önce`;
  return `${Math.round(h / 24)}g önce`;
}
// fresh < 30h (nightly cron healthy), stale < 80h, else cold
function freshness(iso: string | null): string {
  if (!iso) return "#6b7280";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 30) return "#62e39a";
  if (h < 80) return "#ffc24d";
  return "#ff7a7a";
}

const META: Record<string, { Icon: typeof Gavel; color: string }> = {
  tax: { Icon: Gavel, color: "#8ed1df" },
  national: { Icon: Globe2, color: "#a882ff" },
  retail: { Icon: Home, color: "#ffb43c" },
  comp: { Icon: Building2, color: "#50dc8c" },
  calendar: { Icon: CalendarClock, color: "#ffc24d" },
  dd: { Icon: ShieldCheck, color: "#ff7a7a" },
};

// Explicit light-on-dark palette so it reads on the light dashboard.
const TXT = "#f4f7fb";
const DIM = "rgba(244,247,251,0.58)";

// Derive an honest live/stale/cold status from the freshest scrape timestamp,
// instead of a hardcoded "always green" badge.
function fleetStatus(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: "veri yok", color: "#6b7280" };
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (isNaN(h)) return { label: "veri yok", color: "#6b7280" };
  if (h < 30) return { label: "canlı", color: "#62e39a" };
  if (h < 80) return { label: "gecikmeli", color: "#ffc24d" };
  return { label: "durağan", color: "#ff7a7a" };
}

export function DealHoundFleet() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    fetch("/api/scraper-fleet")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => { if (alive) { setFleet(d); setState("ready"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, []);

  const status = fleetStatus(fleet?.lastRun ?? null);

  return (
    <div
      className="relative rounded-2xl mb-7 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #102a55 0%, #0a1a3f 60%)",
        border: "1px solid rgba(142,209,223,0.22)",
        boxShadow: "0 10px 34px rgba(8,18,42,0.45)",
      }}
    >
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #8ed1df, #a882ff, transparent)" }} />

      <div className="px-6 pt-5 pb-5">
        {/* header */}
        <div className="flex items-center gap-3.5">
          <div className="shrink-0 rounded-xl p-1.5" style={{ background: "rgba(142,209,223,0.10)", border: "1px solid rgba(142,209,223,0.18)" }}>
            <CerberusLogo size={40} />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-[0.2em] uppercase" style={{ color: TXT }}>Cerberus</h2>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: `${status.color}28`, color: status.color }}>
              <span className="w-1 h-1 rounded-full" style={{ background: status.color, boxShadow: `0 0 6px ${status.color}` }} /> {state === "error" ? "bağlanamadı" : status.label}
            </span>
            {fleet?.lastRun && (
              <span className="text-[10px] hidden sm:inline" style={{ color: DIM }}>· son tarama {ago(fleet.lastRun)}</span>
            )}
          </div>
          <div className="text-right shrink-0 pl-4" style={{ borderLeft: "1px solid rgba(255,255,255,0.10)" }}>
            <p className="text-[26px] font-extrabold font-mono leading-none tracking-tight" style={{ color: TXT }}>
              {(fleet?.totalLeads ?? 0).toLocaleString()}
            </p>
            <p className="text-[9px] uppercase tracking-widest mt-1" style={{ color: DIM }}>toplam lead</p>
          </div>
        </div>

        {/* bot strip */}
        {state === "error" ? (
          <div className="mt-5 rounded-xl px-4 py-6 text-center text-[11px]" style={{ background: "rgba(255,122,122,0.08)", border: "1px solid rgba(255,122,122,0.18)", color: "#ffb0b0" }}>
            Fleet durumu yüklenemedi — Supabase bağlantısını kontrol edin.
          </div>
        ) : state === "loading" ? (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 animate-pulse" style={{ borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
                <div className="h-3 w-16 rounded mb-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="h-5 w-10 rounded mb-2" style={{ background: "rgba(255,255,255,0.10)" }} />
                <div className="h-2.5 w-20 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
          </div>
        ) : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(fleet?.bots || []).map((b, i) => {
            const { Icon, color } = META[b.kind] || META.tax;
            const active = b.count > 0;
            const href = b.kind === "tax" ? "/admin/acquisitions?src=tax" : b.kind === "national" ? "/admin/acquisitions?src=national" : b.kind === "retail" ? "/admin/acquisitions?src=zillow" : b.kind === "comp" ? "/admin/competitor-analysis" : b.kind === "calendar" ? "/admin/deal-map" : "/admin/acquisitions";
            return (
              <Link key={b.name} href={href} className="relative px-4 py-3.5 transition-colors hover:bg-white/[0.04]" style={{ borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-[11px] font-bold tracking-tight" style={{ color: TXT }}>{b.name}</span>
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" title={b.last ? `son tarama ${ago(b.last)}` : "tarama yok"} style={{ background: b.kind === "dd" ? (active ? color : "rgba(255,255,255,0.2)") : freshness(b.last), boxShadow: b.last && b.kind !== "dd" ? `0 0 6px ${freshness(b.last)}` : "none" }} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold font-mono leading-none" style={{ color: TXT }}>{b.count.toLocaleString()}</span>
                  {b.states > 0 && <span className="text-[10px]" style={{ color: DIM }}>· {b.states} eyalet</span>}
                </div>
                <p className="text-[10px] leading-snug mt-1.5" style={{ color: DIM }}>{b.role}</p>
                {b.last && b.kind !== "dd" && <p className="text-[9px] mt-1" style={{ color: DIM }}>son: {ago(b.last)}</p>}
                {active && <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.6 }} />}
              </Link>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
