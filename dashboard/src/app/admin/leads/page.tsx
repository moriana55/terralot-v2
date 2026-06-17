"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Mail, Phone, Clock, Trash2, Loader2, AlertCircle } from "lucide-react";

interface Lead {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  Property?: { title: string };
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  NEW: { bg: "rgba(142,209,223,0.1)", color: "var(--primary)" },
  CONTACTED: { bg: "rgba(251,185,131,0.1)", color: "var(--tertiary)" },
  QUALIFIED: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
  CLOSED: { bg: "rgba(255,180,171,0.1)", color: "var(--error)" },
};

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];

export default function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/inquiries");
      const json = await res.json();
      if (json.error) setError(json.error);
      else setLeads(json.inquiries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    setLeads(l => l.map(x => x.id === id ? { ...x, status } : x));
    await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteLead(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setLeads(l => l.filter(x => x.id !== id));
    setDeletingId(null);
    setConfirmId(null);
  }

  return (
    <div className="p-8">
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl border p-6 w-80" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <h3 className="font-bold mb-2">Delete inquiry?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-high)" }}>Cancel</button>
              <button onClick={() => deleteLead(confirmId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--error)", color: "white" }}>
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-1">Leads & Inquiries</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>{leads.length} total inquiries</p>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
          <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted)" }} />
          <h3 className="text-lg font-bold mb-2">No inquiries yet</h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>When visitors submit inquiry forms, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => {
            const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.NEW;
            return (
              <div key={lead.id} className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-sm">{lead.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      Re: <span style={{ color: "var(--primary)" }}>{lead.Property?.title || lead.propertyId}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border-0 outline-none cursor-pointer"
                      style={{ background: sc.bg, color: sc.color }}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setConfirmId(lead.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                      <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs mb-3" style={{ color: "var(--muted)" }}>
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(lead.createdAt).toLocaleString()}</span>
                </div>
                {lead.message && (
                  <p className="text-sm rounded-lg p-3 border" style={{ background: "var(--surface-low)", color: "var(--muted)", borderColor: "var(--outline)" }}>
                    {lead.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
