"use client";

/**
 * ANLAŞMA HATTI — 5 aşamalı satın alma kanban'ı (arama tabanlı).
 * Arama kokpitinde "İlgileniyor" işaretlenen sahip buraya otomatik düşer;
 * ◀ ▶ ile aşama sürülür: İlgileniyor → Teklif → Pazarlık → Sözleşme → Tapu.
 * Şema: sql/call_center.sql (pipeline_deals).
 */

import { useCallback, useEffect, useState } from "react";
import { Handshake, ChevronLeft, ChevronRight, Phone, Loader2, Trash2, AlertTriangle, DollarSign } from "lucide-react";

const ACCENT = "#7c3aed";

const STAGES: { key: string; label: string; tone: string; hint: string }[] = [
  { key: "ilgileniyor", label: "İlgileniyor", tone: "#16a34a", hint: "aramadan otomatik" },
  { key: "teklif", label: "Teklif Gitti", tone: "#0891b2", hint: "yazılı teklif iletildi" },
  { key: "pazarlik", label: "Pazarlık", tone: "#d97706", hint: "fiyat/koşul görüşülüyor" },
  { key: "sozlesme", label: "Sözleşme", tone: "#7c3aed", hint: "imza aşaması" },
  { key: "tapu", label: "Tapu / Kapanış", tone: "#dc2626", hint: "title & escrow" },
];

type Deal = {
  lead_id: string; stage: string; note: string | null; offer_amount: number | null; updated_at: string;
  lead: { owner: string; state: string; county: string; apn: string; acres: number | null; est_offer: number | null; est_retail: number | null; est_margin: number | null; phone: string | null } | null;
};

