"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Swords,
  Flame,
  TrendingDown,
  ExternalLink,
  ShieldCheck,
  Target,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP İSTİHBARATI — patronun iki sorusu tek ekranda:
//   1) "Rakiplerimiz EN SON ne sattı/ne yaptı?" → kaybolan ilanlar = MUHTEMEL SATIŞ
//   2) "Rakiplerin olduğu ARSA bölgelerine yoğunlaşalım" → county/state rakip
//      yoğunluğu + o bölgede BİZİM lead sayımız → sourcing önceliği.
// Salt-okunur. Veri: /api/admin/rakip-istihbarat (service role + gate).
// DÜRÜSTLÜK: "satıldı" kesin değil → "muhtemel satış" (ilan snapshot'tan kayboldu).
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US");
const fmtDate = (ts: string | null | undefined) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
};
const relDays = (ts: string | null | undefined): number | null => {
  if (!ts) return null;
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.round((Date.now() - d) / 86_400_000));
};

interface Sale {
  competitor: string | null;
  title: string | null;
  state: string | null;
  stateAbbr: string | null;
  county: string | null;
  acres: number | null;
  price: number | null;
  disappearedAt: string | null;
  domDays: number | null;
  url: string | null;
  verified: boolean;
}
interface CompSum {
  competitor: string;
  active: number;
  suspectedSold: number;
  verifiedSold: number;
}
interface HotRegion {
  state: string;
  county: string;
  countyNorm: string;
  active: number;
  sold: number;
  heat: number;
  topCompetitor: string | null;
  medianPrice: number | null;
  medianPpa: number | null;
  ourLeadsCounty: number;
  ourLeadsState: number;
  priority: "ONCELIK" | "IZLE" | "FIRSAT" | "RAKIP_ALANI" | string;
}
interface Payload {
  generatedAt: string;
  totals: {
    activeListings: number;
    suspectedSold: number;
    verifiedSold: number;
    lastScrapeAt: string | null;
  };
  competitorSummary: CompSum[];
  recentSales: Sale[];
  hotRegions: HotRegion[];
  ourLeadTotal: number;
  notes: string[];
}

const PRIORITY: Record<string, { label: string; bg: string; fg: string }> = {
  ONCELIK: { label: "ÖNCELİK", bg: "var(--success)", fg: "#fff" },
  IZLE: { label: "İzle", bg: "var(--status-info)", fg: "#fff" },
  FIRSAT: { label: "Fırsat (eyalet)", bg: "var(--warn)", fg: "#000" },
  RAKIP_ALANI: { label: "Rakip alanı", bg: "var(--surface-high)", fg: "var(--muted)" },
};

