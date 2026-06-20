"use client";

// "Parseli Gör" — gerçek araziye/kayda götüren dış linkleri gösteren kart.
// buildParcelLinks() ile ELDE NE VARSA o link üretilir; veri yoksa dürüstçe
// "konum verisi yok" gösterilir (uydurma yok). Linkler yeni sekmede açılır.

import { Satellite, ExternalLink, MapPinned, Search, MapPin } from "lucide-react";
import { buildParcelLinks, type ParcelLinkInput, type ParcelLink } from "@/lib/parcel-links";

const ICONS: Record<ParcelLink["kind"], typeof Satellite> = {
  satellite: Satellite,
  source: ExternalLink,
  regrid: MapPinned,
  google_parcel: Search,
  address: MapPin,
};

export function ParcelLinks({ parcel, compact = false }: { parcel: ParcelLinkInput; compact?: boolean }) {
  const { links, hasData } = buildParcelLinks(parcel);

  if (compact) {
    // Tablo satırları için: tek satır, küçük link rozetleri.
    if (!hasData) return <span className="text-[10px]" style={{ color: "var(--muted)" }}>konum yok</span>;
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        {links.map((l) => {
          const Icon = ICONS[l.kind];
          return (
            <a
              key={l.kind}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              title={l.label}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md"
              style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}
            >
              <Icon className="w-3.5 h-3.5" />
            </a>
          );
        })}
      </span>
    );
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <h2 className="font-bold text-sm mb-1 flex items-center gap-1.5">
        <Satellite className="w-4 h-4" style={{ color: "var(--accent-ink)" }} /> Parseli Gör
      </h2>
      <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>
        Bu araziyi gerçekten gör — uydu görüntüsü, kaynak ilan/auction kaydı ve parsel sicili (Regrid).
        Yalnızca elde olan veriden link üretilir; uydurma konum yok.
      </p>
      {!hasData ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Konum verisi yok (koordinat / APN / adres / kaynak URL bu parselde boş) — link üretilemiyor.
        </p>
      ) : (
        <div className="flex items-center gap-2.5 flex-wrap">
          {links.map((l) => {
            const Icon = ICONS[l.kind];
            const primary = l.kind === "satellite";
            return (
              <a
                key={l.kind}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
                style={
                  primary
                    ? { background: "var(--accent-ink)", color: "#fff" }
                    : { background: "var(--surface-low)", border: "1px solid var(--outline)", color: "var(--foreground)" }
                }
              >
                <Icon className="w-3.5 h-3.5" /> {l.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
