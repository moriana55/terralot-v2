"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOD / GÖRÜNÜM SEÇİCİ — tek harita ekranının üst çubuğu.
//
// Dört ayrı harita sayfası (harita · off-market-harita · deal-map ·
// alinabilir-harita) tek `/admin/harita` ekranında toplandı. Hangi işin
// yapılacağını `?mod=`, ekranın panel içinde mi tam ekran mı duracağını
// `?gorunum=` belirler. Bu bileşen sadece o iki sorgu parametresini değiştirir.
//
//   mod=offmarket  → off-market envanteri (vitrin: tek eyalet + uçuş,
//                    panel: çoklu eyalet + istatistik şeridi)
//   mod=anlasma    → vergi-borçlu deal + yaklaşan ihale + megaproje
//   mod=alinabilir → comp'lu alınabilir parseller (2D/3D)
//
// İki tema var: koyu (tam ekran vitrin barının içinde) ve açık (panel başlığı).
// Native <select> KULLANILMAZ — çip butonlar + Link ile URL değişir.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";

/** Tek harita ekranının modları. */
export type HaritaMod = "offmarket" | "anlasma" | "alinabilir";
/** Ekranın nerede durduğu: panel içinde mi, sidebar'ı örten tam ekran mı. */
export type HaritaGorunum = "panel" | "vitrin";

export const HARITA_MODLARI: { id: HaritaMod; etiket: string; ipucu: string }[] = [
  {
    id: "offmarket",
    etiket: "Off-Market",
    ipucu: "Hedef eyaletlerdeki tüm off-market envanteri (gerçek koordinat, sunucu cluster)",
  },
  {
    id: "anlasma",
    etiket: "Anlaşma",
    ipucu: "Vergi-borçlu parseller · 📅 yaklaşan ihaleler · 🏭 megaproje katalizörleri",
  },
  {
    id: "alinabilir",
    etiket: "Alınabilir",
    ipucu: "Comp'lu, spread ≥ $1.500 alınabilir parseller — 2D/3D arazi görünümü",
  },
];

/** URL'yi tek yerden kur, böylece mod ↔ görünüm kombinasyonu hep tutarlı olur. */
export function haritaHref(mod: HaritaMod, gorunum: HaritaGorunum) {
  return `/admin/harita?mod=${mod}&gorunum=${gorunum}`;
}

export default function ModSecici({
  mod,
  gorunum,
  tema = "acik",
}: {
  mod: HaritaMod;
  gorunum: HaritaGorunum;
  tema?: "acik" | "koyu";
}) {
  const koyu = tema === "koyu";

  const cerceve = koyu
    ? { borderColor: "rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)" }
    : { borderColor: "var(--border)", background: "var(--surface)" };

  const cipStili = (aktif: boolean) =>
    koyu
      ? { background: aktif ? "#8ed1df" : "transparent", color: aktif ? "#0b1220" : "#9fb0c8" }
      : { background: aktif ? "#0f172a" : "transparent", color: aktif ? "#ffffff" : "var(--muted)" };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* Mod çipleri */}
      <div className="flex shrink-0 items-center rounded-full border p-0.5" style={cerceve}>
        {HARITA_MODLARI.map((m) => (
          <Link
            key={m.id}
            href={haritaHref(m.id, gorunum)}
            title={m.ipucu}
            aria-current={mod === m.id ? "page" : undefined}
            className="rounded-full px-3 py-1 text-[11px] font-bold transition-all"
            style={cipStili(mod === m.id)}
          >
            {m.etiket}
          </Link>
        ))}
      </div>

      {/* Görünüm anahtarı — panel içi analitik ↔ sidebar'ı örten tam ekran vitrin */}
      <div className="flex shrink-0 items-center rounded-full border p-0.5" style={cerceve}>
        {([
          ["panel", "Panel"],
          ["vitrin", "Tam ekran"],
        ] as const).map(([g, etiket]) => (
          <Link
            key={g}
            href={haritaHref(mod, g)}
            title={
              g === "vitrin"
                ? "Tam ekran vitrin — sidebar'ı örter, müşteri/yatırımcı sunumu için"
                : "Panel içi analitik görünüm — istatistik şeridi ve açıklamalarla"
            }
            aria-current={gorunum === g ? "page" : undefined}
            className="rounded-full px-3 py-1 text-[11px] font-bold transition-all"
            style={cipStili(gorunum === g)}
          >
            {etiket}
          </Link>
        ))}
      </div>
    </div>
  );
}
