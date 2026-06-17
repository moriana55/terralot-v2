"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { MapDeal, MapCatalyst, MapSale } from "./cerberus-map";

const CerberusMap = dynamic(() => import("./cerberus-map"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[640px] gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Harita yükleniyor…</div>,
});

export default function DealMapPage() {
  const [deals, setDeals] = useState<MapDeal[]>([]);
  const [catalysts, setCatalysts] = useState<MapCatalyst[]>([]);
  const [sales, setSales] = useState<MapSale[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: d }, salesRes, cat] = await Promise.all([
        supabase.from("tax_delinquent_properties").select("id,lat,lng,county,state,final_score,minimum_bid,judgment_amount").not("lat", "is", null).not("lng", "is", null).order("final_score", { ascending: false, nullsFirst: false }).limit(800),
        fetch("/api/admin/upcoming-sales").then(r => r.json()).catch(() => ({ sales: [] })),
        fetch("/api/growth-catalysts").then(r => r.json()).catch(() => ({ catalysts: [] })),
      ]);
      setDeals((d as MapDeal[])?.filter(x => x.lat && x.lng) || []);
      setSales((salesRes.sales as MapSale[]) || []);
      setCatalysts(cat.catalysts || []);
    })();
  }, []);

  const legend = [
    { c: "#0f9d58", t: "A+/A deal" }, { c: "#0e7d97", t: "B deal" }, { c: "#b9770a", t: "C deal" },
    { c: "#ffb43c", t: "📅 Yaklaşan satış", ring: true }, { c: "#0a1a3f", t: "🏭 Megaproje" },
  ];

  return (
    <div className="p-7 max-w-6xl space-y-4">
      <div className="flex items-center gap-2">
        <MapIcon className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
        <h1 className="text-2xl font-bold">Deal Haritası</h1>
        <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>{deals.length} deal · {sales.length} satış · {catalysts.length} megaproje</span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {legend.map((l, i) => (
          <span key={i} className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <span className="w-3 h-3 rounded-full" style={{ background: l.ring ? "transparent" : l.c, border: l.ring ? `2px solid ${l.c}` : "none" }} /> {l.t}
          </span>
        ))}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--surface-high)" }}>
        <CerberusMap deals={deals} catalysts={catalysts} sales={sales} />
      </div>
    </div>
  );
}
