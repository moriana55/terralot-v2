"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, SlidersHorizontal, RotateCcw, Factory, CalendarClock, TrendingUp } from "lucide-react";
import { ScoreBadge } from "@/components/ScoreBadge";

// ─────────────────────────────────────────────────────────────────────────────
// CoStar-style demographic deal screener.
//
// Pulls three Supabase-backed feeds and joins them on "ST/COUNTY":
//   • /api/county-demographics — ACS 5-yr income, median age, population, home value
//   • /api/hot-counties        — A-grade deal count + upcoming-sale / catalyst flags
//   • /api/growth-catalysts    — counties hosting an announced megaproject
//
// COMPOSITE OPPORTUNITY SCORE (0–100), fully explainable:
//   Each facet is min-max normalized to 0–1 across the loaded universe, then
//   weighted. Median age is inverted (younger = more demand). Building-permit
//   growth is proxied by the county's A-grade deal density (more A-grade deals =
//   more active opportunity) since per-county permit data isn't in Supabase yet.
//
//     score = 100 * (
//        0.22 * incomeN        +   // buying power
//        0.20 * popN           +   // market size
//        0.18 * homeValueN     +   // appreciation / wealth signal
//        0.15 * ageInvN        +   // younger = household formation / demand
//        0.15 * dealDensityN   +   // A-grade deal supply (permit-growth proxy)
//        0.10 * catalystBonus      // megaproject + upcoming-sale flags
//     )
//
//   catalystBonus = (hasCatalyst ? 0.7 : 0) + (hasSale ? 0.3 : 0), capped at 1.
//   Facets with no data contribute 0 (their weight is effectively reallocated by
//   the normalization, so partial-data counties still rank sensibly).
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  income: 0.22,
  pop: 0.20,
  homeValue: 0.18,
  ageInv: 0.15,
  dealDensity: 0.15,
  catalyst: 0.10,
} as const;

interface DemoCounty {
  state: string; county: string;
  income: number | null; medianAge: number | null;
  population: number | null; homeValue: number | null;
}
interface HotCounty {
  state: string; county: string; total: number; aGrade: number; best: number;
  hasCatalyst: boolean; hasSale: boolean; heat: number;
}

interface Row {
  state: string; county: string;
  income: number | null; medianAge: number | null;
  population: number | null; homeValue: number | null;
  aGrade: number; total: number; best: number;
  hasCatalyst: boolean; hasSale: boolean;
  score: number;
  parts: { income: number; pop: number; homeValue: number; ageInv: number; dealDensity: number; catalyst: number };
}

const norm = (v: number | null, min: number, max: number) =>
  v == null || max <= min ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)));

const fmtMoney = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const fmtNum = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString());

// ── Range filter primitive ───────────────────────────────────────────────────
type Range = { min: number; max: number };

function RangeFilter({
  label, suffix, bounds, value, onChange, step = 1,
}: {
  label: string; suffix?: string; bounds: Range; value: Range;
  onChange: (r: Range) => void; step?: number;
}) {
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{label}</span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--accent-ink)" }}>
          {fmt(value.min)}{suffix} – {fmt(value.max)}{suffix}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={bounds.min} max={bounds.max} step={step} value={value.min}
          onChange={(e) => onChange({ ...value, min: Math.min(+e.target.value, value.max) })}
          className="flex-1 accent-[var(--accent-ink)]"
        />
        <input
          type="range" min={bounds.min} max={bounds.max} step={step} value={value.max}
          onChange={(e) => onChange({ ...value, max: Math.max(+e.target.value, value.min) })}
          className="flex-1 accent-[var(--accent-ink)]"
        />
      </div>
    </div>
  );
}

