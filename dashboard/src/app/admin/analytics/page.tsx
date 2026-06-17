"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, DollarSign, Wallet, ArrowUpRight,
  MapPin, Sparkles, BarChart3, ChevronDown, ChevronUp, Calculator, Loader2
} from "lucide-react";

type SortKey = "title" | "state" | "costPrice" | "price" | "profit" | "roi" | "collected" | "status";
type SortDir = "asc" | "desc";
type TermOption = 12 | 24 | 36;

export default function AdminAnalytics() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [simTerm, setSimTerm] = useState<TermOption>(24);

  useEffect(() => {
    fetch("/api/admin/property?view=analytics")
      .then((r) => r.json())
      .then(({ properties: data }) => { setProperties(data?.map((p: any) => ({ ...p, costPrice: p.costPrice ?? 0, paymentsReceived: p.paymentsReceived ?? 0, status: p.status?.toLowerCase() })) ?? []); setLoading(false); })
      .catch(() => { setProperties([]); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-40 gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  const statesList = ["All", ...Array.from(new Set(properties.map((p: any) => p.state))).sort()];

  const filtered = properties
    .filter((p: any) => selectedState === "All" || p.state === selectedState)
    .filter((p: any) => statusFilter === "All" || p.status === statusFilter);

  const sorted = [...filtered].sort((a, b) => {
    const profitA = a.price - a.costPrice;
    const profitB = b.price - b.costPrice;
    const roiA = a.costPrice > 0 ? profitA / a.costPrice : 0;
    const roiB = b.costPrice > 0 ? profitB / b.costPrice : 0;
    const collectedA = a.downPayment + (a.monthlyPayment * a.paymentsReceived);
    const collectedB = b.downPayment + (b.monthlyPayment * b.paymentsReceived);
    let cmp = 0;
    switch (sortKey) {
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "state": cmp = a.state.localeCompare(b.state); break;
      case "costPrice": cmp = a.costPrice - b.costPrice; break;
      case "price": cmp = a.price - b.price; break;
      case "profit": cmp = profitA - profitB; break;
      case "roi": cmp = roiA - roiB; break;
      case "collected": cmp = collectedA - collectedB; break;
      case "status": cmp = a.status.localeCompare(b.status); break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  // KPIs
  const soldProps = filtered.filter(p => p.status === "sold");
  const totalCost = filtered.reduce((s, p) => s + p.costPrice, 0);
  const totalRetail = filtered.reduce((s, p) => s + p.price, 0);
  const totalProfit = totalRetail - totalCost;
  const totalCollected = soldProps.reduce((s, p) => s + p.downPayment + (p.monthlyPayment * p.paymentsReceived), 0);
  const totalMonthlyIncome = soldProps.reduce((s, p) => s + p.monthlyPayment, 0);
  const totalMonthlyExpenses = filtered.reduce((s, p) => s + p.monthlyExpenses, 0);
  const netMonthly = totalMonthlyIncome - totalMonthlyExpenses;
  const overallROI = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

  // Installment simulation per term
  function simForTerm(term: TermOption) {
    const totalDown = filtered.reduce((s, p) => s + p.downPayment, 0);
    const totalMonthly = filtered.reduce((s, p) => s + Math.round((p.price - p.downPayment) / term), 0);
    const totalRevenue = totalDown + (totalMonthly * term);
    const netProfit = totalRevenue - totalCost;
    const breakEvenMonth = totalCost > 0 ? Math.ceil((totalCost - totalDown) / (totalMonthly > 0 ? totalMonthly : 1)) : 0;
    return { term, totalDown, totalMonthly, totalRevenue, netProfit, breakEvenMonth };
  }

  const sims = ([12, 24, 36] as TermOption[]).map(simForTerm);
  const activeSim = simForTerm(simTerm);

  // Monthly projection for active sim
  const simMonths = Array.from({ length: simTerm }, (_, i) => {
    const income = activeSim.totalMonthly + (i === 0 ? activeSim.totalDown : 0);
    const cumIncome = activeSim.totalDown + activeSim.totalMonthly * (i + 1);
    const cumExpenses = totalMonthlyExpenses * (i + 1);
    const cumNet = cumIncome - totalCost - cumExpenses;
    return { month: i + 1, income, cumIncome, cumExpenses, cumNet };
  });
  const maxCum = Math.max(...simMonths.map(m => m.cumIncome), 1);

  // State summary
  const stateStats = Array.from(new Set(filtered.map(p => p.state))).map(st => {
    const ps = filtered.filter(p => p.state === st);
    const cost = ps.reduce((s, p) => s + p.costPrice, 0);
    const retail = ps.reduce((s, p) => s + p.price, 0);
    const sold = ps.filter(p => p.status === "sold");
    const collected = sold.reduce((s, p) => s + p.downPayment + (p.monthlyPayment * p.paymentsReceived), 0);
    const mrr = sold.reduce((s, p) => s + p.monthlyPayment, 0);
    return { state: st, count: ps.length, soldCount: sold.length, cost, retail, profit: retail - cost, collected, mrr };
  }).sort((a, b) => b.profit - a.profit);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Parcel Financial Analysis</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Cost, revenue, profit & installment simulation per parcel
          </p>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white cursor-pointer">
            <option value="All">All Status</option>
            <option value="sold">Sold</option>
            <option value="pending">Pending</option>
            <option value="available">Available</option>
          </select>
        </div>
      </div>

      {/* State Filter */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl border border-slate-200 bg-slate-50 mb-8">
        {statesList.slice(0, 10).map(st => (
          <button key={st} onClick={() => setSelectedState(st)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={{
              background: selectedState === st ? "var(--secondary)" : "transparent",
              color: selectedState === st ? "#fff" : "var(--muted)"
            }}>
            {st}
          </button>
        ))}
        {statesList.length > 10 && (
          <select onChange={e => setSelectedState(e.target.value)} value={selectedState}
            className="px-2 py-1 rounded text-xs border-0 bg-transparent cursor-pointer font-bold"
            style={{ color: "var(--muted)" }}>
            {statesList.slice(10).map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        {[
          { icon: Wallet, label: "Total Acquisition", value: `$${totalCost.toLocaleString()}`, sub: `${filtered.length} parcels`, color: "text-amber-700", bg: "bg-amber-50" },
          { icon: DollarSign, label: "Total Retail Value", value: `$${totalRetail.toLocaleString()}`, sub: `Avg $${filtered.length > 0 ? Math.round(totalRetail / filtered.length).toLocaleString() : 0}`, color: "text-blue-700", bg: "bg-blue-50" },
          { icon: TrendingUp, label: "Gross Profit", value: `$${totalProfit.toLocaleString()}`, sub: `${overallROI}% ROI`, color: "text-emerald-700", bg: "bg-emerald-50" },
          { icon: ArrowUpRight, label: "Collected So Far", value: `$${totalCollected.toLocaleString()}`, sub: `${soldProps.length} sold`, color: "text-violet-700", bg: "bg-violet-50" },
          { icon: BarChart3, label: "Net Monthly", value: `$${netMonthly.toLocaleString()}/mo`, sub: `In $${totalMonthlyIncome.toLocaleString()} — Out $${totalMonthlyExpenses.toLocaleString()}`, color: netMonthly >= 0 ? "text-emerald-700" : "text-red-600", bg: netMonthly >= 0 ? "bg-emerald-50" : "bg-red-50" },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-5 border border-slate-200 bg-white shadow-sm relative overflow-hidden">
            <div className={`absolute top-4 right-4 w-8 h-8 rounded flex items-center justify-center ${c.bg} border border-slate-200`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-[var(--muted)]">{c.label}</p>
            <h3 className={`text-xl font-extrabold mb-1 ${c.color}`}>{c.value}</h3>
            <p className="text-[10px] text-[var(--muted)]">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Installment Simulation */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--secondary)]" />
              Installment Plan Simulation
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Compare 12, 24, 36-month plans — same inventory, different cash flow speeds
            </p>
          </div>
        </div>

        {/* 3 Plan Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {sims.map(sim => {
            const active = sim.term === simTerm;
            return (
              <button key={sim.term} onClick={() => setSimTerm(sim.term)}
                className="text-left rounded-xl p-5 border-2 transition-all cursor-pointer"
                style={{
                  borderColor: active ? "var(--secondary)" : "rgba(226,232,240,1)",
                  background: active ? "rgba(142,209,223,0.06)" : "white",
                }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-extrabold">{sim.term} Months</span>
                  {active && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--secondary)] text-white">Active</span>}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Down Payments</span>
                    <span className="font-bold font-mono">${sim.totalDown.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Monthly Income</span>
                    <span className="font-bold font-mono text-blue-700">${sim.totalMonthly.toLocaleString()}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Total Revenue</span>
                    <span className="font-bold font-mono text-emerald-700">${sim.totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Net Profit</span>
                    <span className="font-extrabold font-mono text-emerald-700">${sim.netProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Break-even</span>
                    <span className="font-bold text-amber-700">Month {sim.breakEvenMonth}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cumulative Chart for selected term */}
        <div className="mt-2">
          <h4 className="text-sm font-bold mb-1">Cumulative Revenue vs Cost — {simTerm}-Month Plan</h4>
          <p className="text-[10px] mb-4" style={{ color: "var(--muted)" }}>
            Bar = cumulative revenue · Red line = total acquisition cost · Green area = profit zone
          </p>
          <div className="h-48 flex items-end gap-[2px] relative">
            {/* Cost line */}
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400" style={{ bottom: `${(totalCost / maxCum) * 180}px` }}>
              <span className="absolute -top-4 left-1 text-[9px] font-bold text-red-500">Cost: ${totalCost.toLocaleString()}</span>
            </div>
            {simMonths.filter((_, i) => {
              if (simTerm <= 12) return true;
              if (simTerm <= 24) return i % 2 === 0;
              return i % 3 === 0;
            }).map(m => {
              const h = (m.cumIncome / maxCum) * 180;
              const isProfitable = m.cumNet > 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-t transition-all" style={{
                    height: `${h}px`,
                    background: isProfitable ? "linear-gradient(to top, #10b981, #34d399)" : "linear-gradient(to top, #3b82f6, #60a5fa)",
                    minHeight: 4,
                  }} />
                  <span className="text-[8px] font-bold" style={{ color: "var(--muted)" }}>{m.month}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] font-bold">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Below break-even</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Profit zone</span>
            <span className="flex items-center gap-1"><span className="w-6 border-t-2 border-dashed border-red-400" /> Acq. cost</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Monthly Income vs Expenses */}
        <div className="rounded-xl p-6 border border-slate-200 lg:col-span-2 bg-white shadow-sm">
          <h3 className="text-base font-bold mb-1">Actual Monthly Income vs Expenses</h3>
          <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>Based on current sold parcels & holding costs</p>
          <div className="h-48 flex items-end gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const activeSold = soldProps.filter(p => p.paymentsReceived > i);
              const income = activeSold.reduce((s, p) => s + p.monthlyPayment, 0);
              const expenses = totalMonthlyExpenses;
              const maxVal = Math.max(totalMonthlyIncome, totalMonthlyExpenses, 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 160 }}>
                    <div className="w-full rounded-t bg-emerald-500" style={{ height: `${(income / maxVal) * 140}px`, minHeight: 2 }} />
                    <div className="w-full rounded-b bg-red-500 opacity-60" style={{ height: `${(expenses / maxVal) * 140}px`, minHeight: 2 }} />
                  </div>
                  <span className="text-[9px] font-bold" style={{ color: "var(--muted)" }}>M{i + 1}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 text-[10px] font-bold">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Income</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 opacity-60" /> Expenses</span>
          </div>
        </div>

        {/* State P&L */}
        <div className="rounded-xl p-6 border border-slate-200 bg-white shadow-sm">
          <h3 className="text-base font-bold mb-1">State P&L</h3>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>By gross profit</p>
          <div className="space-y-3 max-h-52 overflow-y-auto">
            {stateStats.slice(0, 10).map(row => {
              const maxProfit = stateStats[0]?.profit || 1;
              const pct = Math.round((row.profit / maxProfit) * 100);
              return (
                <div key={row.state}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold flex items-center gap-1"><MapPin className="w-3 h-3 text-[var(--secondary)]" />{row.state}</span>
                    <span className="font-mono text-emerald-700 font-bold">${row.profit.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded w-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded bg-[var(--secondary)]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>
                    <span>{row.count} parcels ({row.soldCount} sold)</span>
                    <span>MRR: ${row.mrr.toLocaleString()}/mo</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Parcel Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Parcel-by-Parcel Financials</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {sorted.length} parcels — click headers to sort
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Profit Analysis
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider bg-slate-50" style={{ color: "var(--muted)" }}>
                {([
                  ["title", "Parcel"],
                  ["state", "State"],
                  ["costPrice", "Acq. Cost"],
                  ["price", "Sale Price"],
                  ["profit", "Profit"],
                  ["roi", "ROI"],
                  ["collected", "Collected"],
                  ["status", "Status"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="p-3 cursor-pointer select-none hover:text-[var(--foreground)] transition-colors" onClick={() => toggleSort(key)}>
                    <span className="flex items-center gap-1">{label} <SortIcon k={key} /></span>
                  </th>
                ))}
                <th className="p-3">Monthly</th>
                <th className="p-3">Expenses</th>
                <th className="p-3">Net/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sorted.slice(0, 50).map(p => {
                const profit = p.price - p.costPrice;
                const roi = p.costPrice > 0 ? Math.round((profit / p.costPrice) * 100) : 0;
                const collected = p.downPayment + (p.monthlyPayment * p.paymentsReceived);
                const netMo = p.status === "sold" ? p.monthlyPayment - p.monthlyExpenses : -p.monthlyExpenses;
                const remaining = p.price - collected;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 max-w-[200px]">
                      <span className="font-semibold text-xs block truncate">{p.title}</span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>{p.acres} ac · {p.county}</span>
                    </td>
                    <td className="p-3 text-xs font-medium">{p.state}</td>
                    <td className="p-3 font-mono text-xs font-bold text-amber-700">${p.costPrice.toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs font-bold text-blue-700">${p.price.toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs font-bold text-emerald-700">${profit.toLocaleString()}</td>
                    <td className="p-3 text-xs font-bold text-emerald-600">+{roi}%</td>
                    <td className="p-3">
                      <span className="font-mono text-xs font-bold text-violet-700">${collected.toLocaleString()}</span>
                      {p.status === "sold" && remaining > 0 && (
                        <span className="text-[9px] block" style={{ color: "var(--muted)" }}>${remaining.toLocaleString()} left</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{
                          background: p.status === "sold" ? "rgba(16,185,129,0.1)" : p.status === "pending" ? "rgba(251,185,131,0.1)" : "rgba(142,209,223,0.1)",
                          color: p.status === "sold" ? "#059669" : p.status === "pending" ? "#d97706" : "var(--primary)",
                        }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs font-bold" style={{ color: p.status === "sold" ? "#059669" : "var(--muted)" }}>
                      {p.status === "sold" ? `$${p.monthlyPayment}` : "—"}
                    </td>
                    <td className="p-3 font-mono text-xs text-red-600 font-bold">-${p.monthlyExpenses}</td>
                    <td className="p-3 font-mono text-xs font-bold" style={{ color: netMo >= 0 ? "#059669" : "#dc2626" }}>
                      {netMo >= 0 ? "+" : ""}{netMo}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length > 50 && (
          <div className="p-4 text-center text-xs font-bold" style={{ color: "var(--muted)" }}>
            Showing 50 of {sorted.length} — filter to narrow
          </div>
        )}

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-6 text-xs font-bold">
          <span>Cost: <span className="text-amber-700">${totalCost.toLocaleString()}</span></span>
          <span>Retail: <span className="text-blue-700">${totalRetail.toLocaleString()}</span></span>
          <span>Profit: <span className="text-emerald-700">${totalProfit.toLocaleString()}</span></span>
          <span>Collected: <span className="text-violet-700">${totalCollected.toLocaleString()}</span></span>
          <span>MRR: <span className="text-emerald-700">${totalMonthlyIncome.toLocaleString()}/mo</span></span>
          <span>Exp: <span className="text-red-600">${totalMonthlyExpenses.toLocaleString()}/mo</span></span>
          <span>Net: <span className={netMonthly >= 0 ? "text-emerald-700" : "text-red-600"}>${netMonthly.toLocaleString()}/mo</span></span>
        </div>
      </div>
    </div>
  );
}
