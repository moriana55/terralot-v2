import { properties } from "@/lib/data";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

export const metadata = { title: "Payments" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

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

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Collected</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>${totalPaid.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{payments.filter(p => p.status === "paid").length} payments</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" style={{ color: "#eab308" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Upcoming</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: "#eab308" }}>${totalPending.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{payments.filter(p => p.status === "pending").length} pending</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Overdue</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>${totalOverdue.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{payments.filter(p => p.status === "overdue").length} late</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-bold mb-4">Payment History</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {["Date", "Property", "Buyer", "Type", "Amount", "Status"].map(h => (
                <th key={h} className="text-left py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.slice(0, 30).map(p => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="py-3 text-xs" style={{ color: "var(--muted)" }}>{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td className="py-3 text-sm font-medium">{p.property}</td>
                <td className="py-3 text-xs">{p.buyer}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{
                    background: p.type === "down_payment" ? "rgba(142,209,223,0.1)" : "rgba(255,255,255,0.05)",
                    color: p.type === "down_payment" ? "#8ed1df" : "var(--muted)",
                  }}>
                    {p.type === "down_payment" ? "Down" : "Monthly"}
                  </span>
                </td>
                <td className="py-3 text-sm font-bold">${p.amount.toLocaleString()}</td>
                <td className="py-3">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase">
                    {p.status === "paid" && <><CheckCircle2 className="w-3 h-3" style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Paid</span></>}
                    {p.status === "pending" && <><Clock className="w-3 h-3" style={{ color: "#eab308" }} /><span style={{ color: "#eab308" }}>Pending</span></>}
                    {p.status === "overdue" && <><AlertTriangle className="w-3 h-3" style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>Overdue</span></>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
