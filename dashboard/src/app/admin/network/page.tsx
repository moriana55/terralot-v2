"use client";

import { TrendingUp, Users, Handshake, CircleDollarSign, Target, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { deals, referrals, contacts, getPipelineStats, scoreDeal, getDealStatusColor, DEAL_STATUS_LABELS, getContact } from "@/lib/network-data";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

export default function NetworkHubPage() {
  const stats = getPipelineStats();
  const activeDeals = deals.filter(d => !["closed", "dead"].includes(d.status));
  const scoredDeals = activeDeals.map(d => ({ ...d, ...scoreDeal(d) })).sort((a, b) => b.score - a.score);
  const recentReferrals = [...referrals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const monthlyData = [
    { month: "Jan", deals: 2, earned: 1200 },
    { month: "Feb", deals: 3, earned: 2800 },
    { month: "Mar", deals: 5, earned: 4100 },
    { month: "Apr", deals: 4, earned: 3500 },
    { month: "May", deals: 8, earned: 7500 },
  ];
  const maxDeals = Math.max(...monthlyData.map(m => m.deals));
  const maxEarned = Math.max(...monthlyData.map(m => m.earned));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Network Hub</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>Your deal flow & network performance at a glance</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Handshake, label: "Active Deals", value: stats.activeDeals, sub: `${stats.totalDeals} total`, color: "var(--primary)" },
          { icon: CircleDollarSign, label: "Earned", value: `$${stats.totalEarned.toLocaleString()}`, sub: `$${stats.totalPending.toLocaleString()} pending`, color: "var(--success)" },
          { icon: Target, label: "Pipeline Value", value: `$${stats.pipelineValue.toLocaleString()}`, sub: `${stats.avgMargin}% avg margin`, color: "var(--tertiary)" },
          { icon: Users, label: "Network", value: stats.totalContacts, sub: `${stats.sources} sources · ${stats.investors} investors`, color: "var(--secondary)" },
        ].map(s => (
          <Card key={s.label}>
            <s.icon className="w-5 h-5 mb-3" style={{ color: s.color }} />
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Deal Flow Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold">Deal Flow</h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>Last 5 months</span>
          </div>
          <div className="flex items-end gap-3 h-40">
            {monthlyData.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-1" style={{ height: "120px", justifyContent: "flex-end" }}>
                  <div className="w-full max-w-[36px] rounded-t-md transition-all"
                    style={{ height: `${(m.deals / maxDeals) * 100}%`, background: "var(--primary)", opacity: 0.8 }} />
                </div>
                <span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>{m.month}</span>
                <span className="text-[10px] font-semibold" style={{ color: "var(--primary)" }}>{m.deals} deals</span>
                <span className="text-[10px]" style={{ color: "var(--success)" }}>${m.earned.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <h2 className="font-bold mb-4">Pipeline Funnel</h2>
          <div className="space-y-3">
            {(["new", "evaluating", "presented", "accepted", "closed"] as const).map(status => {
              const count = deals.filter(d => d.status === status).length;
              const pct = deals.length > 0 ? (count / deals.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{DEAL_STATUS_LABELS[status]}</span>
                    <span className="text-xs font-bold" style={{ color: getDealStatusColor(status) }}>{count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: getDealStatusColor(status) }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Conversion Rate</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "var(--success)" }}>{stats.conversionRate}%</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Scored Deals */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Hottest Deals</h2>
            <Link href="/admin/deals" className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--primary)" }}>
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {scoredDeals.slice(0, 5).map(d => {
              const source = getContact(d.sourceId);
              return (
                <div key={d.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: `${d.color}15`, color: d.color }}>
                    {d.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{d.title}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{d.state} · via {source?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                      style={{ background: `${d.color}15`, color: d.color }}>
                      {d.label}
                    </span>
                    {d.askingPrice && (
                      <p className="text-xs font-semibold mt-1" style={{ color: "var(--primary)" }}>${d.askingPrice.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Sources */}
        <Card>
          <h2 className="font-bold mb-4">Top Sources</h2>
          <div className="space-y-3">
            {contacts
              .filter(c => ["wholesaler", "scout", "realtor"].includes(c.role))
              .map(c => {
                const dealCount = deals.filter(d => d.sourceId === c.id).length;
                const closedCount = deals.filter(d => d.sourceId === c.id && d.status === "closed").length;
                return { ...c, dealCount, closedCount };
              })
              .sort((a, b) => b.dealCount - a.dealCount)
              .map(c => (
                <div key={c.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
                    {c.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{c.company || c.role} · {c.state}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>{c.dealCount} deals</p>
                    <p className="text-[10px]" style={{ color: "var(--success)" }}>{c.closedCount} closed</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
