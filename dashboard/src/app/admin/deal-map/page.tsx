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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [dealsRes, salesRes, cat] = await Promise.all([
          supabase.from("tax_delinquent_properties").select("id,lat,lng,county,state,final_score,minimum_bid,judgment_amount").not("lat", "is", null).not("lng", "is", null).order("final_score", { ascending: false, nullsFirst: false }).limit(800),
          fetch("/api/admin/upcoming-sales").then(r => r.json()).catch(() => ({ sales: [] })),
          fetch("/api/growth-catalysts").then(r => r.json()).catch(() => ({ catalysts: [] })),
        ]);
        if (!alive) return;
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        setDeals((dealsRes.data as MapDeal[])?.filter(x => x.lat != null && x.lng != null) || []);
        setSales((salesRes.sales as MapSale[]) || []);
        setCatalysts(cat.catalysts || []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Harita verileri yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
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
        <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>
          {loading ? "yükleniyor…" : `${deals.length} deal · ${sales.length} satış · ${catalysts.length} megaproje`}
        </span>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: "var(--status-overdue-soft)", color: "var(--danger)", border: "1px solid rgba(186,26,26,0.2)" }}>
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        {legend.map((l, i) => (
          <span key={i} className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <span className="w-3 h-3 rounded-full" style={{ background: l.ring ? "transparent" : l.c, border: l.ring ? `2px solid ${l.c}` : "none" }} /> {l.t}
          </span>
        ))}
      </div>

      <div className="tl-card overflow-hidden relative">
        <CerberusMap deals={deals} catalysts={catalysts} sales={sales} />
        {!loading && !error && deals.length === 0 && sales.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.9)", color: "var(--muted)" }}>
              Haritada gösterilecek konumlu deal/satış yok.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
