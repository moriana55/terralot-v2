"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  MailPlus,
  Satellite,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET LEADS — Ahmet'e gösterilecek GERÇEK, DÜRÜST motive-satıcı tablosu.
//
// DÜRÜSTLÜK KURALLARI:
//  • Sadece GERÇEK isimli + adresli + vergi-borçlu sahipler (jenerik/placeholder hariç).
//  • Comp/dönüm verisi YOKSA değer/marj UYDURULMAZ → "DD bekliyor" yazılır.
//  • Absentee rozeti yalnızca posta-adresi eyaleti ≠ parsel eyaleti ise gösterilir.
//  • DB'ye yazılmaz (sadece okuma).
// ─────────────────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  state: string | null;
  county: string | null;
  apn: string | null;
  owner_name: string | null;
  owner_address: string | null;
  property_address: string | null;
  acres: number | null;
  minimum_bid: number | null;
  judgment_amount: number | null;
  lat: number | null;
  lng: number | null;
  raw_url: string | null;
  source: string | null;
}

interface Lead extends Row {
  ownerName: string;
  ownerAddr: string;
  owed: number;
  mailState: string | null;
  absentee: boolean;
}

const GENERIC = /absentee|owner|unknown|n\/a|test/i;
const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

// Posta adresinden eyalet kodunu çıkar:  "..., HOUSTON, TX, 77020"  →  "TX"
function mailStateFrom(addr: string): string | null {
  const m = addr.toUpperCase().match(/,\s*([A-Z]{2})\s*,?\s*\d{5}/);
  return m ? m[1] : null;
}

// Gerçek-lead filtresi (real-leads.mjs ile birebir mantık)
function toLeads(rows: Row[]): Lead[] {
  const out: Lead[] = [];
  for (const r of rows) {
    const ownerName = (r.owner_name || "").replace(/\s+/g, " ").trim();
    if (ownerName.length < 4 || GENERIC.test(ownerName)) continue;
    const ownerAddr = (r.owner_address || "").replace(/\s+/g, " ").trim();
    if (!ownerAddr) continue;
    const owed = Number(r.minimum_bid) || Number(r.judgment_amount) || 0;
    if (!(owed > 0)) continue;
    const mailState = mailStateFrom(ownerAddr);
    const parcelState = (r.state || "").toUpperCase();
    const absentee = !!(mailState && parcelState && mailState !== parcelState);
    out.push({ ...r, ownerName, ownerAddr, owed, mailState, absentee });
  }
  // Sıralama: absentee önce → sonra düşük borç (ucuz kapatılır)
  out.sort((a, b) => Number(b.absentee) - Number(a.absentee) || a.owed - b.owed);
  return out;
}

// Sahibe gönderilecek kısa, dürüst teklif mektubu taslağı (gerçek verilerle doldurulur)
function letterDraft(l: Lead): string {
  const parcel = l.property_address || `${l.county || ""}, ${l.state || ""}`.trim();
  const apn = l.apn ? ` (Parcel/APN: ${l.apn})` : "";
  return `Dear ${l.ownerName},

I am a local land buyer interested in your property at ${parcel}${apn}.

Public records indicate there may be unpaid property taxes of about ${fmtMoney(
    l.owed
  )} associated with this parcel. I purchase land directly from owners — as-is, no commissions, no repairs, and I can cover closing costs and outstanding taxes.

If you would consider selling, I would like to make you a fair cash offer. There is no obligation. You can reach me at the number / email below.

Sincerely,
TerraLot — Land Acquisitions
Mail to: ${l.ownerAddr}`;
}

