"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TEK HARİTA EKRANI — KABUK
//
// Eskiden dört ayrı harita sayfası vardı; hepsi bu ekranda toplandı:
//   /admin/harita               → mod=offmarket & gorunum=vitrin (tam ekran)
//   /admin/off-market-harita    → mod=offmarket & gorunum=panel
//   /admin/deal-map             → mod=anlasma
//   /admin/alinabilir-harita    → mod=alinabilir
// Eski üç yol SİLİNMEDİ; redirect() ile doğru mod önceden seçili olarak buraya
// bağlanır (AGENTS.md: "route'lar asla silinmez").
//
// PERFORMANS KURALI: her mod ayrı bir `dynamic(..., { ssr:false })` parçadır ve
// YALNIZCA aktifken mount edilir. Pasif modun Leaflet/MapLibre paketi, katmanı
// ve fetch'i hiç yüklenmez.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import ModSecici, { type HaritaMod, type HaritaGorunum } from "./mod-secici";

const Yukleniyor = () => (
  <div className="flex items-center justify-center gap-2 py-24 text-sm" style={{ color: "var(--muted)" }}>
    <Loader2 className="h-4 w-4 animate-spin" /> Harita hazırlanıyor…
  </div>
);

// Tam ekran off-market vitrini kendi koyu üst barını taşıdığı için ayrı parça.
const ModOffmarketVitrin = dynamic(() => import("./mod-offmarket-vitrin"), { ssr: false, loading: Yukleniyor });
const ModOffmarketPanel = dynamic(() => import("./mod-offmarket-panel"), { ssr: false, loading: Yukleniyor });
const ModAnlasma = dynamic(() => import("./mod-anlasma"), { ssr: false, loading: Yukleniyor });
const ModAlinabilir = dynamic(() => import("./mod-alinabilir"), { ssr: false, loading: Yukleniyor });

const MODLAR: HaritaMod[] = ["offmarket", "anlasma", "alinabilir"];

function modOku(v: string | null): HaritaMod {
  return MODLAR.includes(v as HaritaMod) ? (v as HaritaMod) : "offmarket";
}

function gorunumOku(v: string | null, mod: HaritaMod): HaritaGorunum {
  if (v === "panel" || v === "vitrin") return v;
  // Varsayılan: off-market eskiden tam ekran vitrindi, diğer ikisi panel içiydi.
  return mod === "offmarket" ? "vitrin" : "panel";
}

function KabukIcerik() {
  const sp = useSearchParams();
  const mod = modOku(sp.get("mod"));
  const gorunum = gorunumOku(sp.get("gorunum"), mod);

  // Off-market vitrini: kendi tam ekran overlay'i + koyu üst barı var,
  // mod/görünüm seçici o barın içine gömülü. Ekstra sarmalayıcı gerekmez.
  if (mod === "offmarket" && gorunum === "vitrin") return <ModOffmarketVitrin />;

  const tamEkran = gorunum === "vitrin";

  return (
    <div
      className={tamEkran ? "fixed inset-0 z-[80] overflow-auto p-6" : "p-6"}
      style={tamEkran ? { background: "var(--surface)" } : undefined}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ModSecici mod={mod} gorunum={gorunum} tema="acik" />
      </div>
      {mod === "offmarket" && <ModOffmarketPanel />}
      {mod === "anlasma" && <ModAnlasma />}
      {mod === "alinabilir" && <ModAlinabilir />}
    </div>
  );
}

export default function HaritaKabuk() {
  // useSearchParams istemci tarafında çözülür → Suspense sınırı zorunlu.
  return (
    <Suspense fallback={<Yukleniyor />}>
      <KabukIcerik />
    </Suspense>
  );
}
