"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Vergi-Borçlu Lead'ler — tek sayfa, iki sekme:
//  1) Motive Sahipler — DÜRÜST, mektup-atılabilir filtrelenmiş liste (varsayılan)
//  2) DD Tablosu — eski "Tax Leads" sayfası: ham kayıtlar + sel/yol DD kontrolü
// İkisi de aynı `tax_delinquent_properties` tablosunu farklı amaçlarla kullanıyordu,
// bu yüzden sidebar'da iki ayrı giriş yerine tek sayfada sekme olarak birleştirildi.
// (2026-07-13: /admin/tax-leads → buraya redirect edildi.)
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MailPlus, FileSearch } from "lucide-react";
import MotiveSahipler from "./motive-sahipler";
import DDTablosu from "./dd-tablosu";

type TabKey = "motive" | "dd";

const TABS: { key: TabKey; label: string; icon: typeof MailPlus }[] = [
  { key: "motive", label: "Motive Sahipler", icon: MailPlus },
  { key: "dd", label: "DD Tablosu", icon: FileSearch },
];

function OffMarketLeadsInner() {
  const searchParams = useSearchParams();
  const initialTab: TabKey = searchParams.get("tab") === "dd" ? "dd" : "motive";
  const [tab, setTab] = useState<TabKey>(initialTab);

  return (
    <div className="p-8">
      {/* Sekmeler */}
      <div className="flex items-center gap-1 mb-6 border-b" style={{ borderColor: "var(--outline)" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors relative -mb-px"
              style={{
                color: active ? "var(--primary)" : "var(--muted)",
                borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
              }}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "motive" ? <MotiveSahipler /> : <DDTablosu />}
    </div>
  );
}

export default function OffMarketLeadsPage() {
  return (
    <Suspense fallback={null}>
      <OffMarketLeadsInner />
    </Suspense>
  );
}
