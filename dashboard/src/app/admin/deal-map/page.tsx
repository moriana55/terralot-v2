"use client";

import { deals, getContact, scoreDeal, getDealStatusColor, DEAL_STATUS_LABELS } from "@/lib/network-data";
import type { DealStatus } from "@/lib/network-data";
import { useState } from "react";

export default function DealMapPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = statusFilter === "all" ? deals : deals.filter(d => d.status === statusFilter);
  const dealsWithCoords = filtered.filter(d => d.lat && d.lng);
  const selectedDeal = selected ? deals.find(d => d.id === selected) : null;

  const minLat = Math.min(...dealsWithCoords.map(d => d.lat!)) - 2;
  const maxLat = Math.max(...dealsWithCoords.map(d => d.lat!)) + 2;
  const minLng = Math.min(...dealsWithCoords.map(d => d.lng!)) - 2;
  const maxLng = Math.max(...dealsWithCoords.map(d => d.lng!)) + 2;

  const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * 100;
  const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * 100;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Deal Map</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>Geographic overview of your deal pipeline</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {["all", "new", "evaluating", "presented", "accepted", "closed"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: statusFilter === s ? "rgba(142,209,223,0.1)" : "transparent",
              color: statusFilter === s ? "var(--primary)" : "var(--muted)",
              border: "1px solid",
              borderColor: statusFilter === s ? "rgba(142,209,223,0.2)" : "rgba(255,255,255,0.05)",
            }}>
            {s === "all" ? "All" : DEAL_STATUS_LABELS[s as DealStatus]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl border border-white/5 overflow-hidden" style={{ background: "var(--surface)" }}>
          <div className="relative w-full" style={{ paddingBottom: "60%" }}>
            <div className="absolute inset-0 p-8">
              {/* Grid lines */}
              <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.05 }}>
                {[0, 20, 40, 60, 80, 100].map(p => (
                  <g key={p}>
                    <line x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="white" />
                    <line x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="white" />
                  </g>
                ))}
              </svg>

              {/* Deal pins */}
              {dealsWithCoords.map(deal => {
                const x = toX(deal.lng!);
                const y = toY(deal.lat!);
                const { score, color } = scoreDeal(deal);
                const isSelected = selected === deal.id;
                const size = score >= 70 ? 40 : score >= 45 ? 32 : 24;

                return (
                  <button key={deal.id}
                    onClick={() => setSelected(isSelected ? null : deal.id)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-[10px] font-bold transition-all hover:scale-125"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      width: size,
                      height: size,
                      background: color,
                      color: "var(--background)",
                      boxShadow: isSelected ? `0 0 0 3px ${color}, 0 0 20px ${color}` : `0 0 10px ${color}40`,
                      zIndex: isSelected ? 10 : 1,
                    }}>
                    {score}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-white/5 flex items-center gap-6">
            {[
              { label: "Hot (70+)", color: "var(--success)" },
              { label: "Warm (45-69)", color: "var(--tertiary)" },
              { label: "Cold (<45)", color: "var(--muted)" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{l.label}</span>
              </div>
            ))}
            <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>Pin size = deal score</span>
          </div>
        </div>

        {/* Deal Detail / List */}
        <div className="space-y-3">
          {selectedDeal ? (() => {
            const source = getContact(selectedDeal.sourceId);
            const { score, label, color, breakdown } = scoreDeal(selectedDeal);
            return (
              <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold">{selectedDeal.title}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{selectedDeal.state}{selectedDeal.county ? ` · ${selectedDeal.county}` : ""}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                    style={{ background: `${getDealStatusColor(selectedDeal.status)}15`, color: getDealStatusColor(selectedDeal.status) }}>
                    {DEAL_STATUS_LABELS[selectedDeal.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {selectedDeal.acres && <Stat label="Acres" value={`${selectedDeal.acres}`} />}
                  {selectedDeal.askingPrice && <Stat label="Asking" value={`$${selectedDeal.askingPrice.toLocaleString()}`} color="var(--primary)" />}
                  {selectedDeal.estimatedValue && <Stat label="Est. Value" value={`$${selectedDeal.estimatedValue.toLocaleString()}`} color="var(--success)" />}
                  {selectedDeal.askingPrice && selectedDeal.estimatedValue && (
                    <Stat label="Margin" value={`$${(selectedDeal.estimatedValue - selectedDeal.askingPrice).toLocaleString()}`} color="var(--success)" />
                  )}
                </div>

                {/* Score breakdown */}
                <div className="p-3 rounded-lg mb-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">Deal Score</span>
                    <span className="text-lg font-bold" style={{ color }}>{score} — {label}</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { label: "Margin", value: breakdown.margin, max: 40 },
                      { label: "Size", value: breakdown.size, max: 30 },
                      { label: "Urgency", value: breakdown.status, max: 30 },
                    ].map(b => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-[10px] w-14" style={{ color: "var(--muted)" }}>{b.label}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(b.value / b.max) * 100}%`, background: color }} />
                        </div>
                        <span className="text-[10px] font-semibold w-8 text-right">{b.value}/{b.max}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {source && (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Source</p>
                    <p className="text-sm font-semibold">{source.name}</p>
                    {source.company && <p className="text-xs" style={{ color: "var(--muted)" }}>{source.company}</p>}
                  </div>
                )}

                {selectedDeal.documents && selectedDeal.documents.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Documents</p>
                    <div className="space-y-1">
                      {selectedDeal.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <span className="text-xs">{doc.name}</span>
                          <span className="text-[10px]" style={{ color: "var(--muted)" }}>{doc.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDeal.notes && (
                  <div className="pt-3 mt-3 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Notes</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{selectedDeal.notes}</p>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center" style={{ color: "var(--muted)" }}>
              <p className="text-sm">Click a pin to view deal details</p>
            </div>
          )}

          {/* Deals list */}
          <div className="rounded-xl border border-white/5 p-4" style={{ background: "var(--surface)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
              {filtered.length} deals on map
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {dealsWithCoords.map(d => {
                const { score, color } = scoreDeal(d);
                return (
                  <button key={d.id}
                    onClick={() => setSelected(d.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-white/[0.02] transition-colors"
                    style={{ background: selected === d.id ? "rgba(142,209,223,0.05)" : "transparent" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: `${color}15`, color }}>
                      {score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{d.title}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{d.state}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
