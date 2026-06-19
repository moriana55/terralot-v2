"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, SlidersHorizontal, RotateCcw, Factory, CalendarClock, TrendingUp, Map as MapIcon, Target, Download, CheckCircle2, Eye, XCircle } from "lucide-react";
import { ScoreBadge, gradeOf } from "@/components/ScoreBadge";
import Dropdown from "@/components/Dropdown";
import { supabase } from "@/lib/supabase";
import { buyBox, dealMargin, VERDICT_TR, type Verdict, type DealSignals } from "@/lib/buy-box";

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
  const [mode, setMode] = useState<"deals" | "counties">("deals");
  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setMode("deals")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={mode === "deals"
            ? { background: "var(--primary)", color: "#fff" }
            : { background: "var(--surface)", border: "1px solid var(--outline)", color: "var(--muted)" }}>
          <Target className="w-4 h-4" /> Deal Buy-Box
        </button>
        <button
          onClick={() => setMode("counties")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={mode === "counties"
            ? { background: "var(--primary)", color: "#fff" }
            : { background: "var(--surface)", border: "1px solid var(--outline)", color: "var(--muted)" }}>
          <MapIcon className="w-4 h-4" /> County Screener
        </button>
      </div>
      {mode === "deals" ? <DealBuyBoxScreener /> : <CountyScreener />}
    </div>
  );
}

function CountyScreener() {
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            County Screener
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

      {/* Empty — county_demographics not populated yet */}
      {noData && (
        <div className="max-w-xl mx-auto text-center py-16 px-6 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)" }}>
          <SlidersHorizontal className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent-ink)" }} />
          <p className="text-sm font-semibold mb-1">Demografi verisi henüz yüklenmedi</p>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Deal Screener, <code className="font-mono">county_demographics</code> tablosuna dayanır ve bu tablo şu an boş.
            Census zenginleştirmesini çalıştırınca county skorları burada görünür.
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

// ─────────────────────────────────────────────────────────────────────────────
// DEAL BUY-BOX SCREENER
//
// Loads real scored leads from tax_delinquent_properties (the same table the
// acquisitions pipeline uses) and runs the shared, pure rule-based buy box
// (lib/buy-box) over each row to produce an AL / BEKLE / GEÇ verdict + profit
// margin. Filter/sort by score, discount, and margin; export the screened set to
// CSV. Comp value (acres × state retail $/acre from /api/market-rates) is joined
// client-side so margin is real, not fabricated — null when inputs are missing.
// ─────────────────────────────────────────────────────────────────────────────

const FULL2_DS: Record<string, string> = {
  Texas: "TX", Florida: "FL", Georgia: "GA", Tennessee: "TN", "North Carolina": "NC",
  "New York": "NY", Arizona: "AZ", "New Mexico": "NM", Colorado: "CO", California: "CA",
  Arkansas: "AR", Nevada: "NV", Kentucky: "KY", Louisiana: "LA", Maryland: "MD",
};
const stAbbr = (s: string | null): string | null =>
  !s ? null : /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : FULL2_DS[s] ?? null;

interface DealRow extends DealSignals {
  id: string;
  state: string | null;
  county: string | null;
  apn: string | null;
  owner_name: string | null;
  property_address: string | null;
  source: string | null;
  sale_date: string | null;
  raw_url: string | null;
}

const VERDICT_META: Record<Verdict, { color: string; Icon: typeof CheckCircle2 }> = {
  BUY: { color: "var(--grade-a)", Icon: CheckCircle2 },
  WATCH: { color: "var(--warn)", Icon: Eye },
  PASS: { color: "var(--danger)", Icon: XCircle },
};

