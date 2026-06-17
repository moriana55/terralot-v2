"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Target, TrendingUp, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CerberusLogo } from "@/components/DealHoundLogo";
import { ScoreBadge } from "@/components/ScoreBadge";
import { UpcomingSales } from "./scraper/UpcomingSales";
import { GrowthCatalysts } from "@/components/GrowthCatalysts";
import { HotCounties } from "@/components/HotCounties";

interface Stats { total: number; available: number; pending: number; sold: number; totalValue: number; }
interface Funnel { total: number; evaluable: number; states: number; counties: number; score70: number; struckOff: number; }
interface Deal { id: string; state: string; county: string; minimum_bid: number | null; judgment_amount: number | null; final_score: number | null; road_access: string | null; }

const money = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [fresh, setFresh] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 36 * 3600000).toISOString();
      const [{ data: props }, { data: top }, { data: newDeals }, f] = await Promise.all([
        supabase.from("Property").select("price,status"),
        supabase.from("tax_delinquent_properties").select("id,state,county,minimum_bid,judgment_amount,final_score,road_access").order("final_score", { ascending: false, nullsFirst: false }).limit(6),
        supabase.from("tax_delinquent_properties").select("id,state,county,minimum_bid,judgment_amount,final_score,road_access").gt("created_at", since).gte("final_score", 45).order("final_score", { ascending: false, nullsFirst: false }).limit(6),
        fetch("/api/acquisition-stats").then((r) => r.json()).catch(() => null),
      ]);
      if (newDeals) setFresh(newDeals as Deal[]);
      if (props) {
        setStats({
          total: props.length,
          available: props.filter((p) => p.status === "AVAILABLE").length,
          pending: props.filter((p) => p.status === "PENDING").length,
          sold: props.filter((p) => p.status === "SOLD").length,
          totalValue: props.reduce((s, p) => s + (p.price || 0), 0),
        });
      }
      if (top) setDeals(top as Deal[]);
      if (f) setFunnel(f);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-7 max-w-6xl space-y-6">
      {/* ── Cerberus command hero ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #102a55 0%, #0a1a3f 62%)", boxShadow: "0 10px 34px rgba(8,18,42,0.4)" }}>
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #8ed1df, #a882ff, transparent)" }} />
        <div className="p-6">
          <div className="flex items-center gap-3.5">
            <span className="shrink-0 rounded-xl p-1.5" style={{ background: "rgba(142,209,223,0.1)", border: "1px solid rgba(142,209,223,0.18)" }}><CerberusLogo size={38} /></span>
            <div className="flex-1">
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "#f4f7fb" }}>Komuta Merkezi</h1>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(244,247,251,0.55)" }}>Cerberus · canlı deal akışı</p>
            </div>
            <Link href="/admin/acquisitions" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-opacity hover:opacity-90" style={{ background: "#8ed1df", color: "#06202b" }}>
              En iyi deal'ler <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* funnel inline */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              { label: "Toplam lead", value: funnel?.total, c: "#8ed1df" },
              { label: "Değerlenebilir", value: funnel?.evaluable, c: "#a882ff" },
              { label: "Sıcak (A+/A)", value: funnel?.score70, c: "#62e39a" },
              { label: "Struck-off", value: funnel?.struckOff, c: "#ffc24d" },
              { label: "County kapsam", value: funnel?.counties, c: "#f4f7fb" },
            ].map((m) => (
              <div key={m.label} className="px-4 py-3" style={{ background: "rgba(10,20,45,0.55)" }}>
                <p className="text-xl font-extrabold font-mono leading-none" style={{ color: m.c }}>{loading ? "—" : (m.value ?? 0).toLocaleString()}</p>
                <p className="text-[9px] uppercase tracking-wider mt-1.5" style={{ color: "rgba(244,247,251,0.5)" }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sabah brifingi: son 36s yeni bulgular (#2) ── */}
      {fresh.length > 0 && (
        <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--surface-high)" }}>
            <span>🌅</span>
            <h2 className="font-bold text-sm">Sabah Brifingi</h2>
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>· son 36 saatte düşen yeni fırsatlar</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(15,157,88,0.12)", color: "var(--grade-a)" }}>{fresh.length} yeni</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 py-3">
            {fresh.map((d) => {
              const disc = d.judgment_amount && d.minimum_bid ? Math.round(((d.judgment_amount - d.minimum_bid) / d.judgment_amount) * 100) : null;
              return (
                <Link key={d.id} href={`/admin/acquisitions?q=${encodeURIComponent(d.county)}`} className="shrink-0 w-44 rounded-lg p-3 border transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                  <div className="flex items-center gap-2 mb-1"><ScoreBadge score={d.final_score} size={28} /><span className="text-xs font-semibold truncate">{d.county}, {d.state}</span></div>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>{money(d.minimum_bid)}{disc != null ? ` · -${disc}%` : ""}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Portfolio stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Portföy değeri", value: stats ? money(stats.totalValue) : "—", icon: TrendingUp, c: "var(--grade-a)" },
          { label: "Satışta", value: stats?.available ?? "—", icon: MapPin, c: "var(--accent-ink)" },
          { label: "Beklemede", value: stats?.pending ?? "—", icon: Layers, c: "var(--warn)" },
          { label: "Satıldı", value: stats?.sold ?? "—", icon: CheckCircle2, c: "var(--grade-a)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.c }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
            </div>
            <p className="text-2xl font-extrabold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Top deals ── */}
      <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--surface-high)" }}>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
            <h2 className="font-bold text-sm">Günün en iyi deal'leri</h2>
          </div>
          <Link href="/admin/acquisitions" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: "var(--accent-ink)" }}>
            Tümü <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…</div>
        ) : (
          <div>
            {deals.map((d) => {
              const disc = d.judgment_amount && d.minimum_bid ? Math.round(((d.judgment_amount - d.minimum_bid) / d.judgment_amount) * 100) : null;
              return (
                <div key={d.id} className="flex items-center gap-4 px-5 py-3 border-t transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                  <ScoreBadge score={d.final_score} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{d.county}, {d.state}</p>
                    <p className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
                      Teklif <strong style={{ color: "var(--foreground)" }}>{money(d.minimum_bid)}</strong>
                      · Değer <strong style={{ color: "var(--foreground)" }}>{money(d.judgment_amount)}</strong>
                      {d.road_access === "landlocked" && <span style={{ color: "var(--danger)" }}>· landlocked</span>}
                    </p>
                  </div>
                  {disc != null && disc > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold tabular-nums" style={{ color: "var(--grade-a)" }}>-{disc}%</p>
                      <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>indirim</p>
                    </div>
                  )}
                </div>
              );
            })}
            {deals.length === 0 && <p className="text-center text-sm py-10" style={{ color: "var(--muted)" }}>Henüz deal yok.</p>}
          </div>
        )}
      </div>

      {/* Hot counties + upcoming sales side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HotCounties />
        <UpcomingSales max={6} />
      </div>

      {/* Growth catalysts — megaprojects driving land appreciation */}
      <GrowthCatalysts />
    </div>
  );
}
