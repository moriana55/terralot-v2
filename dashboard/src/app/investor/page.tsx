import { properties } from "@/lib/data";
import {
  MapPin, DollarSign, TrendingUp, CreditCard,
  Package,
} from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { Card, StatusPill } from "@/components/InvestorUI";

export const metadata = { title: "Investor Overview" };

export default function InvestorDashboard() {
  const available = properties.filter(p => p.status === "available");
  const pending = properties.filter(p => p.status === "pending");
  const sold = properties.filter(p => p.status === "sold");

  const totalPortfolioValue = properties.reduce((s, p) => s + p.price, 0);
  const totalCost = properties.reduce((s, p) => s + p.costPrice, 0);
  const totalProfit = totalPortfolioValue - totalCost;
  const profitMargin = Math.round((totalProfit / totalPortfolioValue) * 100);

  const monthlyMRR = properties
    .filter(p => p.status === "sold" || p.status === "pending")
    .reduce((s, p) => s + p.monthlyPayment, 0);

  const totalReceived = properties.reduce((s, p) => s + (p.paymentsReceived * p.monthlyPayment) + (p.status !== "available" ? p.downPayment : 0), 0);

  const stats = [
    { icon: Package, label: "Total Parcels", value: properties.length, sub: `${available.length} available · ${pending.length} pending · ${sold.length} sold`, color: "var(--primary)", trend: null },
    { icon: DollarSign, label: "Portfolio Value", value: `$${totalPortfolioValue.toLocaleString()}`, sub: `Cost basis: $${totalCost.toLocaleString()}`, color: "var(--success)", trend: `+${profitMargin}% margin` },
    { icon: TrendingUp, label: "Monthly MRR", value: `$${monthlyMRR.toLocaleString()}`, sub: "From active installments", color: "var(--accent-ink)", trend: null },
    { icon: CreditCard, label: "Total Collected", value: `$${totalReceived.toLocaleString()}`, sub: "All-time revenue", color: "var(--tertiary)", trend: null },
  ];

  const recentSales = properties
    .filter(p => p.status === "sold" || p.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const stateBreakdown = properties.reduce((acc, p) => {
    acc[p.state] = (acc[p.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topStates = Object.entries(stateBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Investor Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Portfolio overview
        </p>
      </div>

      <SampleDataBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Card key={s.label}>
            <div className="flex items-start justify-between mb-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: "var(--surface-high)" }}>
                <s.icon className="w-[18px] h-[18px]" style={{ color: s.color }} />
              </span>
              {s.trend && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--status-paid-soft)", color: "var(--status-paid)" }}>
                  {s.trend}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 !p-0 overflow-hidden">
          <h2 className="font-bold px-5 pt-5 pb-4">Recent Sales Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tl-table min-w-[560px]">
              <thead>
                <tr className="border-y" style={{ borderColor: "var(--border)", background: "var(--surface-low)" }}>
                  {["Property", "State", "Acres", "Sale Price", "Monthly", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSales.map(p => (
                  <tr key={p.id} className="border-b transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 font-medium text-sm">{p.title}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--muted)" }}>{p.state}</td>
                    <td className="px-5 py-3 text-xs tabular-nums">{p.acres} ac</td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums" style={{ color: "var(--success)" }}>${p.price.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs tabular-nums">${p.monthlyPayment}/mo</td>
                    <td className="px-5 py-3"><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Portfolio by State */}
        <Card>
          <h2 className="font-bold mb-4">Portfolio by State</h2>
          <div className="space-y-3">
            {topStates.map(([state, count]) => {
              const pct = Math.round((count / properties.length) * 100);
              return (
                <div key={state}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{state}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: "var(--primary)" }}>{count} parcels</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Revenue Split</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs" style={{ color: "var(--muted)" }}>Investor (60%)</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--success)" }}>${Math.round(totalReceived * 0.6).toLocaleString()}</p>
              </div>
              <div className="w-px h-10" style={{ background: "var(--border)" }} />
              <div className="flex-1">
                <p className="text-xs" style={{ color: "var(--muted)" }}>Operator (40%)</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--primary)" }}>${Math.round(totalReceived * 0.4).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* P&L Summary */}
      <Card className="mt-6">
        <h2 className="font-bold mb-4">Profit & Loss Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {[
            { label: "Total Acquisitions", value: `$${totalCost.toLocaleString()}`, color: "var(--muted)" },
            { label: "Total Revenue", value: `$${totalReceived.toLocaleString()}`, color: "var(--success)" },
            { label: "Unrealized Value", value: `$${(totalPortfolioValue - totalReceived).toLocaleString()}`, color: "var(--primary)" },
            { label: "Net Profit", value: `$${(totalReceived - totalCost).toLocaleString()}`, color: totalReceived > totalCost ? "var(--success)" : "var(--error)" },
            { label: "ROI", value: totalCost > 0 ? `${Math.round(((totalReceived - totalCost) / totalCost) * 100)}%` : "N/A", color: "var(--tertiary)" },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{item.label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
