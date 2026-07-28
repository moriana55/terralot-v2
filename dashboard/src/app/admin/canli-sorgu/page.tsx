"use client";

/**
 * CANLI COUNTY SORGU — statik lead havuzu DIŞINDA, kullanıcı istediğinde bir
 * county'nin parsel verisini O AN sorgular. Sonuç sağlayıcı zincirinden gelir
 * (ücretsiz county ArcGIS → Regrid yedeği); istenirse offmarket_leads'e kaydedilir.
 *
 * Sunucu: /api/admin/live-county (GET sorgu, POST kaydet).
 * Kaynak tanımları: src/lib/county-registry.ts (sadece veri, kod değil).
 */

import { useMemo, useState } from "react";
import { Radio, Loader2, Search, Save, AlertTriangle, MapPin, Building2, CheckCircle2, ChevronDown } from "lucide-react";
import { LIVE_COUNTY_OPTIONS, type LiveCountyResult } from "@/lib/live-county";

// Durum noktası — hangi county'nin gerçekten veri döndürdüğü seçim anında görünsün.
const DURUM_RENK: Record<string, string> = {
  calisiyor: "var(--grade-a)",
  deneniyor: "var(--muted)",
  "veri-yok": "var(--muted)",
  "servis-kapali": "#b91c1c",
};
const DURUM_ETIKET: Record<string, string> = {
  calisiyor: "çalışıyor",
  deneniyor: "deneniyor",
  "veri-yok": "veri yok",
  "servis-kapali": "servis kapalı",
};

/**
 * County seçici — native <select> KULLANILMAZ (proje UI kuralı) ve 60+ kayıtla
 * kullanılamaz hale gelir. Eyalete göre gruplanmış, aranabilir panel.
 */
