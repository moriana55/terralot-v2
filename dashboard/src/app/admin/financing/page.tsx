"use client";

import { useState } from "react";
import { Wallet, AlertTriangle, CheckCircle2, Clock, DollarSign, RotateCcw, TrendingUp, Users } from "lucide-react";

interface Buyer {
  id: string;
  name: string;
  email: string;
  phone: string;
  property: string;
  state: string;
  salePrice: number;
  downPayment: number;
  financed: number;
  rate: number;
  termMonths: number;
  monthlyPayment: number;
  paymentsMade: number;
  totalPaid: number;
  nextDue: string;
  status: "current" | "late" | "defaulted" | "paid_off";
  startDate: string;
  lateCount: number;
}

const buyers: Buyer[] = [
  {
    id: "b1", name: "James Wilson", email: "james@email.com", phone: "(512) 555-0123",
    property: "Lot A — North Ridge", state: "New Mexico", salePrice: 12900, downPayment: 1990,
    financed: 10910, rate: 9.9, termMonths: 60, monthlyPayment: 231,
    paymentsMade: 14, totalPaid: 5224, nextDue: "2026-06-15", status: "current", startDate: "2025-04-15", lateCount: 0,
  },
  {
    id: "b2", name: "Sarah Chen", email: "sarah.c@email.com", phone: "(480) 555-0456",
    property: "Block 1 — Trailhead", state: "Arizona", salePrice: 14900, downPayment: 2490,
    financed: 12410, rate: 10.9, termMonths: 48, monthlyPayment: 319,
    paymentsMade: 18, totalPaid: 8232, nextDue: "2026-06-01", status: "current", startDate: "2025-01-01", lateCount: 1,
  },
  {
    id: "b3", name: "Mike Torres", email: "mike.t@email.com", phone: "(623) 555-0789",
    property: "Block 2 — Creekside", state: "Arizona", salePrice: 15900, downPayment: 2990,
    financed: 12910, rate: 9.9, termMonths: 60, monthlyPayment: 274,
    paymentsMade: 8, totalPaid: 5182, nextDue: "2026-05-20", status: "late", startDate: "2025-09-20", lateCount: 3,
  },
  {
    id: "b4", name: "David Park", email: "d.park@email.com", phone: "(915) 555-0321",
    property: "Lot 1 — Road Front", state: "Texas", salePrice: 6900, downPayment: 990,
    financed: 5910, rate: 11.9, termMonths: 36, monthlyPayment: 197,
    paymentsMade: 36, totalPaid: 8082, nextDue: "-", status: "paid_off", startDate: "2023-06-01", lateCount: 2,
  },
  {
    id: "b5", name: "Robert King", email: "r.king@email.com", phone: "(505) 555-0654",
    property: "Desert Sun Parcel", state: "New Mexico", salePrice: 9900, downPayment: 1490,
    financed: 8410, rate: 10.9, termMonths: 48, monthlyPayment: 216,
    paymentsMade: 6, totalPaid: 2786, nextDue: "2026-04-01", status: "defaulted", startDate: "2025-10-01", lateCount: 5,
  },
  {
    id: "b6", name: "Lisa Nguyen", email: "lisa.n@email.com", phone: "(720) 555-0987",
    property: "Mountain View 5-Acre", state: "Colorado", salePrice: 19900, downPayment: 3990,
    financed: 15910, rate: 8.9, termMonths: 60, monthlyPayment: 330,
    paymentsMade: 10, totalPaid: 7290, nextDue: "2026-06-10", status: "current", startDate: "2025-08-10", lateCount: 0,
  },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  current: { label: "Current", bg: "rgba(80,220,140,0.1)", text: "#50dc8c", icon: CheckCircle2 },
  late: { label: "Late", bg: "rgba(255,180,60,0.1)", text: "#ffb43c", icon: Clock },
  defaulted: { label: "Defaulted", bg: "rgba(255,80,80,0.1)", text: "#ff5050", icon: AlertTriangle },
  paid_off: { label: "Paid Off", bg: "rgba(142,209,223,0.1)", text: "#8ed1df", icon: CheckCircle2 },
};

