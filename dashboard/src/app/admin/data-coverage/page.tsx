"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Database,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DATA COVERAGE / KALİTE PANELİ — salt-okunur ops görünümü.
//
// offmarket_leads + tax_delinquent_properties (+ competitor_listings) üzerinden:
//   • kaynak/eyalet/county bazlı satır sayısı
//   • % mailable (sahip adı + adres var)
//   • % absentee (posta eyaleti ≠ parsel eyaleti)
//   • % skip-traced (kolon varsa)
//   • ortalama marj / skor
//   • kaynak başına son yenileme
//   • COUNTY-HITLIST hedef county kapsama (var/yok)
//
// KURALLAR: hiçbir değerleme/fiyat mantığına dokunmaz. Eksik tablo/kolonda
// çökmez — o parçayı "?" / "—" yapar (isMissingTable deseni).
// ─────────────────────────────────────────────────────────────────────────────

// COUNTY-HITLIST.md (scraper/) hedef county'leri — statik referans listesi.
const HITLIST: { county: string; state: string; tier: 1 | 2 | 3 }[] = [
  { county: "Costilla", state: "CO", tier: 1 },
  { county: "Pueblo", state: "CO", tier: 1 },
  { county: "Apache", state: "AZ", tier: 1 },
  { county: "Navajo", state: "AZ", tier: 1 },
  { county: "Mohave", state: "AZ", tier: 1 },
  { county: "Luna", state: "NM", tier: 1 },
  { county: "Cochise", state: "AZ", tier: 2 },
  { county: "Valencia", state: "NM", tier: 2 },
  { county: "Torrance", state: "NM", tier: 2 },
  { county: "Cibola", state: "NM", tier: 2 },
  { county: "Hudspeth", state: "TX", tier: 2 },
  { county: "Conejos", state: "CO", tier: 2 },
  { county: "Saguache", state: "CO", tier: 2 },
  { county: "Park", state: "CO", tier: 2 },
  { county: "Klamath", state: "OR", tier: 2 },
  { county: "Lake", state: "CA", tier: 2 },
  { county: "Polk", state: "FL", tier: 3 },
  { county: "Charlotte", state: "FL", tier: 3 },
  { county: "Lee", state: "FL", tier: 3 },
  { county: "Marion", state: "FL", tier: 3 },
  { county: "Citrus", state: "FL", tier: 3 },
  { county: "Putnam", state: "FL", tier: 3 },
  { county: "Highlands", state: "FL", tier: 3 },
  { county: "Sarasota", state: "FL", tier: 3 },
];

const GENERIC = /absentee|owner|unknown|n\/a|test/i;

interface Rec {
  source: string;
  state: string;
  county: string;
  mailable: boolean;
  absentee: boolean | null; // null = belirlenemiyor
  skiptraced: boolean | null;
  margin: number | null;
  score: number | null;
  ts: string | null;
}

function isMissing(msg: string | undefined): boolean {
  return /schema cache|does not exist|could not find|relation|column/i.test(msg ?? "");
}

function mailStateFrom(addr: string): string | null {
  const m = addr.toUpperCase().match(/,\s*([A-Z]{2})\s*,?\s*\d{5}/);
  return m ? m[1] : null;
}

function ownerOk(name: string | null): boolean {
  const n = (name || "").replace(/\s+/g, " ").trim();
  return n.length >= 4 && !GENERIC.test(n);
}

function fmtAge(maxTs: string | null): string {
  if (!maxTs) return "—";
  const ms = Date.now() - new Date(maxTs).getTime();
  if (Number.isNaN(ms)) return "?";
  const d = ms / 86400000;
  if (d < 1) return `${Math.max(0, Math.round(ms / 3600000))}sa önce`;
  return `${d.toFixed(1)}g önce`;
}

