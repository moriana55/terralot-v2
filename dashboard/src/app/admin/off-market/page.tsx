"use client";

import { useState } from "react";
import { Plus, Search, Eye, Edit, Trash2, Copy, Check } from "lucide-react";
import { offMarketProperties, OffMarketProperty } from "@/lib/data";

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors"
      style={{ color: "var(--primary)" }}>
      {code}
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" style={{ color: "var(--muted)" }} />}
    </button>
  );
}

const statusColors: Record<string, { bg: string; color: string }> = {
  available: { bg: "rgba(142,209,223,0.1)", color: "var(--success)" },
  under_contract: { bg: "rgba(251,185,131,0.1)", color: "var(--tertiary)" },
  sold: { bg: "rgba(255,180,171,0.1)", color: "var(--error)" },
  withdrawn: { bg: "rgba(255,255,255,0.05)", color: "var(--muted)" },
};

const visibilityLabels: Record<string, string> = {
  private: "Private",
  vip_only: "VIP Only",
  code_access: "Code Access",
};

export default function AdminOffMarket() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = offMarketProperties.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.state.toLowerCase().includes(q) || p.county.toLowerCase().includes(q) || p.accessCode.toLowerCase().includes(q);
    }
    return true;
  });

  const available = offMarketProperties.filter(p => p.status === "available").length;
  const underContract = offMarketProperties.filter(p => p.status === "under_contract").length;
  const avgDiscount = Math.round(offMarketProperties.reduce((sum, p) => sum + p.discount, 0) / offMarketProperties.length);

  const stats = [
    { label: "Total Deals", value: offMarketProperties.length },
    { label: "Available", value: available },
    { label: "Under Contract", value: underContract },
    { label: "Avg Discount", value: `${avgDiscount}%` },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Off-Market Deals</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Private acquisition pipeline</p>
        </div>
        <button className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
          <Plus className="w-4 h-4" /> Add Off-Market
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-white/5 p-4" style={{ background: "var(--surface)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted)" }} />
          <input type="text" placeholder="Search deals or access codes..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg text-sm border border-white/10 focus:border-[var(--primary)]/50 focus:outline-none"
            style={{ background: "var(--surface)", color: "var(--foreground)" }} />
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 p-0.5" style={{ background: "var(--surface)" }}>
          {["", "available", "under_contract", "sold", "withdrawn"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
              style={{
                background: statusFilter === s ? "rgba(142,209,223,0.1)" : "transparent",
                color: statusFilter === s ? "var(--primary)" : "var(--muted)",
              }}>
              {s ? s.replace("_", " ") : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: "var(--surface)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10" style={{ background: "var(--surface-low)" }}>
                {["Property", "Location", "Size", "Price", "Est. Value", "Discount", "Source", "Access Code", "Status", "Visibility", "Expires", "Actions"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img src={p.images[0]} alt="" className="w-12 h-8 rounded object-cover" />
                      <span className="font-semibold text-xs line-clamp-1">{p.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>{p.county}, {p.state}</td>
                  <td className="py-3 px-4 text-xs">{p.acres} ac</td>
                  <td className="py-3 px-4 text-xs font-bold" style={{ color: "var(--primary)" }}>${p.price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>${p.estimatedValue.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>{p.discount}%</span>
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>{p.source}</td>
                  <td className="py-3 px-4"><CopyCode code={p.accessCode} /></td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded whitespace-nowrap"
                      style={{ background: statusColors[p.status].bg, color: statusColors[p.status].color }}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(142,209,223,0.06)", color: "var(--muted)" }}>
                      {visibilityLabels[p.visibility]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                        <Eye className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                      </button>
                      <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                        <Edit className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                      </button>
                      <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                        <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
