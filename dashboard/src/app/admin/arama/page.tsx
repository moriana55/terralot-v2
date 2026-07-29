"use client";

/**
 * SICAK ARAMA KOKPİTİ — mektup outreach'inin telefon dönüşümü.
 * Kuyruk (marj sıralı) → tek tık arama (tel:) → sonuç kaydı → geri arama kuyruğu.
 * Numaralar skip-trace CSV importuyla gelir; numara ÜRETİLMEZ (dürüstlük).
 * Şema: sql/call_center.sql (owner: Supabase'de bir kez çalıştır).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Phone, PhoneOff, PhoneMissed, Voicemail, Flame, ThumbsDown, ShieldOff,
  CalendarClock, Upload, Loader2, Copy, CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";
import { OFFMARKET_STATES } from "@/lib/offmarket-stats";
import GradeBadge from "@/components/GradeBadge";
import { breakdownTitle, gradeColor, GRADE_LABELS } from "@/lib/offmarket-grade";

const ACCENT = "#16a34a";
// Aktif eyalet listesi — tek kaynak: lib/offmarket-stats.ts (burada kopya yok).
const STATES = OFFMARKET_STATES;
// Eyalet çoğunluğunun saat dilimi (TN/OK çoğunluk Central, GA Eastern).
const TZ: Record<string, string> = { AZ: "America/Phoenix", NM: "America/Denver", CO: "America/Denver", TX: "America/Chicago", FL: "America/New_York", AR: "America/Chicago", NC: "America/New_York", TN: "America/Chicago", GA: "America/New_York", OK: "America/Chicago", NV: "America/Los_Angeles", OR: "America/Los_Angeles", MO: "America/Chicago", MI: "America/Detroit", SC: "America/New_York" };

type Lead = {
  lead_id: string; state: string; county: string; apn: string; owner: string;
  mailing_city: string | null; mailing_state: string | null; situs: string | null;
  acres: number | null; est_offer: number | null; est_retail: number | null; est_margin: number | null;
  phone: string | null; phone_source: string | null; do_not_call: boolean;
  grade?: string | null; grade_score?: number | null;
  grade_breakdown?: unknown; grade_reason?: string | null;
};

// Not filtresi — çoklu seçim (A+..F + N/A). Varsayılan A+/A: önce EN satılabilir
// arsanın sahibi aranır. "NA" = derecelendirilemedi (kamu sahipli vb. — F değil).
const GRADE_CHIPS = ["A+", "A", "B", "C", "D", "F", "NA"] as const;
type Callback = { lead_id: string; note: string | null; callback_at: string; lead: { owner: string; state: string; county: string; phone: string | null } | null };

const OUTCOME_META: { key: string; label: string; icon: typeof Phone; tone: string }[] = [
  { key: "no_answer", label: "Ulaşılamadı", icon: PhoneMissed, tone: "#94a3b8" },
  { key: "voicemail", label: "Mesaj bırakıldı", icon: Voicemail, tone: "#0891b2" },
  { key: "interested", label: "İlgileniyor", icon: Flame, tone: "#16a34a" },
  { key: "not_interested", label: "İlgilenmiyor", icon: ThumbsDown, tone: "#d97706" },
  { key: "wrong_number", label: "Yanlış numara", icon: PhoneOff, tone: "#dc2626" },
  { key: "callback", label: "Geri aranacak", icon: CalendarClock, tone: "#7c3aed" },
  { key: "dnc", label: "Aranmasın (DNC)", icon: ShieldOff, tone: "#334155" },
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOME_META.map((o) => [o.key, o.label]));

function usd(n: number | null | undefined) {
  return n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
}
function firstName(owner: string) {
  const w = owner.replace(/[,;].*$/, "").trim().split(/\s+/);
  return w.length > 1 ? w[w.length - 1] : w[0] || "there";
}
function localTime(state: string, now: Date) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ[state] || "America/Denver" }).format(now);
}
function callWindowOk(state: string, now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TZ[state] || "America/Denver" }).format(now));
  return h >= 9 && h < 19;
}

export default function AramaKokpiti() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lastOutcome, setLastOutcome] = useState<Record<string, { outcome: string; at: string }>>({});
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [phoneTotal, setPhoneTotal] = useState(0);
  const [state, setState] = useState<string>("");
  const [onlyPhone, setOnlyPhone] = useState(true);
  const [gradeSel, setGradeSel] = useState<string>("A+,A"); // varsayılan: vitrin notları
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [cbAt, setCbAt] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (state) qs.set("state", state);
      if (onlyPhone) qs.set("only_phone", "1");
      if (gradeSel) qs.set("grades", gradeSel);
      const res = await fetch(`/api/admin/call-center?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "yüklenemedi");
      setLeads(data.leads);
      setLastOutcome(data.lastOutcome ?? {});
      setCallbacks(data.callbacks ?? []);
      setPhoneTotal(data.phoneTotal ?? 0);
      setSchemaReady(data.schemaReady !== false);
      setActiveId((cur) => cur && data.leads.some((l: Lead) => l.lead_id === cur) ? cur : data.leads[0]?.lead_id ?? null);
    } catch (e) {
      setNotice(`Hata: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setLoading(false);
    }
  }, [state, onlyPhone, gradeSel]);

  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => leads.find((l) => l.lead_id === activeId) ?? null, [leads, activeId]);

  const script = useMemo(() => {
    if (!active) return "";
    return `Hi, may I speak with ${firstName(active.owner)}? ...

My name is [NAME], I'm calling from VegaLand. We buy vacant land in ${active.county} County — and I noticed you own ${active.acres ? `about ${active.acres} acres` : "a parcel"} out there (parcel ${active.apn}).

We pay cash, we cover ALL closing costs, and there are no fees or commissions for you.

Would you consider an offer of around ${usd(active.est_offer)} if we could close within 2-3 weeks?

[EVET →] Great! Let me verify the mailing address and send the agreement today.
[KARARSIZ →] Totally understand. What number would make it worth your while?
[HAYIR →] No problem at all — may I check back in a few months in case things change?`;
  }, [active]);

  async function logCall(outcome: string) {
    if (!active) return;
    if (outcome === "callback" && !cbAt) { setNotice("Geri arama için tarih seç."); return; }
    setSaving(outcome);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/call-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: active.lead_id, outcome, note: note || undefined, callback_at: outcome === "callback" ? new Date(cbAt).toISOString() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "kaydedilemedi");
      setLastOutcome((m) => ({ ...m, [active.lead_id]: { outcome, at: new Date().toISOString() } }));
      setNote(""); setCbAt("");
      // sıradaki lead'e geç
      const idx = leads.findIndex((l) => l.lead_id === active.lead_id);
      const next = leads[idx + 1] ?? leads[0] ?? null;
      if (outcome === "dnc") { void load(); } else if (next) setActiveId(next.lead_id);
      if (outcome === "callback") void load();
    } catch (e) {
      setNotice(`Hata: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setSaving(null);
    }
  }

  async function importPhones() {
    const rows = importText.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [key, phone] = l.split(/[,;\t]/).map((x) => x?.trim());
      return { key, phone };
    }).filter((r) => r.key && r.phone);
    if (!rows.length) { setNotice("Satır bulunamadı. Format: lead_id_veya_apn,telefon"); return; }
    setImporting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/call-center", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "import hatası");
      setNotice(`✅ ${data.updated} numara eşleşti${data.skippedCount ? `, ${data.skippedCount} satır eşleşmedi` : ""}.`);
      setImportOpen(false); setImportText("");
      void load();
    } catch (e) {
      setNotice(`Import hatası: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setImporting(false);
    }
  }

  const chip = (on: boolean) => ({
    padding: ".45rem .9rem", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${on ? ACCENT : "var(--outline)"}`, background: on ? `${ACCENT}18` : "var(--surface)", color: on ? ACCENT : "var(--muted)",
  } as const);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Başlık */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="inline-grid place-items-center w-10 h-10 rounded-xl" style={{ background: `${ACCENT}1c` }}>
              <Phone size={20} style={{ color: ACCENT }} />
            </span>
            Sıcak Arama Kokpiti
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Marj sırasına göre sahipleri ara, sonucu tek tıkla işle. Numaralar skip-trace importundan gelir — <b>{phoneTotal.toLocaleString("tr-TR")}</b> lead'de numara var.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold" style={{ border: "1.5px solid var(--outline)", background: "var(--surface)" }}>
            <Upload size={16} /> Numara importu
          </button>
        </div>
      </div>

      {/* ABD yerel saatleri */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STATES.map((st) => {
          const ok = callWindowOk(st, now);
          return (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ border: "1px solid var(--outline)", background: "var(--surface)", color: ok ? ACCENT : "var(--muted)" }}>
              <Clock size={12} /> {st} {localTime(st, now)} {ok ? "· aranabilir" : "· saat dışı"}
            </span>
          );
        })}
      </div>

      {/* Import paneli */}
      {importOpen && (
        <div className="mt-4 rounded-xl border p-5" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
          <p className="text-sm font-bold">Skip-trace CSV yapıştır — her satır: <code>lead_id_veya_APN,telefon</code></p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder={"AZ-MOHAVE-30612345,928 555 0134\n30612346,+1 928 555 0177"} className="mt-3 w-full rounded-lg p-3 text-sm font-mono" style={{ border: "1.5px solid var(--outline)", background: "var(--bg, transparent)" }} />
          <div className="mt-3 flex gap-2">
            <button onClick={importPhones} disabled={importing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white" style={{ background: ACCENT }}>
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} İçe aktar
            </button>
            <button onClick={() => setImportOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-bold" style={{ border: "1.5px solid var(--outline)" }}>Kapat</button>
          </div>
        </div>
      )}

      {!schemaReady && (
        <div className="mt-4 rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2" style={{ border: "1.5px solid #d9770655", background: "#d977060f", color: "#d97706" }}>
          <AlertTriangle size={16} /> Telefon şeması kurulu değil — <code className="font-mono">sql/call_center.sql</code> dosyasını Supabase SQL Editor'da bir kez çalıştırın. Kuyruk görünür ama numara importu ve sonuç kaydı o SQL'den sonra aktifleşir.
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2" style={{ border: "1px solid var(--outline)", background: "var(--surface)" }}>
          {notice.startsWith("✅") ? <CheckCircle2 size={16} style={{ color: ACCENT }} /> : <AlertTriangle size={16} style={{ color: "#d97706" }} />} {notice}
        </div>
      )}

      {/* Filtreler */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button style={chip(!state)} onClick={() => setState("")}>Tümü</button>
        {STATES.map((st) => (
          <button key={st} style={chip(state === st)} onClick={() => setState(st)}>{st}</button>
        ))}
        <span className="mx-2 h-5 w-px" style={{ background: "var(--outline)" }} />
        {/* Not filtresi — çoklu seçim (arsa not motoru; boş seçim = tüm notlar) */}
        {GRADE_CHIPS.map((g) => {
          const sel = gradeSel ? gradeSel.split(",") : [];
          const on = sel.includes(g);
          const col = g === "NA" ? "#64748b" : gradeColor(g);
          return (
            <button
              key={g}
              title={GRADE_LABELS[g === "NA" ? "N/A" : g]}
              onClick={() => setGradeSel((on ? sel.filter((x) => x !== g) : [...sel, g]).join(","))}
              style={{ ...chip(on), ...(on ? { borderColor: col, color: col, background: `${col}18` } : {}) }}
            >
              {g === "NA" ? "N/A" : g}
            </button>
          );
        })}
        <button style={chip(!gradeSel)} onClick={() => setGradeSel("")}>Tümü</button>
        <span className="mx-2 h-5 w-px" style={{ background: "var(--outline)" }} />
        <button style={chip(onlyPhone)} onClick={() => setOnlyPhone((v) => !v)}>📞 Sadece numarası olanlar</button>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* KUYRUK */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
          <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-between" style={{ color: "var(--muted)", borderBottom: "1px solid var(--outline)" }}>
            <span>Arama kuyruğu · marj sıralı</span>
            {loading && <Loader2 size={14} className="animate-spin" />}
          </div>
          <div className="max-h-[560px] overflow-auto">
            {leads.length === 0 && !loading && (
              <p className="p-5 text-sm" style={{ color: "var(--muted)" }}>
                {onlyPhone ? "Numarası olan lead yok — önce skip-trace importu yap." : "Lead bulunamadı."}
              </p>
            )}
            {leads.map((l) => {
              const lo = lastOutcome[l.lead_id];
              const on = l.lead_id === activeId;
              return (
                <button key={l.lead_id} onClick={() => setActiveId(l.lead_id)} className="w-full text-left px-4 py-3 block" style={{ borderBottom: "1px solid var(--outline)", background: on ? `${ACCENT}10` : "transparent", borderLeft: on ? `3px solid ${ACCENT}` : "3px solid transparent" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <GradeBadge grade={l.grade} size="sm" showNA title={breakdownTitle(l.grade_breakdown, l.grade_score)} />
                      <b className="text-sm truncate">{l.owner}</b>
                    </span>
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: ACCENT }}>{usd(l.est_margin)} marj</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--muted)" }}>
                    <span className="truncate">{l.county}, {l.state} · {l.acres ? `${l.acres} ac` : l.apn}</span>
                    {l.phone
                      ? <span className="font-semibold" style={{ color: ACCENT }}>📞</span>
                      : <span>numara bekliyor</span>}
                  </div>
                  {lo && <span className="mt-1 inline-block text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: "var(--outline)", color: "var(--muted)" }}>{OUTCOME_LABEL[lo.outcome] ?? lo.outcome}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* AKTİF KART */}
        <div className="grid gap-5">
          {active ? (
            <div className="rounded-xl border p-6" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <GradeBadge grade={active.grade} size="md" showNA title={breakdownTitle(active.grade_breakdown, active.grade_score)} />
                    {active.owner}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    {active.county} County, {active.state} · APN {active.apn}
                    {active.mailing_city ? ` · posta: ${active.mailing_city}, ${active.mailing_state ?? ""}` : ""}
                  </p>
                  <p className="text-xs mt-1 font-semibold" style={{ color: callWindowOk(active.state, now) ? ACCENT : "#d97706" }}>
                    Yerel saat {localTime(active.state, now)} — {callWindowOk(active.state, now) ? "arama penceresi açık (09–19)" : "arama penceresi DIŞI"}
                  </p>
                </div>
                {active.phone ? (
                  <a href={`tel:${active.phone}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-base font-bold text-white" style={{ background: ACCENT }}>
                    <Phone size={18} /> {active.phone}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold" style={{ border: "1.5px dashed var(--outline)", color: "var(--muted)" }}>
                    <PhoneOff size={16} /> Numara bekleniyor (skip-trace)
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Dönüm", active.acres ? `${active.acres} ac` : "—"],
                  ["Teklif", usd(active.est_offer)],
                  ["Perakende", usd(active.est_retail)],
                  ["Marj", usd(active.est_margin)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg px-3 py-2.5" style={{ background: `${ACCENT}0d`, border: "1px solid var(--outline)" }}>
                    <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{k}</div>
                    <div className="text-sm font-bold mt-0.5">{v}</div>
                  </div>
                ))}
              </div>

              {/* Skript */}
              <div className="mt-5 rounded-lg border p-4 relative" style={{ borderColor: "var(--outline)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Arama skripti (EN) — değerler otomatik dolu</span>
                  <button onClick={() => { void navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: ACCENT }}>
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed font-sans">{script}</pre>
              </div>

              {/* Sonuç */}
              <div className="mt-5">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Arama sonucu</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTCOME_META.map((o) => (
                    <button key={o.key} onClick={() => logCall(o.key)} disabled={saving !== null} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-bold" style={{ border: `1.5px solid ${o.tone}55`, background: `${o.tone}12`, color: o.tone }}>
                      {saving === o.key ? <Loader2 size={15} className="animate-spin" /> : <o.icon size={15} />} {o.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-3">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (opsiyonel) — ör: fiyatı düşük buldu, $9K istiyor" className="rounded-lg px-3 py-2.5 text-sm w-full" style={{ border: "1.5px solid var(--outline)", background: "transparent" }} />
                  <label className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--muted)" }}>
                    Geri arama:
                    <input type="datetime-local" value={cbAt} onChange={(e) => setCbAt(e.target.value)} className="rounded-lg px-2 py-2 text-sm" style={{ border: "1.5px solid var(--outline)", background: "transparent" }} />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-8 text-sm" style={{ borderColor: "var(--outline)", background: "var(--surface)", color: "var(--muted)" }}>
              Kuyruktan bir lead seç.
            </div>
          )}

          {/* Geri aramalar */}
          <div className="rounded-xl border" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--outline)" }}>
              <CalendarClock size={13} className="inline mr-1.5" />Yaklaşan geri aramalar
            </div>
            {callbacks.length === 0 ? (
              <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>Planlı geri arama yok.</p>
            ) : (
              callbacks.map((c, i) => (
                <div key={i} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ borderBottom: "1px solid var(--outline)" }}>
                  <span><b>{c.lead?.owner ?? c.lead_id}</b> <span style={{ color: "var(--muted)" }}>· {c.lead ? `${c.lead.county}, ${c.lead.state}` : ""}{c.note ? ` · ${c.note}` : ""}</span></span>
                  <span className="font-bold" style={{ color: "#7c3aed" }}>
                    {new Date(c.callback_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {c.lead?.phone && <a href={`tel:${c.lead.phone}`} className="ml-3 underline" style={{ color: ACCENT }}>ara</a>}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
