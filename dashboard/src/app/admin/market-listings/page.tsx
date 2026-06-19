"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Home, Trees, ExternalLink } from "lucide-react";
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

const usd = (n: number | null | undefined) => (n == null ? "—" : "$" + Number(n).toLocaleString());

export default function MarketListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "land" | "house">("all");
  const [q, setQ] = useState("");

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

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab === "land" && r.source !== "ZILLOW_LAND") return false;
      if (tab === "house" && r.source !== "ZILLOW_HOUSE") return false;
      if (q) {
        const s = `${r.county ?? ""} ${r.state ?? ""} ${r.property_address ?? ""}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, tab, q]);

  const land = rows.filter((r) => r.source === "ZILLOW_LAND").length;
  const house = rows.filter((r) => r.source === "ZILLOW_HOUSE").length;

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
                {["Tür", "Konum", "Adres", "Dönüm", "Liste Fiyatı", "Zestimate", ""].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => (
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
                  <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{usd(r.judgment_amount)}</td>
                  <td className="py-3 px-4">
                    {r.raw_url && (
                      <a href={r.raw_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--primary)" }}>
                        Aç <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
