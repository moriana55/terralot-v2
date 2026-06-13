"use client";

import { Phone, Mail, Calendar, StickyNote, Send, CheckCircle } from "lucide-react";
import { activities, getContact, getDeal, ACTIVITY_LABELS, getActivityColor } from "@/lib/network-data";
import type { ActivityType } from "@/lib/network-data";
import { useState } from "react";

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
  deal_sent: Send,
  deal_closed: CheckCircle,
};

export default function ActivityPage() {
  const [filter, setFilter] = useState<string>("all");
  const sorted = [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = filter === "all" ? sorted : sorted.filter(a => a.type === filter);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Activity Log</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>All interactions with your network</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "call", "email", "meeting", "note", "deal_sent", "deal_closed"].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: filter === t ? "rgba(142,209,223,0.1)" : "transparent",
              color: filter === t ? "var(--primary)" : "var(--muted)",
              border: "1px solid",
              borderColor: filter === t ? "rgba(142,209,223,0.2)" : "rgba(255,255,255,0.05)",
            }}>
            {t === "all" ? "All" : ACTIVITY_LABELS[t as ActivityType]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="space-y-1">
          {filtered.map(a => {
            const contact = getContact(a.contactId);
            const deal = a.dealId ? getDeal(a.dealId) : null;
            const Icon = ACTIVITY_ICONS[a.type];
            const color = getActivityColor(a.type);
            const date = new Date(a.createdAt);
            const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

            return (
              <div key={a.id} className="relative flex gap-4 p-4 rounded-xl hover:bg-white/[0.02] transition-colors">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 z-10"
                  style={{ background: `${color}15`, color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--primary)" }}>{contact?.name}</span>
                        {deal && (
                          <>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>·</span>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>{deal.title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{dateStr}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{timeStr}</p>
                    </div>
                  </div>
                  {a.description && (
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>{a.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
