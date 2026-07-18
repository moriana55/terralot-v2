"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 5 EYALET OFF-MARKET HARİTASI — NM · AZ · CO · TX · FL beş hedef eyalette
// off-market envanterimizi TEK haritada DÜRÜSTÇE gösterir.
//   AZ · Mohave   → 20.000 lead, ~19.9K'sında GERÇEK lat/lng → gerçek nokta.
//   NM · Valencia+Luna → ~69.2K lead (açık ArcGIS) ama koordinat YOK → county pini.
//   CO/TX/FL      → açık ArcGIS'ten ~33.2K/22.8K/49.9K lead yüklü (Supabase offmarket_leads),
//                   çoğu koordinatsız → county footprint pini. Sahte koordinat SERPİLMEZ.
// Harita altyapısı: react-leaflet (mevcut deals-map.tsx ile aynı; yeni kütüphane yok).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { OffMarketPoint, TargetState } from "./off-market-map";

const OffMarketMap = dynamic(() => import("./off-market-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 text-sm" style={{ height: 640, color: "var(--muted)" }}>
      <Loader2 className="h-4 w-4 animate-spin" /> Harita yükleniyor…
    </div>
  ),
});

// AZ 20.000 + NM 157 = 20.157 gerçek lead (kaynak: mohave-offmarket.json + Luna PropStream export).
const AZ_LEADS = 20000;
const NM_LUNA_LEADS = 157;
const TOTAL_REAL_LEADS = AZ_LEADS + NM_LUNA_LEADS;

// CO/TX/FL hedef county merkezleri — SADECE footprint pini, veri değil.
const TARGETS: TargetState[] = [
  { state: "CO", county: "Costilla / San Luis", lat: 37.18, lng: -105.42, color: "#dc2626" },
  { state: "TX", county: "Horizon / El Paso", lat: 31.68, lng: -106.2, color: "#d97706" },
  { state: "FL", county: "Highlands / Sebring", lat: 27.49, lng: -81.44, color: "#7c3aed" },
];

type Legend = { color: string; label: string; sub: string; dashed?: boolean; pin?: boolean };
const LEGEND: Legend[] = [
  { color: "#059669", label: "AZ · Mohave", sub: `${AZ_LEADS.toLocaleString("en-US")} lead · gerçek koordinat` },
  { color: "#2563eb", label: "NM · Valencia+Luna", sub: "~69.2K lead · açık ArcGIS (koordinat yok)", pin: true },
  { color: "#dc2626", label: "CO · Costilla+Las Animas", sub: "~33.2K lead · açık ArcGIS (county pini)", dashed: true },
  { color: "#d97706", label: "TX · Hudspeth+Trans-Pecos", sub: "~22.8K lead · CAD ArcGIS (county pini)", dashed: true },
  { color: "#7c3aed", label: "FL · Charlotte+Highlands", sub: "~49.9K lead · açık ArcGIS (county pini)", dashed: true },
];

export default function OffMarketHaritaPage() {
  const [azPoints, setAzPoints] = useState<OffMarketPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // AZ Mohave gerçek noktaları — mevcut lean API (nokta+popup+skor).
    fetch("/api/admin/mohave-map-points")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const pts = Array.isArray(d.points)
          ? (d.points as Array<Record<string, unknown>>).map((p) => ({
              id: String(p.id),
              lat: Number(p.lat),
              lng: Number(p.lng),
              owner: String(p.owner ?? ""),
              region: String(p.region ?? ""),
              acres: p.acres == null ? null : Number(p.acres),
              landValue: p.landValue == null ? null : Number(p.landValue),
              score: Number(p.score ?? 0),
            }))
          : [];
        setAzPoints(pts);
      })
      .catch(() => { if (alive) setError("AZ nokta katmanı yüklenemedi."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-4 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#059669" }}>
          ✅ 5 Eyalet · Off-Market Footprint
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <MapIcon className="h-6 w-6" style={{ color: "#059669" }} /> 5 Eyalet Off-Market Haritası
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          NM · AZ · CO · TX · FL beş hedef eyalette off-market envanterimiz. <strong>Dürüstlük kuralı:</strong>{" "}
          koordinatı olan lead gerçek nokta olarak çizilir; koordinatı olmayan (Luna) tek county pini olur;
          henüz verisi olmayan (CO/TX/FL) boş &quot;hedef&quot; işareti kalır. Sahte nokta üretilmez.
        </p>
      </header>

      {/* Özet şerit */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hedef eyalet" value="5" sub="NM·AZ·CO·TX·FL" accent />
        <Stat
          label="Toplam gerçek lead"
          value={TOTAL_REAL_LEADS.toLocaleString("en-US")}
          sub={`AZ ${AZ_LEADS.toLocaleString("en-US")} + NM ${NM_LUNA_LEADS}`}
          accent
        />
        <Stat
          label="Koordinatlı nokta"
          value={loading ? "…" : azPoints.length.toLocaleString("en-US")}
          sub="haritada çizilen (AZ)"
        />
        <Stat label="Veri bekleyen" value="3" sub="CO/TX/FL · PropStream" />
      </div>

      {/* Lejant */}
      <div className="flex flex-wrap gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: l.pin ? 4 : "50%",
                background: l.dashed ? `${l.color}22` : l.color,
                border: l.dashed ? `2px dashed ${l.color}` : l.pin ? `2px solid ${l.color}` : "2px solid #fff",
                boxShadow: l.dashed ? "none" : "0 0 0 1px rgba(0,0,0,0.1)",
              }}
            />
            <span className="text-xs">
              <b>{l.label}</b> <span style={{ color: "var(--muted)" }}>— {l.sub}</span>
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(186,26,26,0.08)", color: "var(--danger)", border: "1px solid rgba(186,26,26,0.2)" }}>
          {error}
        </div>
      )}

      {/* Harita */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <OffMarketMap azPoints={azPoints} lunaLeads={NM_LUNA_LEADS} targets={TARGETS} />
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        AZ noktaları <b>/api/admin/mohave-map-points</b> lean katmanından gelir (skor rengi: yeşil ≥80 · sarı ≥60 · gri
        &lt;60). Luna pini tıklanınca <b>/admin/luna</b> envanterine gider. CO/TX/FL kesikli halka = PropStream verisi
        çekilene kadar boş hedef.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 text-xl font-bold" style={accent ? { color: "#059669" } : undefined}>{value}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
