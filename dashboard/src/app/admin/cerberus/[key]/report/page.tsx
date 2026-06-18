"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, ArrowLeft, Printer, CheckCircle2, Eye, XCircle, ShieldAlert,
  MapPin, Waves, Mountain, Route, Users, Satellite, Info, Building2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL PARCEL TEAR-SHEET  (/admin/cerberus/[key]/report)
//
// A polished, print/PDF-ready single-parcel intelligence report in the spirit of
// a CoStar property report. Reuses the SAME analysis the drill-down reads
// (/api/admin/cerberus/lead?key=...&enrich=1) so every number is real or honestly
// empty — no fabrication. Source-labelled field data (FEMA/USGS/OSM/Census) is
// badged GERÇEK (measured) vs TAHMİNİ (estimated). "Yazdır / PDF" uses the
// browser's native print (window.print) + @media print CSS in globals.css — no
// heavy PDF dependency. The map thumbnail box is reserved up-front to keep CLS low.
// ─────────────────────────────────────────────────────────────────────────────

type Verdict = "BUY" | "WATCH" | "PASS";
const VERDICT_TR: Record<Verdict, string> = { BUY: "AL", WATCH: "BEKLE", PASS: "GEÇ" };
const VERDICT_META: Record<Verdict, { color: string; Icon: typeof CheckCircle2; blurb: string }> = {
  BUY: { color: "var(--grade-a)", Icon: CheckCircle2, blurb: "Güçlü fırsat — edinme kuyruğuna alınması önerilir." },
  WATCH: { color: "var(--warn)", Icon: Eye, blurb: "Potansiyel var — comp/DD doğrulanınca yeniden değerlendir." },
  PASS: { color: "var(--danger)", Icon: XCircle, blurb: "Risk/getiri zayıf — kaynakları daha güçlü leadlere ayır." },
};

interface Enrichment {
  floodZone: string | null; floodLabel: string | null;
  elevationFt: number | null; elevationM: number | null;
  nearestRoadM: number | null; roadAccess: string | null; roadName: string | null;
  population: number | null; medianIncome: number | null; popGrowth5y: number | null;
  lat: number | null; lng: number | null; geocoded: boolean;
  sourcesOk: string[]; regridConnected: boolean; attomConnected: boolean; enrichedAt: string;
}

interface Analysis {
  parcel_key?: string; parcelKey?: string;
  apn: string | null; source: string | null; state: string | null; county: string | null;
  address: string | null; acres: number | null;
  comp_value?: number | null; compValue?: number | null;
  per_acre?: number | null; perAcre?: number | null;
  value_basis?: string; valueBasis?: string;
  value_confidence?: string; valueConfidence?: string;
  min_bid?: number | null; minBid?: number | null;
  margin: number | null;
  discount_pct?: number | null; discountPct?: number | null;
  verdict: Verdict; score: number; confidence: string;
  hard_fail?: boolean; hardFail?: boolean;
  components: { label: string; pts: number; max: number; note: string }[];
  reasons: string[];
  risk_flags?: { code: string; level: string; label: string }[];
  riskFlags?: { code: string; level: string; label: string }[];
  data_gaps?: string[]; dataGaps?: string[];
  suggested_action?: string; suggestedAction?: string;
  narrative: string;
  narrative_source?: string; narrativeSource?: string;
  real_signals?: Record<string, string>; realSignals?: Record<string, string>;
  enrichment?: Enrichment | null;
}

const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const NOSRC = "kaynak bağlı değil";

