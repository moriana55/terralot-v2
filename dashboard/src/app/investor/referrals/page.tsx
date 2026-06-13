import { Users, DollarSign, CheckCircle2, Clock } from "lucide-react";

export const metadata = { title: "Referrals" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

const referrals = [
  { id: "1", contact: "Mike Thompson", role: "Wholesaler", deal: "40 Acres — Hudspeth County", commission: 500, status: "pending", date: "2026-06-05" },
  { id: "2", contact: "Lisa Park", role: "Realtor", deal: "5 Acres — Luna County", commission: 350, status: "paid", paidAt: "2026-06-01", date: "2026-05-20" },
  { id: "3", contact: "David Cruz", role: "Scout", deal: "2.5 Acres — Nye County", commission: 200, status: "paid", paidAt: "2026-05-25", date: "2026-05-10" },
  { id: "4", contact: "Mike Thompson", role: "Wholesaler", deal: "30 Acres — Pecos County", commission: 600, status: "pending", date: "2026-06-07" },
  { id: "5", contact: "Anna Williams", role: "Investor", deal: "20 Acres — Cochise County", commission: 800, status: "pending", date: "2026-06-08" },
];

const contacts = [
  { name: "Mike Thompson", role: "Wholesaler", deals: 5, totalCommission: 2200, state: "Texas" },
  { name: "Lisa Park", role: "Realtor", deals: 3, totalCommission: 1050, state: "New Mexico" },
  { name: "David Cruz", role: "Scout", deals: 4, totalCommission: 800, state: "Nevada" },
  { name: "Anna Williams", role: "Investor", deals: 2, totalCommission: 1600, state: "Arizona" },
  { name: "Robert Garcia", role: "Wholesaler", deals: 1, totalCommission: 400, state: "Colorado" },
];

export default function ReferralsPage() {
  const totalPaid = referrals.filter(r => r.status === "paid").reduce((s, r) => s + r.commission, 0);
  const totalPending = referrals.filter(r => r.status === "pending").reduce((s, r) => s + r.commission, 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Referral Network</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Track commissions and network partnerships</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <Users className="w-5 h-5 mb-2" style={{ color: "var(--primary)" }} />
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Network Size</p>
          <p className="text-2xl font-bold">{contacts.length}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Active contacts</p>
        </Card>
        <Card>
          <CheckCircle2 className="w-5 h-5 mb-2" style={{ color: "var(--success)" }} />
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Paid Commissions</p>
          <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>${totalPaid.toLocaleString()}</p>
        </Card>
        <Card>
          <Clock className="w-5 h-5 mb-2" style={{ color: "#eab308" }} />
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Pending</p>
          <p className="text-2xl font-bold" style={{ color: "#eab308" }}>${totalPending.toLocaleString()}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-4">Top Partners</h2>
          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.name} className="flex items-center gap-3 p-3 rounded-lg border border-white/5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>{c.role} · {c.state}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: "var(--success)" }}>${c.totalCommission.toLocaleString()}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>{c.deals} deals</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold mb-4">Recent Referrals</h2>
          <div className="space-y-3">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.deal}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>via {r.contact} ({r.role})</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${r.commission}</p>
                  <span className="flex items-center gap-1 justify-end text-[10px] font-bold">
                    {r.status === "paid" ? (
                      <><CheckCircle2 className="w-3 h-3" style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Paid</span></>
                    ) : (
                      <><Clock className="w-3 h-3" style={{ color: "#eab308" }} /><span style={{ color: "#eab308" }}>Pending</span></>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
