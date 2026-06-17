"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { simulateFlip, type FlipInputs } from "@/lib/flip-calc";
import { Calculator, Loader2, Search, DollarSign, CalendarClock } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// FLIP SIMULATOR — owner-finance flip economics from a tax-lead (or manual).
// Uses src/lib/flip-calc.ts for all math (cash-on-cash, IRR, amortization).
// ─────────────────────────────────────────────────────────────────────────────

interface LeadLite {
  id: string;
  state: string | null;
  county: string | null;
  acres: number | null;
  minimum_bid: number | null;
  final_score: number | null;
  property_address: string | null;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)}%`);

const NumberField = ({ label, value, onChange, suffix, step = 1 }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number;
}) => (
  <label className="block">
    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>{label}</span>
    <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
      {suffix === "$" && <span className="pl-2.5 text-xs" style={{ color: "var(--muted)" }}>$</span>}
      <input
        type="number" value={Number.isNaN(value) ? "" : value} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-2.5 py-2 text-sm bg-transparent outline-none tabular-nums"
      />
      {suffix && suffix !== "$" && <span className="pr-2.5 text-xs" style={{ color: "var(--muted)" }}>{suffix}</span>}
    </div>
  </label>
);

const Stat = ({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) => (
  <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{label}</div>
    <div className="text-xl font-extrabold tabular-nums" style={{ color: accent || "var(--foreground)" }}>{value}</div>
    {hint && <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{hint}</div>}
  </div>
);

export default function FlipSimPage() {
  const [inp, setInp] = useState<FlipInputs>({
    buyPrice: 5000,
    closingCost: 600,
    monthlyHolding: 40,
    holdingMonths: 3,
    resalePrice: 18000,
    downPct: 10,
    apr: 12,
    termMonths: 60,
    sellingCost: 500,
  });

  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Lead search for prefill
  useEffect(() => {
    if (q.trim().length < 2) { setLeads([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("tax_delinquent_properties")
        .select("id,state,county,acres,minimum_bid,final_score,property_address")
        .or(`county.ilike.%${q}%,property_address.ilike.%${q}%,apn.ilike.%${q}%`)
        .order("final_score", { ascending: false })
        .limit(15);
      setLeads((data as LeadLite[]) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const prefill = (l: LeadLite) => {
    setSelected(l.id);
    const buy = l.minimum_bid ?? inp.buyPrice;
    // naive resale estimate: 3.5x buy as a starting point (user edits)
    setInp((p) => ({ ...p, buyPrice: buy, resalePrice: Math.round(buy * 3.5) }));
  };

  const result = useMemo(() => {
    const safe: FlipInputs = {
      buyPrice: inp.buyPrice || 0,
      closingCost: inp.closingCost || 0,
      monthlyHolding: inp.monthlyHolding || 0,
      holdingMonths: Math.max(0, Math.round(inp.holdingMonths || 0)),
      resalePrice: inp.resalePrice || 0,
      downPct: Math.max(0, Math.min(100, inp.downPct || 0)),
      apr: inp.apr || 0,
      termMonths: Math.max(1, Math.round(inp.termMonths || 1)),
      sellingCost: inp.sellingCost || 0,
    };
    return simulateFlip(safe);
  }, [inp]);

  const set = (k: keyof FlipInputs) => (n: number) => setInp((p) => ({ ...p, [k]: n }));
  const profitColor = result.totalProfit >= 0 ? "var(--grade-a)" : "var(--error)";

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Calculator className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
          Flip Simülatörü
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Tax-sale alış → owner-finance satış ekonomisi. Cash-on-cash, IRR, aylık gelir takvimi ve kâr — dökümante formüllerle.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Inputs */}
        <div className="space-y-5">
          {/* Lead prefill */}
          <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <span className="text-sm font-bold">Tax-lead&apos;den doldur</span>
            </div>
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="county / adres / APN ara…"
              className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none"
              style={{ borderColor: "var(--outline)" }}
            />
            {loading && <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "var(--muted)" }}><Loader2 className="w-3 h-3 animate-spin" /> aranıyor…</div>}
            {leads.length > 0 && (
              <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                {leads.map((l) => (
                  <button key={l.id} onClick={() => prefill(l)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--surface-high)]"
                    style={{ background: selected === l.id ? "var(--surface-high)" : "transparent" }}>
                    <div className="font-semibold truncate">{l.acres ? `${l.acres}ac` : "Parcel"} — {l.county}, {l.state}</div>
                    <div className="tabular-nums" style={{ color: "var(--muted)" }}>min bid {fmt(l.minimum_bid)} · skor {l.final_score ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Alış & Tutma</div>
            <NumberField label="Alış fiyatı (tax-sale)" suffix="$" value={inp.buyPrice} onChange={set("buyPrice")} step={100} />
            <NumberField label="Kapanış maliyeti" suffix="$" value={inp.closingCost ?? 0} onChange={set("closingCost")} step={50} />
            <NumberField label="Aylık tutma maliyeti" suffix="$/ay" value={inp.monthlyHolding} onChange={set("monthlyHolding")} step={10} />
            <NumberField label="Tutma süresi" suffix="ay" value={inp.holdingMonths} onChange={set("holdingMonths")} />
          </div>

          <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Owner-Finance Satış</div>
            <NumberField label="Satış fiyatı" suffix="$" value={inp.resalePrice} onChange={set("resalePrice")} step={500} />
            <NumberField label="Peşinat" suffix="%" value={inp.downPct} onChange={set("downPct")} />
            <NumberField label="APR (faiz)" suffix="%" value={inp.apr} onChange={set("apr")} step={0.1} />
            <NumberField label="Vade" suffix="ay" value={inp.termMonths} onChange={set("termMonths")} />
            <NumberField label="Satış maliyeti" suffix="$" value={inp.sellingCost ?? 0} onChange={set("sellingCost")} step={50} />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Toplam Kâr" value={fmt(result.totalProfit)} accent={profitColor} hint={`ROI ${fmtPct(result.roi)}`} />
            <Stat label="Cash-on-Cash" value={fmtPct(result.cashOnCash)} accent="var(--accent-ink)" hint="1. yıl nakit / yatırılan" />
            <Stat label="IRR (yıllık)" value={result.irrAnnual == null ? "—" : fmtPct(result.irrAnnual)} accent="var(--accent-ink)" hint="aylık nakit akışından" />
            <Stat label="Aylık Ödeme" value={fmt(result.monthlyPayment)} hint={`${inp.termMonths} ay vade`} />
            <Stat label="Peşinat (kapanışta)" value={fmt(result.downPayment)} hint={`net ${fmt(result.netCashAtClose)} geri`} />
            <Stat label="Toplam Faiz Geliri" value={fmt(result.totalInterest)} hint={`toplanan ${fmt(result.totalCollected)}`} />
          </div>

          {/* capital summary */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <span className="text-sm font-bold">Sermaye & Getiri Özeti</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4 text-sm">
              {[
                ["Toplam yatırılan", fmt(result.totalInvested)],
                ["Finanse edilen", fmt(result.financedAmount)],
                ["Yıllık owner-fin. geliri", fmt(result.annualIncome)],
                ["Toplam toplanan", fmt(result.totalCollected)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k}</div>
                  <div className="font-bold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* schedule */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--surface-high)" }}>
              <CalendarClock className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
              <span className="text-sm font-bold">Aylık Gelir Takvimi</span>
              <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>{result.schedule.length} ödeme</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b sticky top-0" style={{ borderColor: "var(--surface-high)", background: "var(--surface)" }}>
                    {["Ay", "Ödeme", "Faiz", "Anapara", "Kalan", "Kümülatif"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((r) => (
                    <tr key={r.month} className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                      <td className="px-4 py-1.5 text-xs font-mono" style={{ color: "var(--muted)" }}>{r.month}</td>
                      <td className="px-4 py-1.5 text-xs tabular-nums font-semibold">{fmt(r.payment)}</td>
                      <td className="px-4 py-1.5 text-xs tabular-nums" style={{ color: "var(--warn)" }}>{fmt(r.interest)}</td>
                      <td className="px-4 py-1.5 text-xs tabular-nums">{fmt(r.principal)}</td>
                      <td className="px-4 py-1.5 text-xs tabular-nums" style={{ color: "var(--muted)" }}>{fmt(r.balance)}</td>
                      <td className="px-4 py-1.5 text-xs tabular-nums" style={{ color: "var(--grade-a)" }}>{fmt(r.cumCash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[10px] leading-relaxed rounded-lg border border-dashed p-3" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>Formüller:</span> aylık ödeme standart amortisman (P·i / (1−(1+i)⁻ⁿ)); IRR aylık nakit akışı üzerinde bisection ile çözülüp yıllığa çevrilir; cash-on-cash = 1. yıl net nakit / yatırılan sermaye. Tümü saf hesap (src/lib/flip-calc.ts), I/O yok.
          </div>
        </div>
      </div>
    </div>
  );
}
