"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarClock, ExternalLink, MapPin } from "lucide-react";

interface Sale {
  id: string; state: string; county: string; sale_date: string | null;
  sale_type: string | null; parcel_list_url: string | null;
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);
}

export function UpcomingSales({ max = 40 }: { max?: number }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("upcoming_sales")
      .select("id,state,county,sale_date,sale_type,parcel_list_url")
      .gte("sale_date", today)
      .order("sale_date", { ascending: true })
      .limit(max)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(true);
        else setSales((data as Sale[]) || []);
        setLoading(false);
      }, () => { if (alive) { setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [max]);

  return (
    <div className="rounded-xl border mt-6" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--surface-high)" }}>
        <CalendarClock className="w-4 h-4" style={{ color: "var(--warn)" }} />
        <h2 className="font-bold text-sm">Yaklaşan Tax-Sale Takvimi</h2>
        <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>· ulusal · GovEase</span>
      </div>
      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>Yükleniyor…</p>
      ) : error ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--danger)" }}>Takvim yüklenemedi.</p>
      ) : sales.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>Yaklaşan satış yok.</p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto">
          {sales.map((s) => {
            const d = daysUntil(s.sale_date);
            const soon = d != null && d <= 14;
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 border-t transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
                <div className="shrink-0 w-14 text-center">
                  <p className="text-sm font-extrabold tabular-nums leading-none" style={{ color: soon ? "var(--danger)" : "var(--foreground)" }}>{d != null ? `${d}g` : "—"}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>kaldı</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--muted)" }} />{s.county}, {s.state}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{s.sale_date} · {s.sale_type || "—"}</p>
                </div>
                {s.parcel_list_url && (
                  <a href={s.parcel_list_url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>
                    Parsel listesi <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