function DealBuyBoxScreener() {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [minScore, setMinScore] = useState(0);
  const [minDiscount, setMinDiscount] = useState(0);
  const [minMargin, setMinMargin] = useState(0); // %
  const [verdictFilter, setVerdictFilter] = useState<"all" | Verdict>("all");
  const [sort, setSort] = useState<"score" | "discount" | "margin" | "savings">("score");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const ratesP = fetch("/api/market-rates")
          .then((r) => r.json())
          .then((j) => {
            const m: Record<string, number> = {};
            (j.rates || []).forEach((r: { state: string; perAcre: number }) => { m[r.state] = r.perAcre; });
            return m;
          })
          .catch(() => ({} as Record<string, number>));

        const dealsP = supabase
          .from("tax_delinquent_properties")
          .select("id,state,county,apn,owner_name,property_address,source,sale_date,raw_url,acres,minimum_bid,judgment_amount,final_score,deal_score,discount_pct,savings,liquidity_score,county_pop_growth,road_access,flood_score")
          // Sadece gerçek tax-lead'ler: ZILLOW (perakende ev/arsa) satırlarını hariç tut
          .not("source", "like", "ZILLOW%")
          .order("final_score", { ascending: false, nullsFirst: false })
          .limit(500);

        const [rateMap, { data, error: dbErr }] = await Promise.all([ratesP, dealsP]);
        if (cancelled) return;
        if (dbErr) throw new Error(dbErr.message);
        setRates(rateMap);
        setRows((data as DealRow[]) || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Deal verisi yüklenemedi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const compValueOf = useMemo(() => (l: DealRow): number | null => {
    if (!l.acres || l.acres <= 0) return null;
    const st = stAbbr(l.state);
    const rate = st ? rates[st] : null;
    return rate ? Math.round(l.acres * rate) : null;
  }, [rates]);

  // score every row with the shared buy box, then filter + sort
  const scored = useMemo(() => {
    return rows.map((l) => {
      const compValue = compValueOf(l);
      const bx = buyBox({ ...l, compValue });
      const margin = dealMargin({ ...l, compValue });
      return { l, compValue, bx, margin };
    });
  }, [rows, compValueOf]);

  const filtered = useMemo(() => {
    return scored
      .filter(({ l, bx, margin }) => {
        const score = l.final_score ?? l.deal_score ?? 0;
        if (score < minScore) return false;
        if ((l.discount_pct ?? 0) < minDiscount) return false;
        if (minMargin > 0 && (margin == null || margin * 100 < minMargin)) return false;
        if (verdictFilter !== "all" && bx.verdict !== verdictFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "discount") return (b.l.discount_pct ?? -1) - (a.l.discount_pct ?? -1);
        if (sort === "margin") return (b.margin ?? -1) - (a.margin ?? -1);
        if (sort === "savings") return (b.l.savings ?? -1) - (a.l.savings ?? -1);
        return (b.l.final_score ?? b.l.deal_score ?? -1) - (a.l.final_score ?? a.l.deal_score ?? -1);
      });
  }, [scored, minScore, minDiscount, minMargin, verdictFilter, sort]);

  const counts = useMemo(() => {
    const c = { BUY: 0, WATCH: 0, PASS: 0 };
    for (const s of scored) c[s.bx.verdict]++;
    return c;
  }, [scored]);

  const exportCSV = () => {
    const cols = ["verdict_tr", "verdict", "buybox_score", "cerberus_score", "grade", "discount_pct", "margin_pct", "savings", "state", "county", "apn", "acres", "minimum_bid", "comp_value", "road_access", "owner_name", "property_address", "source", "sale_date", "raw_url"];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [cols.join(",")];
    for (const { l, compValue, bx, margin } of filtered) {
      const score = l.final_score ?? l.deal_score;
      const grade = score != null ? gradeOf(score).letter : "";
      lines.push([
        VERDICT_TR[bx.verdict], bx.verdict, bx.score, score ?? "", grade, l.discount_pct ?? "",
        margin == null ? "" : Math.round(margin * 100), l.savings ?? "", l.state, l.county, l.apn,
        l.acres ?? "", l.minimum_bid ?? "", compValue ?? "", l.road_access ?? "", l.owner_name,
        l.property_address, l.source, l.sale_date, l.raw_url,
      ].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terralot-buybox-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const noData = !loading && !error && rows.length === 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Deal Buy-Box
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Gerçek scored lead&apos;ler üzerinde kural-tabanlı AL / BEKLE / GEÇ kararı — skor, indirim ve marja göre filtrele, CSV indir
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
            <Download className="w-4 h-4" /> CSV indir ({filtered.length})
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Lead&apos;ler yükleniyor…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {noData && (
        <div className="max-w-xl mx-auto text-center py-16 px-6 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)" }}>
          <Target className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent-ink)" }} />
          <p className="text-sm font-semibold mb-1">Henüz scored lead yok</p>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Buy-Box, <code className="font-mono">tax_delinquent_properties</code> tablosundaki lead&apos;leri okur ve bu tablo şu an boş.
            Scraper&apos;ı çalıştırıp leadleri Supabase&apos;e senkronlayınca (bkz. <code className="font-mono">/api/admin/sync-deals</code>) kararlar burada görünür.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Verdict summary + filters */}
          <div className="rounded-xl border p-5 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {(["BUY", "WATCH", "PASS"] as Verdict[]).map((v) => {
                const { color, Icon } = VERDICT_META[v];
                const active = verdictFilter === v;
                return (
                  <button key={v} onClick={() => setVerdictFilter(active ? "all" : v)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{ background: active ? color : "var(--surface-low)", color: active ? "#fff" : color, border: `1px solid ${active ? color : "var(--outline)"}` }}>
                    <Icon className="w-4 h-4" /> {VERDICT_TR[v]} <span className="font-mono">{counts[v]}</span>
                  </button>
                );
              })}
              {verdictFilter !== "all" && (
                <button onClick={() => setVerdictFilter("all")} className="text-[11px] underline" style={{ color: "var(--muted)" }}>
                  tümünü göster
                </button>
              )}
              <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--muted)" }}>{filtered.length} eşleşen</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <SliderInput label="Min Cerberus skoru" value={minScore} max={100} suffix="" onChange={setMinScore} />
              <SliderInput label="Min indirim" value={minDiscount} max={70} suffix="%" onChange={setMinDiscount} />
              <SliderInput label="Min kâr marjı" value={minMargin} max={90} suffix="%" onChange={setMinMargin} />
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Sırala</label>
                <Dropdown
                  size="sm"
                  aria-label="Sırala"
                  placeholder="Sırala"
                  value={sort}
                  onChange={(v) => setSort(v as typeof sort)}
                  options={[
                    { value: "score", label: "Cerberus skoru" },
                    { value: "discount", label: "İndirim" },
                    { value: "margin", label: "Kâr marjı" },
                    { value: "savings", label: "Tahmini tasarruf" },
                  ]}
                />
              </div>
            </div>
            <p className="mt-4 pt-3 border-t text-[10px] leading-relaxed" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>
              Kâr marjı = (comp değer − min teklif) / comp değer. Comp değer = acres × state retail $/acre (competitor_listings medyanı). Comp yoksa marj boştur ve karar Cerberus skoru/indirim proxy&apos;sine düşer (düşük güven). Landlocked veya min-teklif &gt; comp = hard fail (kararı GEÇ/BEKLE&apos;ye sabitler).
            </p>
          </div>

          {/* Ranked list */}
          {filtered.length === 0 ? (
            <p className="text-center text-sm py-16 rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--surface-high)" }}>
              Bu filtrelerle eşleşen deal yok.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <div className="max-h-[68vh] overflow-y-auto overflow-x-auto">
                <table className="min-w-[920px] w-full text-sm">
                  <thead>
                    <tr className="border-b sticky top-0 z-10" style={{ borderColor: "var(--surface-high)", background: "var(--surface)" }}>
                      {["Karar", "Skor", "County", "Acres", "Min Teklif", "Comp Değer", "İndirim", "Marj", "Tasarruf", "Gerekçe", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 250).map(({ l, compValue, bx, margin }) => {
                      const { color, Icon } = VERDICT_META[bx.verdict];
                      const score = l.final_score ?? l.deal_score;
                      return (
                        <tr key={l.id} className="border-b hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${color}1a`, color }}>
                              <Icon className="w-3.5 h-3.5" /> {VERDICT_TR[bx.verdict]}
                            </span>
                            {bx.confidence === "low" && <span className="block text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>düşük güven</span>}
                          </td>
                          <td className="px-4 py-2.5"><ScoreBadge score={score} size={32} /></td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold">{l.county || "?"}, {l.state || "?"}</span>
                            {l.apn && <span className="block text-[10px] font-mono" style={{ color: "var(--muted)" }}>{l.apn}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs tabular-nums">{l.acres ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs tabular-nums">{l.minimum_bid != null ? `$${l.minimum_bid.toLocaleString()}` : "—"}</td>
                          <td className="px-4 py-2.5 text-xs tabular-nums">{compValue != null ? `$${compValue.toLocaleString()}` : "—"}</td>
                          <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: l.discount_pct != null ? "var(--grade-a)" : "var(--muted)" }}>{l.discount_pct != null ? `-${l.discount_pct}%` : "—"}</td>
                          <td className="px-4 py-2.5 text-xs font-bold tabular-nums" style={{ color: margin != null ? "var(--accent-ink)" : "var(--muted)" }}>{margin != null ? `${Math.round(margin * 100)}%` : "—"}</td>
                          <td className="px-4 py-2.5 text-xs tabular-nums">{l.savings != null ? `+$${l.savings.toLocaleString()}` : "—"}</td>
                          <td className="px-4 py-2.5 text-[10px] max-w-[220px]" style={{ color: "var(--muted)" }} title={bx.reasons.join(" · ")}>
                            <span className="line-clamp-2">{bx.reasons[0] || "—"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {l.apn ? (
                              <div className="inline-flex items-center gap-1.5">
                                <Link href={`/admin/cerberus/${encodeURIComponent("apn:" + l.apn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}`}
                                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-block whitespace-nowrap"
                                  style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>Analiz →</Link>
                                <Link href={`/admin/cerberus/${encodeURIComponent("apn:" + l.apn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}/report`}
                                  title="Tear-sheet raporu (PDF)"
                                  className="text-[11px] font-semibold px-2 py-1 rounded-md inline-block whitespace-nowrap"
                                  style={{ background: "var(--primary)", color: "#fff" }}>Rapor</Link>
                              </div>
                            ) : (
                              <Link href={`/admin/acquisitions?q=${encodeURIComponent(l.county || "")}`}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-block whitespace-nowrap"
                                style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>Detay →</Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SliderInput({ label, value, max, suffix, onChange }: { label: string; value: number; max: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{label}</span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--accent-ink)" }}>≥ {value}{suffix}</span>
      </div>
      <input type="range" min={0} max={max} step={1} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[var(--accent-ink)]" />
    </div>
  );
}
