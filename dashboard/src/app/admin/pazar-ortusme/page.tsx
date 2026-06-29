"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Swords,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  ShieldCheck,
  Building2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// PAZAR-ÖRTÜŞME — "Rakip burada SATIYOR + bizde envanter var = KANITLI PAZAR".
//
// Bölge bazında rakip retail ilanları (competitor_listings) ile bizim off-market
// envanterimizi (offmarket_leads + tax_delinquent_properties) yan yana koyar.
// Salt-okunur — /api/admin/market-overlap (service role + guard) toplulaştırır.
// Hiçbir değerleme/fiyat mantığına dokunmaz. Landio aykırı fiyatları sane-band
// dışında tutulur (medyana katılmaz, "⚠ doğrulanmamış" sayılır).
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US");

interface Region {
  key: string;
  label: string;
  state: string;
  county: string;
  comp: {
    count: number;
    byCompetitor: Record<string, number>;
    medianPpa: number | null;
    priceMin: number | null;
    priceMax: number | null;
    flagged: number;
    samples: { competitor: string; url: string; price: number | null; acres: number | null; title: string }[];
    scrapedAt: string | null;
  };
  ours: { offmarket: number; tax: number; total: number; avgOffer: number | null; medianPpa: number | null };
  spreadPerAcre: number | null;
  badge: "proven" | "comp-only" | "inv-only" | "empty";
}
interface Resp {
  regions: Region[];
  other: { comp: number; offmarket: number; tax: number };
  scrapedAt: string | null;
  band: { ppaMin: number; ppaMax: number };
  notes: string[];
}

const BADGE: Record<string, { label: string; color: string; bg: string }> = {
  proven: { label: "✅ KANITLI PAZAR", color: "var(--grade-a)", bg: "rgba(34,197,94,0.12)" },
  "comp-only": { label: "Rakip satıyor · envanter yok", color: "var(--grade-c)", bg: "rgba(185,119,10,0.12)" },
  "inv-only": { label: "Envanterimiz var · rakip kanıtı yok", color: "var(--accent-ink)", bg: "rgba(14,125,151,0.12)" },
  empty: { label: "—", color: "var(--muted)", bg: "var(--surface-high)" },
};

const COMP_COLOR: Record<string, string> = {
  "Rina Land": "var(--grade-c)",
  Rina: "var(--grade-c)",
  "Discount Lots": "var(--accent-ink)",
  Landio: "var(--grade-b)",
};

function fmtDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
}

