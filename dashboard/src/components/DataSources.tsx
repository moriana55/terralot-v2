"use client";

import { Database, MapPin, Users, TrendingUp, Building2, Waves, Route, Landmark, Info } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// "VERİ KAYNAKLARI" PANELİ — şeffaflık için her analizin DAYANDIĞI gerçek
// kaynakları (mümkünse sayıyla) tek bakışta gösterir.
//
// Amaç: Ahmet (müşteri) "bu sayı nereden geliyor?" derse cevap EKRANDA olsun.
// Bu panel UYDURMA kaynak yazmaz — yalnızca ilgili analizde GERÇEKTEN kullanılan
// (veya kullanılamayan) kaynakları, dürüst etiketlerle ("kullanıldı" / "veri yok")
// listeler. Her satır: ikon · kaynak adı · ne sağladığı · varsa sayısal kanıt.
//
// Kaynak kataloğu (gerçek, projede bağlı):
//   • County tax-delinquent roll → tax_delinquent_properties (12K+ gerçek parsel)
//   • Comps / $/acre → competitor_listings (gerçek piyasa ilanları, medyan)
//   • Demografi → county_demographics (ACS nüfus/medyan gelir)
//   • Büyüme → county_demographics.pop_growth_5y (5 yıllık nüfus trendi)
//   • Ruhsat → county_demographics.building_permits (inşaat ruhsatı)
//   • FEMA → sel bölgesi (canlı zenginleştirme)
//   • OSM → yol erişimi (canlı zenginleştirme)
// ─────────────────────────────────────────────────────────────────────────────

export type SourceStatus = "used" | "missing" | "estimated";

export interface DataSourceItem {
  /** Kaynak ailesi — ikon seçimi için. */
  kind:
    | "parcel"
    | "comps"
    | "demographics"
    | "growth"
    | "permits"
    | "flood"
    | "road"
    | "valuation";
  /** Kaynak başlığı, örn. "Comps · competitor_listings". */
  label: string;
  /** Bu kaynağın sağladığı sinyal, örn. "medyan $14.6K/acre · 18 ilan". */
  detail: string;
  status: SourceStatus;
}

const ICONS: Record<DataSourceItem["kind"], typeof Database> = {
  parcel: MapPin,
  comps: Building2,
  demographics: Users,
  growth: TrendingUp,
  permits: Landmark,
  flood: Waves,
  road: Route,
  valuation: Database,
};

const STATUS_META: Record<SourceStatus, { label: string; color: string; bg: string }> = {
  used: { label: "kullanıldı", color: "var(--grade-a)", bg: "rgba(15,157,88,0.12)" },
  estimated: { label: "tahmini", color: "var(--warn)", bg: "rgba(255,180,60,0.12)" },
  missing: { label: "veri yok", color: "var(--muted)", bg: "var(--surface-high)" },
};

export function DataSources({ items, note }: { items: DataSourceItem[]; note?: string }) {
  if (!items.length) return null;
  const usedCount = items.filter((i) => i.status === "used").length;
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
        <h2 className="font-bold text-sm">Veri Kaynakları</h2>
        <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
          {usedCount} canlı kaynak
        </span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>
        Bu analizin dayandığı gerçek veri kaynakları. Her sayı aşağıdaki kayıtlardan türetildi — uydurma değil.
      </p>
      <div className="space-y-2">
        {items.map((it, i) => {
          const Icon = ICONS[it.kind];
          const sm = STATUS_META[it.status];
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3"
              style={{ background: "var(--surface-low)", borderColor: "var(--surface-high)" }}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-ink)" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold">{it.label}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: sm.bg, color: sm.color }}
                  >
                    {sm.label}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {it.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <p
          className="text-[11px] mt-3 pt-3 border-t flex items-start gap-1.5"
          style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}
        >
          <Info className="w-3 h-3 shrink-0 mt-0.5" /> {note}
        </p>
      )}
    </div>
  );
}
