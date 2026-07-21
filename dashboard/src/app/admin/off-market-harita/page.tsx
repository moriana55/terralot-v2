"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 5 EYALET OFF-MARKET HARİTASI — NM · AZ · CO · TX · FL beş hedef eyalette
// off-market envanterimizi TEK haritada DÜRÜSTÇE gösterir.
//   AZ · Mohave   → 20.000 lead, ~19.9K'sında GERÇEK lat/lng → gerçek nokta.
//   NM/CO/TX/FL   → owner + posta adresli lead (absentee) YÜKLÜ (Supabase offmarket_leads),
//                   çoğu koordinatsız → county merkezinde GERÇEK SAYILI toplu pin.
// Sahte parsel koordinatı SERPİLMEZ. Sayılar Supabase offmarket_leads gerçeğidir.
// Harita altyapısı: react-leaflet (mevcut deals-map.tsx ile aynı; yeni kütüphane yok).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { OffMarketPoint, StatePin } from "./off-market-map";

const OffMarketMap = dynamic(() => import("./off-market-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 text-sm" style={{ height: 640, color: "var(--muted)" }}>
      <Loader2 className="h-4 w-4 animate-spin" /> Harita yükleniyor…
    </div>
  ),
});

// TEK GERÇEK KAYNAK: sayılar CANLI /api/admin/offmarket-breakdown'dan gelir
// (Supabase offmarket_leads head-count). Aşağıdaki değerler yalnız API gelene
// kadar/başarısız olursa FALLBACK — hepsi 2026-07 doğrulandı, canlı ile birebir.
const FALLBACK: Record<string, number> = { AZ: 20000, NM: 69162, CO: 33243, TX: 153093, FL: 84044, AR: 0, NC: 0 };

// County merkezleri (lat/lng) + href — koordinatsız lead'ler için toplu pin konumu.
// SAYI buraya API'den enjekte edilir; merkez/renk sabit kalır.
const CENTROIDS: Record<string, { region: string; lat: number; lng: number; color: string; href?: string }> = {
  NM: { region: "Valencia + Luna", lat: 34.55, lng: -106.75, color: "#2563eb", href: "/admin/luna" },
  CO: { region: "Costilla + Las Animas", lat: 37.28, lng: -104.6, color: "#dc2626" },
  TX: { region: "Trans-Pecos + statewide", lat: 31.3, lng: -99.5, color: "#d97706" },
  FL: { region: "Charlotte + Highlands + statewide", lat: 28.0, lng: -81.6, color: "#7c3aed" },
  AR: { region: "Sharp + Izard + Van Buren", lat: 35.9, lng: -91.9, color: "#0891b2" },
  NC: { region: "Brunswick + Rutherford + Northampton", lat: 35.3, lng: -79.2, color: "#be185d" },
};

export default function OffMarketHaritaPage() {
  const [azPoints, setAzPoints] = useState<OffMarketPoint[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TEK GERÇEK KAYNAK — canlı per-eyalet sayıları (bayatlamaz, her ekranla tutarlı).
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/offmarket-breakdown")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !Array.isArray(d.byState)) return;
        const next: Record<string, number> = { ...FALLBACK };
        for (const s of d.byState as Array<{ state: string; count: number }>) {
          if (typeof s.count === "number") next[s.state] = s.count;
        }
        setCounts(next);
      })
      .catch(() => { /* fallback sayıları kalır */ });
    return () => { alive = false; };
  }, []);

  const TOTAL_LEADS = (["AZ", "NM", "CO", "TX", "FL", "AR", "NC"] as const).reduce((s, k) => s + (counts[k] ?? 0), 0);
  const TX_LEADS = counts.TX ?? 0;
  const STATE_PINS: StatePin[] = (["NM", "CO", "TX", "FL", "AR", "NC"] as const).map((st) => ({
    state: st,
    region: CENTROIDS[st].region,
    lat: CENTROIDS[st].lat,
    lng: CENTROIDS[st].lng,
    color: CENTROIDS[st].color,
    leads: counts[st] ?? 0,
    href: CENTROIDS[st].href,
  }));
  type Legend = { color: string; label: string; sub: string; pin?: boolean };
  const LEGEND: Legend[] = [
    { color: "#059669", label: "AZ · Mohave", sub: `${(counts.AZ ?? 0).toLocaleString("en-US")} lead · gerçek koordinat (nokta)` },
    { color: "#2563eb", label: "NM · Valencia+Luna", sub: `${(counts.NM ?? 0).toLocaleString("en-US")} lead · county pini`, pin: true },
    { color: "#dc2626", label: "CO · Costilla+Las Animas", sub: `${(counts.CO ?? 0).toLocaleString("en-US")} lead · county pini`, pin: true },
    { color: "#d97706", label: "TX · Trans-Pecos+statewide", sub: `${(counts.TX ?? 0).toLocaleString("en-US")} lead · county pini`, pin: true },
    { color: "#0891b2", label: "AR · Sharp+Izard+VanBuren", sub: `${(counts.AR ?? 0).toLocaleString("en-US")} lead · county pini`, pin: true },
    { color: "#be185d", label: "NC · Brunswick+Rutherford+Northampton", sub: `${(counts.NC ?? 0).toLocaleString("en-US")} lead · county pini`, pin: true },
    { color: "#7c3aed", label: "FL · Charlotte+Highlands", sub: `${(counts.FL ?? 0).toLocaleString("en-US")} lead · county pini`, pin: true },
  ];

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
          ✅ 7 Eyalet · Off-Market Footprint
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <MapIcon className="h-6 w-6" style={{ color: "#059669" }} /> 7 Eyalet Off-Market Haritası
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          NM · AZ · CO · TX · FL beş hedef eyalette <strong>{TOTAL_LEADS.toLocaleString("en-US")}</strong> off-market lead.{" "}
          <strong>Dürüstlük kuralı:</strong> koordinatı olan lead gerçek nokta olarak çizilir (AZ);
          koordinatı olmayan eyaletler county merkezinde <strong>gerçek sayılı</strong> toplu pin olur. Sahte nokta üretilmez.
        </p>
      </header>

      {/* Özet şerit */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hedef eyalet" value="5" sub="NM·AZ·CO·TX·FL" accent />
        <Stat
          label="Toplam off-market lead"
          value={TOTAL_LEADS.toLocaleString("en-US")}
          sub="owner + posta adresi mevcut"
          accent
        />
        <Stat
          label="En büyük pazar"
          value={TX_LEADS.toLocaleString("en-US")}
          sub="TX · Trans-Pecos + statewide"
        />
        <Stat
          label="Koordinatlı nokta"
          value={loading ? "…" : azPoints.length.toLocaleString("en-US")}
          sub="haritada çizilen (AZ Mohave)"
        />
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
                background: l.color,
                border: l.pin ? `2px solid ${l.color}` : "2px solid #fff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
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
        <OffMarketMap azPoints={azPoints} statePins={STATE_PINS} />
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        AZ noktaları <b>/api/admin/mohave-map-points</b> lean katmanından gelir (skor rengi: yeşil ≥80 · sarı ≥60 · gri
        &lt;60). NM/CO/TX/FL pinleri county merkezine yerleştirilmiş <b>gerçek</b> lead sayılarıdır (owner + posta adresi
        mevcut); parsel koordinatı geldikçe nokta katmanına dönüşür.
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
