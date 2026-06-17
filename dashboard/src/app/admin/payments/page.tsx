"use client";

import { useState, useEffect } from "react";
import { CreditCard, Mail, Clock, Trash2, Loader2, AlertCircle } from "lucide-react";

interface Payment {
  id: string;
  propertyId: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  Property?: { title: string };
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "rgba(251,185,131,0.1)", color: "var(--tertiary)" },
  PAID: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
  OVERDUE: { bg: "rgba(255,180,171,0.15)", color: "var(--error)" },
  FAILED: { bg: "rgba(186,26,26,0.1)", color: "var(--error)" },
};

const STATUSES = ["PENDING", "PAID", "OVERDUE", "FAILED"];

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      const json = await res.json();
      if (json.error) setError(json.error);
      else setPayments(json.payments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const paidAt = status === "PAID" ? new Date().toISOString() : null;
    setPayments(p => p.map(x => x.id === id ? { ...x, status, paidAt: paidAt ?? x.paidAt } : x));
    await fetch(`/api/admin/payments?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, paidAt }),
    });
  }

  async function deletePayment(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/payments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setPayments(p => p.filter(x => x.id !== id));
    setDeletingId(null);
    setConfirmId(null);
  }

  const total = payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-8">
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl border p-6 w-80" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <h3 className="font-bold mb-2">Delete payment?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-high)" }}>Cancel</button>
              <button onClick={() => deletePayment(confirmId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--error)", color: "white" }}>
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Payments</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{payments.length} total records</p>
        </div>
        <div className="rounded-xl border px-4 py-2.5 text-right" style={{ background: "rgba(142,209,223,0.05)", borderColor: "rgba(142,209,223,0.2)" }}>
          <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: "var(--muted)" }}>Total Collected</p>
          <p className="text-xl font-bold" style={{ color: "var(--primary)" }}>${total.toLocaleString()}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
          <CreditCard className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted)" }} />
          <h3 className="text-lg font-bold mb-2">No payments yet</h3>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
                {["Buyer", "Property", "Amount", "Type", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.PENDING;
                return (
                  <tr key={p.id} className="border-b hover:bg-white/[0.02]" style={{ borderColor: "var(--outline)" }}>
                    <td className="py-3 px-4">
                      <p className="text-xs font-semibold">{p.buyerName}</p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>{p.buyerEmail}</p>
                    </td>
                    <td className="py-3 px-4 text-xs max-w-[160px] truncate" style={{ color: "var(--muted)" }}>{p.Property?.title || p.propertyId}</td>
                    <td className="py-3 px-4 text-xs font-bold" style={{ color: "var(--primary)" }}>${p.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs">{p.type === "DOWN_PAYMENT" ? "Down" : "Monthly"}</td>
                    <td className="py-3 px-4">
                      <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border-0 outline-none cursor-pointer"
                        style={{ background: sc.bg, color: sc.color }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => setConfirmId(p.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                        <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                      </button>
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
