"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Layers,
  Coins,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import realDeals from "@/data/real-deals.json";
import { dealEconomics } from "@/lib/deal-economics";

// ─────────────────────────────────────────────────────────────────────────────
// PORTFÖY / KPI — Ahmet'e "para nerede" gösteren salt-okunur özet panel.
//
// Bu sayfa HİÇBİR değerleme/fiyat/teklif/spread mantığını DEĞİŞTİRMEZ — sadece
// var olan motorları (canonical /api/admin/all-deals + deal-economics.ts +
// /api/admin/portfolio-summary) okuyup toplulaştırır. Veri-kapsama panelinden
// FARKLI: orası veri kalitesi, burası FİNANSAL KPI.
//
// DÜRÜSTLÜK:
//  • "Potansiyel spread" = sourced/tahmini — GERÇEKLEŞMİŞ gelir DEĞİL.
//  • Comp-doğrulanmış spread (motor) ile DCAD-assessed tahmini AYRI gösterilir.
//  • Realized (gerçekleşen) sayılar yalnız deal_tracking'te acquired+sold dolu
//    satırlardan; veri yoksa "veri yok / pipeline" yazar — uydurma yok.
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US");

// ── /api/admin/all-deals yanıt tipleri (yalnız kullandığımız alanlar) ──
interface StateDetail {
  state: string;
  count: number;
  acres: number;
  ppa: number | null;
  comps: number;
  withCompPct: number;
  absenteePct: number;
}
interface AllDealsResp {
  total: number;
  byState: Record<string, number>;
  bySource: Record<string, number>;
  sourceLabels: Record<string, string>;
  stats: {
    totalAcres: number;
    withComp: number;
    withCompPct: number;
    absenteePct: number;
    compMarketSum: number;
    totalSpread: number;
    byStateDetail: StateDetail[];
  };
}

interface TrackingResp {
  offmarketCount: number | null;
  taxCount: number | null;
  tracking: {
    available: boolean;
    totalTracked: number;
    stages: { stage: string; label: string; count: number }[];
    capitalDeployed: number;
    capitalDeals: number;
    realizedSpread: number;
    realizedDeals: number;
    listedValue: number;
  };
  notes: string[];
}

interface GradeDist {
  ok: boolean;
  total: number;
  a: number;
  b: number;
  c: number;
}

// ── Küratörlü premium deal'lar (real-deals.json, statik) — deal-economics.ts ile ──
interface CuratedDeal {
  id: string;
  address?: string;
  owner?: string;
  acres?: number | null;
  suggestedOffer?: number;
  estSpread?: number;
}
function curatedSummary() {
  const deals = ((realDeals as { deals?: CuratedDeal[] }).deals ?? []) as CuratedDeal[];
  let capital = 0; // Σ alış (suggestedOffer = totalCost)
  let spreadSum = 0; // Σ nakit spread (deal-economics ile)
  let roiSum = 0;
  let roiN = 0;
  const rows: { id: string; address: string; owner: string; cost: number | null; spread: number | null; roi: number | null; note: string }[] = [];
  for (const d of deals) {
    const offer = d.suggestedOffer != null && Number.isFinite(d.suggestedOffer) ? d.suggestedOffer : null;
    const spread = d.estSpread != null && Number.isFinite(d.estSpread) ? d.estSpread : null;
    // estSpread = curated (DCAD-assessed) tahmini marj → cashPrice = offer + estSpread.
    const cashPrice = offer != null && spread != null ? offer + spread : null;
    const ec = dealEconomics({ offer, cashPrice, financePrice: cashPrice });
    if (ec.totalCost != null) capital += ec.totalCost;
    if (ec.cashSpread != null) spreadSum += ec.cashSpread;
    if (ec.cashRoiPct != null) {
      roiSum += ec.cashRoiPct;
      roiN++;
    }
    rows.push({
      id: d.id,
      address: d.address ?? "—",
      owner: d.owner ?? "—",
      cost: ec.totalCost,
      spread: ec.cashSpread,
      roi: ec.cashRoiPct,
      note: ec.breakevenNote,
    });
  }
  rows.sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0));
  const meta = realDeals as { count?: number; generatedAt?: string; county?: string };
  return {
    count: deals.length,
    capital: Math.round(capital),
    spreadSum: Math.round(spreadSum),
    avgSpread: deals.length ? Math.round(spreadSum / deals.length) : 0,
    avgRoi: roiN ? Math.round(roiSum / roiN) : null,
    topRows: rows.slice(0, 12),
    generatedAt: meta.generatedAt ?? null,
    county: meta.county ?? null,
  };
}

