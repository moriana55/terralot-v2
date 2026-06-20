"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import { DataSources, type DataSourceItem } from "@/components/DataSources";
import { TrendingDown, Loader2, AlertCircle, Zap, ArrowRight } from "lucide-react";

// Tax-Deal Arbitrage Radar — ranks tax parcels by discount vs intrinsic value.
// GET /api/arbitrage. Intrinsic = acres × county/state median $/acre, or judgment.

interface Opp {
  id: string; state: string | null; county: string | null; apn: string | null;
  acres: number | null; price: number | null; intrinsic: number; gap: number;
  discountPct: number; flagged: boolean; basis: "county_comp" | "state_comp";
  confidence: "high" | "medium" | "low"; ppa: number;
  finalScore: number | null; source: string | null; saleDate: string | null;
  ownerName: string | null; rawUrl: string | null;
}
interface Summary {
  scanned: number; scoreable: number; opportunities: number; flagged: number;
  skippedNoPrice: number; skippedNoAcreage: number; skippedNoComps: number;
  totalGap: number; avgDiscount: number; benchmarkAvailable: boolean; countyComps: number;
}

const fmtMoney = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const BASIS_LABEL: Record<string, string> = { county_comp: "county comp", state_comp: "state $/acre" };

export default function ArbitragePage() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minGap, setMinGap] = useState(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/arbitrage?minGap=${minGap}`);
        const j = await res.json();
        if (j.error) throw new Error(j.error);
        setOpps(j.opportunities || []);
        setSummary(j.summary || null);
        setDataSources(j.dataSources || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [minGap]);

  const noData = !loading && !error && opps.length === 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" style={{ color: "var(--grade-a)" }} /> Arbitrage Radar
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Tax parselleri intrinsic değer vs min-teklif indirimine göre sıralar — en büyük değer açıkları üstte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>Min indirim</span>
          <select value={minGap} onChange={(e) => setMinGap(Number(e.target.value))}
            className="bg-[var(--surface)] border rounded-lg px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--outline)" }}>
            {[0, 20, 30, 50, 70].map((g) => <option key={g} value={g}>{g}%+</option>)}
          </select>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Taranan kayıt", value: summary.scanned.toLocaleString(), color: "#8ed1df" },
            { label: "Arbitraj fırsatı", value: summary.opportunities.toLocaleString(), color: "#50dc8c" },
            { label: "Toplam değer açığı", value: fmtMoney(summary.totalGap), color: "#ffb43c" },
            { label: "Ort. indirim", value: `${summary.avgDiscount}%`, color: "#5aa9ff" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <p className="text-2xl font-extrabold font-mono" style={{ color: c.color }}>{c.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 rounded-lg text-[11px] mb-4" style={{ background: "var(--surface-low)", color: "var(--muted)" }}>
          <span><b style={{ color: "var(--foreground)" }}>{summary.scoreable.toLocaleString()}</b> / {summary.scanned.toLocaleString()} parsel değerlenebildi</span>
          <span>· {summary.skippedNoAcreage.toLocaleString()} parselde acre verisi yok</span>
          <span>· {summary.skippedNoComps.toLocaleString()} parselde comp $/acre yok</span>
          {summary.flagged > 0 && <span style={{ color: "var(--warn)" }}>· {summary.flagged.toLocaleString()} "doğrulanmalı" (şüpheli yüksek indirim)</span>}
        </div>
      )}

      {summary && !summary.benchmarkAvailable && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs mb-4" style={{ background: "rgba(255,180,60,0.08)", color: "var(--warn)" }}>
          <AlertCircle className="w-4 h-4" /> Piyasa $/acre benchmark'ı çok zayıf (competitor_listings neredeyse boş) — rakip scraper'ı çalıştırılmalı.
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Parseller taranıyor…</div>}
      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}><AlertCircle className="w-4 h-4" /> {error}</div>}

      {noData && (
        <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
          <p className="text-sm font-medium mb-1">Bu eşikte arbitraj fırsatı yok</p>
          <p className="text-xs">Min indirimi düşür veya tax_delinquent_properties'i doldur.</p>
        </div>
      )}

      {!loading && opps.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <div className="max-h-[72vh] overflow-y-auto overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead>
                <tr className="border-b sticky top-0" style={{ borderColor: "var(--surface-high)", background: "var(--surface)" }}>
                  {["#", "County", "Skor", "Acres", "Min Teklif", "Intrinsic Değer", "Değer Açığı", "İndirim", "Kaynak", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opps.map((o, i) => (
                  <tr key={o.id} className="border-b transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{o.county || "?"}, {o.state || "?"}</span>
                      {o.apn && <span className="block text-[10px] font-mono" style={{ color: "var(--muted)" }}>{o.apn}</span>}
                    </td>
                    <td className="px-4 py-2.5"><ScoreBadge score={o.finalScore} size={30} /></td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{o.acres ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(o.price)}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums font-semibold">{fmtMoney(o.intrinsic)}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums font-extrabold" style={{ color: "var(--grade-a)" }}>+{fmtMoney(o.gap)}</td>
                    <td className="px-4 py-2.5">
                      {o.flagged ? (
                        <span title="Tahmini değer belirsiz — min teklif eksik veri olabilir, manuel doğrulayın" className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "rgba(255,180,60,0.14)", color: "var(--warn)" }}>
                          <AlertCircle className="w-3 h-3" /> %{o.discountPct}+ · doğrula
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-full" style={{ background: "rgba(80,220,140,0.12)", color: "var(--grade-a)" }}>
                          <Zap className="w-3 h-3" /> %{o.discountPct}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[10px]" style={{ color: "var(--muted)" }}>{BASIS_LABEL[o.basis]}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/underwrite`} className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1"
                        style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>Underwrite <ArrowRight className="w-3 h-3" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Veri Kaynakları — bu taramanın dayandığı gerçek kaynaklar (şeffaflık) */}
      {!loading && dataSources.length > 0 && (
        <div className="mt-6">
          <DataSources
            items={dataSources}
            note="Her intrinsic değer = gerçek parsel acreage'ı × gerçek piyasa $/acre medyanı. Back-taxes/judgment land değeri sayılmaz; comp veya acreage olmayan parseller atlanır."
          />
        </div>
      )}
    </div>
  );
}
