"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Wallet, AlertTriangle, CheckCircle2, Clock, DollarSign, RotateCcw, TrendingUp, Users, Send, CreditCard, ShieldAlert, Loader2 } from "lucide-react";

// --- Real rows from Supabase ---
interface PaymentRow {
  id: string;
  propertyId: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  amount: number | null;
  type: "DOWN_PAYMENT" | "MONTHLY" | null;
  stripeId: string | null;
  status: "PENDING" | "PAID" | "OVERDUE" | "FAILED" | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string | null;
  property?: PropertyRow | null;
}
interface PropertyRow {
  id: string;
  title: string | null;
  state: string | null;
  price: number | null;
  downPayment: number | null;
  monthlyPayment: number | null;
  term: number | null;
  interestRate: number | null;
}

type ContractStatus = "current" | "late" | "defaulted" | "paid_off";

// A financing contract = a buyer + a property, aggregated from that buyer's Payment rows.
interface Contract {
  key: string;
  name: string;
  email: string;
  property: string;
  state: string;
  salePrice: number | null;
  downPayment: number | null;
  financed: number | null;
  rate: number | null;
  termMonths: number | null;
  monthlyPayment: number | null;
  paymentsMade: number;
  totalPaid: number;
  nextDue: string | null;
  status: ContractStatus;
  overdueCount: number;
  payments: PaymentRow[];
}

const statusConfig: Record<ContractStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  current: { label: "Current", bg: "rgba(80,220,140,0.1)", text: "#50dc8c", icon: CheckCircle2 },
  late: { label: "Late", bg: "rgba(255,180,60,0.1)", text: "#ffb43c", icon: Clock },
  defaulted: { label: "Defaulted", bg: "rgba(255,80,80,0.1)", text: "#ff5050", icon: AlertTriangle },
  paid_off: { label: "Paid Off", bg: "rgba(142,209,223,0.1)", text: "#8ed1df", icon: CheckCircle2 },
};

