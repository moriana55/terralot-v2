"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EYALET OFF-MARKET HARİTASI — aktif hedef eyaletlerdeki (lib/offmarket-stats)
// off-market envanterin TAMAMI tek haritada, TEK SİSTEMLE gösterilir.
//   ~469K koordinatlı lead → sunucu tarafı supercluster (offmarket-map-clusters):
//   uzak zoom'da eyalet renkli GERÇEK SAYILI cluster baloncukları, yakın zoom'da
//   HER kayıt tek tek gerçek nokta (örnekleme yok). Nokta tıklanınca canlı
//   Supabase detayı (owner, acres, land value). OSM ↔ Esri uydu katman anahtarı.
// Sahte koordinat SERPİLMEZ. Sayılar Supabase offmarket_leads gerçeğidir.
// Cluster API çökerse county merkezli gerçek sayılı toplu pinlere geri düşülür.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { StatePin } from "./off-market-map";
import { OFFMARKET_STATES, OFFMARKET_STATE_META } from "@/lib/offmarket-stats";
import { useOffmarketStats } from "@/lib/useOffmarketStats";

const OffMarketMap = dynamic(() => import("./off-market-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 text-sm" style={{ height: 640, color: "var(--muted)" }}>
      <Loader2 className="h-4 w-4 animate-spin" /> Harita yükleniyor…
    </div>
  ),
});

// TEK GERÇEK KAYNAK: sayılar CANLI /api/admin/offmarket-breakdown'dan
// (useOffmarketStats hook'u), fallback tek dosyadan (lib/offmarket-stats).
// Bu sayfada hardcoded lead sayısı YOKTUR.
const STATES = OFFMARKET_STATES;
const STATE_INFO = OFFMARKET_STATE_META;

export default function OffMarketHaritaPage() {
  const { counts, total: TOTAL_LEADS } = useOffmarketStats();
  const [coordPoints, setCoordPoints] = useState<number | null>(null);
  const [showComp, setShowComp] = useState(false); // rakip ilanları (kırmızı elmas)
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
          ✅ {STATES.length} Eyalet · Off-Market Footprint
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <MapIcon className="h-6 w-6" style={{ color: "#059669" }} /> {STATES.length} Eyalet Off-Market Haritası
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          {STATES.join(" · ")} hedef eyaletlerinde <strong>{TOTAL_LEADS.toLocaleString("en-US")}</strong>{" "}
          off-market lead — <strong>tamamı haritada</strong>. Uzak zoom'da eyalet renkli cluster baloncukları
          (sayılar gerçek kayıt sayısı), yakınlaşınca her kayıt tek tek gerçek koordinatlı nokta olur; noktaya
          tıklayınca sahip/acre/değer detayı canlı gelir. Sağ üstten uydu görünümüne geçilebilir.
        </p>
      </header>

      {/* Özet şerit */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hedef eyalet" value={String(STATES.length)} sub={STATES.join("·")} accent />
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
          sub="haritada çizilen (tüm eyaletler)"
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
        {/* Rakip ilanları toggle — kırmızı elmas katmanı (Discount Lots · Landio · Rina Land) */}
        <button
          onClick={() => setShowComp((v) => !v)}
          title="Rakip ilanları göster/gizle — gerçek ilan koordinatları (Discount Lots · Landio · Rina Land)"
          className="ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition-all"
          style={{
            borderColor: showComp ? "#dc2626" : "var(--border)",
            background: showComp ? "rgba(220,38,38,0.12)" : "transparent",
            color: showComp ? "#b91c1c" : "var(--muted)",
          }}
        >
          <span
            style={{
              display: "inline-block", width: 10, height: 10, transform: "rotate(45deg)",
              background: "#dc2626", border: "1.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
            }}
          />
          Rakip İlanlar
        </button>
      </div>

      {/* Harita */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <OffMarketMap statePins={STATE_PINS} onMeta={(m) => setCoordPoints(m.totalPoints)} showCompetitors={showComp} />
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
