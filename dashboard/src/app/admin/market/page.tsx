"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, RefreshCw, BarChart3, TrendingUp, Database, Layers,
  CalendarClock, MapPinned, GitCompareArrows, Trophy, Info, ArrowRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// MARKET ANALYTICS  (/admin/market)
//
// CoStar-style market intelligence cockpit. Everything is LIVE from
// /api/admin/market — per-county/state aggregates derived from the real tables
// (lead_analyses + competitor_listings + upcoming_sales): avg $/acre comp, median
// discount/margin, deal volume, AL/BEKLE/GEÇ distribution, top counties by
// opportunity, forward supply via upcoming-sales, with a state/county filter and
// a county A-vs-B comparison. Honest empty states everywhere — never fabricated.
// ─────────────────────────────────────────────────────────────────────────────

type Verdict = "BUY" | "WATCH" | "PASS";

interface CountyRow {
  state: string; county: string; deals: number;
  buy: number; watch: number; pass: number; buyRate: number;
  avgScore: number; avgMargin: number | null; medMargin: number | null;
  avgDiscount: number | null; medDiscount: number | null;
  compPpa: number | null; marketPpa: number | null; upcoming: number; oppScore: number;
}
interface StateRow {
  state: string; deals: number; buy: number; watch: number; pass: number;
  counties: number; buyRate: number; medMargin: number | null; medDiscount: number | null;
  marketPpa: number | null; upcoming: number; listingN: number;
}
interface MarketData {
  tableReady: { analyses: boolean; listings: boolean; upcoming: boolean };
  totals: { deals: number; counties: number; states: number; upcoming: number; verdicts: Record<Verdict, number> };
  states: StateRow[];
  counties: CountyRow[];
  topCounties: CountyRow[];
}

const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);

