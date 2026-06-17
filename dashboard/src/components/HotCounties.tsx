"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Factory, CalendarClock } from "lucide-react";

interface County { state: string; county: string; total: number; aGrade: number; best: number; hasCatalyst: boolean; hasSale: boolean; heat: number; }
interface State { state: string; total: number; aGrade: number; counties: number; catalysts: number; }

export function HotCounties() {
  const [counties, setCounties] = useState<County[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [view, setView] = useState<"county" | "state">("county");

  useEffect(() => {
    fetch("/api/hot-counties").then((r) => r.json()).then((j) => { setCounties(j.counties || []); setStates(j.states || []); }).catch(() => {});
  }, []);

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--surface-high)" }}>
        <Flame className="w-4 h-4" style={{ color: "var(--warn)" }} />
        <h2 className="font-bold text-sm">Sıcak Bölgeler</h2>
        <div className="ml-auto flex gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--outline)" }}>
          {([["county", "County"], ["state", "Eyalet"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
              style={{ background: view === k ? "var(--surface-high)" : "transparent", color: view === k ? "var(--accent-ink)" : "var(--muted)" }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {view === "county" ? counties.map((c, i) => (
          <Link key={c.state + c.county} href={`/admin/acquisitions?q=${encodeURIComponent(c.county)}`} className="flex items-center gap-3 px-5 py-2.5 border-t transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
            <span className="text-xs font-mono w-5 text-center" style={{ color: "var(--muted)" }}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                {c.county}, {c.state}
                {c.hasCatalyst && <Factory className="w-3 h-3" style={{ color: "var(--accent-ink)" }} />}
                {c.hasSale && <CalendarClock className="w-3 h-3" style={{ color: "var(--warn)" }} />}
              </p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>{c.total.toLocaleString()} lead · en iyi skor {c.best}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold tabular-nums" style={{ color: "var(--grade-a)" }}>{c.aGrade}</p>
              <p className="text-[9px]" style={{ color: "var(--muted)" }}>A-grade</p>
            </div>
          </Link>
        )) : states.map((s, i) => (
          <Link key={s.state} href={`/admin/acquisitions`} className="flex items-center gap-3 px-5 py-2.5 border-t transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
            <span className="text-xs font-mono w-5 text-center" style={{ color: "var(--muted)" }}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                {s.state}
                {s.catalysts > 0 && <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: "var(--accent-ink)" }}><Factory className="w-3 h-3" />{s.catalysts}</span>}
              </p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>{s.total.toLocaleString()} lead · {s.counties} county</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold tabular-nums" style={{ color: "var(--grade-a)" }}>{s.aGrade}</p>
              <p className="text-[9px]" style={{ color: "var(--muted)" }}>A-grade</p>
            </div>
          </Link>
        ))}
        {counties.length === 0 && <p className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>Yükleniyor…</p>}
      </div>
    </div>
  );
}