export default function TearSheetPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [a, setA] = useState<Analysis | null>(null);
  const [meta, setMeta] = useState<{ stored: boolean; live: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt] = useState(() => new Date());

  const load = async (enrich: boolean) => {
    if (enrich) setEnriching(true);
    else setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/cerberus/lead?key=${encodeURIComponent(key)}${enrich ? "&enrich=1" : ""}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || `Rapor yüklenemedi (${r.status})`);
      setA(j.analysis);
      setMeta({ stored: !!j.stored, live: !!j.live });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rapor yüklenemedi");
    } finally {
      setLoading(false);
      setEnriching(false);
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const g = <T,>(snake: T | undefined, camel: T | undefined): T | undefined => (snake !== undefined ? snake : camel);
  const compValue = a ? g(a.comp_value, a.compValue) ?? null : null;
  const perAcre = a ? g(a.per_acre, a.perAcre) ?? null : null;
  const minBid = a ? g(a.min_bid, a.minBid) ?? null : null;
  const valueBasis = a ? g(a.value_basis, a.valueBasis) : undefined;
  const valueConf = a ? g(a.value_confidence, a.valueConfidence) : undefined;
  const discountPct = a ? g(a.discount_pct, a.discountPct) ?? null : null;
  const hardFail = a ? g(a.hard_fail, a.hardFail) : false;
  const riskFlags = (a ? g(a.risk_flags, a.riskFlags) : []) || [];
  const dataGaps = (a ? g(a.data_gaps, a.dataGaps) : []) || [];
  const suggestedAction = a ? g(a.suggested_action, a.suggestedAction) : "";
  const realSignals = (a ? g(a.real_signals, a.realSignals) : {}) || {};
  const enr = a?.enrichment ?? null;
  const lat = enr?.lat ?? null;
  const lng = enr?.lng ?? null;

  const mem = a ? VERDICT_META[a.verdict] || VERDICT_META.PASS : VERDICT_META.PASS;

  // $/acre delta vs market: comp $/acre is the market benchmark; we contextualise
  // the realised entry $/acre (min bid ÷ acres) against it. Honest-null otherwise.
  const entryPpa = useMemo(() => {
    if (minBid != null && a?.acres && a.acres > 0) return Math.round(minBid / a.acres);
    return null;
  }, [minBid, a?.acres]);

  // Static map thumbnail (OSM, keyless). Reserved box keeps CLS low regardless.
  const mapSrc = useMemo(() => {
    if (lat == null || lng == null) return null;
    const d = 0.06;
    const bbox = `${(lng - d).toFixed(4)},${(lat - d).toFixed(4)},${(lng + d).toFixed(4)},${(lat + d).toFixed(4)}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
  }, [lat, lng]);

  return (
    <div className="report-sheet p-8 max-w-4xl mx-auto" style={{ color: "var(--foreground)" }}>
      {/* ── Toolbar (hidden on print) ── */}
      <div data-no-print className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <Link href={`/admin/cerberus/${encodeURIComponent(key)}`} className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: "var(--muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Analiz görünümüne dön
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={enriching || loading}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
            style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
            {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />}
            {enr ? "Saha verisini yenile" : "Saha verisini çek"}
          </button>
          <button onClick={() => window.print()} disabled={!a}
            className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-60"
            style={{ background: "var(--primary)", color: "#fff" }}>
            <Printer className="w-4 h-4" /> PDF / Yazdır
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Rapor hazırlanıyor…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {a && (
        <article className="space-y-6">
          {/* ── REPORT MASTHEAD ── */}
          <header data-report-card className="rounded-xl border overflow-hidden report-avoid-break" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-b" style={{ borderColor: "var(--surface-high)", background: "var(--primary)" }}>
              <div className="flex items-center gap-2 text-white">
                <Building2 className="w-5 h-5" />
                <span className="font-extrabold tracking-tight">TerraLot</span>
                <span className="text-[10px] uppercase tracking-[0.18em] opacity-70 ml-1">Cerberus Engine</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">Parsel İstihbarat Raporu</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              {/* Identity block */}
              <div className="md:col-span-2 p-6">
                <h1 className="text-2xl font-extrabold flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
                  {a.county || "?"} County, {a.state || "?"}
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{a.address || "Adres kaydı yok"}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-5">
                  <HeadStat label="APN / Parsel" value={a.apn || NOSRC} mono />
                  <HeadStat label="Eyalet" value={a.state || "—"} />
                  <HeadStat label="Acreage" value={a.acres != null ? `${a.acres} acre` : NOSRC} />
                  <HeadStat label="Kaynak" value={a.source || "—"} />
                  <HeadStat label="Enlem" value={lat != null ? lat.toFixed(5) : NOSRC} mono />
                  <HeadStat label="Boylam" value={lng != null ? lng.toFixed(5) : NOSRC} mono />
                  <HeadStat label="Değerleme temeli" value={valueBasis === "county_comp" ? "County comp" : valueBasis === "state_comp" ? "State comp" : "Comp yok"} />
                  <HeadStat label="Güven" value={valueConf ? `${valueConf}` : a.confidence} />
                </div>
              </div>

              {/* Map thumbnail — reserved box (fixed aspect) to keep CLS low */}
              <div className="border-t md:border-t-0 md:border-l p-4 flex flex-col" style={{ borderColor: "var(--surface-high)" }}>
                <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Konum</span>
                <div className="relative w-full rounded-lg overflow-hidden border" style={{ aspectRatio: "4 / 3", background: "var(--surface-high)", borderColor: "var(--outline)" }}>
                  {mapSrc ? (
                    <iframe
                      title="Parsel haritası"
                      src={mapSrc}
                      className="absolute inset-0 w-full h-full"
                      style={{ border: 0 }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3" style={{ color: "var(--muted)" }}>
                      <MapPin className="w-5 h-5 mb-1.5" />
                      <span className="text-[11px]">Koordinat yok — saha verisini çekince harita gelir.</span>
                    </div>
                  )}
                </div>
                {lat != null && (
                  <p className="text-[10px] mt-1.5 text-center" style={{ color: "var(--muted)" }}>© OpenStreetMap katkıcıları</p>
                )}
              </div>
            </div>
          </header>

          {/* ── VERDICT BANNER ── */}
          <section data-report-card className="rounded-xl border p-5 report-avoid-break" style={{ background: "var(--surface)", borderColor: "var(--surface-high)", borderLeft: `4px solid ${mem.color}` }}>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-extrabold" style={{ background: `${mem.color}1a`, color: mem.color }}>
                <mem.Icon className="w-5 h-5" /> {VERDICT_TR[a.verdict]}
              </span>
              <div>
                <p className="text-3xl font-extrabold tabular-nums leading-none" style={{ color: mem.color }}>{a.score}<span className="text-base font-bold" style={{ color: "var(--muted)" }}>/100</span></p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>Cerberus karar skoru · {a.confidence} güven</p>
              </div>
              {hardFail && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "rgba(186,26,26,0.1)", color: "var(--danger)" }}>
                  <ShieldAlert className="w-4 h-4" /> HARD FAIL — kritik kapan
                </span>
              )}
              <p className="text-sm flex-1 min-w-[220px]" style={{ color: "var(--foreground)" }}>{mem.blurb}</p>
            </div>
          </section>

          {/* ── VALUATION & COMPS ── */}
          <section data-report-card className="rounded-xl border p-6 report-avoid-break" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <SectionTitle n="01" title="Değerleme & Karşılaştırılabilir Satışlar" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mt-4">
              <BigStat label="İçsel değer (comp)" value={fmtMoney(compValue)} accent tone="var(--accent-ink)" />
              <BigStat label="Min teklif" value={fmtMoney(minBid)} />
              <BigStat label="Kâr marjı" value={a.margin != null ? `${Math.round(a.margin * 100)}%` : "—"} accent tone="var(--grade-a)" />
              <BigStat label="İndirim" value={discountPct != null ? `-${discountPct}%` : "—"} />
              <BigStat label="Comp $/acre (piyasa)" value={fmtMoney(perAcre)} />
              <BigStat label="Giriş $/acre" value={fmtMoney(entryPpa)} />
            </div>

            {/* $/acre vs market bar */}
            {perAcre != null && entryPpa != null && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--surface-high)" }}>
                <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
                  <span>Giriş $/acre vs piyasa $/acre</span>
                  <span className="font-semibold tabular-nums" style={{ color: entryPpa <= perAcre ? "var(--grade-a)" : "var(--danger)" }}>
                    {entryPpa <= perAcre ? `Piyasanın %${Math.round((1 - entryPpa / perAcre) * 100)} altında` : `Piyasanın %${Math.round((entryPpa / perAcre - 1) * 100)} üstünde`}
                  </span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (entryPpa / Math.max(perAcre, entryPpa)) * 100)}%`, background: entryPpa <= perAcre ? "var(--grade-a)" : "var(--danger)" }} />
                  <div className="absolute inset-y-0" style={{ left: `${Math.min(100, (perAcre / Math.max(perAcre, entryPpa)) * 100)}%`, width: 2, background: "var(--primary)" }} title="Piyasa benchmark" />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>Çizgi = piyasa medyanı ($/acre). Bar = bu parselin giriş maliyeti $/acre.</p>
              </div>
            )}

            <p className="text-[11px] mt-4 leading-relaxed" style={{ color: "var(--muted)" }}>
              İçsel değer = acreage × bulk-adjusted comp $/acre ({valueBasis === "county_comp" ? "county" : valueBasis === "state_comp" ? "state" : "comp yok"} medyanı, <code className="font-mono">competitor_listings</code>).
              Comp olmayan pazarda değer boş bırakılır — uydurma sayı yoktur. Min teklif tax-sale kaydından, judgment (geri-vergi) değer hesabına KATILMAZ.
            </p>
          </section>

          {/* ── CERBERUS VERDICT — score breakdown ── */}
          <section data-report-card className="rounded-xl border p-6 report-avoid-break" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <SectionTitle n="02" title="Cerberus Kararı — Skor Dağılımı" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mt-4">
              {a.components.map((c) => {
                const pct = c.max ? Math.min(100, (c.pts / c.max) * 100) : 0;
                return (
                  <div key={c.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{c.label}</span>
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--accent-ink)" }}>{c.pts}/{c.max}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--surface-high)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent-ink)" }} />
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>{c.note}</p>
                  </div>
                );
              })}
            </div>
            {a.reasons.length > 0 && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--surface-high)" }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Başlıca gerekçeler</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                  {a.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent-ink)" }} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── FIELD DATA (FEMA / USGS / OSM / Census) ── */}
          <section data-report-card className="rounded-xl border p-6 report-avoid-break" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <SectionTitle n="03" title="Saha Verisi — Çoklu Kaynak (kaynak etiketli)" />
            <p className="text-[11px] mt-1 mb-4" style={{ color: "var(--muted)" }}>
              Her sinyal <strong style={{ color: "var(--grade-a)" }}>GERÇEK</strong> (ölçülmüş) ya da <strong style={{ color: "var(--foreground)" }}>TAHMİNİ</strong> (kural-tabanlı / kaynak bağlı değil) olarak işaretli.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldRow Icon={Waves} label="FEMA sel bölgesi" source="FEMA" real={!!realSignals.flood_score}
                value={enr?.floodZone ? `${enr.floodZone}${enr.floodLabel ? ` — ${enr.floodLabel.replace(/^FEMA:\s*/, "")}` : ""}` : NOSRC} />
              <FieldRow Icon={Route} label="Yol erişimi (OSM)" source="OSM" real={!!realSignals.road_access}
                value={enr?.nearestRoadM != null ? `${enr.nearestRoadM} m · ${enr.roadAccess ?? "?"}${enr.roadName ? ` (${enr.roadName})` : ""}` : (enr?.roadAccess ?? NOSRC)}
                danger={enr?.roadAccess === "landlocked"} />
              <FieldRow Icon={Mountain} label="Rakım (USGS)" source="USGS" real={!!realSignals.elevation}
                value={enr?.elevationFt != null ? `${enr.elevationFt} ft (${enr.elevationM} m)` : NOSRC} />
              <FieldRow Icon={Users} label="Demografi (Census)" source="Census" real={!!realSignals.demographics}
                value={enr?.population != null
                  ? `Nüfus ${enr.population.toLocaleString()}${enr.popGrowth5y != null ? ` · ${(enr.popGrowth5y * 100).toFixed(1)}%/5y` : ""}${enr.medianIncome != null ? ` · medyan gelir $${enr.medianIncome.toLocaleString()}` : ""}`
                  : NOSRC} />
            </div>
            <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap text-[11px]" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>
              <span>Aktif kaynaklar: {enr?.sourcesOk?.length ? enr.sourcesOk.join(" · ") : "yok (saha verisini çek)"}.</span>
              {enr?.geocoded && <span>Koordinat: Census Geocoder.</span>}
              <span>Regrid {enr?.regridConnected ? "bağlı" : "bağlı değil"} · ATTOM {enr?.attomConnected ? "bağlı" : "bağlı değil"} (token ile açılır).</span>
            </div>
          </section>

          {/* ── RISK FLAGS + SUGGESTED ACTION ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 report-avoid-break">
            <div data-report-card className="rounded-xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <SectionTitle n="04" title="Risk Bayrakları" />
              {riskFlags.length === 0 ? (
                <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Belirgin risk bayrağı yok.</p>
              ) : (
                <ul className="space-y-2 mt-3">
                  {riskFlags.map((f) => {
                    const c = f.level === "critical" ? "var(--danger)" : f.level === "warn" ? "var(--warn)" : "var(--muted)";
                    return (
                      <li key={f.code} className="flex items-start gap-2 text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: c }} />
                        <span><span className="font-semibold" style={{ color: c }}>{f.level === "critical" ? "Kritik" : f.level === "warn" ? "Uyarı" : "Bilgi"}:</span> {f.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {dataGaps.length > 0 && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--surface-high)" }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Veri boşlukları</p>
                  <ul className="text-[11px] space-y-0.5" style={{ color: "var(--muted)" }}>
                    {dataGaps.map((d, i) => <li key={i}>· {d}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div data-report-card className="rounded-xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <SectionTitle n="05" title="Önerilen Aksiyon" />
              <p className="text-sm font-bold mt-3" style={{ color: mem.color }}>{suggestedAction}</p>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-high)" }}>
                <p className="text-[11px] font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--muted)" }}>
                  <Info className="w-3 h-3" /> {a.narrativeSource === "ai" || a.narrative_source === "ai" ? "AI underwriting anlatımı" : "Kural-tabanlı anlatım"}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{a.narrative}</p>
              </div>
            </div>
          </section>

          {/* ── FOOTER / DISCLAIMER ── */}
          <footer className="text-[10px] leading-relaxed pt-2 report-avoid-break" style={{ color: "var(--muted)" }}>
            <p>
              Rapor oluşturma: {generatedAt.toLocaleString("tr-TR")} · Parsel anahtarı <code className="font-mono">{a.parcel_key || a.parcelKey || key}</code>
              {meta?.live ? " · anlık analiz (kalıcı kaydedilmedi)" : meta?.stored ? " · kalıcı analizden" : ""}.
            </p>
            <p className="mt-1">
              TerraLot · Cerberus Engine. Sayılar gerçek kaynaklardan türetilir (buy-box rubric + competitor_listings medyanları + FEMA/USGS/OSM/Census).
              Comp veya saha verisi olmayan alanlar &quot;{NOSRC}&quot; ile işaretlenir; uydurma değer üretilmez. Bu rapor yatırım tavsiyesi değildir; edinme öncesi yerinde DD şarttır.
            </p>
          </footer>
        </article>
      )}
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] font-extrabold tracking-widest px-2 py-1 rounded" style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>{n}</span>
      <h2 className="font-bold text-sm uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function HeadStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</p>
      <p className={`text-sm font-semibold ${mono ? "font-mono" : ""}`} style={{ color: "var(--foreground)" }}>{value}</p>
    </div>
  );
}

function BigStat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-lg font-extrabold tabular-nums" style={{ color: accent ? tone || "var(--accent-ink)" : "var(--foreground)" }}>{value}</p>
    </div>
  );
}

function FieldRow({ Icon, label, value, source, real, danger }: {
  Icon: typeof Waves; label: string; value: string; source: string; real: boolean; danger?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--surface-low)", borderColor: danger ? "var(--danger)" : "var(--surface-high)" }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: "var(--accent-ink)" }} /> {label}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={real ? { background: "rgba(15,157,88,0.12)", color: "var(--grade-a)" } : { background: "var(--surface-high)", color: "var(--muted)" }}>
          {real ? "GERÇEK" : "TAHMİNİ"}
        </span>
      </div>
      <p className="text-xs font-semibold" style={{ color: danger ? "var(--danger)" : "var(--foreground)" }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>kaynak: {source}</p>
    </div>
  );
}