async function jget<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default function PortfoyPage() {
  const [engine, setEngine] = useState<AllDealsResp | null>(null);
  const [grades, setGrades] = useState<GradeDist | null>(null);
  const [track, setTrack] = useState<TrackingResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const curated = useMemo(() => curatedSummary(), []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const [eng, gTotal, gA, gAB, tr] = await Promise.all([
      jget<AllDealsResp>("/api/admin/all-deals?pageSize=1"),
      jget<{ total: number }>("/api/admin/all-deals?onlyComp=1&pageSize=1"),
      jget<{ total: number }>("/api/admin/all-deals?onlyComp=1&minGrade=A&pageSize=1"),
      jget<{ total: number }>("/api/admin/all-deals?onlyComp=1&minGrade=B&pageSize=1"),
      jget<TrackingResp>("/api/admin/portfolio-summary"),
    ]);

    if (!eng) {
      setError("Deal motoru (/api/admin/all-deals) yanıt vermedi. Oturum (gate) veya sunucu sorunu olabilir.");
    }
    setEngine(eng);
    setTrack(tr);

    if (gTotal && gA && gAB) {
      const total = gTotal.total;
      const a = gA.total;
      const ab = gAB.total;
      setGrades({ ok: true, total, a, b: Math.max(0, ab - a), c: Math.max(0, total - ab) });
    } else {
      setGrades({ ok: false, total: 0, a: 0, b: 0, c: 0 });
    }
    setLoading(false);
  }

  const stateDetail = engine?.stats.byStateDetail ?? [];
  const maxStateCount = Math.max(1, ...stateDetail.map((s) => s.count));
  const tracking = track?.tracking;
  const maxStage = Math.max(1, ...(tracking?.stages.map((s) => s.count) ?? [1]));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Portföy / KPI — Para Paneli
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Pipeline&apos;ın finansal özeti: kaç deal sourced, potansiyel spread, grade dağılımı, eyalet kırılımı,
            funnel ve (varsa) gerçekleşen sermaye/spread. Salt-okunur — hiçbir değer/teklif mantığına dokunmaz.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>

      {/* Dürüstlük notu */}
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-5"
        style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
      >
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--grade-a)" }} />
        <span>
          <strong style={{ color: "var(--foreground)" }}>&quot;Potansiyel spread&quot; sourced (tahmini) değerdir — gerçekleşmiş gelir DEĞİL.</strong>{" "}
          Comp-doğrulanmış spread (motor) ile DCAD-assessed tahmini ayrı gösterilir. Gerçekleşen (realized) sayılar
          yalnız <code>deal_tracking</code>&apos;te alış + satış dolu satırlardan gelir; veri yoksa &quot;veri yok / pipeline&quot; yazar.
        </span>
      </div>

      {track?.notes && track.notes.length > 0 && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-5"
          style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{track.notes.join(" · ")}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> KPI&apos;lar toplanıyor…
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}
        >
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && (
        <>
          {/* ── Headline KPI ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
            <Kpi
              icon={Layers}
              label="Sourced deal (motor)"
              value={fmtNum(engine?.total ?? null)}
              sub="tüm kaynaklar birleşik"
              accent
            />
            <Kpi
              icon={TrendingUp}
              label="Comp-doğrulanmış potansiyel spread"
              value={fmtMoney(engine?.stats.totalSpread ?? null)}
              sub={`${fmtNum(engine?.stats.withComp ?? null)} comp-değerli deal · sourced, gerçekleşmemiş`}
            />
            <Kpi
              icon={Coins}
              label="Küratörlü tahmini marj (DCAD)"
              value={fmtMoney(curated.spreadSum)}
              sub={`${curated.count} premium deal · assessed-tabanlı tahmin`}
            />
            <Kpi
              icon={MapPin}
              label="Mektuba-hazır ham lead"
              value={fmtNum((track?.offmarketCount ?? 0) + (track?.taxCount ?? 0) || null)}
              sub={`offmarket ${fmtNum(track?.offmarketCount ?? null)} · tax ${fmtNum(track?.taxCount ?? null)}`}
            />
          </div>

          {/* Secondary stat strip */}
          <div className="flex items-center gap-3 mb-8 flex-wrap text-sm">
            <Stat label="Comp kapsama" value={engine ? `${engine.stats.withCompPct}%` : "—"} />
            <Stat label="Absentee" value={engine ? `${engine.stats.absenteePct}%` : "—"} />
            <Stat label="Toplam dönüm" value={fmtNum(engine?.stats.totalAcres ?? null)} />
            <Stat label="Comp piyasa değeri (Σ)" value={fmtMoney(engine?.stats.compMarketSum ?? null)} />
            <Stat label="Eyalet" value={engine ? String(Object.keys(engine.byState).length) : "—"} />
            <Stat label="Kaynak" value={engine ? String(Object.keys(engine.bySource).length) : "—"} />
          </div>

          {/* ── Grade dağılımı ─────────────────────────────────────────── */}
          <Section title="Deal Grade Dağılımı (A / B / C) — yalnız comp-değerli deal'ler">
            {grades?.ok && grades.total > 0 ? (
              <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--outline)" }}>
                {([
                  ["A", grades.a, "var(--grade-a)", "Güçlü alım"],
                  ["B", grades.b, "var(--grade-b)", "Sağlam"],
                  ["C", grades.c, "var(--grade-c)", "Marjinal"],
                ] as const).map(([g, n, color, desc]) => {
                  const pct = grades.total ? Math.round((n / grades.total) * 100) : 0;
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <span className="w-6 text-sm font-bold" style={{ color }}>{g}</span>
                      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "var(--surface-high)" }}>
                        <div className="h-full rounded-md" style={{ width: `${pct}%`, background: color, minWidth: n > 0 ? 4 : 0 }} />
                      </div>
                      <span className="w-28 text-right text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                        <strong style={{ color: "var(--foreground)" }}>{fmtNum(n)}</strong> ({pct}%) · {desc}
                      </span>
                    </div>
                  );
                })}
                <p className="text-[11px] pt-1" style={{ color: "var(--muted)" }}>
                  Toplam {fmtNum(grades.total)} comp-değerli deal. Comp&apos;u olmayan / mismatch deal&apos;lere grade verilmez (uydurma yok).
                </p>
              </div>
            ) : (
              <Empty text="Grade dağılımı hesaplanamadı — comp-değerli deal yok ya da motor yanıt vermedi." />
            )}
          </Section>

          {/* ── Eyalet bazlı ──────────────────────────────────────────── */}
          <Section title="Eyalet Bazlı Kırılım">
            {stateDetail.length > 0 ? (
              <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                      {["Eyalet", "Deal", "", "Dönüm", "Comp %", "Absentee %", "$/acre (comp)"].map((h, i) => (
                        <th key={i} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stateDetail.map((s) => (
                      <tr key={s.state} className="border-b" style={{ borderColor: "var(--outline)" }}>
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{s.state}</td>
                        <td className="px-4 py-2.5 tabular-nums">{fmtNum(s.count)}</td>
                        <td className="px-4 py-2.5 w-40">
                          <div className="h-2 rounded-full" style={{ background: "var(--surface-high)" }}>
                            <div className="h-2 rounded-full" style={{ width: `${(s.count / maxStateCount) * 100}%`, background: "var(--accent-ink)" }} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{fmtNum(s.acres)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{s.withCompPct}%</td>
                        <td className="px-4 py-2.5 tabular-nums">{s.absenteePct}%</td>
                        <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--muted)" }}>
                          {s.ppa != null ? `${fmtMoney(s.ppa)} (${s.comps})` : "comp gerekli"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Eyalet kırılımı yok — motor yanıt vermedi." />
            )}
          </Section>

          {/* ── Pipeline funnel (deal_tracking) ───────────────────────── */}
          <Section title="Pipeline Funnel (deal_tracking)">
            {tracking?.available && tracking.stages.length > 0 ? (
              <div className="rounded-xl border p-5 space-y-2.5" style={{ borderColor: "var(--outline)" }}>
                {tracking.stages.map((s) => {
                  const pct = Math.round((s.count / maxStage) * 100);
                  return (
                    <div key={s.stage} className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium whitespace-nowrap" style={{ color: "var(--foreground)" }}>{s.label}</span>
                      <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: "var(--surface-high)" }}>
                        <div className="h-full rounded-md" style={{ width: `${pct}%`, background: "var(--primary)", minWidth: s.count > 0 ? 4 : 0 }} />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums font-semibold">{fmtNum(s.count)}</span>
                    </div>
                  );
                })}
                <p className="text-[11px] pt-1" style={{ color: "var(--muted)" }}>
                  Toplam {fmtNum(tracking.totalTracked)} takip edilen deal. Ahmet acquisitions ekranında stage güncelledikçe bu funnel dolar.
                </p>
              </div>
            ) : (
              <Empty text="deal_tracking pipeline verisi yok — acquisitions ekranında deal'ler stage'lendikçe funnel burada belirir. (veri yok / pipeline)" />
            )}
          </Section>

          {/* ── Gerçekleşen (realized) ─────────────────────────────────── */}
          <Section title="Gerçekleşen (Realized) — Sermaye & Spread">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                icon={Coins}
                label="Sermaye yatırıldı"
                value={tracking?.capitalDeals ? fmtMoney(tracking.capitalDeployed) : "veri yok"}
                sub={tracking?.capitalDeals ? `${tracking.capitalDeals} sahipli parsel` : "pipeline — henüz alış yok"}
              />
              <Kpi
                icon={TrendingUp}
                label="Gerçekleşen spread"
                value={tracking?.realizedDeals ? fmtMoney(tracking.realizedSpread) : "veri yok"}
                sub={tracking?.realizedDeals ? `${tracking.realizedDeals} satılan deal` : "pipeline — henüz satış yok"}
                accent={!!tracking?.realizedDeals}
              />
              <Kpi
                icon={Layers}
                label="Listede (satılmamış)"
                value={tracking && tracking.listedValue > 0 ? fmtMoney(tracking.listedValue) : "veri yok"}
                sub="Σ list_price — beklenen, gerçekleşmemiş"
              />
              <Kpi
                icon={BarChart3}
                label="MRR / ödeme (owner-finance)"
                value="veri yok"
                sub="ödeme entegrasyonu bağlı değil — pipeline"
              />
            </div>
          </Section>

          {/* ── Küratörlü premium deal ekonomisi (deal-economics.ts) ──── */}
          <Section
            title={`Küratörlü Premium Deal Ekonomisi — ${curated.county ?? "Dallas County"} (örnek, en yüksek marj)`}
          >
            <div className="flex items-center gap-3 mb-3 flex-wrap text-sm">
              <Stat label="Premium deal" value={fmtNum(curated.count)} accent />
              <Stat label="Toplam alış (sermaye gerekli)" value={fmtMoney(curated.capital)} />
              <Stat label="Toplam tahmini marj" value={fmtMoney(curated.spreadSum)} />
              <Stat label="Ortalama marj/deal" value={fmtMoney(curated.avgSpread)} />
              <Stat label="Ortalama nakit ROI" value={curated.avgRoi != null ? `${curated.avgRoi}%` : "—"} />
            </div>
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                    {["Parsel", "Sahip", "Alış maliyeti", "Nakit spread", "ROI", "Özet (deal-economics)"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {curated.topRows.map((r) => (
                    <tr key={r.id} className="border-b align-top" style={{ borderColor: "var(--outline)" }}>
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{r.address}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>{r.owner}</td>
                      <td className="px-4 py-2.5 tabular-nums">{fmtMoney(r.cost)}</td>
                      <td className="px-4 py-2.5 tabular-nums font-bold" style={{ color: "var(--grade-a)" }}>{r.spread != null ? `+${fmtMoney(r.spread)}` : "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.roi != null ? `${r.roi}%` : "—"}</td>
                      <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--muted)" }}>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
              Ekonomi <code>deal-economics.ts</code> ile hesaplanır (null-safe). Değerler DCAD assessed-tabanlı tahmini marjdır;
              comp ile doğrulanınca motor (Tüm Dealler) gerçek comp spread&apos;i gösterir.
              {curated.generatedAt ? ` · Snapshot: ${curated.generatedAt}` : ""}
            </p>
          </Section>
        </>
      )}
    </div>
  );
}

// ── Küçük UI parçaları ─────────────────────────────────────────────────────────
function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color: accent ? "var(--accent-ink)" : "var(--foreground)" }}>
        {value}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-3.5 py-2 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
      <span className="text-lg font-bold tabular-nums" style={{ color: accent ? "var(--accent-ink)" : "var(--foreground)" }}>
        {value}
      </span>{" "}
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--muted)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-10 rounded-xl border border-dashed text-sm" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
      {text}
    </div>
  );
}