export default function MarketAnalyticsPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [cmpA, setCmpA] = useState<string>("");
  const [cmpB, setCmpB] = useState<string>("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/market", { cache: "no-store" });
      if (!r.ok) throw new Error(`Market verisi yüklenemedi (${r.status})`);
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Market verisi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCounties = useMemo(() => {
    if (!data) return [];
    const rows = stateFilter ? data.counties.filter((c) => c.state === stateFilter) : data.counties;
    return rows;
  }, [data, stateFilter]);

  const countyKey = (c: CountyRow) => `${c.state}/${c.county}`;
  const cmpRowA = useMemo(() => data?.counties.find((c) => countyKey(c) === cmpA) ?? null, [data, cmpA]);
  const cmpRowB = useMemo(() => data?.counties.find((c) => countyKey(c) === cmpB) ?? null, [data, cmpB]);

  const verdictTotal = data ? data.totals.verdicts.BUY + data.totals.verdicts.WATCH + data.totals.verdicts.PASS : 0;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-xl p-2.5" style={{ background: "var(--primary)" }}>
            <BarChart3 className="w-6 h-6 text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Market Analitik</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              CoStar tarzı pazar istihbaratı — eyalet/county bazında $/acre, indirim, deal hacmi, AL/BEKLE/GEÇ dağılımı ve gelen arz
            </p>
          </div>
        </div>
        <button onClick={() => { setLoading(true); load(); }} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Yenile
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Pazar verileri toplanıyor…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* analyses table missing → honest owner action */}
      {data && !data.tableReady.analyses && (
        <div className="max-w-2xl mx-auto text-center py-14 px-6 rounded-xl border border-dashed mb-6" style={{ borderColor: "var(--outline)" }}>
          <Database className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent-ink)" }} />
          <p className="text-sm font-semibold mb-1">Analiz tablosu henüz yok</p>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Pazar analitiği <code className="font-mono">lead_analyses</code> tablosundan beslenir. Önce
            {" "}<code className="font-mono">CERBERUS_ANALYSES_SETUP.sql</code>&apos;i uygula ve Cerberus&apos;ta &quot;Tümünü Analiz Et&quot;e bas.
          </p>
          <Link href="/admin/cerberus" className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "var(--primary)", color: "#fff" }}>
            Cerberus Intel&apos;e git <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {data && data.tableReady.analyses && (
        <>
          {/* KPI ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi Icon={Layers} label="Analiz Edilen Deal" value={data.totals.deals.toLocaleString()} sub={`${data.totals.counties} county · ${data.totals.states} eyalet`} tone="var(--accent-ink)" />
            <Kpi Icon={TrendingUp} label="AL Oranı" value={verdictTotal ? `${Math.round((data.totals.verdicts.BUY / verdictTotal) * 100)}%` : "—"} sub={`${data.totals.verdicts.BUY.toLocaleString()} AL kararı`} tone="var(--grade-a)" />
            <Kpi Icon={MapPinned} label="En İyi County" value={data.topCounties[0] ? `${data.topCounties[0].county}` : "—"} sub={data.topCounties[0] ? `${data.topCounties[0].state} · opp ${data.topCounties[0].oppScore}` : "veri yok"} tone="var(--primary)" />
            <Kpi Icon={CalendarClock} label="Gelen Arz" value={data.tableReady.upcoming ? data.totals.upcoming.toLocaleString() : "—"} sub={data.tableReady.upcoming ? "yaklaşan tax-sale" : "upcoming_sales bağlı değil"} tone="var(--warn)" />
          </div>

          {/* VERDICT DISTRIBUTION (stacked bar) */}
          <div className="rounded-xl border p-5 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <h2 className="font-bold text-sm">Portföy Karar Dağılımı (AL / BEKLE / GEÇ)</h2>
              <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>{verdictTotal.toLocaleString()} deal</span>
            </div>
            {verdictTotal === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>Henüz analiz yok.</p>
            ) : (
              <>
                <div className="flex h-5 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                  <div style={{ width: `${(data.totals.verdicts.BUY / verdictTotal) * 100}%`, background: "var(--grade-a)" }} />
                  <div style={{ width: `${(data.totals.verdicts.WATCH / verdictTotal) * 100}%`, background: "var(--warn)" }} />
                  <div style={{ width: `${(data.totals.verdicts.PASS / verdictTotal) * 100}%`, background: "var(--danger)" }} />
                </div>
                <div className="flex items-center gap-5 mt-2.5 text-[11px] flex-wrap">
                  <Legend color="var(--grade-a)" label="AL" n={data.totals.verdicts.BUY} total={verdictTotal} />
                  <Legend color="var(--warn)" label="BEKLE" n={data.totals.verdicts.WATCH} total={verdictTotal} />
                  <Legend color="var(--danger)" label="GEÇ" n={data.totals.verdicts.PASS} total={verdictTotal} />
                </div>
              </>
            )}
          </div>

          {/* STATE TABLE */}
          <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
              <MapPinned className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <h2 className="font-bold text-sm">Eyalet Bazında Pazar</h2>
              <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>deal hacmine göre</span>
            </div>
            {data.states.length === 0 ? (
              <p className="text-center text-sm py-10" style={{ color: "var(--muted)" }}>Eyalet verisi yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm tl-table">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                      {["Eyalet", "Deal", "AL Oranı", "Med. Marj", "Med. İndirim", "Piyasa $/acre", "County", "Gelen Arz", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.states.map((st) => (
                      <tr key={st.state} className="border-b hover:bg-[var(--surface-low)] cursor-pointer" style={{ borderColor: "var(--surface-high)" }}
                        onClick={() => setStateFilter(stateFilter === st.state ? "" : st.state)}>
                        <td className="px-4 py-2.5 font-bold">{st.state}</td>
                        <td className="px-4 py-2.5 tabular-nums">{st.deals.toLocaleString()}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-14 h-1.5 rounded-full overflow-hidden inline-block" style={{ background: "var(--surface-high)" }}>
                              <span className="block h-full rounded-full" style={{ width: `${st.buyRate}%`, background: "var(--grade-a)" }} />
                            </span>
                            {st.buyRate}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums" style={{ color: st.medMargin != null ? "var(--accent-ink)" : "var(--muted)" }}>{st.medMargin != null ? `${st.medMargin}%` : "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{st.medDiscount != null ? `-${st.medDiscount}%` : "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{st.marketPpa != null ? fmtMoney(st.marketPpa) : <span style={{ color: "var(--muted)" }}>comp yok</span>}</td>
                        <td className="px-4 py-2.5 tabular-nums">{st.counties}</td>
                        <td className="px-4 py-2.5 tabular-nums">{data.tableReady.upcoming ? st.upcoming : "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[11px] font-semibold" style={{ color: stateFilter === st.state ? "var(--accent-ink)" : "var(--muted)" }}>
                            {stateFilter === st.state ? "filtre açık" : "filtrele"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TOP COUNTIES BY OPPORTUNITY */}
          <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 px-5 py-3.5 border-b flex-wrap" style={{ borderColor: "var(--surface-high)" }}>
              <Trophy className="w-4 h-4" style={{ color: "var(--grade-a)" }} />
              <h2 className="font-bold text-sm">Fırsata Göre En İyi County&apos;ler</h2>
              <div className="ml-auto flex items-center gap-2">
                {stateFilter && (
                  <button onClick={() => setStateFilter("")} className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>
                    {stateFilter} filtresini temizle ✕
                  </button>
                )}
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>opp = AL oranı + hacim + marj</span>
              </div>
            </div>
            {filteredCounties.length === 0 ? (
              <p className="text-center text-sm py-10" style={{ color: "var(--muted)" }}>
                {stateFilter ? `${stateFilter} için county verisi yok.` : "County verisi yok."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[820px] w-full text-sm tl-table">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                      {["Opp", "County", "Deal", "AL", "BEKLE", "GEÇ", "Med. Marj", "Comp $/acre", "Piyasa $/acre", "Gelen", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCounties.slice(0, 30).map((c) => (
                      <tr key={countyKey(c)} className="border-b hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-extrabold tabular-nums"
                            style={{ background: `${c.oppScore >= 60 ? "var(--grade-a)" : c.oppScore >= 40 ? "var(--warn)" : "var(--danger)"}1a`, color: c.oppScore >= 60 ? "var(--grade-a)" : c.oppScore >= 40 ? "var(--warn)" : "var(--danger)" }}>
                            {c.oppScore}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><span className="font-semibold">{c.county}</span><span className="block text-[10px]" style={{ color: "var(--muted)" }}>{c.state}</span></td>
                        <td className="px-3 py-2.5 tabular-nums">{c.deals}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold" style={{ color: "var(--grade-a)" }}>{c.buy}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--warn)" }}>{c.watch}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--danger)" }}>{c.pass}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: c.medMargin != null ? "var(--accent-ink)" : "var(--muted)" }}>{c.medMargin != null ? `${c.medMargin}%` : "—"}</td>
                        <td className="px-3 py-2.5 tabular-nums">{fmtMoney(c.compPpa)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{c.marketPpa != null ? fmtMoney(c.marketPpa) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                        <td className="px-3 py-2.5 tabular-nums">{data.tableReady.upcoming ? c.upcoming : "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Link href={`/admin/deal-screener?state=${encodeURIComponent(c.state)}`} className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--accent-ink)" }}>Deals →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COUNTY COMPARISON (A vs B) */}
          <div className="rounded-xl border p-5 mb-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 mb-4">
              <GitCompareArrows className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <h2 className="font-bold text-sm">County Karşılaştırma (A vs B)</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <CountyPicker label="County A" value={cmpA} onChange={setCmpA} counties={data.counties} />
              <CountyPicker label="County B" value={cmpB} onChange={setCmpB} counties={data.counties} />
            </div>
            {cmpRowA && cmpRowB ? (
              <div className="grid grid-cols-3 gap-px rounded-lg overflow-hidden" style={{ background: "var(--surface-high)" }}>
                <CmpHead a={cmpRowA} b={cmpRowB} />
                <CmpRow label="Deal hacmi" a={cmpRowA.deals} b={cmpRowB.deals} better="high" />
                <CmpRow label="AL oranı" a={cmpRowA.buyRate} b={cmpRowB.buyRate} suffix="%" better="high" />
                <CmpRow label="Ort. skor" a={cmpRowA.avgScore} b={cmpRowB.avgScore} better="high" />
                <CmpRow label="Med. marj" a={cmpRowA.medMargin} b={cmpRowB.medMargin} suffix="%" better="high" />
                <CmpRow label="Med. indirim" a={cmpRowA.medDiscount} b={cmpRowB.medDiscount} suffix="%" better="high" />
                <CmpRow label="Comp $/acre" a={cmpRowA.compPpa} b={cmpRowB.compPpa} money better="high" />
                <CmpRow label="Piyasa $/acre" a={cmpRowA.marketPpa} b={cmpRowB.marketPpa} money better="high" />
                <CmpRow label="Fırsat skoru" a={cmpRowA.oppScore} b={cmpRowB.oppScore} better="high" />
                <CmpRow label="Gelen arz" a={data.tableReady.upcoming ? cmpRowA.upcoming : null} b={data.tableReady.upcoming ? cmpRowB.upcoming : null} better="high" />
              </div>
            ) : (
              <p className="text-xs text-center py-6" style={{ color: "var(--muted)" }}>İki county seç — yan yana karşılaştırma için.</p>
            )}
          </div>

          {/* honesty footer */}
          <div className="rounded-xl border p-4 text-[11px] leading-relaxed" style={{ background: "var(--surface-low)", borderColor: "var(--outline)", color: "var(--muted)" }}>
            <p className="flex items-center gap-1.5 mb-1" style={{ color: "var(--foreground)" }}>
              <Info className="w-3.5 h-3.5" /> Veri kaynakları & dürüstlük
            </p>
            <p>
              Deal aggregateleri <strong style={{ color: "var(--foreground)" }}>lead_analyses</strong> (Cerberus kararları), piyasa $/acre
              {" "}<strong style={{ color: "var(--foreground)" }}>competitor_listings</strong> medyanları, gelen arz
              {" "}<strong style={{ color: "var(--foreground)" }}>upcoming_sales</strong>&apos;tan canlı gelir. Comp olmayan pazarda $/acre &quot;—&quot; gösterilir (uydurma yok).
              {!data.tableReady.listings && " competitor_listings bağlı değil — piyasa $/acre boş."}
              {!data.tableReady.upcoming && " upcoming_sales bağlı değil — gelen arz boş."}
              {" "}Trend serisi, fiyat geçmişi tablosu eklendiğinde otomatik devreye girer.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ Icon, label, value, sub, tone }: { Icon: typeof Layers; label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: tone }} />
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
      <p className="text-2xl font-extrabold tabular-nums truncate" style={{ color: tone }} title={value}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

function Legend({ color, label, n, total }: { color: string; label: string; n: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className="font-semibold" style={{ color }}>{label}</span>
      <span className="tabular-nums" style={{ color: "var(--muted)" }}>{n.toLocaleString()} · {total ? Math.round((n / total) * 100) : 0}%</span>
    </span>
  );
}

function CountyPicker({ label, value, onChange, counties }: { label: string; value: string; onChange: (v: string) => void; counties: CountyRow[] }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg" style={{ background: "var(--surface-low)", border: "1px solid var(--outline)", color: "var(--foreground)" }}>
        <option value="">— seç —</option>
        {counties.map((c) => (
          <option key={`${c.state}/${c.county}`} value={`${c.state}/${c.county}`}>{c.county}, {c.state} ({c.deals} deal)</option>
        ))}
      </select>
    </label>
  );
}

function CmpHead({ a, b }: { a: CountyRow; b: CountyRow }) {
  return (
    <>
      <div className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "var(--surface)", color: "var(--muted)" }}>Metrik</div>
      <div className="px-3 py-2.5 text-sm font-bold text-center" style={{ background: "var(--surface)" }}>{a.county}, {a.state}</div>
      <div className="px-3 py-2.5 text-sm font-bold text-center" style={{ background: "var(--surface)" }}>{b.county}, {b.state}</div>
    </>
  );
}

function CmpRow({ label, a, b, suffix, money, better }: { label: string; a: number | null; b: number | null; suffix?: string; money?: boolean; better?: "high" | "low" }) {
  const fmt = (v: number | null) => v == null ? "—" : money ? fmtMoney(v) : `${v}${suffix ?? ""}`;
  let aWin = false, bWin = false;
  if (a != null && b != null && a !== b && better) {
    if (better === "high") { aWin = a > b; bWin = b > a; } else { aWin = a < b; bWin = b < a; }
  }
  return (
    <>
      <div className="px-3 py-2 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>{label}</div>
      <div className="px-3 py-2 text-sm text-center tabular-nums font-semibold" style={{ background: "var(--surface)", color: aWin ? "var(--grade-a)" : "var(--foreground)" }}>{fmt(a)}</div>
      <div className="px-3 py-2 text-sm text-center tabular-nums font-semibold" style={{ background: "var(--surface)", color: bWin ? "var(--grade-a)" : "var(--foreground)" }}>{fmt(b)}</div>
    </>
  );
}