export default function PazarOrtusmePage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/market-overlap");
      if (!r.ok) {
        setError(`Sunucu ${r.status} döndü (oturum/gate olabilir).`);
        setLoading(false);
        return;
      }
      const j = (await r.json()) as Resp;
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    }
    setLoading(false);
  }

  const regions = data?.regions ?? [];
  const proven = regions.filter((r) => r.badge === "proven");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Swords className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Rakip vs Bizim Envanter — Pazar Örtüşme
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Rakip BU bölgelerde retail satıyor (pazar gerçek) + bizde aynı bölgede envanter var (alabiliriz). Salt-okunur kanıt.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>

      {/* Dürüstlük notu */}
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-5"
        style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
      >
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--grade-a)" }} />
        <span>
          <strong style={{ color: "var(--foreground)" }}>&quot;✅ KANITLI PAZAR&quot; = rakip orada SATIYOR + bizde envanter var.</strong>{" "}
          Medyan $/acre, ham arsa için makul banda ({data ? `$${fmtNum(data.band.ppaMin)}–$${fmtNum(data.band.ppaMax)}/acre` : "—"}) sığan ilanlardan hesaplanır.
          Landio gibi aykırı fiyatlar (ör. $750k/5acre = scraping hatası) medyana KATILMAZ; &quot;⚠ N doğrulanmamış&quot; olarak gösterilir.
          {data?.scrapedAt ? ` Rakip verisi çekim tarihi: ${fmtDate(data.scrapedAt)}.` : ""}
        </span>
      </div>

      {data?.notes && data.notes.length > 0 && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-5"
          style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{data.notes.join(" · ")}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Pazar örtüşmesi hesaplanıyor…
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}
        >
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Özet */}
          <div className="flex items-center gap-3 mb-6 flex-wrap text-sm">
            <Stat label="Kanıtlı pazar (bölge)" value={String(proven.length)} accent />
            <Stat label="Gösterilen bölge" value={String(regions.length)} />
            {data && (
              <Stat
                label="Eşleşmeyen (Diğer)"
                value={`rakip ${fmtNum(data.other.comp)} · env ${fmtNum(data.other.offmarket + data.other.tax)}`}
              />
            )}
          </div>

          {regions.length === 0 ? (
            <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
              <p className="text-sm font-medium mb-1">Gösterilecek bölge yok</p>
              <p className="text-xs">competitor_listings ve offmarket_leads dolduğunda örtüşen pazarlar burada belirir.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {regions.map((r) => {
                const badge = BADGE[r.badge];
                const competitors = Object.entries(r.comp.byCompetitor).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={r.key} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                    {/* Bölge başlığı */}
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-b flex-wrap" style={{ borderColor: "var(--outline)" }}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" style={{ color: "var(--muted)" }} />
                        <span className="font-bold text-base">{r.label}</span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>{r.county}, {r.state}</span>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {r.badge === "proven" && <CheckCircle2 className="w-3 h-3" />}
                        {badge.label}
                      </span>
                    </div>

                    {/* İçerik: rakip | envanter | spread */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: "var(--outline)" }}>
                      {/* Rakip satışı */}
                      <div className="p-5">
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                          Rakip Satıyor
                        </div>
                        <div className="text-2xl font-extrabold mb-1" style={{ color: "var(--foreground)" }}>
                          {fmtNum(r.comp.count)} <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>retail ilan</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {competitors.map(([name, n]) => (
                            <span key={name} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: COMP_COLOR[name] || "var(--foreground)" }}>
                              {name} {n}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs space-y-0.5" style={{ color: "var(--muted)" }}>
                          <div>Medyan: <strong style={{ color: "var(--accent-ink)" }}>{r.comp.medianPpa != null ? `${fmtMoney(r.comp.medianPpa)}/acre` : "comp gerekli"}</strong></div>
                          {r.comp.priceMin != null && (
                            <div>Fiyat aralığı: {fmtMoney(r.comp.priceMin)} – {fmtMoney(r.comp.priceMax)}</div>
                          )}
                          {r.comp.flagged > 0 && (
                            <div style={{ color: "var(--grade-c)" }}>⚠ {fmtNum(r.comp.flagged)} aykırı (doğrulanmamış, medyan dışı)</div>
                          )}
                        </div>
                        {/* Kanıt linkleri */}
                        {r.comp.samples.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {r.comp.samples.map((s, i) => (
                              <a
                                key={i}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold"
                                style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                                title={`${s.competitor}: ${s.title} (${s.acres ?? "?"} ac · ${fmtMoney(s.price)})`}
                              >
                                <ExternalLink className="w-3 h-3" /> {s.competitor} kanıt
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bizim envanter */}
                      <div className="p-5">
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                          Bizim Envanter
                        </div>
                        <div className="text-2xl font-extrabold mb-1" style={{ color: r.ours.total > 0 ? "var(--grade-a)" : "var(--muted)" }}>
                          {fmtNum(r.ours.total)} <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>alınabilir lead</span>
                        </div>
                        <div className="text-xs space-y-0.5" style={{ color: "var(--muted)" }}>
                          <div>Off-market: <strong style={{ color: "var(--foreground)" }}>{fmtNum(r.ours.offmarket)}</strong> · Tax: <strong style={{ color: "var(--foreground)" }}>{fmtNum(r.ours.tax)}</strong></div>
                          <div>Ort. alış maliyeti: <strong style={{ color: "var(--foreground)" }}>{fmtMoney(r.ours.avgOffer)}</strong></div>
                          <div>Bizim medyan: {r.ours.medianPpa != null ? `${fmtMoney(r.ours.medianPpa)}/acre` : "—"}</div>
                        </div>
                      </div>

                      {/* Spread */}
                      <div className="p-5">
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                          Spread (rakip − biz, $/acre)
                        </div>
                        {r.spreadPerAcre != null ? (
                          <>
                            <div className="flex items-center gap-1.5 text-2xl font-extrabold mb-1" style={{ color: r.spreadPerAcre > 0 ? "var(--grade-a)" : "var(--grade-c)" }}>
                              <TrendingUp className="w-5 h-5" />
                              {r.spreadPerAcre > 0 ? "+" : ""}{fmtMoney(r.spreadPerAcre)}
                              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>/acre</span>
                            </div>
                            <p className="text-xs" style={{ color: "var(--muted)" }}>
                              Rakip retail {fmtMoney(r.comp.medianPpa)}/acre vs bizim alış {fmtMoney(r.ours.medianPpa)}/acre.
                              Kaba gösterge — gerçek marj parsel DD&apos;sinde netleşir.
                            </p>
                          </>
                        ) : (
                          <div className="text-sm" style={{ color: "var(--muted)" }}>
                            Spread için hem rakip hem bizim $/acre medyanı gerekli — şu an eksik.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-3.5 py-2 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
      <span className="text-lg font-bold tabular-nums" style={{ color: accent ? "var(--accent-ink)" : "var(--foreground)" }}>
        {value}
      </span>{" "}
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}
