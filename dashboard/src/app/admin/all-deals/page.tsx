"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal, RotateCcw, Download, Loader2, MapPin, ExternalLink,
  ChevronLeft, ChevronRight, Search, ShieldCheck, X, MailPlus,
} from "lucide-react";

type Deal = {
  id: string; source: string; sourceLabel: string; state: string; county: string;
  region: string; owner: string; ownerState: string; absentee: boolean; address: string;
  acres: number; landValue: number; estOffer: number; estResale: number; spread: number;
  score: number | null; apn: string; lat: number | null; lng: number | null; mapUrl: string;
  marketValue: number | null; comps: number; mailSafe: boolean; valBasis: string; dealGrade: string | null;
  useCode: string; mh: "likely" | "verify" | "unlikely" | null; mhReason: string;
};

const GRADE_UI: Record<string, string> = {
  A: "bg-emerald-600 text-white", B: "bg-sky-500 text-white", C: "bg-slate-300 text-slate-700",
};
type StateDetail = { state: string; count: number; acres: number; ppa: number | null; comps: number; withCompPct: number; absenteePct: number };
type Stats = {
  totalAcres: number; withComp: number; withCompPct: number; absenteePct: number;
  mhLikely?: number; mhLikelyPct?: number;
  compMarketSum: number; totalSpread: number; statePpa: Record<string, { ppa: number; n: number }>;
  byStateDetail: StateDetail[];
};
type ApiResp = {
  total: number; totalAll: number; page: number; pageSize: number; pages: number;
  byState: Record<string, number>; bySource: Record<string, number>;
  sourceLabels: Record<string, string>; stats?: Stats; rows: Deal[];
};

type ScrubStatus = "pass" | "warn" | "fail" | "unknown";
type ScrubFactor = { key: string; label: string; status: ScrubStatus; value: string; note: string; source: string; critical?: boolean };
type ScrubResult = { score: number; grade: string; verdict: string; verdictTone: string; rationale: string; factors: ScrubFactor[] };

type AttomComp = { address: string; saleAmt: number; saleDate: string; propType: string; apn: string };
type AttomResp = { ok: boolean; reason?: string; count: number; rawCount: number; bulkRemoved: number; median: number | null; comps: AttomComp[] };
type AttomTitle = { ok: boolean; reason?: string; owner: string; absentee: boolean | null; hasMortgage: boolean | null; deedType: string; mailing: string; lastSalePrice: number | null; lastSaleDate: string; annualTax: number | null };

const usd = (n: number) =>
  n >= 1000 ? "$" + Math.round(n).toLocaleString("en-US") : "$" + Math.round(n);

const STATUS_UI: Record<ScrubStatus, { dot: string; text: string; label: string }> = {
  pass: { dot: "bg-emerald-500", text: "text-emerald-700", label: "✓" },
  warn: { dot: "bg-amber-500", text: "text-amber-700", label: "!" },
  fail: { dot: "bg-rose-500", text: "text-rose-700", label: "✕" },
  unknown: { dot: "bg-slate-300", text: "text-slate-400", label: "?" },
};
const VERDICT_UI: Record<string, string> = {
  pass: "bg-emerald-600 text-white",
  warn: "bg-amber-500 text-white",
  fail: "bg-rose-600 text-white",
};
const SOURCE_COLOR: Record<string, string> = {
  mohave: "bg-amber-100 text-amber-700",
  dallas: "bg-emerald-100 text-emerald-700",
  "cheap-land": "bg-sky-100 text-sky-700",
  "propstream-nm": "bg-violet-100 text-violet-700",
};

