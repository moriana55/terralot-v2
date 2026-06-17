"use client";

import { Plus, Phone, Mail, X, Trash2, Loader2 } from "lucide-react";
import { activities, ROLE_LABELS, ACTIVITY_LABELS, getActivityColor } from "@/lib/network-data";
import type { ContactRole } from "@/lib/network-data";
import { useState, useEffect } from "react";

const ROLE_COLORS: Record<string, string> = {
  wholesaler: "var(--primary)",
  scout: "var(--tertiary)",
  realtor: "var(--secondary)",
  investor: "var(--success)",
  buyer: "var(--muted)",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/contacts?view=full").then(r => r.json()).catch(() => ({ contacts: [] })),
      fetch("/api/admin/deals").then(r => r.json()).catch(() => ({ deals: [] })),
    ]).then(([{ contacts: c }, { deals: d }]) => {
      setContacts(c?.map((x: any) => ({ ...x, role: x.role?.toLowerCase() })) ?? []);
      setDeals(d?.map((x: any) => ({ ...x, status: x.status?.toLowerCase() })) ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? contacts : contacts.filter((c: any) => c.role === filter);
  const selected = selectedId ? contacts.find((c: any) => c.id === selectedId) : null;
  const selectedDeals = selected ? deals.filter((d: any) => d.sourceId === selected.id) : [];
  const selectedActivities = selected ? activities.filter((a: any) => a.contactId === selected.id).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)) : [];

  async function deleteContact(id: string) {
    await fetch(`/api/admin/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setContacts(c => c.filter(x => x.id !== id));
    setConfirmId(null);
    if (selectedId === id) setSelectedId(null);
  }

  if (loading) return <div className="flex items-center justify-center py-40 gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="p-8">
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl border p-6 w-80" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <h3 className="font-bold mb-2">Delete contact?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-high)" }}>Cancel</button>
              <button onClick={() => deleteContact(confirmId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--error)", color: "white" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Contacts</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Your network of wholesalers, scouts, realtors & investors</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--primary)", color: "var(--background)" }}>
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {/* Role filter */}
      <div className="flex gap-2 mb-6">
        {["all", "wholesaler", "scout", "realtor", "investor", "buyer"].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: filter === r ? "rgba(142,209,223,0.1)" : "transparent",
              color: filter === r ? "var(--primary)" : "var(--muted)",
              border: "1px solid",
              borderColor: filter === r ? "rgba(142,209,223,0.2)" : "rgba(255,255,255,0.05)",
            }}>
            {r === "all" ? `All (${contacts.length})` : `${ROLE_LABELS[r as ContactRole]} (${contacts.filter(c => c.role === r).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact list */}
        <div className={`${selected ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: "var(--surface)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["Name", "Role", "Location", "Deals", "Contact", ""].map(h => (
                    <th key={h} className="text-left py-3 px-5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const dealCount = deals.filter(d => d.sourceId === c.id).length;
                  return (
                    <tr key={c.id}
                      onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      style={{ background: selectedId === c.id ? "rgba(142,209,223,0.03)" : "transparent" }}>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background: `${ROLE_COLORS[c.role]}15`, color: ROLE_COLORS[c.role] }}>
                            {c.name.split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          <div>
                            <div className="font-semibold">{c.name}</div>
                            {c.company && <div className="text-xs" style={{ color: "var(--muted)" }}>{c.company}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                          style={{ background: `${ROLE_COLORS[c.role]}15`, color: ROLE_COLORS[c.role] }}>
                          {ROLE_LABELS[c.role as ContactRole]}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-xs" style={{ color: "var(--muted)" }}>{c.state || "—"}</td>
                      <td className="py-3.5 px-5">
                        {dealCount > 0 ? (
                          <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{dealCount}</span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          {c.email && <Mail className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />}
                          {c.phone && <Phone className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />}
                        </div>
                      </td>
                      <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setConfirmId(c.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contact Detail Panel */}
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: `${ROLE_COLORS[selected.role]}15`, color: ROLE_COLORS[selected.role] }}>
                    {selected.name.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className="font-bold">{selected.name}</h3>
                    {selected.company && <p className="text-xs" style={{ color: "var(--muted)" }}>{selected.company}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-white/5">
                  <X className="w-4 h-4" style={{ color: "var(--muted)" }} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {selected.email && <p><span style={{ color: "var(--muted)" }}>Email:</span> {selected.email}</p>}
                {selected.phone && <p><span style={{ color: "var(--muted)" }}>Phone:</span> {selected.phone}</p>}
                {selected.state && <p><span style={{ color: "var(--muted)" }}>Location:</span> {selected.state}</p>}
                {selected.budget && (
                  <p><span style={{ color: "var(--muted)" }}>Budget:</span> ${selected.budget.min.toLocaleString()} – ${selected.budget.max.toLocaleString()}</p>
                )}
                {selected.preferredStates && (
                  <p><span style={{ color: "var(--muted)" }}>Preferred:</span> {selected.preferredStates.join(", ")}</p>
                )}
                {selected.notes && <p className="pt-2 leading-relaxed" style={{ color: "var(--muted)" }}>{selected.notes}</p>}
              </div>
            </div>

            {/* Deals from this source */}
            {selectedDeals.length > 0 && (
              <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Deals ({selectedDeals.length})</p>
                <div className="space-y-2">
                  {selectedDeals.map(d => (
                    <div key={d.id} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <p className="text-xs font-semibold">{d.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>{d.state}</span>
                        <span className="text-[10px] font-bold uppercase" style={{ color: getDealStatusColorImport(d.status) }}>
                          {d.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            {selectedActivities.length > 0 && (
              <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Activity</p>
                <div className="space-y-3">
                  {selectedActivities.map(a => {
                    const date = new Date(a.createdAt);
                    return (
                      <div key={a.id} className="flex gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: getActivityColor(a.type) }} />
                        <div>
                          <p className="text-xs font-semibold">{a.title}</p>
                          <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                            {ACTIVITY_LABELS[a.type]} · {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                          {a.description && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{a.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getDealStatusColorImport(status: string) {
  const colors: Record<string, string> = {
    new: "var(--primary)", evaluating: "var(--tertiary)", presented: "var(--secondary)",
    accepted: "var(--success)", closed: "var(--success)", dead: "var(--muted)",
  };
  return colors[status] || "var(--muted)";
}
