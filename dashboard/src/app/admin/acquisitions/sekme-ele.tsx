"use client";

// ── "Ele" sekmesi — Deal Buy-Box ekranı (eski /admin/deal-screener) ──────────
// Gövde olduğu gibi taşındı; sadece aktif sekme mount olduğunda yüklenir.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, Target, Download, CheckCircle2, Eye, XCircle } from "lucide-react";
import { ScoreBadge, gradeOf } from "@/components/ScoreBadge";
import Dropdown from "@/components/Dropdown";
import { supabase } from "@/lib/supabase";
import { buyBox, dealMargin, VERDICT_TR, type Verdict, type DealSignals } from "@/lib/buy-box";
import { DataSources, type DataSourceItem } from "@/components/DataSources";
import { ParcelLinks } from "@/components/ParcelLinks";

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
  lat: number | null;
  lng: number | null;
}

const VERDICT_META: Record<Verdict, { color: string; Icon: typeof CheckCircle2 }> = {
  BUY: { color: "var(--grade-a)", Icon: CheckCircle2 },
  WATCH: { color: "var(--warn)", Icon: Eye },
  PASS: { color: "var(--danger)", Icon: XCircle },
};

export default function EleSekmesi() {
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
          .select("id,state,county,apn,owner_name,property_address,source,sale_date,raw_url,lat,lng,acres,minimum_bid,judgment_amount,final_score,deal_score,discount_pct,savings,liquidity_score,county_pop_growth,road_access,flood_score")
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

  // ── VERİ KAYNAKLARI (şeffaflık) — bu ekranın dayandığı gerçek kaynaklar ──
  const dataSources: DataSourceItem[] = useMemo(() => {
    const rateStates = Object.keys(rates).sort();
    const withComp = scored.filter((s) => s.compValue != null).length;
    return [
      {
        kind: "parcel",
        label: "Parsel evreni · County tax-delinquent roll",
        detail: `${rows.length.toLocaleString()} gerçek tax-lead (tax_delinquent_properties, perakende ZILLOW satırları hariç)`,
        status: "used",
      },
      {
        kind: "comps",
        label: "Comps · Piyasa $/acre medyanı (/api/market-rates)",
        detail: rateStates.length
          ? `${rateStates.length} state retail $/acre medyanı (${rateStates.join(", ")}) · ${withComp.toLocaleString()} parselde comp değeri hesaplandı (competitor_listings)`
          : "Piyasa benchmark'ı yok — competitor_listings boş",
        status: rateStates.length ? "used" : "missing",
      },
      {
        kind: "valuation",
        label: "Karar · buy-box motoru (kural-tabanlı)",
        detail: `${scored.length.toLocaleString()} parsel skorlandı → AL ${counts.BUY} · BEKLE ${counts.WATCH} · GEÇ ${counts.PASS} (marj + talep + erişim + sel + indirim)`,
        status: "used",
      },
      {
        kind: "demographics",
        label: "Talep sinyali · County demografisi",
        detail: "Nüfus büyümesi + likidite skoru karara katılır (county_demographics / lead sinyalleri)",
        status: "estimated",
      },
    ];
  }, [rates, scored, rows.length, counts]);

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
                      {["Karar", "Skor", "County", "Acres", "Min Teklif", "Comp Değer", "İndirim", "Marj", "Tasarruf", "Gerekçe", "Gör", ""].map((h) => (
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
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <ParcelLinks compact parcel={{ lat: l.lat, lng: l.lng, apn: l.apn, state: l.state, county: l.county, property_address: l.property_address, raw_url: l.raw_url }} />
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

          {/* Veri Kaynakları — bu ekranın dayandığı gerçek kaynaklar (şeffaflık) */}
          {!loading && (
            <div className="mt-6">
              <DataSources
                items={dataSources}
                note="Kâr marjı = (comp değer − min teklif) / comp değer. Comp değer = gerçek acreage × gerçek state $/acre medyanı. Comp yoksa marj boş ve karar skor proxy'sine düşer (düşük güven) — uydurma yok."
              />
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
