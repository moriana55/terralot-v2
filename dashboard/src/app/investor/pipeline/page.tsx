import { Search, FileCheck, Handshake, CheckCircle2, XCircle } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

export const metadata = { title: "Deal Pipeline" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

const stages = [
  { id: "sourced", label: "Sourced", icon: Search, color: "#8ed1df" },
  { id: "evaluating", label: "Evaluating", icon: FileCheck, color: "#eab308" },
  { id: "offer", label: "Offer Made", icon: Handshake, color: "#f97316" },
  { id: "closed", label: "Closed", icon: CheckCircle2, color: "#22c55e" },
  { id: "dead", label: "Dead", icon: XCircle, color: "#ef4444" },
];

const deals = [
  { id: "1", title: "40 Acres — Hudspeth County", state: "Texas", acres: 40, askPrice: 3200, estValue: 8500, source: "Tax Auction", stage: "evaluating", date: "2026-06-05" },
  { id: "2", title: "5 Acres — Luna County", state: "New Mexico", acres: 5, askPrice: 1800, estValue: 5200, source: "Wholesaler", stage: "offer", date: "2026-06-03" },
  { id: "3", title: "20 Acres — Cochise County", state: "Arizona", acres: 20, askPrice: 4500, estValue: 12000, source: "Direct Mail", stage: "sourced", date: "2026-06-08" },
  { id: "4", title: "10 Acres — Costilla County", state: "Colorado", acres: 10, askPrice: 2800, estValue: 7500, source: "Tax Auction", stage: "evaluating", date: "2026-06-01" },
  { id: "5", title: "2.5 Acres — Nye County", state: "Nevada", acres: 2.5, askPrice: 1200, estValue: 3800, source: "Scout", stage: "closed", date: "2026-05-20" },
  { id: "6", title: "15 Acres — Calhoun County", state: "Arkansas", acres: 15, askPrice: 2000, estValue: 6000, source: "Wholesaler", stage: "sourced", date: "2026-06-09" },
  { id: "7", title: "8 Acres — Elko County", state: "Nevada", acres: 8, askPrice: 3500, estValue: 9000, source: "Tax Auction", stage: "dead", date: "2026-05-15" },
  { id: "8", title: "30 Acres — Pecos County", state: "Texas", acres: 30, askPrice: 2500, estValue: 7200, source: "Direct Mail", stage: "offer", date: "2026-06-07" },
];

export default function PipelinePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Deal Pipeline</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Active acquisition opportunities being evaluated</p>

      <SampleDataBanner note="Gerçek pipeline için admin → Acquisitions ekranına bakın." />

      {/* Pipeline columns */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          return (
            <div key={stage.id}>
              <div className="flex items-center gap-2 mb-3">
                <stage.icon className="w-4 h-4" style={{ color: stage.color }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: stage.color }}>{stage.label}</span>
                <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${stage.color}15`, color: stage.color }}>
                  {stageDeals.length}
                </span>
              </div>
              <div className="space-y-2">
                {stageDeals.map(deal => (
                  <div key={deal.id} className="rounded-lg border border-white/5 p-3 transition-all hover:border-white/10" style={{ background: "var(--surface)" }}>
                    <h3 className="text-xs font-bold mb-1">{deal.title}</h3>
                    <p className="text-[10px] mb-2" style={{ color: "var(--muted)" }}>{deal.state} · {deal.acres} ac · via {deal.source}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>Ask: ${deal.askPrice.toLocaleString()}</span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--success)" }}>Est: ${deal.estValue.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>{new Date(deal.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--primary)" }}>
                        {Math.round(((deal.estValue - deal.askPrice) / deal.askPrice) * 100)}% ROI
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <Card>
        <h2 className="font-bold mb-4">Pipeline Summary</h2>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Total Deals</p>
            <p className="text-2xl font-bold">{deals.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Total Ask</p>
            <p className="text-2xl font-bold">${deals.reduce((s, d) => s + d.askPrice, 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Est. Portfolio Value</p>
            <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>${deals.reduce((s, d) => s + d.estValue, 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Avg. ROI Potential</p>
            <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
              {Math.round(deals.reduce((s, d) => s + ((d.estValue - d.askPrice) / d.askPrice) * 100, 0) / deals.length)}%
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
