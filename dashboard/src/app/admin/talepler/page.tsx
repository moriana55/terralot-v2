"use client";

// ── ALICI TALEPLERİ ──────────────────────────────────────────────────────────
// /p/[id] herkese-açık alıcı sayfasının talep formundan düşen lead'ler.
// Kaynak: Supabase parcel_inquiries (kalıcı) + bellek-içi fallback (geçici —
// tablo henüz kurulmadıysa; sql/parcel_inquiries.sql'i çalıştırınca kalıcılaşır).

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageSquare, Phone, RefreshCw, TriangleAlert } from "lucide-react";
import type { ParcelInquiry } from "@/lib/parcel-inquiry-store";

const STATUS: Record<string, { label: string; cls: string; next?: string }> = {
  NEW: { label: "YENİ", cls: "bg-emerald-100 text-emerald-700", next: "CONTACTED" },
  CONTACTED: { label: "İLETİŞİMDE", cls: "bg-sky-100 text-sky-700", next: "CLOSED" },
  CLOSED: { label: "KAPANDI", cls: "bg-slate-100 text-slate-500", next: "NEW" },
};

export default function TaleplerPage() {
  const [rows, setRows] = useState<ParcelInquiry[]>([]);
  const [tableOk, setTableOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/parcel-inquiries")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTableOk(!!d.tableOk); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch("/api/admin/parcel-inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
  };

  const copyLink = (parcelId: string) => {
    const url = `${location.origin}/p/${encodeURIComponent(parcelId)}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(parcelId);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">💬 Alıcı Talepleri</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Herkese açık <code className="rounded bg-slate-100 px-1">/p/&lt;id&gt;</code> parsel sayfasının formundan gelen lead&apos;ler.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </div>

      {!tableOk && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>parcel_inquiries tablosu yok</b> — talepler şu an bellek-içi (deploy/restart&apos;ta silinir).
            Kalıcılaştırmak için <code className="rounded bg-amber-100 px-1">sql/parcel_inquiries.sql</code>&apos;i Supabase SQL Editor&apos;da bir kez çalıştır.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">
          Henüz talep yok. Haritadaki parsel popup&apos;ından &quot;🔗 Müşteri linki&quot;ni kopyalayıp WhatsApp&apos;tan gönder —
          alıcı formu doldurunca burada görünür.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{r.name}</span>
                  <button
                    onClick={() => setStatus(r.id, STATUS[r.status]?.next || "CONTACTED")}
                    disabled={!!r.volatile}
                    title={r.volatile ? "Geçici kayıt — durum güncellenemez" : "Durumu değiştir"}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS[r.status]?.cls ?? "bg-slate-100 text-slate-500"} ${r.volatile ? "opacity-60" : "cursor-pointer"}`}
                  >
                    {STATUS[r.status]?.label ?? r.status}
                  </button>
                  {r.volatile && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700" title="Bellek-içi — restart'ta kaybolur">geçici</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString("tr-TR")}</span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-emerald-700"><Mail className="h-3.5 w-3.5" />{r.email}</a>}
                {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 hover:text-emerald-700"><Phone className="h-3.5 w-3.5" />{r.phone}</a>}
              </div>

              {r.message && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{r.message}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">Parsel:</span>
                <a href={`/p/${encodeURIComponent(r.parcel_id)}`} target="_blank" rel="noreferrer" className="font-semibold text-sky-600 hover:underline">
                  {r.parcel_title || r.parcel_id}
                </a>
                <button onClick={() => copyLink(r.parcel_id)} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50">
                  {copied === r.parcel_id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied === r.parcel_id ? "Kopyalandı" : "Müşteri linki"}
                </button>
                <a href={`/admin/parcel-sunum?id=${encodeURIComponent(r.parcel_id)}`} target="_blank" rel="noreferrer" className="rounded border border-slate-200 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50">
                  🖨 Sunum
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