export default function AllDealsPage() {
  const [state, setState] = useState("");
  const [source, setSource] = useState("");
  const [county, setCounty] = useState("");
  const [q, setQ] = useState("");
  const [minAcres, setMinAcres] = useState("");
  const [maxAcres, setMaxAcres] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [absentee, setAbsentee] = useState(false);
  const [onlyComp, setOnlyComp] = useState(false);
  const [mhOnly, setMhOnly] = useState(false); // ROAD Act MH-uygun filtresi
  const [gradeFilter, setGradeFilter] = useState("");
  const [minSpread, setMinSpread] = useState("");
  const [sort, setSort] = useState("spread");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showMarket, setShowMarket] = useState(false);

  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Detail + Scrub drawers ──
  const [detailFor, setDetailFor] = useState<Deal | null>(null);
  const [scrubFor, setScrubFor] = useState<Deal | null>(null);
  const [scrub, setScrub] = useState<ScrubResult | null>(null);
  const [scrubLoading, setScrubLoading] = useState(false);
  const [attom, setAttom] = useState<AttomResp | null>(null);
  const [attomLoading, setAttomLoading] = useState(false);
  const [title, setTitle] = useState<AttomTitle | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);

  const loadAttom = async (d: Deal) => {
    if (d.lat == null || d.lng == null) return;
    setAttom(null); setAttomLoading(true);
    const r: AttomResp | null = await fetch(`/api/admin/attom-comps?lat=${d.lat}&lng=${d.lng}`)
      .then((x) => x.json()).catch(() => null);
    setAttom(r); setAttomLoading(false);
  };
  const loadTitle = async (d: Deal) => {
    if (!d.address) return;
    setTitle(null); setTitleLoading(true);
    const city = (d.region || d.county).split("/")[0].trim();
    const loc = `${city}, ${d.state}`;
    const r: AttomTitle | null = await fetch(`/api/admin/attom-title?address=${encodeURIComponent(d.address)}&loc=${encodeURIComponent(loc)}`)
      .then((x) => x.json()).catch(() => null);
    setTitle(r); setTitleLoading(false);
  };
  const openDetail = (d: Deal) => { setDetailFor(d); setAttom(null); setTitle(null); };

  const openScrub = async (d: Deal) => {
    setScrubFor(d); setScrub(null); setScrubLoading(true);
    const p = new URLSearchParams();
    if (d.lat != null) p.set("lat", String(d.lat));
    if (d.lng != null) p.set("lon", String(d.lng));
    p.set("acres", String(d.acres));
    p.set("value", String(d.landValue));
    p.set("offer", String(d.estOffer));
    p.set("spread", String(d.spread));
    p.set("ownerState", d.ownerState);
    p.set("state", d.state);
    const r: ScrubResult | null = await fetch(`/api/admin/scrub?${p}`)
      .then((x) => x.json()).catch(() => null);
    setScrub(r); setScrubLoading(false);
  };

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (state) p.set("state", state);
    if (source) p.set("source", source);
    if (county) p.set("county", county);
    if (q) p.set("q", q);
    if (minAcres) p.set("minAcres", minAcres);
    if (maxAcres) p.set("maxAcres", maxAcres);
    if (minValue) p.set("minValue", minValue);
    if (maxValue) p.set("maxValue", maxValue);
    if (minSpread) p.set("minSpread", minSpread);
    if (absentee) p.set("absentee", "1");
    if (onlyComp) p.set("onlyComp", "1");
    if (mhOnly) p.set("mh", "1");
    if (gradeFilter) p.set("minGrade", gradeFilter);
    p.set("sort", sort);
    p.set("dir", dir);
    p.set("page", String(page));
    return p.toString();
  }, [state, source, county, q, minAcres, maxAcres, minValue, maxValue, minSpread, absentee, onlyComp, mhOnly, gradeFilter, sort, dir, page]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/all-deals?${qs}`)
        .then((r) => r.json())
        .then((d: ApiResp) => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [qs]);

  // reset to page 1 when any filter (not page) changes
  useEffect(() => { setPage(1); },
    [state, source, county, q, minAcres, maxAcres, minValue, maxValue, minSpread, absentee, onlyComp, mhOnly, gradeFilter, sort, dir]);

  const reset = () => {
    setState(""); setSource(""); setCounty(""); setQ("");
    setMinAcres(""); setMaxAcres(""); setMinValue(""); setMaxValue("");
    setMinSpread(""); setAbsentee(false); setOnlyComp(false); setMhOnly(false); setGradeFilter(""); setSort("spread"); setDir("desc"); setPage(1);
  };

  const toggleSort = (key: string) => {
    if (sort === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSort(key); setDir("desc"); }
  };
  const arrow = (key: string) => (sort === key ? (dir === "desc" ? " ↓" : " ↑") : "");

  const exportCsv = async () => {
    const p = new URLSearchParams(qs);
    p.set("pageSize", "500"); p.set("page", "1");
    const d: ApiResp = await fetch(`/api/admin/all-deals?${p}`).then((r) => r.json());
    const head = ["Grade", "State", "County", "Owner", "OwnerState", "Address", "Acres", "AssessedValue", "MarketValueComp", "Comps", "EstOffer", "Spread", "Absentee", "Source", "APN"];
    const lines = d.rows.map((r) =>
      [r.dealGrade ?? "", r.state, r.county, r.owner, r.ownerState, r.address, r.acres, r.landValue, r.marketValue ?? "", r.comps, r.estOffer, r.spread, r.absentee ? "Y" : "", r.sourceLabel, r.apn]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `terralot-deals${state ? "-" + state : ""}.csv`;
    a.click();
  };

  const states = data ? Object.entries(data.byState).sort((a, b) => b[1] - a[1]) : [];
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Birleşik Deal Tarayıcı · PropStream tarzı
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Tüm Dealler</h1>
          <p className="text-sm text-slate-500">
            Tüm kaynaklar tek yerde — eyalet eyalet filtrele, 50&apos;şer sayfa.{" "}
            {data && (
              <span className="font-semibold text-slate-700">
                {data.total.toLocaleString()} sonuç
                {state ? ` · ${state}` : ` · ${data.totalAll.toLocaleString()} toplam`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> Sıfırla
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* CoStar-style KPI band (real data) */}
      {data?.stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { l: "Sonuç", v: data.total.toLocaleString(), s: "deal" },
            { l: "Toplam alan", v: data.stats.totalAcres.toLocaleString(), s: "acre" },
            { l: "Comp-değerli", v: `%${data.stats.withCompPct}`, s: `${data.stats.withComp.toLocaleString()} parsel` },
            { l: "Absentee", v: `%${data.stats.absenteePct}`, s: "şehir-dışı sahip" },
            { l: "🏠 MH-uygun", v: `%${data.stats.mhLikelyPct ?? 0}`, s: `${(data.stats.mhLikely ?? 0).toLocaleString()} parsel (ROAD Act)` },
            { l: "Comp piyasa Σ", v: data.stats.compMarketSum >= 1e6 ? `$${(data.stats.compMarketSum / 1e6).toFixed(1)}M` : usd(data.stats.compMarketSum), s: "gerçek comp" },
            { l: "Spread Σ", v: data.stats.totalSpread >= 1e6 ? `$${(data.stats.totalSpread / 1e6).toFixed(1)}M` : usd(data.stats.totalSpread), s: "potansiyel" },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k.l}</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{k.v}</div>
              <div className="text-[10px] text-slate-400">{k.s}</div>
            </div>
          ))}
        </div>
      )}

      {/* Market özeti (CoStar tarzı per-state dökim) */}
      {data?.stats?.byStateDetail && data.stats.byStateDetail.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button onClick={() => setShowMarket((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <span>📊 Market Özeti — {data.stats.byStateDetail.length} eyalet (gerçek veri)</span>
            <span className="text-slate-400">{showMarket ? "▲" : "▼"}</span>
          </button>
          {showMarket && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Eyalet</th><th className="px-4 py-2 text-right">Deal</th>
                    <th className="px-4 py-2 text-right">Toplam acre</th><th className="px-4 py-2 text-right">$/acre (comp)</th>
                    <th className="px-4 py-2 text-right">Comp kapsama</th><th className="px-4 py-2 text-right">Absentee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.stats.byStateDetail.map((s) => (
                    <tr key={s.state} onClick={() => setState(s.state)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">{s.state}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.count.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{s.acres.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.ppa ? `$${s.ppa.toLocaleString()}` : <span className="text-amber-600 text-xs">comp gerekli</span>}<span className="ml-1 text-[10px] text-slate-400">{s.comps ? `${s.comps}c` : ""}</span></td>
                      <td className="px-4 py-2 text-right tabular-nums"><span className={s.withCompPct >= 50 ? "text-emerald-600" : "text-amber-600"}>%{s.withCompPct}</span></td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">%{s.absenteePct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* State chips */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setState("")}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${!state ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          Tümü {data && <span className="opacity-60">{data.totalAll.toLocaleString()}</span>}
        </button>
        {states.map(([st, n]) => {
          const ppa = data?.stats?.statePpa?.[st];
          return (
            <button key={st} onClick={() => setState(st)}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${state === st ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {st} <span className="opacity-60">{n.toLocaleString()}</span>
              {ppa && <span className={`ml-1 text-[10px] font-normal ${state === st ? "text-emerald-300" : "text-emerald-600"}`}>${ppa.ppa >= 1000 ? (ppa.ppa / 1000).toFixed(1) + "K" : ppa.ppa}/ac</span>}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4 lg:grid-cols-6">
        <label className="col-span-2 flex flex-col gap-1 lg:col-span-2">
          <span className="text-xs font-medium text-slate-500">Ara (sahip / adres / APN)</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör. LLC, Las Vegas…"
              className="w-full py-2 text-sm outline-none" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">County</span>
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="county / bölge"
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Kaynak</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none">
            <option value="">Tümü</option>
            {data && Object.entries(data.sourceLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}{data.bySource[k] ? ` (${data.bySource[k]})` : ""}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Acre (min–max)</span>
          <div className="flex gap-1">
            <input value={minAcres} onChange={(e) => setMinAcres(e.target.value)} placeholder="min" inputMode="decimal"
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none" />
            <input value={maxAcres} onChange={(e) => setMaxAcres(e.target.value)} placeholder="max" inputMode="decimal"
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Değer $ (min–max)</span>
          <div className="flex gap-1">
            <input value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="min" inputMode="numeric"
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none" />
            <input value={maxValue} onChange={(e) => setMaxValue(e.target.value)} placeholder="max" inputMode="numeric"
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Min spread $</span>
          <input value={minSpread} onChange={(e) => setMinSpread(e.target.value)} placeholder="ör. 5000" inputMode="numeric"
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none" />
        </label>
        <div className="col-span-2 flex items-end justify-between gap-2 md:col-span-1">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={absentee} onChange={(e) => setAbsentee(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300" />
            Absentee
          </label>
          <select value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); setSort(s); setDir(d as "asc" | "desc"); }}
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none">
            <option value="spread:desc">Spread ↓</option>
            <option value="marketValue:desc">Piyasa (comp) ↓</option>
            <option value="landValue:desc">Değer ↓</option>
            <option value="landValue:asc">Değer ↑ (en ucuz)</option>
            <option value="acres:desc">Acre ↓</option>
            <option value="acres:asc">Acre ↑</option>
            <option value="estOffer:asc">Teklif ↑ (en ucuz)</option>
          </select>
        </div>
      </div>

      {/* Hızlı filtre çipleri */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Hızlı:</span>
        <button onClick={() => setOnlyComp((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${onlyComp ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          💎 Sadece comp-değerli
        </button>
        <button onClick={() => setGradeFilter(gradeFilter === "A" ? "" : "A")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${gradeFilter === "A" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          Fırsat A
        </button>
        <button onClick={() => setGradeFilter(gradeFilter === "B" ? "" : "B")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${gradeFilter === "B" ? "bg-sky-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          Fırsat A+B
        </button>
        <button onClick={() => setAbsentee((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${absentee ? "bg-rose-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          Absentee
        </button>
        <button onClick={() => setMhOnly((v) => !v)}
          title="ROAD Act satış kozu: manufactured home koyulabilir sinyali taşıyan parseller (assessor kodu + bölge playbook'u; kesin izin county'den teyit edilmeli)"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${mhOnly ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          🏠 MH-uygun (ROAD Act)
        </button>
      </div>

      {/* Honesty note */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-800">
        <b>Değerleme:</b> <b>Değer (assd.)</b> = vergi dairesi assessed (piyasa değeri değil). <b>Piyasa (comp)</b> = rakip ilan medyanı $/acre × acre (gerçek comp; yetersizse “comp gerekli”).
        <b> Teklif</b> = piyasa × %15-20 · <b>Spread</b> = nakit satış (%65) − teklif. Comp yoksa hiçbir sayı uydurulmaz.
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3"><button onClick={() => toggleSort("state")} className="hover:text-slate-900">Eyalet{arrow("state")}</button></th>
                <th className="px-3 py-3"><button onClick={() => toggleSort("county")} className="hover:text-slate-900">County / Bölge{arrow("county")}</button></th>
                <th className="px-3 py-3"><button onClick={() => toggleSort("owner")} className="hover:text-slate-900">Sahip{arrow("owner")}</button></th>
                <th className="px-3 py-3">Adres</th>
                <th className="px-3 py-3 text-right"><button onClick={() => toggleSort("acres")} className="hover:text-slate-900">Acre{arrow("acres")}</button></th>
                <th className="px-3 py-3 text-right" title="Vergi dairesi (assessed) değeri — comp ile teyit edilmeli"><button onClick={() => toggleSort("landValue")} className="hover:text-slate-900">Değer (assd.){arrow("landValue")}</button></th>
                <th className="px-3 py-3 text-right" title="Comp-tabanlı piyasa değeri: rakip ilan medyanı $/acre × acre"><button onClick={() => toggleSort("marketValue")} className="hover:text-slate-900">Piyasa (comp){arrow("marketValue")}</button></th>
                <th className="px-3 py-3 text-right"><button onClick={() => toggleSort("estOffer")} className="hover:text-slate-900">Teklif{arrow("estOffer")}</button></th>
                <th className="px-3 py-3 text-right"><button onClick={() => toggleSort("spread")} className="hover:text-slate-900">Spread{arrow("spread")}</button></th>
                <th className="px-3 py-3">Kaynak</th>
                <th className="px-3 py-3 text-center">Scrub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={11} className="py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} className="py-16 text-center text-slate-400">
                  Bu filtreye uyan deal yok.
                </td></tr>
              )}
              {!loading && rows.map((d) => (
                <tr key={d.id} onClick={() => openDetail(d)} className="cursor-pointer hover:bg-slate-50/70">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {d.dealGrade && <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-black ${GRADE_UI[d.dealGrade]}`} title="Fırsat notu (comp-değerli)">{d.dealGrade}</span>}
                      <span className="font-bold text-slate-700">{d.state}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {d.county}{d.region && d.region !== d.county ? <span className="block text-xs text-slate-400">{d.region}</span> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-slate-800">{d.owner || "—"}</span>
                    {d.absentee && <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">absentee {d.ownerState}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {d.address || "—"}
                    {d.mh === "likely" && <span className="ml-1.5 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700" title={d.mhReason}>🏠 MH</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{d.acres ? d.acres.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{d.landValue ? usd(d.landValue) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {d.valBasis === "mismatch" ? (
                      <span className="text-[11px] font-medium text-amber-600" title="Comp ile assessed >4× ayrışıyor — bu parsel tipine uymuyor (ör. kırsal $/acre, şehir lotu). Elle doğrula.">⚠ comp uyumsuz</span>
                    ) : d.marketValue ? (
                      <span className="font-semibold text-slate-900">
                        {usd(d.marketValue)}
                        <span className="ml-1 text-[10px] font-normal text-slate-400">{d.comps}c</span>
                        {d.valBasis === "attom_region" && <span className="ml-1 rounded bg-indigo-100 px-1 text-[9px] font-bold text-indigo-700" title="ATTOM gerçek satış emsali (bölge $/acre) — en güvenilir">ATTOM</span>}
                        {d.valBasis === "state_comp" && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700" title="Eyalet medyanı — kaba. County comp gelince hassaslaşır.">eyalet</span>}
                        {d.valBasis === "county_comp" && <span className="ml-1 rounded bg-emerald-100 px-1 text-[9px] font-medium text-emerald-700" title="County-level comp — hassas">county</span>}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600">comp gerekli</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{d.estOffer ? usd(d.estOffer) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600">{d.spread ? usd(d.spread) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SOURCE_COLOR[d.source] ?? "bg-slate-100 text-slate-600"}`}>
                      {d.sourceLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openScrub(d); }} title="Scrub çalıştır"
                        className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> Scrub
                      </button>
                      {d.mapUrl && (
                        <a href={d.mapUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-emerald-600">
                          {d.lat ? <MapPin className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>Sayfa <b>{data.page}</b> / {data.pages} · {data.total.toLocaleString()} deal</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" /> Önceki
              </button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50">
                Sonraki <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deal detail drawer */}
      {detailFor && (() => {
        const d = detailFor;
        const valNode = d.valBasis === "mismatch"
          ? <span className="text-amber-600">⚠ comp uyumsuz</span>
          : d.marketValue ? <span className="text-slate-900">{usd(d.marketValue)} <span className="text-xs text-slate-400">· {d.comps} comp · {d.valBasis === "attom_region" ? "ATTOM gerçek satış" : d.valBasis === "county_comp" ? "county" : "eyalet"}</span></span>
          : <span className="text-amber-600">comp gerekli</span>;
        const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
          <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 py-1.5 text-sm">
            <span className="text-slate-500">{k}</span><span className="text-right font-medium text-slate-800">{v}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetailFor(null)}>
            <div className="absolute inset-0 bg-slate-900/30" />
            <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
                <div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_COLOR[d.source] ?? "bg-slate-100 text-slate-600"}`}>{d.sourceLabel}</span>
                  <div className="mt-1 font-bold text-slate-900">{d.owner || d.apn || "—"}</div>
                  <div className="text-xs text-slate-500">{d.address || "—"} · {d.state} / {d.county}</div>
                </div>
                <button onClick={() => setDetailFor(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Parsel</div>
                  <Row k="Eyalet / County" v={`${d.state} / ${d.county}`} />
                  {d.region && d.region !== d.county && <Row k="Bölge" v={d.region} />}
                  <Row k="Alan" v={d.acres ? `${d.acres.toFixed(2)} acre` : "—"} />
                  <Row k="APN" v={d.apn || "—"} />
                  {d.lat != null && <Row k="Koordinat" v={`${d.lat.toFixed(4)}, ${d.lng?.toFixed(4)}`} />}
                  {d.lat != null && d.lng != null && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <a href={`https://www.google.com/maps/@${d.lat},${d.lng},600m/data=!3m1!1e3`} target="_blank" rel="noreferrer"
                        className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700">🛰️ Uydu</a>
                      <a href={`https://www.google.com/maps?q=&layer=c&cbll=${d.lat},${d.lng}`} target="_blank" rel="noreferrer"
                        className="rounded-lg bg-slate-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700">👁️ Street View</a>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`} target="_blank" rel="noreferrer"
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">📍 Konum</a>
                    </div>
                  )}
                  {d.lat != null && <p className="mt-1 text-[10px] text-slate-400">Uydu/Street View = yol, elektrik direği, yapı var mı gözle kontrol (utility ön-bakış, bedava).</p>}
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Değerleme</div>
                  <Row k="Değer (assessed)" v={d.landValue ? usd(d.landValue) : "—"} />
                  <Row k="Piyasa (comp)" v={valNode} />
                  <Row k="Teklif (%15-20)" v={d.estOffer ? <span className="text-emerald-700">{usd(d.estOffer)}</span> : "—"} />
                  <Row k="Nakit satış (%65)" v={d.estResale ? usd(d.estResale) : "—"} />
                  <Row k="Spread" v={d.spread ? <span className="font-semibold text-emerald-600">{usd(d.spread)}</span> : "—"} />
                  {d.marketValue != null && d.valBasis !== "mismatch" && d.marketValue > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {[
                        { l: "Piyasa (comp)", val: d.marketValue, tone: "bg-slate-400" },
                        { l: "Nakit satış", val: d.estResale, tone: "bg-emerald-400" },
                        { l: "Teklif", val: d.estOffer, tone: "bg-slate-900" },
                      ].map((b) => (
                        <div key={b.l} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-[10px] text-slate-500">{b.l}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                            <div className={`h-full ${b.tone}`} style={{ width: `${Math.max(2, Math.min(100, (b.val / d.marketValue!) * 100))}%` }} />
                          </div>
                          <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-slate-600">{b.val ? usd(b.val) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!d.mailSafe && d.marketValue != null && d.valBasis !== "mismatch" && (
                    <p className="mt-2 text-[11px] text-amber-600">⚠ Comp güveni düşük — otomatik mail atma, doğrula.</p>
                  )}
                </div>
                {d.dealGrade && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded text-xs font-black ${GRADE_UI[d.dealGrade]}`}>{d.dealGrade}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fırsat Gerekçesi</span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {[
                        { ok: d.absentee, t: "Absentee (şehir-dışı sahip) — motive satıcı", w: 2 },
                        { ok: d.acres >= 0.2 && d.acres <= 5, t: "İdeal boyut (0.2–5 acre)", w: 2 },
                        { ok: d.mailSafe, t: "Comp güveni yeterli (mailSafe)", w: 1 },
                        { ok: d.marketValue != null && d.landValue > 0 && d.marketValue > d.landValue, t: "Comp > assessed (değerli alım)", w: 1 },
                      ].map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className={r.ok ? "text-emerald-600" : "text-slate-300"}>{r.ok ? "✓" : "○"}</span>
                          <span className={r.ok ? "text-slate-700" : "text-slate-400"}>{r.t}</span>
                          <span className="ml-auto text-[10px] text-slate-400">+{r.w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sahip</div>
                  <Row k="Ad" v={d.owner || "—"} />
                  <Row k="Mailing eyaleti" v={d.ownerState || "—"} />
                  <Row k="Durum" v={d.absentee ? <span className="text-rose-600">Absentee (şehir-dışı)</span> : "Eyalet içi"} />
                </div>
                {/* ROAD Act MH-uygunluk — dürüst sinyal (assessor kodu + bölge playbook, teyit şerhli) */}
                {d.mh && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Manufactured Home (ROAD Act)</div>
                    <Row k="Sinyal" v={
                      d.mh === "likely" ? <span className="font-semibold text-teal-700">🏠 MH-uygun (teyit şerhli)</span>
                      : d.mh === "verify" ? <span className="text-amber-600">County teyidi şart</span>
                      : <span className="text-slate-500">Uygun değil</span>
                    } />
                    {d.useCode && <Row k="Kullanım kodu" v={d.useCode} />}
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{d.mhReason}</p>
                  </div>
                )}
                {/* ATTOM gerçek satışlar */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Yakındaki Gerçek Satışlar · ATTOM</span>
                    <button onClick={() => loadAttom(d)} disabled={d.lat == null || attomLoading}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
                      {attomLoading ? "Çekiliyor…" : "Satışları çek"}
                    </button>
                  </div>
                  {d.lat == null && <p className="text-[11px] text-amber-600">Koordinat yok — ATTOM bu satırda çekemiyor.</p>}
                  {attom && attom.ok && (
                    <>
                      <div className="mb-2 flex items-baseline gap-2 text-sm">
                        <span className="font-bold text-slate-900">{attom.median != null ? usd(attom.median) : "—"}</span>
                        <span className="text-[11px] text-slate-500">median · {attom.count} temiz satış{attom.bulkRemoved ? ` (${attom.bulkRemoved} bulk elendi)` : ""}</span>
                      </div>
                      <ul className="space-y-1">
                        {attom.comps.slice(0, 8).map((c, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-2 border-b border-slate-50 py-1 text-[12px]">
                            <span className="truncate text-slate-600">{c.saleDate} · {c.address || c.apn}</span>
                            <span className="shrink-0 font-medium tabular-nums text-emerald-700">{usd(c.saleAmt)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[10px] text-slate-400">Gerçek tapu satışları (ATTOM). Karışık boyut olabilir — $/acre normalizasyonu sonraki adım.</p>
                    </>
                  )}
                  {attom && !attom.ok && <p className="text-[11px] text-amber-600">{attom.reason || "ATTOM verisi alınamadı."}</p>}
                  {attom && attom.ok && attom.count === 0 && <p className="text-[11px] text-slate-400">Bu çevrede ATTOM satış kaydı yok.</p>}
                </div>

                {/* ATTOM tapu ön-kontrol */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tapu Ön-Kontrol · ATTOM</span>
                    <button onClick={() => loadTitle(d)} disabled={!d.address || titleLoading}
                      className="rounded-lg bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                      {titleLoading ? "Kontrol…" : "Tapu kontrol"}
                    </button>
                  </div>
                  {!d.address && <p className="text-[11px] text-amber-600">Adres yok — ATTOM tapu çekemiyor.</p>}
                  {title && title.ok && (
                    <ul className="space-y-1 text-sm">
                      <li className="flex justify-between"><span className="text-slate-500">ATTOM sahip</span><span className="font-medium text-slate-800">{title.owner || "—"}</span></li>
                      <li className="flex justify-between"><span className="text-slate-500">Sahip durumu</span><span className="font-medium">{title.absentee ? <span className="text-rose-600">Absentee</span> : title.absentee === false ? "Yerel" : "—"}</span></li>
                      <li className="flex justify-between"><span className="text-slate-500">İpotek (ATTOM)</span><span className="font-semibold">{title.hasMortgage ? <span className="text-amber-600">VAR — title company incele</span> : <span className="text-emerald-600">görünmüyor ✓</span>}</span></li>
                      <li className="flex justify-between"><span className="text-slate-500">Deed tipi</span><span className="font-medium text-slate-700">{title.deedType || "—"}</span></li>
                      <li className="flex justify-between"><span className="text-slate-500">Sahip ne zaman/kaça almış</span><span className="font-medium text-slate-800">{title.lastSalePrice ? `${usd(title.lastSalePrice)} · ${title.lastSaleDate?.slice(0, 4)}` : "kayıt yok"}</span></li>
                      <li className="flex justify-between"><span className="text-slate-500">Yıllık vergi</span><span className="font-medium text-slate-700">{title.annualTax != null ? usd(title.annualTax) : "—"}</span></li>
                      {title.lastSalePrice != null && title.lastSalePrice > 0 && (
                        <li className="text-[10px] text-slate-500">{title.lastSalePrice <= 1500 ? "✅ Düşük alış/miras — teklifimize açık olabilir." : `⚠ ${usd(title.lastSalePrice)}'a almış — teklif buna göre ayarla (düşük teklife hayır diyebilir).`}</li>
                      )}
                      <li className="mt-1 text-[10px] text-slate-400">⚠ Ön-kontrol — vergi/yargı lien&apos;lerini KAPSAMAZ. Kesin temizlik kapanmadan <b>title company</b> ile.</li>
                    </ul>
                  )}
                  {title && !title.ok && <p className="text-[11px] text-amber-600">{title.reason || "ATTOM tapu kaydı bulunamadı."}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setDetailFor(null); openScrub(d); }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                    <ShieldCheck className="h-4 w-4" /> Scrub çalıştır
                  </button>
                  {d.owner && d.address && d.valBasis !== "mismatch" && (
                    <a
                      href={`/admin/mailer?prefill=1&owner=${encodeURIComponent(d.owner)}&addr=${encodeURIComponent(d.address)}&deal=${encodeURIComponent(d.address.split(",")[0].trim())}&tpl=tpl3&dealId=${encodeURIComponent(d.id)}&mv=${d.marketValue ?? d.landValue ?? 0}&county=${encodeURIComponent(d.county ?? "")}&st=${encodeURIComponent(d.state ?? "")}&acres=${d.acres ?? ""}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                      <MailPlus className="h-4 w-4" /> Mektup At
                    </a>
                  )}
                  {d.mapUrl && (
                    <a href={d.mapUrl} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                      <MapPin className="h-4 w-4" /> Harita
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Scrub drawer */}
      {scrubFor && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setScrubFor(null)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Parsel Scrub</div>
                <div className="font-bold text-slate-900">{scrubFor.owner || scrubFor.apn}</div>
                <div className="text-xs text-slate-500">{scrubFor.state} · {scrubFor.county} · {scrubFor.acres ? scrubFor.acres.toFixed(2) : "—"} acre</div>
              </div>
              <button onClick={() => setScrubFor(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5">
              {scrubLoading && (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  <p className="mt-2 text-sm">FEMA + OpenStreetMap sorgulanıyor…</p>
                </div>
              )}
              {!scrubLoading && scrub && (
                <>
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-black ${VERDICT_UI[scrub.verdictTone] ?? "bg-slate-500 text-white"}`}>
                      {scrub.grade}
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${scrub.verdictTone === "pass" ? "text-emerald-700" : scrub.verdictTone === "warn" ? "text-amber-700" : "text-rose-700"}`}>{scrub.verdict}</div>
                      <div className="text-sm text-slate-600">{scrub.rationale}</div>
                      <div className="mt-0.5 text-xs text-slate-400">Skor {scrub.score}/100</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {scrub.factors.map((f) => (
                      <div key={f.key} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_UI[f.status].dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800">{f.label}</span>
                            <span className={`text-sm font-medium ${STATUS_UI[f.status].text}`}>{f.value}</span>
                          </div>
                          <p className="text-xs text-slate-500">{f.note}</p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">Kaynak: {f.source}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!scrubLoading && !scrub && (
                <p className="py-16 text-center text-sm text-slate-400">Scrub alınamadı.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