// Paginated salt-okuma fetch. Hata → { rows: [], missing }.
async function fetchAll<T>(
  table: string,
  columns: string
): Promise<{ rows: T[]; missing: boolean; error?: string }> {
  const all: T[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) return { rows: all, missing: isMissing(error.message), error: error.message };
    all.push(...((data as T[]) ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
    if (from > 60000) break; // güvenlik tavanı
  }
  return { rows: all, missing: false };
}

interface SrcAgg {
  source: string;
  count: number;
  mailable: number;
  absentee: number;
  absenteeKnown: number;
  skiptraced: number;
  skipKnown: number;
  marginSum: number;
  marginN: number;
  scoreSum: number;
  scoreN: number;
  maxTs: string | null;
}

export default function CoveragePage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const out: Rec[] = [];
    const warn: string[] = [];

    // 1) offmarket_leads — skip-trace kolonlu dene, yoksa düş.
    let off = await fetchAll<Record<string, unknown>>(
      "offmarket_leads",
      "state,county,region,owner,mailing_address,mailing_state,absentee,skiptraced,est_margin,updated_at,source"
    );
    let skipAvailable = true;
    if (off.error && /skiptraced/i.test(off.error)) {
      skipAvailable = false;
      off = await fetchAll<Record<string, unknown>>(
        "offmarket_leads",
        "state,county,region,owner,mailing_address,mailing_state,absentee,est_margin,updated_at,source"
      );
    }
    if (off.missing) warn.push("offmarket_leads tablosu yok — atlandı.");
    else {
      for (const r of off.rows) {
        const state = String(r.state || "").toUpperCase();
        const county = String(r.county || r.region || "");
        const mailable = ownerOk(r.owner as string | null) && !!r.mailing_address;
        out.push({
          source: String(r.source || "offmarket"),
          state,
          county,
          mailable,
          absentee: r.absentee == null ? null : !!r.absentee,
          skiptraced: skipAvailable ? !!r.skiptraced : null,
          margin: r.est_margin == null ? null : Number(r.est_margin),
          score: null,
          ts: (r.updated_at as string) ?? null,
        });
      }
    }

    // 2) tax_delinquent_properties
    const tax = await fetchAll<Record<string, unknown>>(
      "tax_delinquent_properties",
      "state,county,source,owner_name,owner_address,final_score,scraped_at"
    );
    if (tax.missing) warn.push("tax_delinquent_properties tablosu yok — atlandı.");
    else {
      for (const r of tax.rows) {
        const state = String(r.state || "").toUpperCase();
        const addr = String(r.owner_address || "");
        const mailable = ownerOk(r.owner_name as string | null) && !!addr;
        const ms = addr ? mailStateFrom(addr) : null;
        const absentee = ms && state ? ms !== state : null;
        out.push({
          source: String(r.source || "tax"),
          state,
          county: String(r.county || ""),
          mailable,
          absentee,
          skiptraced: null,
          margin: null,
          score: r.final_score == null ? null : Number(r.final_score),
          ts: (r.scraped_at as string) ?? null,
        });
      }
    }

    // 3) competitor_listings — kapsama (county var/yok) için sayılır.
    const comp = await fetchAll<Record<string, unknown>>(
      "competitor_listings",
      "state,county,competitor,scraped_at"
    );
    if (comp.missing) warn.push("competitor_listings tablosu yok — atlandı.");
    else {
      for (const r of comp.rows) {
        out.push({
          source: `competitor:${String(r.competitor || "?")}`,
          state: String(r.state || "").toUpperCase(),
          county: String(r.county || ""),
          mailable: false,
          absentee: null,
          skiptraced: null,
          margin: null,
          score: null,
          ts: (r.scraped_at as string) ?? null,
        });
      }
    }

    if (out.length === 0 && warn.length === 3) {
      setError("Hiçbir veri tablosu bulunamadı (offmarket_leads / tax_delinquent_properties / competitor_listings).");
    }
    setRecs(out);
    setNotes(warn);
    setLoading(false);
  }

  // ── Kaynak bazlı toplulaştırma ──────────────────────────────────────────────
  const bySource = useMemo<SrcAgg[]>(() => {
    const m = new Map<string, SrcAgg>();
    for (const r of recs) {
      let a = m.get(r.source);
      if (!a) {
        a = {
          source: r.source,
          count: 0,
          mailable: 0,
          absentee: 0,
          absenteeKnown: 0,
          skiptraced: 0,
          skipKnown: 0,
          marginSum: 0,
          marginN: 0,
          scoreSum: 0,
          scoreN: 0,
          maxTs: null,
        };
        m.set(r.source, a);
      }
      a.count++;
      if (r.mailable) a.mailable++;
      if (r.absentee != null) {
        a.absenteeKnown++;
        if (r.absentee) a.absentee++;
      }
      if (r.skiptraced != null) {
        a.skipKnown++;
        if (r.skiptraced) a.skiptraced++;
      }
      if (r.margin != null && !Number.isNaN(r.margin)) {
        a.marginSum += r.margin;
        a.marginN++;
      }
      if (r.score != null && !Number.isNaN(r.score)) {
        a.scoreSum += r.score;
        a.scoreN++;
      }
      if (r.ts && (!a.maxTs || r.ts > a.maxTs)) a.maxTs = r.ts;
    }
    return [...m.values()].sort((x, y) => y.count - x.count);
  }, [recs]);

  // ── Eyalet bazlı ────────────────────────────────────────────────────────────
  const byState = useMemo(() => {
    const m = new Map<string, { state: string; count: number; mailable: number; absentee: number; absenteeKnown: number }>();
    for (const r of recs) {
      const s = r.state || "?";
      let a = m.get(s);
      if (!a) {
        a = { state: s, count: 0, mailable: 0, absentee: 0, absenteeKnown: 0 };
        m.set(s, a);
      }
      a.count++;
      if (r.mailable) a.mailable++;
      if (r.absentee != null) {
        a.absenteeKnown++;
        if (r.absentee) a.absentee++;
      }
    }
    return [...m.values()].sort((x, y) => y.count - x.count);
  }, [recs]);

  // ── County kapsama (hitlist var/yok) ────────────────────────────────────────
  const coverage = useMemo(() => {
    return HITLIST.map((h) => {
      // county adı DB'de "Costilla" / "costilla county" gibi değişebilir → includes.
      const key = h.county.toLowerCase();
      let count = 0;
      for (const r of recs) {
        if (
          r.state === h.state &&
          r.county &&
          r.county.toLowerCase().includes(key)
        )
          count++;
      }
      return { ...h, have: count > 0, count };
    });
  }, [recs]);

  const totals = useMemo(() => {
    const count = recs.length;
    const mailable = recs.filter((r) => r.mailable).length;
    const absK = recs.filter((r) => r.absentee != null);
    const absentee = absK.filter((r) => r.absentee).length;
    const haveCounties = coverage.filter((c) => c.have).length;
    return {
      count,
      mailablePct: count ? Math.round((mailable / count) * 100) : 0,
      absenteePct: absK.length ? Math.round((absentee / absK.length) * 100) : 0,
      states: new Set(recs.map((r) => r.state).filter(Boolean)).size,
      sources: bySource.length,
      haveCounties,
      totalCounties: HITLIST.length,
    };
  }, [recs, coverage, bySource]);

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Database className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Veri Kapsama & Kalite
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Kaynak / eyalet / county bazlı satır, mailable %, absentee %, skip-trace %, ortalama marj/skor ve son yenileme. Salt-okunur.
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

      {notes.length > 0 && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-5"
          style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{notes.join(" · ")}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Kapsama hesaplanıyor…
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
            <Stat label="Toplam kayıt" value={totals.count.toLocaleString("en-US")} accent />
            <Stat label="Mailable" value={`${totals.mailablePct}%`} />
            <Stat label="Absentee" value={`${totals.absenteePct}%`} />
            <Stat label="Eyalet" value={String(totals.states)} />
            <Stat label="Kaynak" value={String(totals.sources)} />
            <Stat label="Hitlist county" value={`${totals.haveCounties}/${totals.totalCounties}`} />
          </div>

          {/* Kaynak bazlı tablo */}
          <Section title="Kaynak Bazlı">
            <Table
              head={["Kaynak", "Satır", "Mailable", "Absentee", "Skip-trace", "Ort. Marj", "Ort. Skor", "Son Yenileme"]}
            >
              {bySource.map((a) => (
                <tr key={a.source} className="border-b" style={{ borderColor: "var(--outline)" }}>
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{a.source}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.count.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 tabular-nums">{pct(a.mailable, a.count)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.absenteeKnown ? pct(a.absentee, a.absenteeKnown) : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.skipKnown ? pct(a.skiptraced, a.skipKnown) : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.marginN ? `$${Math.round(a.marginSum / a.marginN).toLocaleString("en-US")}` : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.scoreN ? (a.scoreSum / a.scoreN).toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>{fmtAge(a.maxTs)}</td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* Eyalet bazlı tablo */}
          <Section title="Eyalet Bazlı">
            <Table head={["Eyalet", "Satır", "Mailable", "Absentee"]}>
              {byState.map((a) => (
                <tr key={a.state} className="border-b" style={{ borderColor: "var(--outline)" }}>
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{a.state}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.count.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 tabular-nums">{pct(a.mailable, a.count)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.absenteeKnown ? pct(a.absentee, a.absenteeKnown) : "—"}</td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* County hitlist kapsama */}
          <Section title={`Hedef County Kapsaması (COUNTY-HITLIST) — ${totals.haveCounties}/${totals.totalCounties} var`}>
            <Table head={["County", "Eyalet", "Tier", "Durum", "Satır"]}>
              {coverage.map((c) => (
                <tr key={`${c.state}-${c.county}`} className="border-b" style={{ borderColor: "var(--outline)" }}>
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} /> {c.county}
                  </td>
                  <td className="px-4 py-2.5">{c.state}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>T{c.tier}</td>
                  <td className="px-4 py-2.5">
                    {c.have ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "var(--grade-a)" }}>
                        <CheckCircle2 className="w-3 h-3" /> Var
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                        <XCircle className="w-3 h-3" /> Yok
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{c.count ? c.count.toLocaleString("en-US") : "—"}</td>
                </tr>
              ))}
            </Table>
          </Section>
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
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--muted)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            {head.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
