import { properties } from "@/lib/data";
import {
  MapPin, DollarSign, TrendingUp, CreditCard,
  ArrowUpRight, ArrowDownRight, Package, Users,
} from "lucide-react";

export const metadata = { title: "Investor Overview" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

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
    { icon: TrendingUp, label: "Monthly MRR", value: `$${monthlyMRR.toLocaleString()}`, sub: "From active installments", color: "#8ed1df", trend: "+12% vs last month" },
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Investor Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Real-time portfolio overview · Last updated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/5" style={{ background: "var(--surface)" }}>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Live</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Card key={s.label}>
            <div className="flex items-start justify-between mb-3">
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
              {s.trend && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                  <ArrowUpRight className="w-3 h-3" />
                  {s.trend}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <h2 className="font-bold mb-4">Recent Sales Activity</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Property", "State", "Acres", "Sale Price", "Monthly", "Status"].map(h => (
                  <th key={h} className="text-left py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentSales.map(p => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-3 font-medium text-sm">{p.title}</td>
                  <td className="py-3 text-xs" style={{ color: "var(--muted)" }}>{p.state}</td>
                  <td className="py-3 text-xs">{p.acres} ac</td>
                  <td className="py-3 text-xs font-semibold" style={{ color: "var(--success)" }}>${p.price.toLocaleString()}</td>
                  <td className="py-3 text-xs">${p.monthlyPayment}/mo</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{
                      background: p.status === "sold" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                      color: p.status === "sold" ? "#22c55e" : "#eab308",
                    }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                    <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>{count} parcels</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--surface-low)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Revenue Split</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs" style={{ color: "var(--muted)" }}>Investor (60%)</p>
                <p className="text-lg font-bold" style={{ color: "var(--success)" }}>${Math.round(totalReceived * 0.6).toLocaleString()}</p>
              </div>
              <div className="w-px h-10" style={{ background: "var(--surface-low)" }} />
              <div className="flex-1">
                <p className="text-xs" style={{ color: "var(--muted)" }}>Operator (40%)</p>
                <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>${Math.round(totalReceived * 0.4).toLocaleString()}</p>
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
            { label: "Net Profit", value: `$${(totalReceived - totalCost).toLocaleString()}`, color: totalReceived > totalCost ? "var(--success)" : "var(--error, #ef4444)" },
            { label: "ROI", value: totalCost > 0 ? `${Math.round(((totalReceived - totalCost) / totalCost) * 100)}%` : "N/A", color: "var(--tertiary)" },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{item.label}</p>
              <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
