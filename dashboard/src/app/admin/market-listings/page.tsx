"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Home, Trees, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  state: string | null;
  county: string | null;
  property_address: string | null;
  acres: number | null;
  minimum_bid: number | null;   // Zillow liste fiyatı
  judgment_amount: number | null; // Zestimate / değer
  source: string | null;
  raw_url: string | null;
};

type SortKey = "acres" | "minimum_bid" | "judgment_amount" | "ppa";
type SortDir = "asc" | "desc";

const usd = (n: number | null | undefined) => (n == null ? "—" : "$" + Number(n).toLocaleString());

// $/acre — sadece geçerli fiyat + dönüm varsa
const ppaOf = (r: Row) =>
  r.minimum_bid != null && r.acres != null && r.acres > 0 ? r.minimum_bid / r.acres : null;

export default function MarketListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "land" | "house">("all");
  const [q, setQ] = useState("");

  // aralık filtreleri (client-side, mevcut veriden)
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minAcres, setMinAcres] = useState("");
  const [maxAcres, setMaxAcres] = useState("");

  // sıralama
  const [sortKey, setSortKey] = useState<SortKey>("minimum_bid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tax_delinquent_properties")
        .select("id,state,county,property_address,acres,minimum_bid,judgment_amount,source,raw_url")
        .like("source", "ZILLOW%")
        .order("minimum_bid", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (!cancelled) { setRows((data as Row[]) || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;
    const minA = minAcres ? Number(minAcres) : null;
    const maxA = maxAcres ? Number(maxAcres) : null;

    const out = rows.filter((r) => {
      if (tab === "land" && r.source !== "ZILLOW_LAND") return false;
      if (tab === "house" && r.source !== "ZILLOW_HOUSE") return false;
      if (q) {
        const s = `${r.county ?? ""} ${r.state ?? ""} ${r.property_address ?? ""}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      if (minP != null && (r.minimum_bid == null || r.minimum_bid < minP)) return false;
      if (maxP != null && (r.minimum_bid == null || r.minimum_bid > maxP)) return false;
      if (minA != null && (r.acres == null || r.acres < minA)) return false;
      if (maxA != null && (r.acres == null || r.acres > maxA)) return false;
      return true;
    });

    const get = (r: Row): number | null =>
      sortKey === "ppa" ? ppaOf(r)
        : sortKey === "acres" ? r.acres
          : sortKey === "minimum_bid" ? r.minimum_bid
            : r.judgment_amount;

    const dir = sortDir === "asc" ? 1 : -1;
    // null değerler her zaman sona düşer
    return [...out].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    });
  }, [rows, tab, q, minPrice, maxPrice, minAcres, maxAcres, sortKey, sortDir]);

  const land = rows.filter((r) => r.source === "ZILLOW_LAND").length;
  const house = rows.filter((r) => r.source === "ZILLOW_HOUSE").length;

  const hasRangeFilter = minPrice || maxPrice || minAcres || maxAcres;
  const clearRanges = () => { setMinPrice(""); setMaxPrice(""); setMinAcres(""); setMaxAcres(""); };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Piyasa İlanları (Zillow)</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Zillow&apos;dan çekilen ev &amp; arsa piyasa ilanları — comp/referans için. Tax-lead değildir, deal-screener&apos;dan ayrıdır.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {([["all", `Hepsi (${rows.length})`], ["land", `Arsa (${land})`], ["house", `Ev (${house})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: tab === k ? "var(--primary)" : "var(--surface-high)", color: tab === k ? "#fff" : "var(--fg)" }}>
            {label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="County / eyalet / adres ara..."
          className="flex-1 min-w-[220px] px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface)", border: "1px solid var(--surface-high)" }} />
      </div>

      {/* Aralık filtreleri */}
      <div className="flex items-end gap-4 flex-wrap rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
        <RangeField label="Liste Fiyatı ($)" minVal={minPrice} maxVal={maxPrice} onMin={setMinPrice} onMax={setMaxPrice} step="1000" />
        <RangeField label="Dönüm (acre)" minVal={minAcres} maxVal={maxAcres} onMin={setMinAcres} onMax={setMaxAcres} step="0.5" />
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
            {filtered.length.toLocaleString()} sonuç
          </span>
          {hasRangeFilter && (
            <button onClick={clearRanges}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: "var(--surface-high)", color: "var(--fg)" }}>
              <X className="w-3 h-3" /> Filtreyi temizle
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>İlan bulunamadı.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                <Th>Tür</Th>
                <Th>Konum</Th>
                <Th>Adres</Th>
                <SortTh label="Dönüm" col="acres" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Liste Fiyatı" col="minimum_bid" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="$/acre" col="ppa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Zestimate" col="judgment_amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => {
                const ppa = ppaOf(r);
                return (
                  <tr key={r.id} className="border-t transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                    <td className="py-3 px-4">
                      {r.source === "ZILLOW_LAND"
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--grade-a)" }}><Trees className="w-3 h-3" /> Arsa</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--accent-ink)" }}><Home className="w-3 h-3" /> Ev</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">{r.county}, {r.state}</td>
                    <td className="py-3 px-4 text-xs max-w-[260px] truncate" style={{ color: "var(--muted)" }}>{r.property_address || "—"}</td>
                    <td className="py-3 px-4 text-xs">{r.acres ? `${r.acres} ac` : "—"}</td>
                    <td className="py-3 px-4 text-xs font-bold">{usd(r.minimum_bid)}</td>
                    <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{ppa != null ? usd(Math.round(ppa)) : "—"}</td>
                    <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{usd(r.judgment_amount)}</td>
                    <td className="py-3 px-4">
                      {r.raw_url && (
                        <a href={r.raw_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--primary)" }}>
                          Aç <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
      {children}
    </th>
  );
}

function SortTh({ label, col, sortKey, sortDir, onSort }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: active ? "var(--primary)" : "var(--muted)" }}>
      <button onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity uppercase tracking-widest">
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}

function RangeField({ label, minVal, maxVal, onMin, onMax, step }: {
  label: string; minVal: string; maxVal: string; onMin: (v: string) => void; onMax: (v: string) => void; step: string;
}) {
  const inputStyle = { background: "var(--surface-low)", border: "1px solid var(--surface-high)" } as const;
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" min="0" step={step} value={minVal} onChange={(e) => onMin(e.target.value)} placeholder="min"
          className="w-24 px-3 py-2 rounded-lg text-xs tabular-nums" style={inputStyle} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>–</span>
        <input type="number" inputMode="numeric" min="0" step={step} value={maxVal} onChange={(e) => onMax(e.target.value)} placeholder="max"
          className="w-24 px-3 py-2 rounded-lg text-xs tabular-nums" style={inputStyle} />
      </div>
    </div>
  );
}