export default function FinancingPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = filter === "all" ? buyers : buyers.filter(b => b.status === filter);
  const sel = buyers.find(b => b.id === selected);

  const totalFinanced = buyers.reduce((s, b) => s + b.financed, 0);
  const totalCollected = buyers.reduce((s, b) => s + b.totalPaid, 0);
  const monthlyIncome = buyers.filter(b => b.status === "current" || b.status === "late").reduce((s, b) => s + b.monthlyPayment, 0);
  const defaultedValue = buyers.filter(b => b.status === "defaulted").reduce((s, b) => s + (b.financed - b.totalPaid + b.downPayment), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Seller Financing</p>
        <h1 className="text-2xl font-bold mt-1">Owner Finance Manager</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Financed", value: `$${totalFinanced.toLocaleString()}`, icon: DollarSign, color: "var(--primary)" },
          { label: "Total Collected", value: `$${totalCollected.toLocaleString()}`, icon: TrendingUp, color: "#50dc8c" },
          { label: "Monthly Income", value: `$${monthlyIncome.toLocaleString()}/mo`, icon: Wallet, color: "#a882ff" },
          { label: "Active Buyers", value: buyers.filter(b => b.status === "current" || b.status === "late").length.toString(), icon: Users, color: "#ffb43c" },
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

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "current", label: "Current" },
          { key: "late", label: "Late" },
          { key: "defaulted", label: "Defaulted" },
          { key: "paid_off", label: "Paid Off" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: filter === f.key ? "var(--primary)" : "var(--surface)",
              color: filter === f.key ? "#000" : "var(--muted)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Buyer List */}
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
                {filtered.map(b => {
                  const remaining = b.financed - (b.totalPaid - b.downPayment);
                  const st = statusConfig[b.status];
                  return (
                    <tr key={b.id} onClick={() => setSelected(b.id)}
                      className="border-t cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: "rgba(255,255,255,0.03)", background: selected === b.id ? "rgba(142,209,223,0.04)" : undefined }}>
                      <td className="p-3 font-semibold">{b.name}</td>
                      <td className="p-3" style={{ color: "var(--muted)" }}>{b.property}</td>
                      <td className="p-3 text-right font-mono">${b.monthlyPayment}</td>
                      <td className="p-3 text-right font-mono">${b.totalPaid.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">${Math.max(0, remaining).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        <div>
          {sel ? (() => {
            const remaining = sel.financed - (sel.totalPaid - sel.downPayment);
            const progress = ((sel.totalPaid - sel.downPayment) / sel.financed) * 100;
            const st = statusConfig[sel.status];
            const totalOwed = sel.monthlyPayment * sel.termMonths + sel.downPayment;
            const interestEarned = totalOwed - sel.salePrice;
            return (
              <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{sel.name}</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>
                    {st.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs" style={{ color: "var(--muted)" }}>
                  <p>{sel.email} · {sel.phone}</p>
                  <p>{sel.property} — {sel.state}</p>
                </div>

                {/* Payment Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--muted)" }}>Payment Progress</span>
                    <span className="font-semibold">{sel.paymentsMade}/{sel.termMonths} payments</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(progress, 100)}%`, background: st.text }} />
                  </div>
                </div>

                {/* Financial Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: "Sale Price", value: `$${sel.salePrice.toLocaleString()}` },
                    { label: "Down Payment", value: `$${sel.downPayment.toLocaleString()}` },
                    { label: "Financed", value: `$${sel.financed.toLocaleString()}` },
                    { label: "Rate", value: `${sel.rate}% APR` },
                    { label: "Monthly", value: `$${sel.monthlyPayment}/mo` },
                    { label: "Term", value: `${sel.termMonths} months` },
                    { label: "Total Paid", value: `$${sel.totalPaid.toLocaleString()}` },
                    { label: "Remaining", value: `$${Math.max(0, remaining).toLocaleString()}` },
                  ].map(d => (
                    <div key={d.label}>
                      <p style={{ color: "var(--muted)" }}>{d.label}</p>
                      <p className="font-semibold">{d.value}</p>
                    </div>
                  ))}
                </div>

                {/* Interest Earned */}
                <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(80,220,140,0.06)", border: "1px solid rgba(80,220,140,0.15)" }}>
                  <div className="flex justify-between">
                    <span style={{ color: "#50dc8c" }}>Interest Income (total)</span>
                    <span className="font-bold" style={{ color: "#50dc8c" }}>${interestEarned.toLocaleString()}</span>
                  </div>
                </div>

                {sel.lateCount > 0 && (
                  <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(255,180,60,0.06)", border: "1px solid rgba(255,180,60,0.15)" }}>
                    <AlertTriangle className="w-3 h-3 inline mr-1" style={{ color: "#ffb43c" }} />
                    <span style={{ color: "#ffb43c" }}>{sel.lateCount} late payment{sel.lateCount > 1 ? "s" : ""} on record</span>
                  </div>
                )}

                {sel.status === "defaulted" && (
                  <div className="p-3 rounded-lg text-xs space-y-2" style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.15)" }}>
                    <p style={{ color: "#ff5050" }}>
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Buyer defaulted. Land recoverable.
                    </p>
                    <p style={{ color: "var(--muted)" }}>
                      Collected ${sel.totalPaid.toLocaleString()} before default. Land can be resold.
                    </p>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,80,80,0.15)", color: "#ff5050" }}>
                      <RotateCcw className="w-3 h-3" /> Reclaim & Relist
                    </button>
                  </div>
                )}

                {sel.nextDue !== "-" && (
                  <div className="text-xs pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>
                    Next payment due: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{sel.nextDue}</span>
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
    </div>
  );
}
