"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP İLANLARI KATMANI — ortak react-leaflet katmanı (ana harita + off-market
// harita). AZ dönemi görsel dili: bizim lead'ler eyalet renkli daire, rakipler
// KIRMIZI ELMAS. Koordinatlar competitor-scraper-v2.mjs ile ilan
// sayfalarından/API'lerinden birebir alınır — yaklaşık konum/jitter YOK.
// Katman mount olduğunda /api/admin/competitor-map-points'ten bir kez yükler;
// toggle kapalıyken component hiç mount edilmediği için fetch de olmaz.
// ─────────────────────────────────────────────────────────────────────────────

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";

export const COMP_COLOR = "#dc2626";

export type CompetitorPoint = {
  id: string; competitor: string; title: string | null; state: string | null; county: string | null;
  acres: number | null; price: number | null; monthly_payment: number | null; raw_url: string | null;
  lat: number; lng: number;
};

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

const US_STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Florida: "FL", Georgia: "GA", Illinois: "IL", Kentucky: "KY", Louisiana: "LA",
  Michigan: "MI", Missouri: "MO", Montana: "MT", Nevada: "NV", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", Oregon: "OR", "South Carolina": "SC",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Washington: "WA", Wyoming: "WY",
};
export const stAbbr = (s: string | null) => (s ? US_STATE_ABBR[s] ?? s : null);

function compIcon(large: boolean) {
  const s = large ? 11 : 10;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${s}px;height:${s}px;transform:rotate(45deg);
      background:${COMP_COLOR};
      border:1.5px solid rgba(255,255,255,0.95);
      box-shadow:0 0 0 3px rgba(220,38,38,0.25), 0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [s + 4, s + 4],
    iconAnchor: [(s + 4) / 2, (s + 4) / 2],
  });
}

function CompetitorPopup({ p, dark }: { p: CompetitorPoint; dark: boolean }) {
  const ppa = p.price != null && p.acres ? Math.round(p.price / p.acres) : null;
  const fg = dark ? "#e7edf7" : "#0f172a";
  const mut = dark ? "#8b9ab3" : "#64748b";
  const red = dark ? "#fca5a5" : "#b91c1c";
  const R = ({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <span style={{ color: mut }}>{k}</span>
      <span style={{ fontWeight: strong ? 700 : 600, color: accent ? red : fg, textAlign: "right" }}>{v}</span>
    </div>
  );
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.55, minWidth: 216, color: fg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ width: 9, height: 9, transform: "rotate(45deg)", background: COMP_COLOR, boxShadow: `0 0 8px ${COMP_COLOR}`, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, letterSpacing: "0.02em", color: red }}>RAKİP · {p.competitor}</span>
      </div>
      {p.title && <div style={{ fontWeight: 600, marginBottom: 5 }}>{p.title}</div>}
      <R k="Konum" v={[p.county, stAbbr(p.state)].filter(Boolean).join(", ") || "—"} />
      <R k="Büyüklük" v={p.acres != null ? `${p.acres} acre` : "—"} />
      <R k="Fiyat" v={usd(p.price)} accent strong />
      {ppa != null && <R k="$ / acre" v={usd(ppa)} />}
      {p.monthly_payment != null && <R k="Aylık taksit" v={usd(p.monthly_payment)} />}
      {p.raw_url && (
        <a
          href={p.raw_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: 7, fontSize: 11.5, fontWeight: 700, color: red, textDecoration: "underline" }}
        >
          İlana git ↗
        </a>
      )}
    </div>
  );
}

export default function CompetitorLayer({
  large = false,
  dark = false,
  stateFilter = null,
  onMeta,
}: {
  /** Uydu/koyu zeminde biraz daha büyük elmas. */
  large?: boolean;
  /** Popup teması (ana harita koyu, off-market harita açık). */
  dark?: boolean;
  /** 2 harfli eyalet filtresi (örn. "AZ") — null ise hepsi. */
  stateFilter?: string | null;
  onMeta?: (m: { total: number; byCompetitor: Record<string, number> }) => void;
}) {
  const [points, setPoints] = useState<CompetitorPoint[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/competitor-map-points")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => {
        if (!alive) return;
        setPoints(Array.isArray(d.points) ? d.points : []);
        if (d.meta && onMeta) onMeta(d.meta);
      })
      .catch(() => { if (alive) setPoints([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const icon = useMemo(() => compIcon(large), [large]);
  if (!points) return null;
  const visible = stateFilter ? points.filter((p) => stAbbr(p.state) === stateFilter) : points;
  return (
    <>
      {visible.map((p) => (
        <Marker key={`comp-${p.id}`} position={[p.lat, p.lng]} icon={icon} zIndexOffset={500}>
          <Popup>
            <CompetitorPopup p={p} dark={dark} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}
