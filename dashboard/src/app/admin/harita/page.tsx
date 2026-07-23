"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ANA HARİTA — /admin/harita — müşteri/yatırımcı sunumu için TAM EKRAN vitrin.
// Ekranın tamamı harita (admin şablonunun üstüne fixed overlay), üstte ince
// şeffaf bar: marka + canlı toplam + eyalet filtre çipleri + koyu/uydu anahtarı.
//   - Noktalar: /api/admin/offmarket-map-clusters (yüzbinlerce gerçek koordinat,
//     sunucu tarafı supercluster — sahte nokta YOK).
//   - Sayılar: TEK GERÇEK KAYNAK useOffmarketStats → /api/admin/offmarket-breakdown.
//   - Çip tıkla → o eyalete uçar + sadece onu gösterir; tekrar tıkla → tümü.
// Mevcut /admin/off-market-harita analitik sayfası olduğu gibi durur.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CerberusLogo } from "@/components/DealHoundLogo";
import {
  OFFMARKET_STATES,
  OFFMARKET_STATE_META,
  type OffmarketState,
} from "@/lib/offmarket-stats";
import { useOffmarketStats } from "@/lib/useOffmarketStats";

const MainMap = dynamic(() => import("./main-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "#0b1220" }}>
      <span className="rounded-xl p-2 animate-pulse" style={{ background: "rgba(142,209,223,0.12)" }}>
        <CerberusLogo size={34} />
      </span>
      <div className="flex items-center gap-2 text-sm" style={{ color: "#7d8ba3" }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Harita hazırlanıyor…
      </div>
    </div>
  );
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}K` : String(n);

export default function AnaHaritaPage() {
  const { counts, total } = useOffmarketStats();
  const [selected, setSelected] = useState<OffmarketState | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [showComp, setShowComp] = useState(false); // rakip ilanları (kırmızı elmas)
  // Çip tıklamasını haritaya iletmek için "komut" state'i (her tıklamada artan id).
  const [flyCmd, setFlyCmd] = useState<{ id: number; st: OffmarketState | null }>({ id: 0, st: null });

  const pick = (st: OffmarketState) => {
    const next = selected === st ? null : st;
    setSelected(next);
    setFlyCmd((c) => ({ id: c.id + 1, st: next }));
  };

  return (
    <div className="fixed inset-0 z-[80]" style={{ background: "#0b1220" }}>
      {/* Harita — tam ekran */}
      <div className="absolute inset-0">
        <MainMap satellite={satellite} stateFilter={selected} flyCmd={flyCmd} showCompetitors={showComp} />
      </div>

      {/* Üst şeffaf bar */}
      <div
        className="absolute inset-x-0 top-0 z-[1200] px-3 py-2 sm:px-4"
        style={{
          background: "linear-gradient(180deg, rgba(8,12,24,0.88) 0%, rgba(8,12,24,0.72) 70%, rgba(8,12,24,0) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Marka + toplam */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/admin"
              title="Panele dön"
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/10"
              style={{ color: "#9fb0c8" }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="shrink-0 rounded-lg p-1" style={{ background: "rgba(142,209,223,0.14)" }}>
              <CerberusLogo size={22} />
            </span>
            <div className="leading-tight min-w-0">
              <div className="text-[14px] font-extrabold tracking-tight text-white truncate">
                Terra<span style={{ color: "#8ed1df" }}>Lot</span>
                <span className="ml-2 hidden sm:inline text-[12px] font-semibold" style={{ color: "#c6d3e6" }}>
                  {OFFMARKET_STATES.length} Eyalet · {total.toLocaleString("en-US")} Off-Market Lead
                </span>
              </div>
              <div className="sm:hidden text-[11px] font-medium" style={{ color: "#c6d3e6" }}>
                {OFFMARKET_STATES.length} Eyalet · {total.toLocaleString("en-US")} lead
              </div>
            </div>
          </div>

          {/* Eyalet çipleri */}
          <div className="order-3 -mx-3 w-[calc(100%+1.5rem)] overflow-x-auto px-3 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0 [scrollbar-width:none]">
            <div className="flex items-center gap-1.5 py-0.5">
              {OFFMARKET_STATES.map((st) => {
                const m = OFFMARKET_STATE_META[st];
                const on = selected === st;
                const dim = selected != null && !on;
                return (
                  <button
                    key={st}
                    onClick={() => pick(st)}
                    title={`${m.label} · ${m.region} — ${(counts[st] ?? 0).toLocaleString("en-US")} lead${on ? " (filtreyi kaldır)" : ""}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all"
                    style={{
                      borderColor: on ? m.color : "rgba(255,255,255,0.16)",
                      background: on ? `${m.color}33` : "rgba(255,255,255,0.06)",
                      color: dim ? "#6b7a94" : "#ffffff",
                      opacity: dim ? 0.65 : 1,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }}
                    />
                    {st}
                    <span style={{ color: dim ? "#5d6b84" : "#b7c4d9", fontWeight: 600 }}>{compact(counts[st] ?? 0)}</span>
                  </button>
                );
              })}
              {selected && (
                <button
                  onClick={() => pick(selected)}
                  className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)" }}
                >
                  Tümü
                </button>
              )}
            </div>
          </div>

          {/* Rakip ilanları toggle — kırmızı elmas katmanı */}
          <button
            onClick={() => setShowComp((v) => !v)}
            title="Rakip ilanları göster/gizle (Discount Lots · Landio · Rina Land — gerçek koordinat)"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all"
            style={{
              borderColor: showComp ? "#dc2626" : "rgba(255,255,255,0.16)",
              background: showComp ? "rgba(220,38,38,0.22)" : "rgba(255,255,255,0.06)",
              color: showComp ? "#fca5a5" : "#9fb0c8",
            }}
          >
            <span
              className="inline-block h-2 w-2"
              style={{ background: "#dc2626", transform: "rotate(45deg)", boxShadow: showComp ? "0 0 6px #dc2626" : "none" }}
            />
            Rakip İlanlar
          </button>

          {/* Koyu / Uydu anahtarı */}
          <div
            className="flex shrink-0 items-center rounded-full border p-0.5"
            style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)" }}
          >
            {([false, true] as const).map((sat) => (
              <button
                key={String(sat)}
                onClick={() => setSatellite(sat)}
                className="rounded-full px-3 py-1 text-[11px] font-bold transition-all"
                style={{
                  background: satellite === sat ? "#8ed1df" : "transparent",
                  color: satellite === sat ? "#0b1220" : "#9fb0c8",
                }}
              >
                {sat ? "Uydu" : "Harita"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
