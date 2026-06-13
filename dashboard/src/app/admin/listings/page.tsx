"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Edit, Trash2, Star, Loader2, AlertCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Property {
  id: string;
  title: string;
  slug: string;
  state: string;
  county: string;
  acres: number;
  price: number;
  monthlyPayment: number;
  status: string;
  featured: boolean;
  images: string[];
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  AVAILABLE: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
  PENDING: { bg: "rgba(251,185,131,0.1)", color: "var(--tertiary)" },
  SOLD: { bg: "rgba(255,180,171,0.1)", color: "var(--error)" },
  DRAFT: { bg: "rgba(107,114,128,0.1)", color: "var(--muted)" },
};

export default function AdminListings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase.from("Property").select("id,title,slug,state,county,acres,price,monthlyPayment,status,featured,images").order("createdAt", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    if (search) q = q.or(`title.ilike.%${search}%,state.ilike.%${search}%,county.ilike.%${search}%`);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setProperties(data ?? []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function deleteProperty(id: string) {
    setDeletingId(id);
    const { error: err } = await supabase.from("Property").delete().eq("id", id);
    if (err) alert("Delete failed: " + err.message);
    else setProperties(p => p.filter(x => x.id !== id));
    setDeletingId(null);
    setConfirmId(null);
  }

  async function toggleFeatured(id: string, current: boolean) {
    await supabase.from("Property").update({ featured: !current }).eq("id", id);
    setProperties(p => p.map(x => x.id === id ? { ...x, featured: !current } : x));
  }

  return (
    <div className="p-8">
      {/* Confirm dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl border p-6 w-80" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <h3 className="font-bold mb-2">Delete listing?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-high)" }}>Cancel</button>
              <button onClick={() => deleteProperty(confirmId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--error)", color: "white" }}>
                {deletingId === confirmId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Listings</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{properties.length} properties</p>
        </div>
        <button className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
          <Plus className="w-4 h-4" /> Add Listing
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted)" }} />
          <input type="text" placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg text-sm border focus:outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--outline)", color: "var(--foreground)" }} />
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
          {[["", "All"], ["AVAILABLE", "Available"], ["PENDING", "Pending"], ["SOLD", "Sold"]].map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
              style={{ background: statusFilter === val ? "rgba(142,209,223,0.1)" : "transparent", color: statusFilter === val ? "var(--primary)" : "var(--muted)" }}>
              {label}
            </button>
          ))}
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
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
                {["Property", "Location", "Size", "Price", "Monthly", "Status", "Featured", "Actions"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map(p => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.AVAILABLE;
                return (
                  <tr key={p.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: "var(--outline)" }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-12 h-8 rounded object-cover" />}
                        <span className="font-semibold text-xs line-clamp-1">{p.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{p.county}, {p.state}</td>
                    <td className="py-3 px-4 text-xs">{p.acres} ac</td>
                    <td className="py-3 px-4 text-xs font-bold" style={{ color: "var(--primary)" }}>${p.price.toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs">${p.monthlyPayment}/mo</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: sc.bg, color: sc.color }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleFeatured(p.id, p.featured)}>
                        <Star className="w-4 h-4" style={{ color: p.featured ? "var(--tertiary)" : "var(--outline)", fill: p.featured ? "var(--tertiary)" : "none" }} />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Link href={`/properties/${p.slug}`} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                          <Eye className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                        </Link>
                        <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                          <Edit className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                        </button>
                        <button onClick={() => setConfirmId(p.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {properties.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>No listings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
