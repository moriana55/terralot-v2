"use client";

import { useEffect, useState } from "react";
import { Factory, Cpu, BatteryCharging, Server, Car } from "lucide-react";

interface Catalyst {
  company: string; project: string; sector: string;
  city: string; state: string; county: string;
  investmentB: number; year: number;
}

const SECTOR: Record<string, { Icon: typeof Factory; color: string }> = {
  "Çip": { Icon: Cpu, color: "#8ed1df" },
  "EV": { Icon: Car, color: "#5aa9ff" },
  "EV/Batarya": { Icon: Car, color: "#5aa9ff" },
  "Batarya": { Icon: BatteryCharging, color: "#50dc8c" },
  "Veri Merkezi": { Icon: Server, color: "#ffb43c" },
};

export function GrowthCatalysts() {
  const [items, setItems] = useState<Catalyst[]>([]);

  useEffect(() => {
    fetch("/api/growth-catalysts").then((r) => r.json()).then((j) => setItems(j.catalysts || [])).catch(() => {});
  }, []);

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--surface-high)" }}>
        <Factory className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
        <h2 className="font-bold text-sm">Büyüme Katalizörleri</h2>
        <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>· megaproje yakını arazi = patlama potansiyeli</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "var(--surface-high)" }}>
        {items.sort((a, b) => b.investmentB - a.investmentB).map((c, i) => {
          const { Icon, color } = SECTOR[c.sector] || SECTOR["Çip"];
          return (
            <div key={i} className="p-4" style={{ background: "var(--surface)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${color}1f`, color }}>{c.sector}</span>
                <span className="ml-auto text-sm font-extrabold font-mono" style={{ color: "var(--grade-a)" }}>${c.investmentB}B</span>
              </div>
              <p className="font-bold text-sm">{c.company}</p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>{c.project}</p>
              <p className="text-[11px] mt-1.5 font-semibold" style={{ color: "var(--accent-ink)" }}>{c.county} County, {c.state}</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>{c.city} · ~{c.year}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