function usd(n: number | null | undefined) {
  return n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function AnlasmaHatti() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pipeline");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "yüklenemedi");
      setDeals(data.deals ?? []);
      setSchemaReady(data.schemaReady !== false);
    } catch (e) {
      setNotice(`Hata: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function move(deal: Deal, dir: 1 | -1) {
    const idx = STAGES.findIndex((s) => s.key === deal.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    setBusy(deal.lead_id);
    try {
      const res = await fetch("/api/admin/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: deal.lead_id, stage: next.key }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeals((ds) => ds.map((d) => d.lead_id === deal.lead_id ? { ...d, stage: next.key } : d));
    } catch (e) {
      setNotice(`Hata: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(deal: Deal) {
    if (!confirm(`${deal.lead?.owner ?? deal.lead_id} hattan çıkarılsın mı?`)) return;
    setBusy(deal.lead_id);
    try {
      const res = await fetch(`/api/admin/pipeline?lead_id=${encodeURIComponent(deal.lead_id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeals((ds) => ds.filter((d) => d.lead_id !== deal.lead_id));
    } catch (e) {
      setNotice(`Hata: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setBusy(null);
    }
  }

  async function setOffer(deal: Deal) {
    const raw = prompt("Teklif tutarı (USD):", deal.offer_amount ? String(deal.offer_amount) : String(deal.lead?.est_offer ?? ""));
    if (raw == null) return;
    const val = Number(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(val) || val <= 0) { setNotice("Geçersiz tutar."); return; }
    setBusy(deal.lead_id);
    try {
      const res = await fetch("/api/admin/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: deal.lead_id, offer_amount: val }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeals((ds) => ds.map((d) => d.lead_id === deal.lead_id ? { ...d, offer_amount: val } : d));
    } catch (e) {
      setNotice(`Hata: ${e instanceof Error ? e.message : "ağ"}`);
    } finally {
      setBusy(null);
    }
  }

  const totalPotential = deals.reduce((a, d) => a + (d.lead?.est_margin ?? 0), 0);

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="inline-grid place-items-center w-10 h-10 rounded-xl" style={{ background: `${ACCENT}1c` }}>
              <Handshake size={20} style={{ color: ACCENT }} />
            </span>
            Anlaşma Hattı
            {loading && <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Arama kokpitinde <b>İlgileniyor</b> işaretlenen sahipler buraya otomatik düşer. ◀ ▶ ile aşama sür; tapuya kadar takip et.
          </p>
        </div>
        <div className="rounded-xl px-4 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--outline)", background: "var(--surface)" }}>
          {deals.length} anlaşma · potansiyel marj <span style={{ color: ACCENT }}>{usd(totalPotential)}</span>
        </div>
      </div>

      {!schemaReady && (
        <div className="mt-4 rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2" style={{ border: "1.5px solid #d9770655", background: "#d977060f", color: "#d97706" }}>
          <AlertTriangle size={16} /> Şema kurulu değil — <code className="font-mono">sql/call_center.sql</code> Supabase'de bir kez çalıştırılmalı.
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg px-4 py-3 text-sm font-semibold" style={{ border: "1px solid var(--outline)", background: "var(--surface)" }}>{notice}</div>
      )}

      <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))", overflowX: "auto" }}>
        {STAGES.map((st, si) => {
          const col = deals.filter((d) => d.stage === st.key);
          return (
            <div key={st.key} className="rounded-xl border flex flex-col min-h-[300px]" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `2px solid ${st.tone}` }}>
                <div>
                  <b className="text-sm">{si + 1} · {st.label}</b>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{st.hint}</div>
                </div>
                <span className="text-xs font-bold rounded-full px-2.5 py-1" style={{ background: `${st.tone}18`, color: st.tone }}>{col.length}</span>
              </div>
              <div className="p-3 grid gap-3 content-start flex-1">
                {col.length === 0 && <p className="text-xs p-2" style={{ color: "var(--muted)" }}>Boş</p>}
                {col.map((d) => (
                  <div key={d.lead_id} className="rounded-lg border p-3" style={{ borderColor: "var(--outline)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-sm leading-tight">{d.lead?.owner ?? d.lead_id}</b>
                      <button onClick={() => remove(d)} title="Hattan çıkar" style={{ color: "var(--muted)" }}><Trash2 size={13} /></button>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                      {d.lead ? `${d.lead.county}, ${d.lead.state} · ${d.lead.acres ? `${d.lead.acres} ac` : d.lead.apn}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <button onClick={() => setOffer(d)} className="inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ background: `${st.tone}12`, color: st.tone }}>
                        <DollarSign size={11} /> {d.offer_amount ? usd(d.offer_amount) : `öneri ${usd(d.lead?.est_offer)}`}
                      </button>
                      <span className="rounded-full px-2 py-1" style={{ background: "var(--outline)", color: "var(--muted)" }}>marj {usd(d.lead?.est_margin)}</span>
                      {d.lead?.phone && (
                        <a href={`tel:${d.lead.phone}`} className="inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ background: "#16a34a15", color: "#16a34a" }}>
                          <Phone size={11} /> ara
                        </a>
                      )}
                    </div>
                    {d.note && <p className="mt-2 text-[11px] italic" style={{ color: "var(--muted)" }}>{d.note}</p>}
                    <div className="mt-2.5 flex justify-between">
                      <button onClick={() => move(d, -1)} disabled={si === 0 || busy === d.lead_id} className="inline-flex items-center gap-1 text-[11px] font-bold rounded px-2 py-1 disabled:opacity-30" style={{ border: "1px solid var(--outline)" }}>
                        <ChevronLeft size={12} /> geri
                      </button>
                      <button onClick={() => move(d, 1)} disabled={si === STAGES.length - 1 || busy === d.lead_id} className="inline-flex items-center gap-1 text-[11px] font-bold rounded px-2 py-1 text-white disabled:opacity-30" style={{ background: st.tone }}>
                        {busy === d.lead_id ? <Loader2 size={12} className="animate-spin" /> : <>ilerlet <ChevronRight size={12} /></>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
