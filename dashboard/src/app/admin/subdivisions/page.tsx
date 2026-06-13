"use client";

import { useState } from "react";
import { Split, Plus, ChevronRight, MapPin, DollarSign, TrendingUp, Layers } from "lucide-react";

interface SubParcel {
  id: string;
  name: string;
  acres: number;
  status: "available" | "listed" | "pending" | "sold";
  price: number;
  buyer?: string;
}

interface Subdivision {
  id: string;
  parentTitle: string;
  state: string;
  county: string;
  totalAcres: number;
  acquisitionCost: number;
  acquisitionDate: string;
  splitType: "minor" | "major";
  parcels: SubParcel[];
  notes: string;
}

const subdivisions: Subdivision[] = [
  {
    id: "sub-1",
    parentTitle: "Mesa Vista Ranch",
    state: "New Mexico",
    county: "Torrance",
    totalAcres: 40,
    acquisitionCost: 18000,
    acquisitionDate: "2026-03-15",
    splitType: "minor",
    notes: "4-way minor split, no survey required. County approved.",
    parcels: [
      { id: "p1", name: "Lot A — North Ridge", acres: 10, status: "sold", price: 12900, buyer: "James Wilson" },
      { id: "p2", name: "Lot B — Sunset View", acres: 10, status: "pending", price: 11900 },
      { id: "p3", name: "Lot C — Valley Floor", acres: 10, status: "listed", price: 10900 },
      { id: "p4", name: "Lot D — Mesa Top", acres: 10, status: "available", price: 13900 },
    ],
  },
  {
    id: "sub-2",
    parentTitle: "Ponderosa Flats",
    state: "Arizona",
    county: "Navajo",
    totalAcres: 80,
    acquisitionCost: 32000,
    acquisitionDate: "2026-01-20",
    splitType: "major",
    notes: "8-lot major subdivision. Plat filed, waiting county recording. Road easement secured.",
    parcels: [
      { id: "p5", name: "Block 1 — Trailhead", acres: 10, status: "sold", price: 14900, buyer: "Sarah Chen" },
      { id: "p6", name: "Block 2 — Creekside", acres: 10, status: "sold", price: 15900, buyer: "Mike Torres" },
      { id: "p7", name: "Block 3 — Hilltop", acres: 10, status: "pending", price: 13900 },
      { id: "p8", name: "Block 4 — Meadow", acres: 10, status: "listed", price: 12900 },
      { id: "p9", name: "Block 5 — Pine Ridge", acres: 10, status: "listed", price: 14500 },
      { id: "p10", name: "Block 6 — South View", acres: 10, status: "available", price: 11900 },
      { id: "p11", name: "Block 7 — Overlook", acres: 10, status: "available", price: 16900 },
      { id: "p12", name: "Block 8 — Flatland", acres: 10, status: "available", price: 10900 },
    ],
  },
  {
    id: "sub-3",
    parentTitle: "Lone Star Tract",
    state: "Texas",
    county: "Hudspeth",
    totalAcres: 20,
    acquisitionCost: 8000,
    acquisitionDate: "2026-04-01",
    splitType: "minor",
    notes: "Simple 4-lot split. All lots have road frontage on County Rd 12.",
    parcels: [
      { id: "p13", name: "Lot 1 — Road Front", acres: 5, status: "sold", price: 6900, buyer: "David Park" },
      { id: "p14", name: "Lot 2 — Corner", acres: 5, status: "listed", price: 5900 },
      { id: "p15", name: "Lot 3 — Interior", acres: 5, status: "listed", price: 4900 },
      { id: "p16", name: "Lot 4 — Back Forty", acres: 5, status: "available", price: 4500 },
    ],
  },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  available: { bg: "rgba(100,200,255,0.1)", text: "#64c8ff" },
  listed: { bg: "rgba(168,130,255,0.1)", text: "#a882ff" },
  pending: { bg: "rgba(255,180,60,0.1)", text: "#ffb43c" },
  sold: { bg: "rgba(80,220,140,0.1)", text: "#50dc8c" },
};

