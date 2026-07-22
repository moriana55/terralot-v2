"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 7 EYALET OFF-MARKET HARİTASI — AZ · NM · CO · TX · FL · AR · NC yedi hedef
// eyaletteki off-market envanterin TAMAMI tek haritada, TEK SİSTEMLE gösterilir.
//   ~469K koordinatlı lead → sunucu tarafı supercluster (offmarket-map-clusters):
//   uzak zoom'da eyalet renkli GERÇEK SAYILI cluster baloncukları, yakın zoom'da
//   HER kayıt tek tek gerçek nokta (örnekleme yok). Nokta tıklanınca canlı
//   Supabase detayı (owner, acres, land value). OSM ↔ Esri uydu katman anahtarı.
// Sahte koordinat SERPİLMEZ. Sayılar Supabase offmarket_leads gerçeğidir.
// Cluster API çökerse county merkezli gerçek sayılı toplu pinlere geri düşülür.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { StatePin } from "./off-market-map";

const OffMarketMap = dynamic(() => import("./off-market-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 text-sm" style={{ height: 640, color: "var(--muted)" }}>
      <Loader2 className="h-4 w-4 animate-spin" /> Harita yükleniyor…
    </div>
  ),
});

const STATES = ["AZ", "NM", "CO", "TX", "FL", "AR", "NC"] as const;

// TEK GERÇEK KAYNAK: sayılar CANLI /api/admin/offmarket-breakdown'dan gelir
// (Supabase offmarket_leads head-count). Aşağıdaki değerler yalnız API gelene
// kadar/başarısız olursa FALLBACK — 2026-07-22 doğrulandı, canlı ile birebir.
const FALLBACK: Record<string, number> = { AZ: 20000, NM: 69162, CO: 33243, TX: 153093, FL: 84044, AR: 71585, NC: 38148 };

// Eyalet bölge etiketi + rengi + (varsa) envanter linki. Lat/lng yalnız cluster
// API çökerse kullanılan fallback county pini içindir.
const STATE_INFO: Record<string, { region: string; lat: number; lng: number; color: string; href?: string }> = {
  AZ: { region: "Mohave", lat: 35.2, lng: -113.8, color: "#059669" },
  NM: { region: "Valencia + Luna", lat: 34.55, lng: -106.75, color: "#2563eb", href: "/admin/luna" },
  CO: { region: "Costilla + Las Animas", lat: 37.28, lng: -104.6, color: "#dc2626" },
  TX: { region: "Trans-Pecos + statewide", lat: 31.3, lng: -99.5, color: "#d97706" },
  FL: { region: "Charlotte + Highlands + statewide", lat: 28.0, lng: -81.6, color: "#7c3aed" },
  AR: { region: "Sharp + Izard + Van Buren", lat: 35.9, lng: -91.9, color: "#0891b2" },
  NC: { region: "Brunswick + Rutherford + Northampton", lat: 35.3, lng: -79.2, color: "#be185d" },
};

export default function OffMarketHaritaPage() {
  const [counts, setCounts] = useState<Record<string, number>>(FALLBACK);
  const [coordPoints, setCoordPoints] = useState<number | null>(null);

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

  const TOTAL_LEADS = STATES.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const biggest = STATES.reduce((a, b) => ((counts[a] ?? 0) >= (counts[b] ?? 0) ? a : b));
  const STATE_PINS: StatePin[] = STATES.map((st) => ({
    state: st,
    region: STATE_INFO[st].region,
    lat: STATE_INFO[st].lat,
    lng: STATE_INFO[st].lng,
    color: STATE_INFO[st].color,
    leads: counts[st] ?? 0,
    href: STATE_INFO[st].href,
  }));

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
          AZ · NM · CO · TX · FL · AR · NC yedi hedef eyalette <strong>{TOTAL_LEADS.toLocaleString("en-US")}</strong>{" "}
          off-market lead — <strong>tamamı haritada</strong>. Uzak zoom'da eyalet renkli cluster baloncukları
          (sayılar gerçek kayıt sayısı), yakınlaşınca her kayıt tek tek gerçek koordinatlı nokta olur; noktaya
          tıklayınca sahip/acre/değer detayı canlı gelir. Sağ üstten uydu görünümüne geçilebilir.
        </p>
      </header>

      {/* Özet şerit */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hedef eyalet" value="7" sub="AZ·NM·CO·TX·FL·AR·NC" accent />
        <Stat
          label="Toplam off-market lead"
          value={TOTAL_LEADS.toLocaleString("en-US")}
          sub="owner + posta adresi mevcut"
          accent
        />
        <Stat
          label="En büyük pazar"
          value={(counts[biggest] ?? 0).toLocaleString("en-US")}
          sub={`${biggest} · ${STATE_INFO[biggest].region}`}
        />
        <Stat
          label="Koordinatlı nokta"
          value={coordPoints == null ? "…" : coordPoints.toLocaleString("en-US")}
          sub="haritada çizilen (7 eyalet)"
        />
      </div>

      {/* Lejant */}
      <div className="flex flex-wrap gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {STATES.map((st) => (
          <div key={st} className="flex items-center gap-2">
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: STATE_INFO[st].color,
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
              }}
            />
            <span className="text-xs">
              <b>{st} · {STATE_INFO[st].region}</b>{" "}
              <span style={{ color: "var(--muted)" }}>— {(counts[st] ?? 0).toLocaleString("en-US")} lead</span>
            </span>
          </div>
        ))}
      </div>

      {/* Harita */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <OffMarketMap statePins={STATE_PINS} onMeta={(m) => setCoordPoints(m.totalPoints)} />
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Noktalar <b>/api/admin/offmarket-map-clusters</b> katmanından gelir (kaynak: Supabase offmarket_leads,
        gerçek parsel/centroid koordinatları — sahte nokta üretilmez). Cluster sayıları gerçek kayıt sayısıdır ve
        zoom'da tek tek noktalara açılır; koordinatı henüz olmayan ~230 kayıt haritada gösterilmez.
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