function CountySecici({ deger, onChange }: { deger: string; onChange: (k: string) => void }) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState("");
  const secili = LIVE_COUNTY_OPTIONS.find((o) => o.key === deger);

  const gruplar = useMemo(() => {
    const q = ara.trim().toLowerCase();
    const m = new Map<string, typeof LIVE_COUNTY_OPTIONS>();
    for (const o of LIVE_COUNTY_OPTIONS) {
      if (q && !o.label.toLowerCase().includes(q) && !o.state.toLowerCase().includes(q)) continue;
      const a = m.get(o.state) ?? [];
      a.push(o);
      m.set(o.state, a);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [ara]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm text-left"
        style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}
      >
        <span className="flex items-center gap-2 truncate">
          {secili && (
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: DURUM_RENK[secili.durum] ?? "var(--muted)" }} />
          )}
          <span className="truncate">{secili?.label ?? "County seç"}</span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--muted)" }} />
      </button>

      {acik && (
        <div
          className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          <div className="p-2 sticky top-0" style={{ background: "var(--surface)" }}>
            <input
              autoFocus
              value={ara}
              onChange={(e) => setAra(e.target.value)}
              placeholder="County veya eyalet ara…"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}
            />
          </div>
          {gruplar.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: "var(--muted)" }}>Eşleşen county yok.</div>
          )}
          {gruplar.map(([state, liste]) => (
            <div key={state}>
              <div className="px-3 py-1 text-[11px] font-bold sticky top-[46px]"
                style={{ color: "var(--muted)", background: "var(--surface-high)" }}>
                {state}
              </div>
              {liste.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => { onChange(o.key); setAcik(false); setAra(""); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:opacity-80"
                  style={{ background: o.key === deger ? "var(--surface-high)" : "transparent" }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: DURUM_RENK[o.durum] ?? "var(--muted)" }} />
                  <span className="truncate flex-1">{o.county}</span>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--muted)" }}>
                    {DURUM_ETIKET[o.durum] ?? o.durum}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ACCENT = "#0891b2";

interface ApiResponse {
  county: string;
  label: string;
  state: string;
  live: boolean;
  fetchedAt: string;
  count: number;
  capped: boolean;
  rows: LiveCountyResult[];
}

const fmtMoney = (v: number | null) => (v == null ? "—" : `$${v.toLocaleString("en-US")}`);
const fmtAcres = (v: number | null) => (v == null ? "—" : `${v} ac`);

export default function CanliSorguPage() {
  const [countyKey, setCountyKey] = useState(LIVE_COUNTY_OPTIONS[0]?.key ?? "");
  const [owner, setOwner] = useState("");
  const [apn, setApn] = useState("");
  const [mailingState, setMailingState] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const selected = LIVE_COUNTY_OPTIONS.find((o) => o.key === countyKey);

  async function runQuery() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(new Set());
    setNotice(null);
    try {
      const p = new URLSearchParams({ county: countyKey });
      if (owner.trim()) p.set("owner", owner.trim());
      if (apn.trim()) p.set("apn", apn.trim());
      if (mailingState.trim()) p.set("mailingState", mailingState.trim());
      if (minValue.trim()) p.set("minValue", minValue.trim());
      if (maxValue.trim()) p.set("maxValue", maxValue.trim());
      const res = await fetch(`/api/admin/live-county?${p}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Sorgu başarısız (HTTP ${res.status})`);
        return;
      }
      setResult(data as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ağ hatası — sorgu tamamlanamadı");
    } finally {
      setLoading(false);
    }
  }

  async function save(rows: LiveCountyResult[], key: string) {
    setSavingKey(key);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/live-county", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countyKey, rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(`Kaydetme hatası: ${data.error || res.status}`);
        return;
      }
      setSaved((prev) => {
        const next = new Set(prev);
        for (const r of rows) next.add(r.apn);
        return next;
      });
      setNotice(`✅ ${data.saved} kayıt offmarket_leads'e yazıldı.`);
    } catch (e) {
      setNotice(`Kaydetme hatası: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setSavingKey(null);
    }
  }

  const rows = result?.rows ?? [];
  const unsaved = rows.filter((r) => !saved.has(r.apn));

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Başlık */}
      <div className="flex items-start gap-3 mb-1">
        <span className="rounded-lg p-2 shrink-0" style={{ background: `${ACCENT}1a` }}>
          <Radio className="w-5 h-5" style={{ color: ACCENT }} />
        </span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Canlı County Sorgu</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Statik 360K lead dışında — seçili county'nin parsel servisine <b>o an</b> sorgu atar.
            Sonuç doğrudan county ArcGIS'inden gelir; istediğini offmarket_leads'e kaydet.
          </p>
        </div>
      </div>

      {/* Arama paneli */}
      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>County (canlı kaynak)</span>
            <CountySecici deger={countyKey} onChange={setCountyKey} />
            {selected?.not && (
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>{selected.not}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Malik adı</span>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="ör. SMITH"
              className="rounded-lg border px-3 py-2 text-sm bg-transparent" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>APN / Parsel No</span>
            <input value={apn} onChange={(e) => setApn(e.target.value)} placeholder="kısmi eşleşme"
              className="rounded-lg border px-3 py-2 text-sm bg-transparent" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Posta eyaleti (absentee)</span>
            <input value={mailingState} onChange={(e) => setMailingState(e.target.value)} placeholder="ör. CA" maxLength={2}
              className="rounded-lg border px-3 py-2 text-sm bg-transparent uppercase" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Min değer {selected && !selected.hasValue && <span className="normal-case font-normal">(bu county'de değer yok)</span>}
            </span>
            <input value={minValue} onChange={(e) => setMinValue(e.target.value)} type="number" placeholder="$" disabled={selected && !selected.hasValue}
              className="rounded-lg border px-3 py-2 text-sm bg-transparent disabled:opacity-40" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Max değer</span>
            <input value={maxValue} onChange={(e) => setMaxValue(e.target.value)} type="number" placeholder="$" disabled={selected && !selected.hasValue}
              className="rounded-lg border px-3 py-2 text-sm bg-transparent disabled:opacity-40" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runQuery}
            disabled={loading || !countyKey}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Sorgulanıyor…" : "Sorgula"}
          </button>
          {result && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {result.count} sonuç · canlı çekim {new Date(result.fetchedAt).toLocaleTimeString("tr-TR")}
              {result.capped && " · (ilk 200 ile sınırlı — filtreyi daralt)"}
            </span>
          )}
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div className="mt-5 rounded-lg border p-4 flex items-start gap-2.5" style={{ borderColor: "#f59e0b55", background: "#f59e0b10" }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#d97706" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#b45309" }}>Canlı sorgu başarısız</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{error}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Bu gerçek bir canlı sorgu — county servisi engelli/yavaş olabilir. Sahte sonuç gösterilmez.</p>
          </div>
        </div>
      )}

      {/* Bildirim */}
      {notice && (
        <div className="mt-4 rounded-lg border px-4 py-2.5 text-sm" style={{ borderColor: "var(--outline)", background: "var(--surface)", color: "var(--foreground)" }}>
          {notice}
        </div>
      )}

      {/* Sonuç tablosu */}
      {result && (
        <div className="mt-5">
          {rows.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <MapPin className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--muted)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>Bu filtreyle canlı sonuç dönmedi. Filtreyi genişletmeyi dene.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{result.label} · {rows.length} parsel</h2>
                <button
                  onClick={() => save(unsaved, "__all__")}
                  disabled={savingKey !== null || unsaved.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  {savingKey === "__all__" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Tümünü kaydet ({unsaved.length})
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--outline)" }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: "var(--surface)", color: "var(--muted)" }}>
                      <th className="text-left font-semibold px-3 py-2.5">Malik</th>
                      <th className="text-left font-semibold px-3 py-2.5">Posta adresi</th>
                      <th className="text-left font-semibold px-3 py-2.5">Situs / APN</th>
                      <th className="text-right font-semibold px-3 py-2.5">Alan</th>
                      <th className="text-right font-semibold px-3 py-2.5">Arazi değeri</th>
                      <th className="text-center font-semibold px-3 py-2.5">Absentee</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isSaved = saved.has(r.apn);
                      return (
                        <tr key={r.apn} className="border-t" style={{ borderColor: "var(--outline)" }}>
                          <td className="px-3 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>
                            <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />{r.owner}</span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>
                            {r.mailing_address}<br />
                            <span className="text-xs">{[r.mailing_city, r.mailing_state, r.mailing_zip].filter(Boolean).join(", ")}</span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>
                            {r.situs || "—"}<br />
                            <span className="text-xs font-mono">{r.apn}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right" style={{ color: "var(--foreground)" }}>{fmtAcres(r.acres)}</td>
                          <td className="px-3 py-2.5 text-right" style={{ color: "var(--foreground)" }}>{fmtMoney(r.land_value)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {r.absentee ? (
                              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${ACCENT}1a`, color: ACCENT }}>Evet</span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {isSaved ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#16a34a" }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Kayıtlı
                              </span>
                            ) : (
                              <button
                                onClick={() => save([r], r.apn)}
                                disabled={savingKey !== null}
                                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                                style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}
                              >
                                {savingKey === r.apn ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Kaydet
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
