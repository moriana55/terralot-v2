import { properties } from "@/lib/data";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { Card } from "@/components/InvestorUI";

export const metadata = { title: "Payments" };

interface PaymentRecord {
  id: string;
  property: string;
  buyer: string;
  amount: number;
  date: string;
  type: "down_payment" | "monthly";
  status: "paid" | "pending" | "overdue";
}

function generatePayments(): PaymentRecord[] {
  const payments: PaymentRecord[] = [];
  const buyers = ["James Miller", "Maria Santos", "Ahmed Hassan", "Sarah Chen", "Carlos Rivera", "John Smith"];
  const sold = properties.filter(p => p.status === "sold" || p.status === "pending");

  sold.forEach((p, idx) => {
    const buyer = buyers[idx % buyers.length];
    payments.push({
      id: `dp-${p.id}`,
      property: p.title,
      buyer,
      amount: p.downPayment,
      date: p.createdAt,
      type: "down_payment",
      status: "paid",
    });
    for (let i = 0; i < p.paymentsReceived; i++) {
      const d = new Date(p.createdAt);
      d.setMonth(d.getMonth() + i + 1);
      payments.push({
        id: `mo-${p.id}-${i}`,
        property: p.title,
        buyer,
        amount: p.monthlyPayment,
        date: d.toISOString().split("T")[0],
        type: "monthly",
        status: "paid",
      });
    }
    const nextDue = new Date(p.createdAt);
    nextDue.setMonth(nextDue.getMonth() + p.paymentsReceived + 1);
    if (p.paymentsReceived < p.term) {
      payments.push({
        id: `next-${p.id}`,
        property: p.title,
        buyer,
        amount: p.monthlyPayment,
        date: nextDue.toISOString().split("T")[0],
        type: "monthly",
        status: nextDue < new Date() ? "overdue" : "pending",
      });
    }
  });

  return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function PaymentsPage() {
  const payments = generatePayments();
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Payment Tracking</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>All installment payments across the portfolio</p>

      <SampleDataBanner note="Stripe bağlanınca gerçek ödeme geçmişiyle değişecek." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--status-paid)" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Collected</p>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--status-paid)" }}>${totalPaid.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{payments.filter(p => p.status === "paid").length} payments</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" style={{ color: "var(--status-pending)" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Upcoming</p>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--status-pending)" }}>${totalPending.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{payments.filter(p => p.status === "pending").length} pending</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "var(--status-overdue)" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Overdue</p>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--status-overdue)" }}>${totalOverdue.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{payments.filter(p => p.status === "overdue").length} late</p>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <h2 className="font-bold px-5 pt-5 pb-4">Payment History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tl-table min-w-[640px]">
            <thead>
              <tr className="border-y" style={{ borderColor: "var(--border)", background: "var(--surface-low)" }}>
                {["Date", "Property", "Buyer", "Type", "Amount", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 30).map(p => (
                <tr key={p.id} className="border-b transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3 text-xs tabular-nums" style={{ color: "var(--muted)" }}>{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-5 py-3 text-sm font-medium">{p.property}</td>
                  <td className="px-5 py-3 text-xs">{p.buyer}</td>
                  <td className="px-5 py-3">
                    <span className="tl-pill" style={{
                      background: p.type === "down_payment" ? "var(--status-info-soft)" : "var(--surface-high)",
                      color: p.type === "down_payment" ? "var(--status-info)" : "var(--muted)",
                    }}>
                      {p.type === "down_payment" ? "Down" : "Monthly"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-bold tabular-nums">${p.amount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase">
                      {p.status === "paid" && <><CheckCircle2 className="w-3 h-3" style={{ color: "var(--status-paid)" }} /><span style={{ color: "var(--status-paid)" }}>Paid</span></>}
                      {p.status === "pending" && <><Clock className="w-3 h-3" style={{ color: "var(--status-pending)" }} /><span style={{ color: "var(--status-pending)" }}>Pending</span></>}
                      {p.status === "overdue" && <><AlertTriangle className="w-3 h-3" style={{ color: "var(--status-overdue)" }} /><span style={{ color: "var(--status-overdue)" }}>Overdue</span></>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