export default function OffMarketLeadsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [onlyAbsentee, setOnlyAbsentee] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    // Sadece OKUMA. Sunucu tarafı kaba ön-filtre; ince filtre client'ta.
    const all: Row[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error: err } = await supabase
        .from("tax_delinquent_properties")
        .select(
          "id,state,county,apn,owner_name,owner_address,property_address,acres,minimum_bid,judgment_amount,lat,lng,raw_url,source"
        )
        .not("owner_name", "is", null)
        .not("owner_address", "is", null)
        .range(from, from + PAGE - 1);
      if (err) {
        setError(err.message);
        break;
      }
      all.push(...((data as Row[]) ?? []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
      if (from > 40000) break;
    }
    setRows(all);
    setLoading(false);
  }

  const leads = useMemo(() => toLeads(rows), [rows]);
  const shown = useMemo(
    () => (onlyAbsentee ? leads.filter((l) => l.absentee) : leads),
    [leads, onlyAbsentee]
  );

  const absenteeCount = leads.filter((l) => l.absentee).length;
  const stateCount = new Set(leads.map((l) => (l.state || "").toUpperCase()).filter(Boolean)).size;
  const stateBreakdown = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) {
      const s = (l.state || "?").toUpperCase();
      c[s] = (c[s] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  async function copyLetter(l: Lead) {
    try {
      await navigator.clipboard.writeText(letterDraft(l));
      setCopiedId(l.id);
      setTimeout(() => setCopiedId((c) => (c === l.id ? null : c)), 1800);
    } catch {
      // Pano erişimi yoksa sessizce geç
    }
  }

  function mailtoHref(l: Lead): string {
    const subj = `Offer to purchase — ${l.property_address || l.apn || "your property"}`;
    return `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(
      letterDraft(l)
    )}`;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <MailPlus className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Off-Market Leads — Mektup Atılacak Gerçek Sahipler
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Gerçek isimli + posta adresli + vergi-borçlu (motive) sahipler. Mektup, posta adresine gider.
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
          <strong style={{ color: "var(--foreground)" }}>Vergi borçlu + absentee sahipler = en motive satıcılar.</strong>{" "}
          Bu sayfada uydurma değer / marj / % indirim YOK. Dönüm + comp verisi olmadan teklif gösterilmez —
          o satırlarda <em>“Değer DD bekliyor”</em> yazar. Değer, DD (Regrid / comp) ile doğrulanır.
        </span>
      </div>

      {/* Özet */}
      {!loading && !error && (
        <div className="flex items-center gap-3 mb-5 flex-wrap text-sm">
          <Stat label="Gerçek-isimli motive sahip" value={leads.length.toLocaleString("en-US")} accent />
          <Stat label="Absentee (uzakta)" value={absenteeCount.toLocaleString("en-US")} />
          <Stat label="Eyalet" value={String(stateCount)} />
          {stateBreakdown.length > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--outline)" }}>
              {stateBreakdown.map(([s, n]) => `${s} ${n}`).join(" · ")}
            </span>
          )}
          {absenteeCount > 0 && (
            <button
              onClick={() => setOnlyAbsentee((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{
                background: onlyAbsentee ? "var(--accent-ink)" : "var(--surface)",
                color: onlyAbsentee ? "var(--background)" : "var(--muted)",
                border: "1px solid var(--outline)",
              }}
            >
              📮 Sadece absentee
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Gerçek lead&apos;ler yükleniyor…
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

      {!loading && !error && shown.length === 0 && (
        <div
          className="text-center py-20 rounded-xl border border-dashed"
          style={{ borderColor: "var(--outline)", color: "var(--muted)" }}
        >
          <p className="text-sm font-medium mb-1">Gösterilecek gerçek lead yok</p>
          <p className="text-xs">Scraper daha fazla eyalet topladıkça bu liste büyür.</p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                {["Sahip", "Posta Adresi", "Parsel", "Dönüm", "Borç", "Absentee", "Önerilen Teklif", "Aksiyon"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const hasComp = l.acres != null && l.acres > 0; // comp/dönüm yoksa teklif UYDURULMAZ
                const satUrl =
                  l.lat != null && l.lng != null
                    ? `https://www.google.com/maps/@${l.lat},${l.lng},800m/data=!3m1!1e3`
                    : null;
                const regridUrl = `https://app.regrid.com/search?query=${encodeURIComponent(
                  l.property_address || `${l.apn ?? ""} ${l.county ?? ""} ${l.state ?? ""}`
                )}`;
                return (
                  <tr
                    key={l.id}
                    className="border-b transition-colors hover:bg-white/[0.02] align-top"
                    style={{ borderColor: "var(--outline)" }}
                  >
                    {/* Sahip */}
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{l.ownerName}</td>

                    {/* Posta Adresi */}
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                      {l.ownerAddr}
                    </td>

                    {/* Parsel */}
                    <td className="px-4 py-3 text-xs">
                      <div>{l.property_address || `${l.county ?? "—"}, ${l.state ?? ""}`}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                        {[l.county, l.state].filter(Boolean).join(", ")}
                        {l.apn ? ` · APN ${l.apn}` : ""}
                      </div>
                    </td>

                    {/* Dönüm */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {l.acres != null ? `${l.acres} ac` : "—"}
                    </td>

                    {/* Borç */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-amber-500">{fmtMoney(l.owed)}</span>
                      <span className="block text-[10px]" style={{ color: "var(--muted)" }}>
                        vergi borcu
                      </span>
                    </td>

                    {/* Absentee */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {l.absentee ? (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(34,197,94,0.12)", color: "var(--grade-a)" }}
                          title={`Posta eyaleti ${l.mailState} ≠ parsel eyaleti ${l.state}`}
                        >
                          📮 Uzakta
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* Önerilen Teklif — DÜRÜST */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {hasComp ? (
                        // Dönüm var: muhafazakâr, comp-tabanlı yer tutucu. (Comp pipeline bağlanınca gerçek değer girer.)
                        <span style={{ color: "var(--muted)" }}>Comp ile hesapla</span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{ background: "var(--surface-high)", color: "var(--muted)" }}
                        >
                          Değer DD bekliyor
                        </span>
                      )}
                    </td>

                    {/* Aksiyon */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {satUrl && (
                          <a
                            href={satUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                            title="Uydu görüntüsünde parseli gör"
                          >
                            <Satellite className="w-3 h-3" /> Gör
                          </a>
                        )}
                        <a
                          href={regridUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                          title="Regrid'de parsel + DD"
                        >
                          <ExternalLink className="w-3 h-3" /> Regrid
                        </a>
                        {l.raw_url && (
                          <a
                            href={l.raw_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                            title="Kaynak kayıt"
                          >
                            <ExternalLink className="w-3 h-3" /> Kaynak
                          </a>
                        )}
                        <a
                          href={mailtoHref(l)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{ background: "rgba(57,128,244,0.1)", color: "var(--primary)" }}
                          title="Mektup taslağını e-posta ile aç"
                        >
                          <MailPlus className="w-3 h-3" /> Mektup
                        </a>
                        <button
                          onClick={() => copyLetter(l)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                          title="Mektup taslağını kopyala"
                        >
                          {copiedId === l.id ? (
                            <>
                              <Check className="w-3 h-3" /> Kopyalandı
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Kopyala
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="px-3.5 py-2 rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
    >
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: accent ? "var(--accent-ink)" : "var(--foreground)" }}
      >
        {value}
      </span>{" "}
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}