export default function DealScreenerPage() {
  const [demos, setDemos] = useState<DemoCounty[]>([]);
  const [hot, setHot] = useState<HotCounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // active filter ranges (initialized after data bounds are known)
  const [filters, setFilters] = useState<Record<string, Range> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dRes, hRes] = await Promise.all([
          fetch("/api/county-demographics"),
          fetch("/api/hot-counties"),
        ]);
        const dJson = await dRes.json().catch(() => ({}));
        const hJson = await hRes.json().catch(() => ({}));
        setDemos(dJson.counties || []);
        setHot(hJson.counties || []);
      } catch (e: any) {
        setError(e?.message || "Veri yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // join demographics + hot-county signals on "ST/COUNTY"
  const joined = useMemo(() => {
    const hotMap = new Map<string, HotCounty>();
    for (const h of hot) hotMap.set(`${h.state}/${h.county.toUpperCase()}`, h);
    return demos.map((d) => {
      const h = hotMap.get(`${d.state}/${d.county.toUpperCase()}`);
      return {
        ...d,
        aGrade: h?.aGrade ?? 0,
        total: h?.total ?? 0,
        best: h?.best ?? 0,
        hasCatalyst: h?.hasCatalyst ?? false,
        hasSale: h?.hasSale ?? false,
      };
    });
  }, [demos, hot]);

  // bounds across the loaded universe (used for normalization + slider ranges)
  const bounds = useMemo(() => {
    const b = {
      population: { min: Infinity, max: -Infinity },
      income: { min: Infinity, max: -Infinity },
      medianAge: { min: Infinity, max: -Infinity },
      homeValue: { min: Infinity, max: -Infinity },
      dealDensity: { min: 0, max: 0 },
    };
    let maxDensity = 0;
    for (const r of joined) {
      if (r.population != null) { b.population.min = Math.min(b.population.min, r.population); b.population.max = Math.max(b.population.max, r.population); }
      if (r.income != null) { b.income.min = Math.min(b.income.min, r.income); b.income.max = Math.max(b.income.max, r.income); }
      if (r.medianAge != null) { b.medianAge.min = Math.min(b.medianAge.min, r.medianAge); b.medianAge.max = Math.max(b.medianAge.max, r.medianAge); }
      if (r.homeValue != null) { b.homeValue.min = Math.min(b.homeValue.min, r.homeValue); b.homeValue.max = Math.max(b.homeValue.max, r.homeValue); }
      maxDensity = Math.max(maxDensity, r.aGrade);
    }
    b.dealDensity.max = maxDensity;
    // guard against Infinity when no data
    for (const k of Object.keys(b) as (keyof typeof b)[]) {
      if (!isFinite(b[k].min)) b[k].min = 0;
      if (!isFinite(b[k].max)) b[k].max = 0;
    }
    return b;
  }, [joined]);

  // initialize filters once bounds are real
  useEffect(() => {
    if (filters || joined.length === 0) return;
    setFilters({
      population: { ...bounds.population },
      income: { ...bounds.income },
      medianAge: { ...bounds.medianAge },
      homeValue: { ...bounds.homeValue },
      dealDensity: { ...bounds.dealDensity },
    });
  }, [bounds, joined.length, filters]);

  const resetFilters = () => setFilters({
    population: { ...bounds.population },
    income: { ...bounds.income },
    medianAge: { ...bounds.medianAge },
    homeValue: { ...bounds.homeValue },
    dealDensity: { ...bounds.dealDensity },
  });

  // score + filter + rank
  const rows: Row[] = useMemo(() => {
    if (!filters) return [];
    const out: Row[] = joined
      .filter((r) => {
        const pass = (v: number | null, f: Range) => v == null || (v >= f.min && v <= f.max);
        return (
          pass(r.population, filters.population) &&
          pass(r.income, filters.income) &&
          pass(r.medianAge, filters.medianAge) &&
          pass(r.homeValue, filters.homeValue) &&
          r.aGrade >= filters.dealDensity.min && r.aGrade <= filters.dealDensity.max
        );
      })
      .map((r) => {
        const incomeN = norm(r.income, bounds.income.min, bounds.income.max);
        const popN = norm(r.population, bounds.population.min, bounds.population.max);
        const homeValueN = norm(r.homeValue, bounds.homeValue.min, bounds.homeValue.max);
        // inverted age: younger -> closer to 1
        const ageN = norm(r.medianAge, bounds.medianAge.min, bounds.medianAge.max);
        const ageInvN = r.medianAge == null ? 0 : 1 - ageN;
        const dealDensityN = norm(r.aGrade, bounds.dealDensity.min, bounds.dealDensity.max);
        const catalystBonus = Math.min(1, (r.hasCatalyst ? 0.7 : 0) + (r.hasSale ? 0.3 : 0));

        const parts = {
          income: WEIGHTS.income * incomeN,
          pop: WEIGHTS.pop * popN,
          homeValue: WEIGHTS.homeValue * homeValueN,
          ageInv: WEIGHTS.ageInv * ageInvN,
          dealDensity: WEIGHTS.dealDensity * dealDensityN,
          catalyst: WEIGHTS.catalyst * catalystBonus,
        };
        const score = Math.round(100 * (parts.income + parts.pop + parts.homeValue + parts.ageInv + parts.dealDensity + parts.catalyst));
        return { ...r, score, parts };
      })
      .sort((a, b) => b.score - a.score);
    return out;
  }, [joined, filters, bounds]);

  const noData = !loading && !error && joined.length === 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Deal Screener
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            CoStar tarzı çok-faktörlü county taraması — demografi + büyüme sinyalleri → açıklanabilir fırsat skoru
          </p>
        </div>
        {filters && (
          <button onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
            <RotateCcw className="w-4 h-4" /> Filtreleri sıfırla
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> County verileri yükleniyor…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Empty */}
      {noData && (
        <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
          <p className="text-sm font-medium mb-1">Demografi verisi yok</p>
          <p className="text-xs">scraper/build-county-demographics.js çalıştır ve county_demographics tablosunu doldur (PUSH_SUPABASE=1)</p>
        </div>
      )}

      {!loading && !error && joined.length > 0 && filters && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Facet panel */}
          <aside className="rounded-xl border p-5 space-y-5 h-fit" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <h2 className="font-bold text-sm">Filtreler</h2>
              <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--muted)" }}>{rows.length} county</span>
            </div>
            <RangeFilter label="Nüfus" bounds={bounds.population} value={filters.population} step={1000}
              onChange={(r) => setFilters((p) => ({ ...p!, population: r }))} />
            <RangeFilter label="Medyan Hane Geliri" suffix="$" bounds={bounds.income} value={filters.income} step={1000}
              onChange={(r) => setFilters((p) => ({ ...p!, income: r }))} />
            <RangeFilter label="Medyan Yaş" suffix="y" bounds={bounds.medianAge} value={filters.medianAge}
              onChange={(r) => setFilters((p) => ({ ...p!, medianAge: r }))} />
            <RangeFilter label="Medyan Ev Değeri" suffix="$" bounds={bounds.homeValue} value={filters.homeValue} step={5000}
              onChange={(r) => setFilters((p) => ({ ...p!, homeValue: r }))} />
            <RangeFilter label="A-grade Deal Yoğunluğu" bounds={bounds.dealDensity} value={filters.dealDensity}
              onChange={(r) => setFilters((p) => ({ ...p!, dealDensity: r }))} />

            <div className="pt-3 border-t text-[10px] leading-relaxed" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>
              <p className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Fırsat Skoru ağırlıkları</p>
              <p>Gelir 22% · Nüfus 20% · Ev değeri 18% · Genç nüfus 15% · Deal yoğunluğu 15% · Katalizör 10%</p>
              <p className="mt-1">Her faktör yüklü county evreninde 0–1 normalize edilir; yaş ters çevrilir.</p>
            </div>
          </aside>

          {/* Ranked list */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "var(--grade-a)" }} />
              <h2 className="font-bold text-sm">Sıralı Fırsatlar</h2>
              <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>fırsat skoruna göre azalan</span>
            </div>

            {rows.length === 0 ? (
              <p className="text-center text-sm py-16" style={{ color: "var(--muted)" }}>Bu filtrelerle eşleşen county yok.</p>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead>
                    <tr className="border-b sticky top-0" style={{ borderColor: "var(--surface-high)", background: "var(--surface)" }}>
                      {["#", "County", "Skor", "Nüfus", "Gelir", "Medyan Yaş", "Ev Değeri", "A-grade", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => {
                      const key = `${r.state}/${r.county}`;
                      const open = expanded === key;
                      return (
                        <FragmentRow
                          key={key} r={r} i={i} open={open}
                          onToggle={() => setExpanded(open ? null : key)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// row + expandable score breakdown
function FragmentRow({ r, i, open, onToggle }: { r: Row; i: number; open: boolean; onToggle: () => void }) {
  const breakdown: { label: string; v: number }[] = [
    { label: "Gelir", v: r.parts.income },
    { label: "Nüfus", v: r.parts.pop },
    { label: "Ev Değeri", v: r.parts.homeValue },
    { label: "Genç Nüfus", v: r.parts.ageInv },
    { label: "Deal Yoğunluğu", v: r.parts.dealDensity },
    { label: "Katalizör", v: r.parts.catalyst },
  ];
  return (
    <>
      <tr className="border-b transition-colors hover:bg-[var(--surface-low)] cursor-pointer" style={{ borderColor: "var(--surface-high)" }} onClick={onToggle}>
        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>{i + 1}</td>
        <td className="px-4 py-2.5">
          <span className="font-semibold flex items-center gap-1.5">
            {r.county}, {r.state}
            {r.hasCatalyst && <Factory className="w-3 h-3" style={{ color: "var(--accent-ink)" }} />}
            {r.hasSale && <CalendarClock className="w-3 h-3" style={{ color: "var(--warn)" }} />}
          </span>
        </td>
        <td className="px-4 py-2.5"><ScoreBadge score={r.score} size={34} /></td>
        <td className="px-4 py-2.5 text-xs tabular-nums">{fmtNum(r.population)}</td>
        <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(r.income)}</td>
        <td className="px-4 py-2.5 text-xs tabular-nums">{r.medianAge == null ? "—" : r.medianAge.toFixed(1)}</td>
        <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(r.homeValue)}</td>
        <td className="px-4 py-2.5 text-xs font-extrabold tabular-nums" style={{ color: "var(--grade-a)" }}>{r.aGrade}</td>
        <td className="px-4 py-2.5 text-right">
          <Link onClick={(e) => e.stopPropagation()} href={`/admin/acquisitions?q=${encodeURIComponent(r.county)}`}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-block"
            style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>Deals →</Link>
        </td>
      </tr>
      {open && (
        <tr style={{ background: "var(--surface-low)" }}>
          <td colSpan={9} className="px-6 py-4">
            <p className="text-[11px] font-bold mb-2" style={{ color: "var(--foreground)" }}>
              Skor dağılımı — toplam {r.score}/100 (ağırlıklı, normalize katkılar)
            </p>
            <div className="space-y-1.5">
              {breakdown.map((b) => {
                const pts = Math.round(b.v * 100);
                return (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="text-[11px] w-28 shrink-0" style={{ color: "var(--muted)" }}>{b.label}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pts)}%`, background: "var(--accent-ink)" }} />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums w-10 text-right" style={{ color: "var(--accent-ink)" }}>+{pts}</span>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