// Build buyer contracts out of individual payment rows (real data only).
function buildContracts(rows: PaymentRow[]): Contract[] {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    const key = `${r.buyerEmail || r.buyerName || "unknown"}::${r.propertyId || "?"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return Array.from(groups.entries()).map(([key, payments]) => {
    const prop = payments.find(p => p.property)?.property || null;
    const paidMonthly = payments.filter(p => p.status === "PAID" && p.type === "MONTHLY");
    const totalPaid = payments.filter(p => p.status === "PAID").reduce((s, p) => s + (p.amount || 0), 0);
    const overdueCount = payments.filter(p => p.status === "OVERDUE" || p.status === "FAILED").length;
    const pendingDues = payments.filter(p => p.status === "PENDING" && p.dueDate).map(p => p.dueDate!).sort();
    const allPaid = payments.length > 0 && payments.every(p => p.status === "PAID");

    let status: ContractStatus = "current";
    if (allPaid) status = "paid_off";
    else if (overdueCount >= 4) status = "defaulted";
    else if (overdueCount > 0) status = "late";

    const salePrice = prop?.price ?? null;
    const downPayment = prop?.downPayment ?? null;
    const financed = salePrice != null && downPayment != null ? salePrice - downPayment : null;

    return {
      key,
      name: payments[0].buyerName || payments[0].buyerEmail || "Unknown buyer",
      email: payments[0].buyerEmail || "—",
      property: prop?.title || "—",
      state: prop?.state || "—",
      salePrice,
      downPayment,
      financed,
      rate: prop?.interestRate ?? null,
      termMonths: prop?.term ?? null,
      monthlyPayment: prop?.monthlyPayment ?? null,
      paymentsMade: paidMonthly.length,
      totalPaid,
      nextDue: pendingDues[0] || null,
      status,
      overdueCount,
      payments: payments.sort((a, b) => (b.paidAt || b.createdAt || "").localeCompare(a.paidAt || a.createdAt || "")),
    };
  });
}

const money = (n: number | null | undefined) => (n == null ? "—" : `$${n.toLocaleString()}`);

export default function FinancingPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("Payment")
        .select("*, property:Property(id,title,state,price,downPayment,monthlyPayment,term,interestRate)")
        .order("createdAt", { ascending: false });
      if (cancelled) return;
      if (err) { setError(err.message); setRows([]); }
      else setRows((data as PaymentRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const contracts = useMemo(() => buildContracts(rows), [rows]);
  const filtered = filter === "all" ? contracts : contracts.filter(c => c.status === filter);
  const sel = contracts.find(c => c.key === selected) || filtered[0] || contracts[0];

  const totalFinanced = contracts.reduce((s, c) => s + (c.financed || 0), 0);
  const totalCollected = contracts.reduce((s, c) => s + c.totalPaid, 0);
  const monthlyIncome = contracts.filter(c => c.status === "current" || c.status === "late").reduce((s, c) => s + (c.monthlyPayment || 0), 0);
  const activeBuyersCount = contracts.filter(c => c.status === "current" || c.status === "late").length;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Seller Financing</p>
          <h1 className="text-2xl font-bold mt-1">Owner Finance Manager</h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Live from <code className="font-mono">Payment</code> × <code className="font-mono">Property</code> · {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {notification && (
          <div className="px-4 py-2 rounded-lg text-xs font-semibold animate-slideIn flex items-center gap-2 border bg-[var(--surface)] text-[var(--primary)] border-[var(--primary)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
            <span>{notification}</span>
          </div>
        )}
      </div>

      {/* Stats — derived from real rows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Financed", value: money(totalFinanced), icon: DollarSign, color: "var(--primary)" },
          { label: "Total Collected", value: money(totalCollected), icon: TrendingUp, color: "#50dc8c" },
          { label: "Monthly Income", value: `${money(monthlyIncome)}/mo`, icon: Wallet, color: "#a882ff" },
          { label: "Active Buyers", value: activeBuyersCount.toString(), icon: Users, color: "#ffb43c" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(255,80,80,0.08)", color: "#ff5050", border: "1px solid rgba(255,80,80,0.2)" }}>
          Supabase error: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm gap-2" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading financing contracts…
        </div>
      ) : contracts.length === 0 ? (
        /* Honest empty state — no fabricated buyers */
        <div className="rounded-xl border p-16 flex flex-col items-center justify-center text-center" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
          <Wallet className="w-12 h-12 mb-4" style={{ color: "var(--muted)" }} />
          <p className="font-semibold text-lg">No financing contracts yet</p>
          <p className="text-sm mt-2 max-w-md" style={{ color: "var(--muted)" }}>
            Contracts appear here automatically once buyers start owner-financed purchases. Each paid down payment or monthly installment in the <code className="font-mono">Payment</code> table is grouped into a buyer contract, with terms pulled from the linked property.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-2">
            {[["all", "All"], ["current", "Current"], ["late", "Late"], ["defaulted", "Defaulted"], ["paid_off", "Paid Off"]].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: filter === key ? "var(--primary)" : "var(--surface)", color: filter === key ? "#fff" : "var(--muted)" }}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contract list */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--surface-low)" }}>
                      <th className="text-left p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>Buyer</th>
                      <th className="text-left p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>Property</th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>Monthly</th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>Paid</th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>Remaining</th>
                      <th className="text-center p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const remaining = c.financed != null ? c.financed - (c.totalPaid - (c.downPayment || 0)) : null;
                      const st = statusConfig[c.status];
                      return (
                        <tr key={c.key} onClick={() => setSelected(c.key)}
                          className="border-t cursor-pointer transition-colors hover:bg-white/[0.02]"
                          style={{ borderColor: "rgba(255,255,255,0.03)", background: sel?.key === c.key ? "rgba(142,209,223,0.04)" : undefined }}>
                          <td className="p-3 font-semibold">{c.name}</td>
                          <td className="p-3" style={{ color: "var(--muted)" }}>{c.property}</td>
                          <td className="p-3 text-right font-mono">{money(c.monthlyPayment)}</td>
                          <td className="p-3 text-right font-mono">{money(c.totalPaid)}</td>
                          <td className="p-3 text-right font-mono">{remaining == null ? "—" : money(Math.max(0, remaining))}</td>
                          <td className="p-3 text-center">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail panel */}
            <div>
              {sel ? (() => {
                const remaining = sel.financed != null ? sel.financed - (sel.totalPaid - (sel.downPayment || 0)) : null;
                const progress = sel.financed ? ((sel.totalPaid - (sel.downPayment || 0)) / sel.financed) * 100 : 0;
                const st = statusConfig[sel.status];
                return (
                  <div className="rounded-xl border p-5 space-y-5 sticky top-6" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <div>
                        <h3 className="font-bold text-lg">{sel.name}</h3>
                        <p className="text-xs text-stone-400 mt-0.5">{sel.email}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                    </div>

                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      <span className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Contract Property</span>
                      <p className="font-semibold text-white">{sel.property}{sel.state !== "—" ? ` — ${sel.state}` : ""}</p>
                    </div>

                    {sel.termMonths != null && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: "var(--muted)" }}>Amortization Progress</span>
                          <span className="font-semibold">{sel.paymentsMade}/{sel.termMonths} months</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(progress, 100)}%`, background: st.text }} />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {[
                        { label: "Sale Price", value: money(sel.salePrice) },
                        { label: "Down Payment", value: money(sel.downPayment) },
                        { label: "Financed Principal", value: money(sel.financed) },
                        { label: "Interest Rate", value: sel.rate != null ? `${sel.rate}% APR` : "—" },
                        { label: "Monthly Payment", value: sel.monthlyPayment != null ? `${money(sel.monthlyPayment)}/mo` : "—" },
                        { label: "Term duration", value: sel.termMonths != null ? `${sel.termMonths} months` : "—" },
                        { label: "Total Received", value: money(sel.totalPaid) },
                        { label: "Outstanding Balance", value: remaining == null ? "—" : money(Math.max(0, remaining)) },
                      ].map(d => (
                        <div key={d.label}>
                          <p style={{ color: "var(--muted)" }} className="text-[10px]">{d.label}</p>
                          <p className="font-semibold">{d.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Admin actions — appear by real contract status */}
                    <div className="space-y-2.5 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <span className="block text-[10px] font-bold uppercase text-stone-500">Stripe Admin Actions</span>

                      {sel.status === "late" && (
                        <button onClick={() => showNotification(`Payment reminder queued for ${sel.name}.`)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all">
                          <Send className="w-3.5 h-3.5" /> Send Reminder
                        </button>
                      )}

                      {sel.status === "defaulted" && (
                        <div className="p-3 rounded-lg text-xs space-y-3" style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.15)" }}>
                          <p style={{ color: "#ff5050" }} className="flex items-center gap-1">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>Contract defaulted ({sel.overdueCount} missed). Property recoverable.</span>
                          </p>
                          <button onClick={() => showNotification(`Reclaim flow for "${sel.property}" — wire to Stripe + Property status to finish.`)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all border border-red-500/30">
                            <RotateCcw className="w-3.5 h-3.5" /> Reclaim & Relist Land
                          </button>
                        </div>
                      )}

                      {sel.status === "current" && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-stone-500 p-2.5 rounded bg-[var(--surface-high)]">
                            <span className="flex items-center gap-1"><CreditCard className="w-3 h-3 text-emerald-400" /> Autopay (Stripe)</span>
                            <span className="text-emerald-400 font-bold">{sel.payments.some(p => p.stripeId) ? "ACTIVE" : "—"}</span>
                          </div>
                          <div className="space-y-1.5 mt-2">
                            <span className="block text-[9px] font-bold uppercase text-stone-600">Recent Transactions</span>
                            {sel.payments.filter(p => p.status === "PAID").slice(0, 3).map(p => (
                              <div key={p.id} className="flex justify-between items-center text-[10px] p-2 rounded bg-black/20 text-stone-400">
                                <span>{(p.paidAt || p.createdAt || "").slice(0, 10)} · {p.stripeId || p.type}</span>
                                <span className="font-bold text-white">{money(p.amount)}</span>
                              </div>
                            ))}
                            {sel.payments.filter(p => p.status === "PAID").length === 0 && (
                              <p className="text-[10px] text-stone-600 italic">No paid transactions yet.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {sel.nextDue && sel.status !== "defaulted" && (
                      <div className="text-xs pt-2 text-stone-500">
                        Next payment due: <span className="font-semibold text-white">{sel.nextDue}</span>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="rounded-xl border p-12 flex flex-col items-center justify-center text-center" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                  <Wallet className="w-10 h-10 mb-3" style={{ color: "var(--muted)" }} />
                  <p className="font-semibold">Select a buyer</p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Click a row to view financing details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
