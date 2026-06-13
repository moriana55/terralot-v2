"use client";

import { useEffect, useState } from "react";
import { MapPin, DollarSign, MessageSquare, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Stats {
  total: number;
  available: number;
  pending: number;
  sold: number;
  featured: number;
  totalValue: number;
  avgPrice: number;
}

interface RecentProperty {
  id: string;
  title: string;
  state: string;
  acres: number;
  price: number;
  status: string;
  images: string[];
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: props }, { data: rec }] = await Promise.all([
        supabase.from("Property").select("price,status,featured"),
        supabase.from("Property").select("id,title,state,acres,price,status,images").order("createdAt", { ascending: false }).limit(8),
      ]);

      if (props) {
        const total = props.length;
        const available = props.filter(p => p.status === "AVAILABLE").length;
        const pending = props.filter(p => p.status === "PENDING").length;
        const sold = props.filter(p => p.status === "SOLD").length;
        const featured = props.filter(p => p.featured).length;
        const totalValue = props.reduce((s: number, p: any) => s + p.price, 0);
        setStats({ total, available, pending, sold, featured, totalValue, avgPrice: total ? Math.round(totalValue / total) : 0 });
      }
      if (rec) setRecent(rec);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full py-40 gap-2 text-sm" style={{ color: "var(--muted)" }}>
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Overview of your land sales platform</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: MapPin, label: "Total Listings", value: stats?.total ?? 0, sub: `${stats?.available ?? 0} available`, color: "var(--primary)" },
          { icon: DollarSign, label: "Total Portfolio", value: `$${(stats?.totalValue ?? 0).toLocaleString()}`, sub: `Avg $${(stats?.avgPrice ?? 0).toLocaleString()}`, color: "var(--success)" },
          { icon: MessageSquare, label: "Pending Sales", value: stats?.pending ?? 0, sub: "awaiting close", color: "var(--tertiary)" },
          { icon: TrendingUp, label: "Featured", value: stats?.featured ?? 0, sub: "highlighted listings", color: "var(--secondary)" },
        ].map(s => (
          <Card key={s.label}>
            <s.icon className="w-5 h-5 mb-3" style={{ color: s.color }} />
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Recent Listings</h2>
          <Link href="/admin/listings" className="text-xs font-semibold" style={{ color: "var(--primary)" }}>View All</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {["Property", "State", "Acres", "Price", "Status"].map(h => (
                <th key={h} className="text-left py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map(p => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="w-10 h-7 rounded object-cover" />}
                    <span className="font-semibold text-xs">{p.title}</span>
                  </div>
                </td>
                <td className="py-3 text-xs" style={{ color: "var(--muted)" }}>{p.state}</td>
                <td className="py-3 text-xs">{p.acres}</td>
                <td className="py-3 text-xs font-semibold" style={{ color: "var(--primary)" }}>${p.price.toLocaleString()}</td>
                <td className="py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{
                      background: p.status === "AVAILABLE" ? "rgba(34,197,94,0.1)" : p.status === "PENDING" ? "rgba(251,185,131,0.1)" : "rgba(255,180,171,0.1)",
                      color: p.status === "AVAILABLE" ? "#22c55e" : p.status === "PENDING" ? "var(--tertiary)" : "var(--error)",
                    }}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
