"use client";

import { Plus, Target, Users, Trash2, Loader2 } from "lucide-react";
import { DEAL_STATUS_LABELS, getDealStatusColor, scoreDeal, matchInvestors } from "@/lib/network-data";
import type { DealStatus } from "@/lib/network-data";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const PIPELINE: DealStatus[] = ["new", "evaluating", "presented", "accepted", "closed", "dead"];

export default function DealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [matchDealId, setMatchDealId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("Deal").select("*").order("createdAt", { ascending: false }),
      supabase.from("Contact").select("id,name,company,role,state,notes"),
    ]).then(([{ data: d }, { data: c }]) => {
      setDeals(d?.map(x => ({ ...x, status: x.status?.toLowerCase() })) ?? []);
      setContacts(c ?? []);
      setLoading(false);
    });
  }, []);

  function getContact(id: string) { return contacts.find(c => c.id === id); }

  const grouped = PIPELINE.reduce((acc, s) => {
    acc[s] = deals.filter(d => d.status === s);
    return acc;
  }, {} as Record<DealStatus, any[]>);

  const matchDeal = matchDealId ? deals.find(d => d.id === matchDealId) : null;
  const matches = matchDeal ? matchInvestors(matchDeal) : [];

  async function deleteDeal(id: string) {
    await supabase.from("Deal").delete().eq("id", id);
    setDeals(d => d.filter(x => x.id !== id));
    setConfirmId(null);
  }

  if (loading) return <div className="flex items-center justify-center py-40 gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="p-8">
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl border p-6 w-80" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <h3 className="font-bold mb-2">Delete deal?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-high)" }}>Cancel</button>
              <button onClick={() => deleteDeal(confirmId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--error)", color: "white" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Deal Pipeline</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Off-market deals from your network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/5 overflow-hidden">
            {(["pipeline", "table"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: view === v ? "rgba(142,209,223,0.1)" : "transparent", color: view === v ? "var(--primary)" : "var(--muted)" }}>
                {v === "pipeline" ? "Pipeline" : "Table"}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
            <Plus className="w-4 h-4" /> Add Deal
          </button>
        </div>
      </div>

      {matchDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setMatchDealId(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 mx-4" style={{ background: "var(--surface)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(142,209,223,0.1)" }}>
                <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <h3 className="font-bold">Investor Match</h3>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{matchDeal.title}</p>
              </div>
            </div>
            {matches.length > 0 ? (
              <div className="space-y-3">
                {matches.map((m: any) => (
                  <div key={m.contact.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: m.matchScore >= 70 ? "rgba(142,209,223,0.1)" : "rgba(255,255,255,0.05)", color: m.matchScore >= 70 ? "var(--success)" : "var(--muted)" }}>
                      {m.matchScore}%
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.contact.name}</p>
                      {m.contact.company && <p className="text-xs" style={{ color: "var(--muted)" }}>{m.contact.company}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.reasons.map((r: string) => (
                          <span key={r} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>No matching investors found</p>
            )}
            <button onClick={() => setMatchDealId(null)} className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold border border-white/10" style={{ color: "var(--muted)" }}>Close</button>
          </div>
        </div>
      )}

      {view === "pipeline" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE.filter(s => s !== "dead").map(status => (
            <div key={status} className="min-w-[260px] flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: getDealStatusColor(status) }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{DEAL_STATUS_LABELS[status]}</span>
                <span className="text-[10px] font-bold ml-auto px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>{grouped[status].length}</span>
              </div>
              <div className="space-y-2">
                {grouped[status].map((deal: any) => {
                  const source = getContact(deal.sourceId);
                  const { score, label, color } = scoreDeal(deal);
                  return (
                    <div key={deal.id} className="rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors" style={{ background: "var(--surface)" }}>
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-sm">{deal.title}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${color}15`, color }}>{score} {label}</span>
                          <button onClick={() => setConfirmId(deal.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5">
                            <Trash2 className="w-3 h-3" style={{ color: "var(--error)" }} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{deal.state}{deal.county ? ` · ${deal.county}` : ""}</p>
                      <div className="flex items-center justify-between">
                        {deal.askingPrice && <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>${deal.askingPrice.toLocaleString()}</span>}
                        {deal.acres && <span className="text-[10px]" style={{ color: "var(--muted)" }}>{deal.acres} ac</span>}
                      </div>
                      {deal.estimatedValue && deal.askingPrice && (
                        <div className="mt-2 text-[10px] font-semibold" style={{ color: "var(--success)" }}>Margin: ${(deal.estimatedValue - deal.askingPrice).toLocaleString()}</div>
                      )}
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        {source && <span className="text-[10px]" style={{ color: "var(--muted)" }}>via {source.name}</span>}
                        <button onClick={() => setMatchDealId(deal.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md hover:bg-white/[0.05]" style={{ color: "var(--primary)" }}>
                          <Target className="w-3 h-3" /> Match
                        </button>
                      </div>
                    </div>
                  );
                })}
                {grouped[status].length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs" style={{ color: "var(--muted)" }}>No deals</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: "var(--surface)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Deal", "Score", "Location", "Acres", "Asking", "Est. Value", "Margin", "Source", "Status", ""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d: any) => {
                const source = getContact(d.sourceId);
                const margin = d.estimatedValue && d.askingPrice ? d.estimatedValue - d.askingPrice : null;
                const { score, label, color } = scoreDeal(d);
                return (
                  <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-semibold">{d.title}</td>
                    <td className="py-3.5 px-4"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{score} {label}</span></td>
                    <td className="py-3.5 px-4 text-xs" style={{ color: "var(--muted)" }}>{d.state}{d.county ? `, ${d.county}` : ""}</td>
                    <td className="py-3.5 px-4 text-xs">{d.acres || "—"}</td>
                    <td className="py-3.5 px-4 text-xs font-semibold" style={{ color: "var(--primary)" }}>{d.askingPrice ? `$${d.askingPrice.toLocaleString()}` : "—"}</td>
                    <td className="py-3.5 px-4 text-xs">{d.estimatedValue ? `$${d.estimatedValue.toLocaleString()}` : "—"}</td>
                    <td className="py-3.5 px-4 text-xs font-semibold" style={{ color: margin && margin > 0 ? "var(--success)" : "var(--muted)" }}>{margin ? `$${margin.toLocaleString()}` : "—"}</td>
                    <td className="py-3.5 px-4 text-xs" style={{ color: "var(--muted)" }}>{source?.name || "—"}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: `${getDealStatusColor(d.status)}15`, color: getDealStatusColor(d.status) }}>{DEAL_STATUS_LABELS[d.status as DealStatus]}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setMatchDealId(d.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md hover:bg-white/[0.05]" style={{ color: "var(--primary)" }}>
                          <Target className="w-3 h-3" /> Match
                        </button>
                        <button onClick={() => setConfirmId(d.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