export default function SubdivisionsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const totalAcquired = subdivisions.reduce((s, d) => s + d.acquisitionCost, 0);
  const allParcels = subdivisions.flatMap(s => s.parcels);
  const totalRetail = allParcels.reduce((s, p) => s + p.price, 0);
  const soldRevenue = allParcels.filter(p => p.status === "sold").reduce((s, p) => s + p.price, 0);
  const totalProfit = totalRetail - totalAcquired;

  const sel = subdivisions.find(s => s.id === selected);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Land Splits</p>
          <h1 className="text-2xl font-bold mt-1">Subdivision Tracker</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--primary)", color: "#000" }}>
          <Plus className="w-4 h-4" /> New Split
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Acquired", value: `$${totalAcquired.toLocaleString()}`, icon: DollarSign, color: "var(--primary)" },
          { label: "Total Retail Value", value: `$${totalRetail.toLocaleString()}`, icon: TrendingUp, color: "#a882ff" },
          { label: "Revenue Collected", value: `$${soldRevenue.toLocaleString()}`, icon: DollarSign, color: "#50dc8c" },
          { label: "Projected Profit", value: `$${totalProfit.toLocaleString()}`, icon: TrendingUp, color: "#ffb43c" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subdivision List */}
        <div className="lg:col-span-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Parent Parcels ({subdivisions.length})</p>
          {subdivisions.map(sub => {
            const soldCount = sub.parcels.filter(p => p.status === "sold").length;
            const revenue = sub.parcels.filter(p => p.status === "sold").reduce((s, p) => s + p.price, 0);
            const roi = Math.round(((sub.parcels.reduce((s, p) => s + p.price, 0) - sub.acquisitionCost) / sub.acquisitionCost) * 100);
            const active = selected === sub.id;
            return (
              <button key={sub.id} onClick={() => setSelected(sub.id)}
                className="w-full text-left rounded-xl p-4 border transition-all"
                style={{
                  background: active ? "rgba(142,209,223,0.06)" : "var(--surface)",
                  borderColor: active ? "var(--primary)" : "rgba(255,255,255,0.05)",
                }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{sub.parentTitle}</h3>
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--muted)" }} />
                </div>
                <div className="flex items-center gap-2 text-xs mb-3" style={{ color: "var(--muted)" }}>
                  <MapPin className="w-3 h-3" /> {sub.county}, {sub.state}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p style={{ color: "var(--muted)" }}>Acres</p>
                    <p className="font-bold">{sub.totalAcres}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--muted)" }}>Lots</p>
                    <p className="font-bold">{soldCount}/{sub.parcels.length}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--muted)" }}>ROI</p>
                    <p className="font-bold" style={{ color: "#50dc8c" }}>+{roi}%</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(soldCount / sub.parcels.length) * 100}%`, background: "#50dc8c" }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {sel ? (
            <div className="rounded-xl border p-6 space-y-5" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{sel.parentTitle}</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{sel.county}, {sel.state} · {sel.totalAcres} acres · {sel.splitType === "minor" ? "Minor Split" : "Major Subdivision"}</p>
                </div>
                <div className="text-right text-sm">
                  <p style={{ color: "var(--muted)" }}>Acquired</p>
                  <p className="font-bold">${sel.acquisitionCost.toLocaleString()}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{sel.acquisitionDate}</p>
                </div>
              </div>

              {sel.notes && (
                <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(255,180,60,0.06)", color: "#ffb43c", border: "1px solid rgba(255,180,60,0.15)" }}>
                  <Layers className="w-3 h-3 inline mr-1" /> {sel.notes}
                </div>
              )}

              {/* Parcels Grid */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>Sub-Parcels ({sel.parcels.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sel.parcels.map(p => (
                    <div key={p.id} className="rounded-lg p-4 border" style={{ background: "var(--surface-low)", borderColor: "rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">{p.name}</h4>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: statusColors[p.status].bg, color: statusColors[p.status].text }}>
                          {p.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p style={{ color: "var(--muted)" }}>Size</p>
                          <p className="font-semibold">{p.acres} acres</p>
                        </div>
                        <div>
                          <p style={{ color: "var(--muted)" }}>Price</p>
                          <p className="font-semibold">${p.price.toLocaleString()}</p>
                        </div>
                      </div>
                      {p.buyer && (
                        <p className="text-xs mt-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>
                          Buyer: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{p.buyer}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-3 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="text-center">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Cost / Acre</p>
                  <p className="font-bold text-sm">${Math.round(sel.acquisitionCost / sel.totalAcres)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Avg Sale / Acre</p>
                  <p className="font-bold text-sm">${Math.round(sel.parcels.reduce((s, p) => s + p.price, 0) / sel.totalAcres)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Total Retail</p>
                  <p className="font-bold text-sm">${sel.parcels.reduce((s, p) => s + p.price, 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Gross Margin</p>
                  <p className="font-bold text-sm" style={{ color: "#50dc8c" }}>
                    {Math.round(((sel.parcels.reduce((s, p) => s + p.price, 0) - sel.acquisitionCost) / sel.acquisitionCost) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-12 flex flex-col items-center justify-center text-center" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
              <Split className="w-10 h-10 mb-3" style={{ color: "var(--muted)" }} />
              <p className="font-semibold">Select a subdivision</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Choose a parent parcel to view lots and financials</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
