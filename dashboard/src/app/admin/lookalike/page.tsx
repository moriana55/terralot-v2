"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Search, TrendingUp, Target } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// LOOKALIKE COUNTY — pick a winner, find demographically/growth-similar counties.
// Backed by /api/lookalike (cosine/euclidean over z-scored facets).
// ─────────────────────────────────────────────────────────────────────────────

interface UniItem { state: string; county: string; }
interface Similar {
  state: string; county: string; similarity: number;
  income: number | null; medianAge: number | null; population: number | null;
  homeValue: number | null; popGrowth: number | null; dealDensity: number;
}
type Winner = Omit<Similar, "similarity">;

const fmtMoney = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const fmtNum = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString());
const fmtGrowth = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

function simColor(s: number) {
  if (s >= 85) return "var(--grade-a)";
  if (s >= 70) return "var(--grade-b)";
  if (s >= 55) return "var(--grade-c)";
  return "var(--grade-d)";
}

export default function LookalikePage() {
  const [universe, setUniverse] = useState<UniItem[]>([]);
  const [winnerKey, setWinnerKey] = useState<string>("");
  const [metric, setMetric] = useState<"cosine" | "euclidean">("cosine");
  const [winner, setWinner] = useState<Winner | null>(null);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUni, setLoadingUni] = useState(true);
  const [demographicsEmpty, setDemographicsEmpty] = useState(false);
  const [q, setQ] = useState("");

  // load universe once. Counties are sourced from county_demographics when it's
  // populated, otherwise from the real scored leads (tax_delinquent_properties)
  // — the same data the Deal Buy-Box screener shows — so the picker is never
  // empty just because the demographics table hasn't been built yet.
  useEffect(() => {
    fetch("/api/lookalike")
      .then((r) => r.json())
      .then((j) => {
        setUniverse(j.universe || []);
        setDemographicsEmpty(Boolean(j.demographicsEmpty));
      })
      .catch(() => setUniverse([]))
      .finally(() => setLoadingUni(false));
  }, []);

  const filteredUni = useMemo(() => {
    if (!q.trim()) return universe.slice(0, 200);
    const t = q.toUpperCase();
    return universe.filter((u) => u.county.includes(t) || u.state.includes(t)).slice(0, 200);
  }, [universe, q]);

  const run = async (key: string, m = metric) => {
    const [state, county] = key.split("/");
    if (!state || !county) return;
    setLoading(true);
    setWinnerKey(key);
    const r = await fetch(`/api/lookalike?state=${state}&county=${encodeURIComponent(county)}&metric=${m}`);
    const j = await r.json();
    setWinner(j.winner || null);
    setSimilar(j.similar || []);
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Copy className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
          Lookalike County
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Kazandığın bir county seç → demografik + büyüme açısından benzer county&apos;leri bul. Bir pazarda işe yarayan playbook&apos;u nereye taşıyacağını söyler.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Picker */}
        <aside className="rounded-xl border p-4 h-fit" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
            <span className="text-sm font-bold">Winner county seç</span>
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            {(["cosine", "euclidean"] as const).map((m) => (
              <button key={m} onClick={() => { setMetric(m); if (winnerKey) run(winnerKey, m); }}
                className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold capitalize"
                style={{ background: metric === m ? "var(--accent-ink)" : "var(--surface-high)", color: metric === m ? "var(--background)" : "var(--muted)" }}>
                {m}
              </button>
            ))}
          </div>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "var(--muted)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="county / eyalet ara…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
          </div>
          {loadingUni ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}><Loader2 className="w-3 h-3 animate-spin" /> yükleniyor…</div>
          ) : universe.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>Henüz county yok. Önce scraper&apos;ı çalıştırıp lead&apos;leri (tax_delinquent_properties) Supabase&apos;e senkronla.</p>
          ) : (
            <>
              {demographicsEmpty && (
                <p className="text-[10px] mb-2 leading-relaxed px-1" style={{ color: "var(--muted)" }}>
                  Gerçek lead&apos;lerden ({universe.length} county) dolduruldu. Benzerlik skoru için demografi gerekir:
                  county_demographics boş — county_demographics.sql + build-county-demographics.js çalıştır.
                </p>
              )}
              <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                {filteredUni.map((u) => {
                  const key = `${u.state}/${u.county}`;
                  return (
                    <button key={key} onClick={() => run(key)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--surface-high)]"
                      style={{ background: winnerKey === key ? "var(--surface-high)" : "transparent", color: winnerKey === key ? "var(--accent-ink)" : "inherit", fontWeight: winnerKey === key ? 600 : 400 }}>
                      {u.county}, {u.state}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        {/* Results */}
        <div>
          {!winner && !loading && (
            <div className="text-center py-24 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
              <Copy className="w-8 h-8 mx-auto mb-3 opacity-40" />
              {demographicsEmpty && winnerKey ? (
                <div className="max-w-md mx-auto px-6">
                  <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    {winnerKey.split("/")[1]}, {winnerKey.split("/")[0]} seçildi
                  </p>
                  <p className="text-xs">
                    County seçimi gerçek lead verisinden çalışıyor, ama benzerlik skoru hesabı demografi facet&apos;lerine (gelir, yaş, nüfus, ev değeri, büyüme) ihtiyaç duyar.
                    <code className="font-mono"> county_demographics</code> tablosu boş — doldurunca benzer county&apos;ler burada listelenir.
                  </p>
                </div>
              ) : (
                <p className="text-sm">Soldan bir winner county seç.</p>
              )}
            </div>
          )}
          {loading && <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> benzerler hesaplanıyor…</div>}

          {winner && !loading && (
            <>
              {/* Winner profile */}
              <div className="rounded-xl border p-5 mb-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--accent-ink)" }}>Winner profili</div>
                <div className="text-lg font-bold mb-3">{winner.county}, {winner.state}</div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">
                  {[
                    ["Gelir", fmtMoney(winner.income)], ["Medyan yaş", winner.medianAge?.toFixed(1) ?? "—"],
                    ["Nüfus", fmtNum(winner.population)], ["Ev değeri", fmtMoney(winner.homeValue)],
                    ["Büyüme 5y", fmtGrowth(winner.popGrowth)], ["A-grade deal", String(winner.dealDensity)],
                  ].map(([k, v]) => (
                    <div key={k}><div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k}</div><div className="font-bold tabular-nums">{v}</div></div>
                  ))}
                </div>
              </div>

              {/* Ranked similars */}
              <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--surface-high)" }}>
                  <TrendingUp className="w-4 h-4" style={{ color: "var(--grade-a)" }} />
                  <span className="text-sm font-bold">En Benzer County&apos;ler</span>
                  <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>{metric} · benzerlik %&apos;e göre</span>
                </div>
                {similar.length === 0 ? (
                  <p className="text-center text-sm py-12" style={{ color: "var(--muted)" }}>Benzer bulunamadı.</p>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
                    <table className="min-w-[760px] w-full text-sm">
                      <thead>
                        <tr className="border-b sticky top-0" style={{ borderColor: "var(--surface-high)", background: "var(--surface)" }}>
                          {["#", "County", "Benzerlik", "Gelir", "Yaş", "Nüfus", "Ev Değeri", "Büyüme", "Deal", ""].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {similar.map((r, i) => (
                          <tr key={`${r.state}/${r.county}`} className="border-b hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                            <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>{i + 1}</td>
                            <td className="px-4 py-2.5 font-semibold">{r.county}, {r.state}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${r.similarity}%`, background: simColor(r.similarity) }} />
                                </div>
                                <span className="text-xs font-bold tabular-nums" style={{ color: simColor(r.similarity) }}>{r.similarity}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(r.income)}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{r.medianAge?.toFixed(1) ?? "—"}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{fmtNum(r.population)}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{fmtMoney(r.homeValue)}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{fmtGrowth(r.popGrowth)}</td>
                            <td className="px-4 py-2.5 text-xs font-extrabold tabular-nums" style={{ color: "var(--grade-a)" }}>{r.dealDensity}</td>
                            <td className="px-4 py-2.5 text-right">
                              <Link href={`/admin/acquisitions?q=${encodeURIComponent(r.county)}`}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-block"
                                style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>Deals →</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="text-[10px] mt-3 leading-relaxed" style={{ color: "var(--muted)" }}>
                Facet vektörü: gelir, medyan yaş, nüfus, ev değeri, 5y büyüme, A-grade deal yoğunluğu — county evreninde z-score normalize edilir. Eksik facet&apos;ler ortalamaya (z=0) atanır.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
