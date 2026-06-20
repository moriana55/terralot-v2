import { investorDemoProperties as properties } from "@/lib/investor-demo";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { Card, StatusPill } from "@/components/InvestorUI";

export const metadata = { title: "Financials" };

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
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Complete financial breakdown of the TerraLot portfolio</p>

      <SampleDataBanner note="Aylık grafik kısmen sabit örnek değerler içerir." />

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
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
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
                <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--success)" }}>${(m.revenue / 1000).toFixed(1)}k</span>
                <div className="w-full rounded-t-md transition-all" style={{ height: `${(m.revenue / maxRevenue) * 100}%`, background: "var(--primary)", minHeight: 8 }} />
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
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--success)" }}>${investorShare.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                <div className="h-full rounded-full" style={{ width: "60%", background: "var(--success)" }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Operator Share (40%)</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--primary)" }}>${operatorShare.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                <div className="h-full rounded-full" style={{ width: "40%", background: "var(--primary)" }} />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Monthly MRR</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: "var(--success)" }}>${monthlyMRR.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Net Monthly</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: netMonthly > 0 ? "var(--success)" : "var(--error)" }}>${netMonthly.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* P&L Table */}
      <Card className="!p-0 overflow-hidden">
        <h2 className="font-bold px-5 pt-5 pb-4">Profit & Loss by Parcel</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tl-table min-w-[760px]">
            <thead>
              <tr className="border-y" style={{ borderColor: "var(--border)", background: "var(--surface-low)" }}>
                {["Property", "State", "Cost", "Sale Price", "Collected", "Remaining", "Margin", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map(p => {
                const collected = p.status !== "available" ? p.downPayment + (p.paymentsReceived * p.monthlyPayment) : 0;
                const remaining = p.price - collected;
                const margin = Math.round(((p.price - p.costPrice) / p.price) * 100);
                return (
                  <tr key={p.id} className="border-b transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 font-medium">{p.title}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--muted)" }}>{p.state}</td>
                    <td className="px-5 py-3 text-xs tabular-nums">${p.costPrice.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums">${p.price.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums" style={{ color: "var(--success)" }}>${collected.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs tabular-nums" style={{ color: "var(--muted)" }}>${remaining.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs font-bold tabular-nums" style={{ color: margin > 40 ? "var(--success)" : "var(--primary)" }}>{margin}%</td>
                    <td className="px-5 py-3"><StatusPill status={p.status} /></td>
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
