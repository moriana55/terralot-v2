"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOD: ALINABİLİR
// Eski `/admin/alinabilir-harita` sayfasının gövdesi — projedeki en zengin
// harita ekranı. 2D (Leaflet) varsayılan, 3D (MapLibre + arazi) isteğe bağlı.
// İçindeki tüm katmanlar ağır bileşenlerin kendisinde durur ve DEĞİŞMEDİ:
// filtre paneli (7 boolean + grade çipleri), lejant, Regrid tapu sınırları,
// OSM yollar, FEMA, County GIS, pazarlama görseli üreteci, kampanya sepeti,
// Mohave 💌/⭐ katmanları, 🏁 rakip satışları, 🐋 büyük oyuncular,
// 3D arazi / sunum turu / spread kuleleri.
// Ağır bileşenler yerinde bırakıldı: ../alinabilir-harita/deals-map(-3d).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { MapPoint } from "../alinabilir-harita/deals-map";

const DealsMap = dynamic(() => import("../alinabilir-harita/deals-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

// 3D mod (MapLibre GL + arazi) — 2D varsayılan kalır, 3D isteğe bağlı yüklenir.
const DealsMap3D = dynamic(() => import("../alinabilir-harita/deals-map-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

export default function ModAlinabilir() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [minGrade, setMinGrade] = useState("B"); // A+B varsayılan
  const [mode3d, setMode3d] = useState(false); // 2D Leaflet varsayılan; 3D = MapLibre + arazi

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ map: "1", onlyComp: "1", minSpread: "1500", sort: "spread" });
    if (minGrade) p.set("minGrade", minGrade);
    fetch(`/api/admin/all-deals?${p}`)
      .then((r) => r.json())
      .then((d) => { setPoints(d.points ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [minGrade]);

  const totalSpread = useMemo(() => points.reduce((s, p) => s + (p.spread || 0), 0), [points]);

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[520px] flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            <MapIcon className="h-3.5 w-3.5" /> Alınabilir Parseller · Harita
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Deal Haritası</h1>
          <p className="text-sm text-slate-500">
            ATTOM değerli, spread ≥ $1.500 alınabilir parseller — her nokta gerçek bir deal.{" "}
            <span className="font-semibold text-slate-700">
              {points.length.toLocaleString()} parsel · toplam spread ~${Math.round(totalSpread).toLocaleString()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[[false, "2D"], [true, "3D Arazi"]].map(([v, l]) => (
              <button key={String(l)} onClick={() => setMode3d(v as boolean)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode3d === v ? "bg-cyan-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                {l as string}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {[["A", "Sadece A"], ["B", "A + B"], ["", "Hepsi"]].map(([v, l]) => (
              <button key={l} onClick={() => setMinGrade(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${minGrade === v ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#059669" }} /> A</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0284c7" }} /> B</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#94a3b8" }} /> C</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && points.length === 0 && (
          <div className="flex h-full items-center justify-center text-slate-400">Koordinatlı alınabilir parsel yok.</div>
        )}
        {points.length > 0 && (mode3d ? <DealsMap3D points={points} /> : <DealsMap points={points} />)}
      </div>
    </div>
  );
}
