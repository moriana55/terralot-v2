import { properties } from "@/lib/data";

export const metadata = { title: "Financials" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

export default function FinancialsPage() {
  const totalCost = properties.reduce((s, p) => s + p.costPrice, 0);
  const totalSaleValue = properties.reduce((s, p) => s + p.price, 0);
  const grossProfit = totalSaleValue - totalCost;

  const activeSales = properties.filter(p => p.status === "sold" || p.status === "pending");
  const totalCollected = activeSales.reduce((s, p) => s + p.downPayment + (p.paymentsReceived * p.monthlyPayment), 0);
  const totalRemaining = activeSales.reduce((s, p) => s + (p.price - p.downPayment - (p.paymentsReceived * p.monthlyPayment)), 0);
  const monthlyMRR = activeSales.reduce((s, p) => s + p.monthlyPayment, 0);
  const annualProjected = monthlyMRR * 12;

  const monthlyExpenses = properties.reduce((s, p) => s + (p.monthlyExpenses || 0), 0);
  const netMonthly = monthlyMRR - monthlyExpenses;

  const investorShare = Math.round(totalCollected * 0.6);
  const operatorShare = Math.round(totalCollected * 0.4);

  const months = [
    { month: "Jan", revenue: 2400, expenses: 800 },
    { month: "Feb", revenue: 3100, expenses: 850 },
    { month: "Mar", revenue: 3800, expenses: 900 },
    { month: "Apr", revenue: 4200, expenses: 920 },
    { month: "May", revenue: 5100, expenses: 1000 },
    { month: "Jun", revenue: monthlyMRR, expenses: monthlyExpenses },
  ];
  const maxRevenue = Math.max(...months.map(m => m.revenue));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Financial Report</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Complete financial breakdown of the TerraLot portfolio</p>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Invested", value: `$${totalCost.toLocaleString()}`, color: "var(--muted)" },
          { label: "Total Collected", value: `$${totalCollected.toLocaleString()}`, color: "var(--success)" },
          { label: "Outstanding", value: `$${totalRemaining.toLocaleString()}`, color: "var(--primary)" },
          { label: "Gross Margin", value: `${Math.round((grossProfit / totalSaleValue) * 100)}%`, color: "var(--tertiary)" },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <Card>
          <h2 className="font-bold mb-6">Monthly Revenue Trend</h2>
          <div className="flex items-end gap-3 h-40">
            {months.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: "var(--success)" }}>${(m.revenue / 1000).toFixed(1)}k</span>
                <div className="w-full rounded-t-md" style={{ height: `${(m.revenue / maxRevenue) * 100}%`, background: "var(--primary)", minHeight: 8 }} />
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>{m.month}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Revenue Split */}
        <Card>
          <h2 className="font-bold mb-6">Revenue Distribution</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Investor Share (60%)</span>
                <span className="text-sm font-bold" style={{ color: "var(--success)" }}>${investorShare.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: "var(--surface-low)" }}>
                <div className="h-full rounded-full" style={{ width: "60%", background: "var(--success)" }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Operator Share (40%)</span>
                <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>${operatorShare.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: "var(--surface-low)" }}>
                <div className="h-full rounded-full" style={{ width: "40%", background: "var(--primary)" }} />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Monthly MRR</p>
              <p className="text-xl font-bold" style={{ color: "var(--success)" }}>${monthlyMRR.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Net Monthly</p>
              <p className="text-xl font-bold" style={{ color: netMonthly > 0 ? "var(--success)" : "var(--error, #ef4444)" }}>${netMonthly.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* P&L Table */}
      <Card>
        <h2 className="font-bold mb-4">Profit & Loss by Parcel</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Property", "State", "Cost", "Sale Price", "Collected", "Remaining", "Margin", "Status"].map(h => (
                  <th key={h} className="text-left py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map(p => {
                const collected = p.status !== "available" ? p.downPayment + (p.paymentsReceived * p.monthlyPayment) : 0;
                const remaining = p.price - collected;
                const margin = Math.round(((p.price - p.costPrice) / p.price) * 100);
                return (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-3 font-medium">{p.title}</td>
                    <td className="py-3 text-xs" style={{ color: "var(--muted)" }}>{p.state}</td>
                    <td className="py-3 text-xs">${p.costPrice.toLocaleString()}</td>
                    <td className="py-3 text-xs font-semibold">${p.price.toLocaleString()}</td>
                    <td className="py-3 text-xs font-semibold" style={{ color: "var(--success)" }}>${collected.toLocaleString()}</td>
                    <td className="py-3 text-xs" style={{ color: "var(--muted)" }}>${remaining.toLocaleString()}</td>
                    <td className="py-3 text-xs font-bold" style={{ color: margin > 40 ? "var(--success)" : "var(--primary)" }}>{margin}%</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{
                        background: p.status === "sold" ? "rgba(34,197,94,0.1)" : p.status === "pending" ? "rgba(234,179,8,0.1)" : "rgba(142,209,223,0.1)",
                        color: p.status === "sold" ? "#22c55e" : p.status === "pending" ? "#eab308" : "#8ed1df",
                      }}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
