"use client";

import { useState } from "react";
import { Clock, Terminal, Play, Loader2, CheckCircle2, Building2, Database } from "lucide-react";
import { DealHoundFleet } from "./DealHoundFleet";
import { UpcomingSales } from "./UpcomingSales";

export default function ScraperPage() {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const runCompetitor = async () => {
    setRunning(true);
    setMsg(null);
    try {
      const r = await fetch("/api/competitor-scraper", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setMsg(j.message || "Rakip taraması başlatıldı. Birkaç dakikada Competitor Intel güncellenir.");
    } catch {
      setMsg("Tetiklenemedi — worker'ı elle çalıştır: cd scraper && node competitor-scraper.js");
    }
    setRunning(false);
  };

  const PIPELINE = [
    { name: "Tax · TX", cmd: "node migrate_to_supabase.js", note: "county vergi-icra → Supabase" },
    { name: "National", cmd: "node socrata-harvest.js", note: "ulusal Socrata açık-veri" },
    { name: "Competitor", cmd: "node competitor-scraper.js", note: "rakip retail $/acre" },
    { name: "Due Diligence", cmd: "node dd-enrich.js", note: "yol / sel / landlocked" },
  ];

  return (
    <div className="p-8 max-w-5xl">
      {/* Cerberus fleet */}
      <DealHoundFleet />

      <UpcomingSales />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule + control */}
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h2 className="font-bold text-sm">Otomatik Çalışma</h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Cerberus her gece <strong style={{ color: "var(--foreground)" }}>06:00</strong>'da otomatik çalışır
            (launchd · <code className="font-mono text-[11px]">com.terralot.sourcing</code>): tüm botlar tarar,
            skorlar ve <code className="font-mono text-[11px]">final_score</code>'a göre sıralar.
          </p>

          <button
            onClick={runCompetitor}
            disabled={running}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Rakip taramasını şimdi çalıştır
          </button>
          {msg && (
            <p className="mt-3 text-xs flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#50dc8c" }} /> {msg}
            </p>
          )}
          <p className="mt-3 text-[11px]" style={{ color: "var(--muted)" }}>
            Tam tarama (Zillow dahil): <code className="font-mono text-[11px]">cd scraper && ./run-all.sh</code>
          </p>
        </div>

        {/* Pipeline reference */}
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h2 className="font-bold text-sm">Pipeline botları</h2>
          </div>
          <div className="space-y-2">
            {PIPELINE.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--surface-low)" }}>
                <Database className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{p.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>{p.note}</p>
                </div>
                <code className="text-[10px] font-mono px-2 py-1 rounded shrink-0" style={{ background: "rgba(0,0,0,0.25)", color: "var(--primary)" }}>{p.cmd}</code>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <Play className="w-3 h-3" /> Sonuçlar <strong style={{ color: "var(--foreground)" }}>Acquisitions</strong> ve <strong style={{ color: "var(--foreground)" }}>Competitor Intel</strong> sayfalarında canlı görünür.
          </p>
        </div>
      </div>
    </div>
  );
}