export default function RakipIstihbaratPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/rakip-istihbarat", { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setData((await res.json()) as Payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen" style={{ color: "var(--foreground)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Başlık */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Swords size={22} style={{ color: "var(--accent)" }} />
              Rakip İstihbaratı
            </h1>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--muted)" }}>
              Rakipler EN SON ne sattı (kaybolan ilan = muhtemel satış) + en yoğun oldukları arsa
              bölgeleri, o bölgedeki kendi lead sayımızla eşleştirilmiş. Sourcing önceliğini bu belirler.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Yenile
          </button>
        </div>

        {loading && !data && (
          <div className="flex items-center gap-2 py-20 justify-center" style={{ color: "var(--muted)" }}>
            <Loader2 className="animate-spin" size={18} /> Yükleniyor…
          </div>
        )}
        {err && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm"
            style={{ background: "var(--status-overdue-soft)", color: "var(--danger)" }}
          >
            <AlertCircle size={16} /> {err}
          </div>
        )}

        {data && (
          <>
            {/* Özet kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Stat label="Aktif rakip ilanı" value={fmtNum(data.totals.activeListings)} icon={<Target size={16} />} />
              <Stat
                label="Muhtemel satış (kayboldu)"
                value={fmtNum(data.totals.suspectedSold)}
                icon={<TrendingDown size={16} />}
                accent="var(--warn)"
              />
              <Stat
                label="Doğrulanmış satış"
                value={fmtNum(data.totals.verifiedSold)}
                icon={<ShieldCheck size={16} />}
                accent="var(--success)"
              />
              <Stat label="Bizim lead (sıcak eyaletler)" value={fmtNum(data.ourLeadTotal)} icon={<Flame size={16} />} />
            </div>

            <p className="text-xs mb-8" style={{ color: "var(--muted)" }}>
              Son scrape: {fmtDate(data.totals.lastScrapeAt)} · Rapor: {fmtDate(data.generatedAt)}
              {data.notes.length > 0 && (
                <span style={{ color: "var(--warn)" }}> · {data.notes.join(" · ")}</span>
              )}
            </p>

            {/* 1) RAKİP SON SATIŞLARI */}
            <Section
              title="Rakip son satışları — muhtemel"
              subtitle="İlan snapshot'tan kayboldu = büyük olasılıkla satıldı (kesin değil). Kaybolma tarihine göre yeni→eski."
              icon={<TrendingDown size={18} style={{ color: "var(--warn)" }} />}
            >
              {data.recentSales.length === 0 ? (
                <Empty text="Henüz kaybolan ilan yok — ilk diff sonrası birikir." />
              ) : (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--outline)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                        <Th>Kaybolma</Th>
                        <Th>Rakip</Th>
                        <Th>Bölge</Th>
                        <Th right>Fiyat</Th>
                        <Th right>Acre</Th>
                        <Th right>DOM</Th>
                        <Th>Durum</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentSales.map((s, i) => {
                        const rd = relDays(s.disappearedAt);
                        return (
                          <tr key={i} style={{ borderTop: "1px solid var(--outline)" }}>
                            <Td>
                              {fmtDate(s.disappearedAt)}
                              {rd != null && (
                                <span style={{ color: "var(--muted)" }}> · {rd}g önce</span>
                              )}
                            </Td>
                            <Td>{s.competitor || "—"}</Td>
                            <Td>
                              <span className="font-medium">{s.county || "—"}</span>
                              <span style={{ color: "var(--muted)" }}>
                                {" "}
                                {s.stateAbbr ? s.stateAbbr.toUpperCase() : s.state || ""}
                              </span>
                              {s.title && (
                                <div className="text-xs max-w-xs truncate" style={{ color: "var(--muted)" }}>
                                  {s.title}
                                </div>
                              )}
                            </Td>
                            <Td right>{fmtMoney(s.price)}</Td>
                            <Td right>{s.acres ?? "—"}</Td>
                            <Td right>{s.domDays ?? "—"}</Td>
                            <Td>
                              {s.verified ? (
                                <Badge bg="var(--success)" fg="#fff">
                                  Doğrulandı
                                </Badge>
                              ) : (
                                <Badge bg="var(--warn)" fg="#000">
                                  Muhtemel
                                </Badge>
                              )}
                              {s.url && (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex ml-1 align-middle"
                                  style={{ color: "var(--accent)" }}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* 2) AKTİF RAKİP İLANLARI ÖZETİ */}
            <Section
              title="Rakip başına özet"
              subtitle="Aktif ilan + muhtemel/doğrulanmış satış."
              icon={<Swords size={18} style={{ color: "var(--accent)" }} />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.competitorSummary.map((c) => (
                  <div
                    key={c.competitor}
                    className="rounded-xl border p-4"
                    style={{ borderColor: "var(--outline)", background: "var(--surface)" }}
                  >
                    <div className="font-semibold mb-2">{c.competitor}</div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <div className="text-lg font-bold">{fmtNum(c.active)}</div>
                        <div style={{ color: "var(--muted)" }}>aktif</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: "var(--warn)" }}>
                          {fmtNum(c.suspectedSold)}
                        </div>
                        <div style={{ color: "var(--muted)" }}>muhtemel</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: "var(--success)" }}>
                          {fmtNum(c.verifiedSold)}
                        </div>
                        <div style={{ color: "var(--muted)" }}>doğrulanmış</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* 3) RAKİP SICAK BÖLGELER + BİZİM LEAD */}
            <Section
              title="Rakip sıcak bölgeler + bizim lead sayımız"
              subtitle="Rakip yoğunluğu (aktif ilan + muhtemel satış×2) sıralı. Bizde lead varsa = sourcing önceliği. Envanterimiz ağırlıkla AZ/Mohave'de — eyalet sayısı kesin, county en-iyi-çaba eşleşme."
              icon={<Flame size={18} style={{ color: "var(--warn)" }} />}
            >
              {data.hotRegions.length === 0 ? (
                <Empty text="Bölge verisi yok." />
              ) : (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--outline)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                        <Th>Bölge</Th>
                        <Th>Ana rakip</Th>
                        <Th right>Aktif ilan</Th>
                        <Th right>Muhtemel satış</Th>
                        <Th right>Medyan fiyat</Th>
                        <Th right>Bizim lead (county)</Th>
                        <Th right>Bizim lead (eyalet)</Th>
                        <Th>Öncelik</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hotRegions.map((r, i) => {
                        const p = PRIORITY[r.priority] || PRIORITY.RAKIP_ALANI;
                        return (
                          <tr key={i} style={{ borderTop: "1px solid var(--outline)" }}>
                            <Td>
                              <span className="font-medium capitalize">{r.county}</span>{" "}
                              <span style={{ color: "var(--muted)" }}>{r.state}</span>
                            </Td>
                            <Td>{r.topCompetitor || "—"}</Td>
                            <Td right>{fmtNum(r.active)}</Td>
                            <Td right style={{ color: r.sold > 0 ? "var(--warn)" : undefined }}>
                              {fmtNum(r.sold)}
                            </Td>
                            <Td right>{fmtMoney(r.medianPrice)}</Td>
                            <Td right style={{ color: r.ourLeadsCounty > 0 ? "var(--success)" : "var(--muted)" }}>
                              {fmtNum(r.ourLeadsCounty)}
                            </Td>
                            <Td right style={{ color: "var(--muted)" }}>{fmtNum(r.ourLeadsState)}</Td>
                            <Td>
                              <Badge bg={p.bg} fg={p.fg}>
                                {p.label}
                              </Badge>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ── Küçük bileşenler ──────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--muted)" }}>
        {icon} {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {icon} {title}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>
  );
}
function Td({
  children,
  right,
  style,
}: {
  children: React.ReactNode;
  right?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td className={`px-3 py-2 align-top ${right ? "text-right tabular-nums" : "text-left"}`} style={style}>
      {children}
    </td>
  );
}
function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div
      className="text-center py-12 rounded-xl border border-dashed text-sm"
      style={{ borderColor: "var(--outline)", color: "var(--muted)" }}
    >
      {text}
    </div>
  );
}
