"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Acquisitions — tek ekran, üç sekme (`?sekme=`)
//
//   calis (VARSAYILAN) · Lead pipeline + ROI predictor (bu ekranın eski gövdesi)
//   ele                · Deal Buy-Box (eski /admin/deal-screener)
//   bolge              · County Screener (eski /admin/deal-screener)
//
// `?sekme` yokken "calis" açılır — 7 farklı ekrandan gelen `?q=` / `?src=` /
// `?state=` bağlantıları eskisi gibi çalışsın diye varsayılan değişmedi.
//
// PERFORMANS: sekme gövdeleri ayrı dosyalarda ve `next/dynamic` ile yükleniyor.
// Sadece aktif sekme mount olur → yalnızca o sekmenin uçları/sorguları çalışır.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function Yukleniyor() {
  return (
    <div className="flex items-center gap-2 p-8 text-sm" style={{ color: "var(--muted)" }}>
      <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
    </div>
  );
}

// ssr:false + dynamic → pasif sekmelerin JS'i hiç indirilmez, effect'leri hiç koşmaz.
const CalisSekmesi = dynamic(() => import("./sekme-calis"), { ssr: false, loading: Yukleniyor });
const EleSekmesi = dynamic(() => import("./sekme-ele"), { ssr: false, loading: Yukleniyor });
const BolgeSekmesi = dynamic(() => import("./sekme-bolge"), { ssr: false, loading: Yukleniyor });

const SEKMELER = [
  ["calis", "Çalış"],
  ["ele", "Ele"],
  ["bolge", "Bölge"],
] as const;
type Sekme = (typeof SEKMELER)[number][0];

function AcquisitionsIcerik() {
  const sp = useSearchParams();
  const ham = sp.get("sekme");
  const aktif: Sekme = ham === "ele" || ham === "bolge" ? ham : "calis";

  // Sekme değişirken diğer parametreler (q / src / state) korunur.
  const sekmeLinki = (s: Sekme) => {
    const p = new URLSearchParams(sp.toString());
    if (s === "calis") p.delete("sekme");
    else p.set("sekme", s);
    const qs = p.toString();
    return qs ? `/admin/acquisitions?${qs}` : "/admin/acquisitions";
  };

  return (
    <div>
      {/* Sekme çubuğu */}
      <div className="px-6 pt-6">
        <div className="inline-flex gap-1 rounded-xl border p-1" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
          {SEKMELER.map(([deger, etiket]) => {
            const secili = aktif === deger;
            return (
              <Link
                key={deger}
                href={sekmeLinki(deger)}
                aria-current={secili ? "page" : undefined}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={secili
                  ? { background: "var(--primary)", color: "#fff" }
                  : { color: "var(--muted)" }}
              >
                {etiket}
              </Link>
            );
          })}
        </div>
      </div>

      {aktif === "calis" && <CalisSekmesi />}
      {aktif === "ele" && <div className="px-8 pb-8 pt-6"><EleSekmesi /></div>}
      {aktif === "bolge" && <div className="px-8 pb-8 pt-6"><BolgeSekmesi /></div>}
    </div>
  );
}

export default function AcquisitionsPage() {
  // useSearchParams istemci tarafında okunuyor → Suspense sarmalı zorunlu.
  return (
    <Suspense fallback={<Yukleniyor />}>
      <AcquisitionsIcerik />
    </Suspense>
  );
}
