"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Rocket, Loader2, AlertCircle, Factory, TrendingUp } from "lucide-react";

// Path-of-Growth Predictor — counties most likely to heat up next 12-18mo.
// GET /api/path-of-growth → composite momentum score.

interface PoGCounty {
  state: string; county: string; momentum: number;
  g1: number | null; g5: number | null; permits: number | null; income: number | null;
  aGrade: number; hasCatalyst: boolean;
  parts: Record<string, number>;
}

const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const fmtMoney = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const PART_LABEL: Record<string, string> = {
  growth1y: "1y nüfus", growth5y: "5y nüfus", permits: "İnşaat izni", catalyst: "Megaproje", dealMomentum: "Deal momentumu", wealth: "Gelir",
};

export default function PathOfGrowthPage() {
  const [rows, setRows] = useState<PoGCounty[]>([]);
  const [meta, setMeta] = useState<{ total: number; hasGrowthData: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/path-of-growth");
        const j = await res.json();
        if (j.error) throw new Error(j.error);
        setRows(j.counties || []);
        setMeta(j.meta || null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const noData = !loading && !error && rows.length === 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Rocket className="w-5 h-5" style={{ color: "var(--accent-ink)" }} /> Path of Growth
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Önümüzdeki 12-18 ayda ısınması en olası county'ler — büyüme + izinler + megaproje + deal momentumundan bileşik skor.
        </p>
      </div>

      {meta && !meta.hasGrowthData && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs mb-4" style={{ background: "rgba(255,180,60,0.08)", color: "var(--warn)" }}>
          <AlertCircle className="w-4 h-4" /> Büyüme/izin kolonları boş (pop_growth_1y, building_permits). Skor şimdilik megaproje + deal momentumu + gelir sinyaline dayanıyor. add_innovation_features.sql çalıştırıp county_demographics'i zenginleştir.
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> County'ler skorlanıyor…</div>}
      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}><AlertCircle className="w-4 h-4" /> {error}</div>}

      {noData && (
        <div className="max-w-xl mx-auto text-center py-16 px-6 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)" }}>
          <Rocket className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent-ink)" }} />
          <p className="text-sm font-semibold mb-1">County verisi henüz yüklenmedi</p>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Path of Growth, <code className="font-mono">county_demographics</code> tablosuna dayanır ve bu tablo şu an boş.
            Census zenginleştirmesini çalıştırınca momentum sıralaması burada görünür.
          </p>
          <div className="text-left rounded-lg p-3 font-mono text-[11px] leading-relaxed" style={{ background: "var(--surface-low)", color: "var(--foreground)" }}>
            <p style={{ color: "var(--muted)" }}># 1) Supabase&apos;de tabloyu oluştur</p>
            <p>scraper/sql/county_demographics.sql</p>
            <p className="mt-2" style={{ color: "var(--muted)" }}># 2) veriyi derle</p>
            <p>node scraper/build-county-demographics.js</p>
            <p className="mt-2" style={{ color: "var(--muted)" }}># 3) Supabase&apos;e yükle</p>
            <p>PUSH_SUPABASE=1 node scraper/build-county-demographics.js</p>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "var(--grade-a)" }} />
            <h2 className="font-bold text-sm">Momentum Sıralaması</h2>
            <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>{meta?.total ?? rows.length} county taranan</span>
          </div>
          <div className="max-h-[72vh] overflow-y-auto overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b sticky top-0" style={{ borderColor: "var(--surface-high)", background: "var(--surface)" }}>
                  {["#", "County", "Momentum", "1y", "5y", "İzin", "Gelir", "A-grade", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const key = `${r.state}/${r.county}`;
                  const open = expanded === key;
                  return (
                    <Fragment key={key}>
                      <tr onClick={() => setExpanded(open ? null : key)}
                        className="border-b transition-colors hover:bg-[var(--surface-low)] cursor-pointer" style={{ borderColor: "var(--surface-high)" }}>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold flex items-center gap-1.5">
                            {r.county}, {r.state}
                            {r.hasCatalyst && <Factory className="w-3 h-3" style={{ color: "var(--accent-ink)" }} />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><ScoreBadge score={r.momentum} size={32} /></td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{fmtPct(r.g1)}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{fmtPct(r.g5)}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{r.permits == null ? "—" : r.permits.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(r.income)}</td>
                        <td className="px-4 py-2.5 text-xs font-extrabold tabular-nums" style={{ color: "var(--grade-a)" }}>{r.aGrade}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link onClick={(e) => e.stopPropagation()} href={`/admin/acquisitions?q=${encodeURIComponent(r.county)}`}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-block" style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>Deals →</Link>
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ background: "var(--surface-low)" }}>
                          <td colSpan={9} className="px-6 py-4">
                            <p className="text-[11px] font-bold mb-2">Momentum kırılımı — {r.momentum}/100</p>
                            <div className="space-y-1.5">
                              {Object.entries(r.parts).map(([k, v]) => (
                                <div key={k} className="flex items-center gap-3">
                                  <span className="text-[11px] w-28 shrink-0" style={{ color: "var(--muted)" }}>{PART_LABEL[k] || k}</span>
                                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, v * 4)}%`, background: "var(--accent-ink)" }} />
                                  </div>
                                  <span className="text-[11px] font-mono tabular-nums w-10 text-right" style={{ color: "var(--accent-ink)" }}>+{v}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
