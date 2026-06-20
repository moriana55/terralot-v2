import { investorDemoProperties as properties } from "@/lib/investor-demo";
import { MapPin } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { StatusPill } from "@/components/InvestorUI";

export const metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  const sorted = [...properties].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{properties.length} parcels across {new Set(properties.map(p => p.state)).size} states</p>
      </div>

      <SampleDataBanner note="Görseller ve parseller temsilidir." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(p => (
          <div key={p.id} className="tl-card overflow-hidden transition-all hover:shadow-[var(--shadow-pop)]">
            <div className="relative h-40 overflow-hidden" style={{ background: "var(--surface-high)" }}>
              <img src={p.images[0]} alt={p.title} loading="lazy" width={400} height={160} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3"><StatusPill status={p.status} /></div>
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold tabular-nums text-white">{p.acres} ac</div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm mb-1">{p.title}</h3>
              <div className="flex items-center gap-1 text-xs mb-3" style={{ color: "var(--muted)" }}>
                <MapPin className="w-3 h-3" /> {p.county}, {p.state}
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Cost</p>
                  <p className="text-sm font-bold tabular-nums">${p.costPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Sale</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: "var(--success)" }}>${p.price.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Monthly</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: "var(--primary)" }}>${p.monthlyPayment}/mo</p>
                </div>
              </div>
              {(p.status === "sold" || p.status === "pending") && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: "var(--muted)" }}>Payment progress</span>
                    <span className="font-bold tabular-nums">{p.paymentsReceived}/{p.term}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((p.paymentsReceived / p.term) * 100)}%`, background: "var(--success)" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
