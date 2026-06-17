"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Send, Loader2, Search, Mail, FileText, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ONE-CLICK OWNER OUTREACH (admin)
// Pick a tax-lead → preview the generated deal-sheet → send a Lob letter/postcard
// (mocked when LOB_API_KEY absent) → logs an outreach_event. Backed by /api/outreach.
// ─────────────────────────────────────────────────────────────────────────────

interface Lead {
  id: string; state: string | null; county: string | null; acres: number | null;
  minimum_bid: number | null; final_score: number | null; owner_name: string | null;
  owner_address: string | null; property_address: string | null; apn: string | null;
}
interface Event {
  id: string; lead_ref: string | null; channel: string; type: string; status: string;
  provider_id: string | null; recipient_name: string | null; created_at: string; error: string | null;
}
interface DealSheet {
  title: string; offerPrice: number | null; offerPct: number; minimumBid: number | null;
  score: number | null; merge_variables: Record<string, string>;
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

const STATUS_ICON: Record<string, { icon: typeof Send; color: string }> = {
  sent: { icon: CheckCircle2, color: "var(--grade-a)" },
  mock: { icon: FileText, color: "var(--warn)" },
  queued: { icon: Clock, color: "var(--muted)" },
  failed: { icon: AlertTriangle, color: "var(--error)" },
};

export default function OutreachPage() {
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [channel, setChannel] = useState<"letter" | "postcard">("letter");
  const [offerPct, setOfferPct] = useState(110);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { status: string; dealSheet: DealSheet; note: string; error: string | null; lob: Record<string, unknown> | null }>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const loadEvents = async (leadId?: string) => {
    const url = leadId ? `/api/outreach?leadId=${leadId}` : "/api/outreach";
    const j = await (await fetch(url)).json();
    setEvents(j.events || []);
  };
  useEffect(() => { loadEvents(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setLeads([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("tax_delinquent_properties")
        .select("id,state,county,acres,minimum_bid,final_score,owner_name,owner_address,property_address,apn")
        .or(`county.ilike.%${q}%,property_address.ilike.%${q}%,apn.ilike.%${q}%,owner_name.ilike.%${q}%`)
        .order("final_score", { ascending: false })
        .limit(15);
      setLeads((data as Lead[]) || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (l: Lead) => { setLead(l); setResult(null); loadEvents(l.id); };

  const send = async (preview = false) => {
    if (!lead) return;
    setSending(true);
    const j = await (await fetch("/api/outreach", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, channel, type: "offer", offerPct, send: !preview }),
    })).json();
    setResult(j);
    setSending(false);
    loadEvents(lead.id);
  };

  const hasAddress = !!lead?.owner_address;

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Send className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
          Tek-Tık Sahip Outreach
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Bir lead seç → deal-sheet otomatik üretilir → Lob mektup/postcard tetikle (key yoksa mock) → outreach_events&apos;e loglanır.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Lead search */}
        <aside className="rounded-xl border p-4 h-fit" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "var(--muted)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="county / sahip / adres / APN…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
          </div>
          {searching && <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}><Loader2 className="w-3 h-3 animate-spin" /> aranıyor…</div>}
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {leads.map((l) => (
              <button key={l.id} onClick={() => pick(l)}
                className="w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors hover:bg-[var(--surface-high)]"
                style={{ background: lead?.id === l.id ? "var(--surface-high)" : "transparent" }}>
                <div className="font-semibold truncate">{l.acres ? `${l.acres}ac` : "Parcel"} — {l.county}, {l.state}</div>
                <div className="truncate" style={{ color: "var(--muted)" }}>{l.owner_name || "sahip ?"} · skor {l.final_score ?? "—"}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Compose + result */}
        <div>
          {!lead ? (
            <div className="text-center py-24 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
              <Send className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Soldan bir lead ara ve seç.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border p-5 mb-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-lg font-bold">{lead.acres ? `${lead.acres}-Acre` : "Parcel"} — {lead.county}, {lead.state}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      Sahip: {lead.owner_name || "bilinmiyor"} · min teklif {fmt(lead.minimum_bid)} · skor {lead.final_score ?? "—"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: hasAddress ? "var(--muted)" : "var(--error)" }}>
                      {hasAddress ? `Adres: ${lead.owner_address}` : "⚠ owner_address yok — Lob gönderimi başarısız olur"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <span className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--muted)" }}>Kanal</span>
                    <div className="flex gap-1.5">
                      {(["letter", "postcard"] as const).map((c) => (
                        <button key={c} onClick={() => setChannel(c)} className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold capitalize"
                          style={{ background: channel === c ? "var(--accent-ink)" : "var(--surface-high)", color: channel === c ? "var(--background)" : "var(--muted)" }}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--muted)" }}>Teklif (% min bid)</span>
                    <input type="number" value={offerPct} onChange={(e) => setOfferPct(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none tabular-nums" style={{ borderColor: "var(--outline)" }} />
                  </label>
                  <div className="flex items-end gap-2">
                    <button onClick={() => send(true)} disabled={sending} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "var(--surface-high)" }}>
                      <FileText className="w-4 h-4" /> Önizle
                    </button>
                    <button onClick={() => send(false)} disabled={sending} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "var(--primary)", color: "var(--background)" }}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
                    </button>
                  </div>
                </div>
              </div>

              {result && (
                <div className="rounded-xl border p-5 mb-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
                    <span className="text-sm font-bold">Deal-Sheet Önizleme</span>
                    <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: STATUS_ICON[result.status]?.color || "var(--muted)" }}>{result.status}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                    <div><div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Teklif fiyatı</div><div className="font-bold tabular-nums">{fmt(result.dealSheet.offerPrice)}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Min teklif</div><div className="font-bold tabular-nums">{fmt(result.dealSheet.minimumBid)}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Teklif oranı</div><div className="font-bold tabular-nums">{result.dealSheet.offerPct}%</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Skor</div><div className="font-bold tabular-nums">{result.dealSheet.score ?? "—"}</div></div>
                  </div>
                  <div className="rounded-lg p-3 text-xs font-mono" style={{ background: "var(--surface-low)", color: "var(--muted)" }}>
                    {Object.entries(result.dealSheet.merge_variables).map(([k, v]) => (
                      <div key={k}><span style={{ color: "var(--accent-ink)" }}>{k}</span>: {v}</div>
                    ))}
                  </div>
                  <p className="text-[10px] mt-3 rounded-md border border-dashed px-2 py-1" style={{ borderColor: "var(--outline)", color: result.error ? "var(--error)" : "var(--muted)" }}>
                    {result.error || result.note}
                  </p>
                </div>
              )}

              {/* Event log */}
              <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--surface-high)" }}>
                  <Mail className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
                  <span className="text-sm font-bold">Outreach Günlüğü</span>
                  <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>{events.length} olay</span>
                </div>
                {events.length === 0 ? (
                  <p className="text-center text-sm py-10" style={{ color: "var(--muted)" }}>Bu lead için henüz outreach yok.</p>
                ) : (
                  <div className="max-h-[40vh] overflow-y-auto">
                    {events.map((e) => {
                      const S = STATUS_ICON[e.status] || STATUS_ICON.queued;
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 border-b text-xs" style={{ borderColor: "var(--surface-high)" }}>
                          <S.icon className="w-4 h-4 shrink-0" style={{ color: S.color }} />
                          <span className="font-semibold capitalize w-16">{e.channel}</span>
                          <span style={{ color: "var(--muted)" }}>{e.recipient_name || "—"}</span>
                          <span className="ml-auto tabular-nums" style={{ color: "var(--muted)" }}>{new Date(e.created_at).toLocaleString()}</span>
                          {e.provider_id && <span className="font-mono text-[10px]" style={{ color: "var(--accent-ink)" }}>{e.provider_id.slice(0, 12)}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
