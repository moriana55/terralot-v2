"use client";

import { useState } from "react";
import { X, Send, CheckCircle2, Loader2 } from "lucide-react";
import type { Property } from "@/lib/data";

interface InquiryModalProps {
  property: Property;
  onClose: () => void;
}

export default function InquiryModal({ property, onClose }: InquiryModalProps) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, propertyId: property.id, propertyTitle: property.title }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative rounded-2xl p-8 max-w-md w-full text-center border border-white/10" style={{ background: "var(--surface)" }} onClick={e => e.stopPropagation()}>
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--success)" }} />
          <h3 className="text-xl font-bold mb-2">Inquiry Sent!</h3>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            We&apos;ll get back to you within 24 hours about <strong>{property.title}</strong>.
          </p>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative rounded-2xl p-6 max-w-lg w-full border border-white/10" style={{ background: "var(--surface)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold">Inquire About This Property</h3>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{property.title} — ${property.price.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 hover:border-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--muted)" }}>Full Name *</label>
              <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm border border-white/10 focus:border-[var(--primary)]/50 focus:outline-none"
                style={{ background: "var(--surface-low)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--muted)" }}>Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm border border-white/10 focus:border-[var(--primary)]/50 focus:outline-none"
                style={{ background: "var(--surface-low)", color: "var(--foreground)" }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--muted)" }}>Phone (optional)</label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 rounded-lg text-sm border border-white/10 focus:border-[var(--primary)]/50 focus:outline-none"
              style={{ background: "var(--surface-low)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--muted)" }}>Message</label>
            <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3}
              placeholder="I'm interested in this property..."
              className="w-full px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[var(--primary)]/50 focus:outline-none resize-none"
              style={{ background: "var(--surface-low)", color: "var(--foreground)" }} />
          </div>

          {status === "error" && (
            <p className="text-xs" style={{ color: "var(--error)" }}>Something went wrong. Please try again or call us directly.</p>
          )}

          <button type="submit" disabled={status === "sending"}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--primary)", color: "var(--background)" }}>
            {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {status === "sending" ? "Sending..." : "Send Inquiry"}
          </button>
        </form>
      </div>
    </div>
  );
}
