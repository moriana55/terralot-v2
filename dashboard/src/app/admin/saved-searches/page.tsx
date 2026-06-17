"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Plus, Trash2, Play, Loader2, X, Mail, Clock } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// SAVED SEARCHES + ALERTS (admin)
// Save a deal-screener / acquisitions filter set, run it, see NEW matches.
// Email/cron delivery is a STUB (Vercel cron + Resend TODO — see /api routes).
// ─────────────────────────────────────────────────────────────────────────────

interface SavedSearch {
  id: string;
  name: string;
  source: string;
  filters_json: Record<string, unknown>;
  notify_email: string | null;
  last_run_at: string | null;
  last_match_count: number;
}

interface Match {
  id: string; state: string | null; county: string | null; source: string | null;
  acres: number | null; minimum_bid: number | null; final_score: number | null;
  property_address: string | null;
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

const blankForm = { name: "", states: "", county: "", srcContains: "", minScore: "", minAcres: "", maxAcres: "", minBid: "", maxBid: "", hasOwner: false, notify_email: "" };

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof blankForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [runResult, setRunResult] = useState<null | { id: string; total: number; newCount: number; matches: Match[]; newMatches: Match[]; note: string }>(null);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const j = await (await fetch("/api/saved-searches")).json();
    setSearches(j.searches || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const filters: Record<string, unknown> = {};
    if (form.states.trim()) filters.states = form.states.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (form.county.trim()) filters.county = form.county.trim();
    if (form.srcContains.trim()) filters.srcContains = form.srcContains.trim();
    if (form.minScore) filters.minScore = Number(form.minScore);
    if (form.minAcres) filters.minAcres = Number(form.minAcres);
    if (form.maxAcres) filters.maxAcres = Number(form.maxAcres);
    if (form.minBid) filters.minBid = Number(form.minBid);
    if (form.maxBid) filters.maxBid = Number(form.maxBid);
    if (form.hasOwner) filters.hasOwner = true;

    await fetch("/api/saved-searches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, source: "deal-screener", filters_json: filters, notify_email: form.notify_email || null }),
    });
    setSaving(false); setShowForm(false); setForm(blankForm); load();
  };

  const del = async (id: string) => {
    if (!confirm("Aramayı sil?")) return;
    await fetch("/api/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete", id }) });
    load();
  };

  const run = async (id: string) => {
    setRunning(id);
    setRunResult(null);
    const j = await (await fetch("/api/saved-searches/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })).json();
    setRunResult({ id, total: j.total ?? 0, newCount: j.newCount ?? 0, matches: j.matches || [], newMatches: j.newMatches || [], note: j.note || "" });
    setRunning(null);
    load();
  };

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <BellRing className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Kayıtlı Aramalar & Alarmlar
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Deal-screener filtre setlerini sakla, çalıştır, yeni eşleşmeleri gör. E-posta/cron teslimatı STUB (Vercel cron + Resend TODO).
          </p>
        </div>
        <button onClick={() => { setForm(blankForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
          <Plus className="w-4 h-4" /> Yeni Arama
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> yükleniyor…</div>
      ) : searches.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
          <p className="text-sm font-medium mb-1">Kayıtlı arama yok</p>
          <p className="text-xs">add_innovation_features_batch2.sql çalıştır, sonra &quot;Yeni Arama&quot; ekle.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s) => (
            <div key={s.id} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-bold text-sm flex items-center gap-2">{s.name}
                    {s.notify_email && <span className="flex items-center gap-1 text-[10px] font-normal" style={{ color: "var(--muted)" }}><Mail className="w-3 h-3" /> {s.notify_email}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.entries(s.filters_json || {}).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                        {k}: {Array.isArray(v) ? v.join(",") : String(v)}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "hiç çalışmadı"}</span>
                    <span>son eşleşme: {s.last_match_count}</span>
                  </div>
                </div>
                <button onClick={() => run(s.id)} disabled={running === s.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--accent-ink)", color: "var(--background)" }}>
                  {running === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Çalıştır
                </button>
                <button onClick={() => del(s.id)} className="p-1.5 rounded-md hover:bg-[var(--surface-high)]"><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} /></button>
              </div>

              {runResult?.id === s.id && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-high)" }}>
                  <div className="flex items-center gap-4 mb-2 text-xs">
                    <span className="font-semibold">{runResult.total} toplam eşleşme</span>
                    <span className="font-bold" style={{ color: runResult.newCount > 0 ? "var(--grade-a)" : "var(--muted)" }}>{runResult.newCount} YENİ</span>
                  </div>
                  <p className="text-[10px] mb-2 rounded-md border border-dashed px-2 py-1" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>{runResult.note}</p>
                  {(runResult.newMatches.length ? runResult.newMatches : runResult.matches).slice(0, 8).map((m) => (
                    <Link key={m.id} href={`/admin/acquisitions?q=${encodeURIComponent(m.county || "")}`} className="flex items-center gap-3 px-2 py-1.5 rounded-md text-xs hover:bg-[var(--surface-high)]">
                      <span className="font-semibold flex-1 truncate">{m.acres ? `${m.acres}ac` : "Parcel"} — {m.county}, {m.state}</span>
                      <span className="tabular-nums" style={{ color: "var(--muted)" }}>{fmt(m.minimum_bid)}</span>
                      <span className="tabular-nums font-bold" style={{ color: "var(--grade-a)" }}>{m.final_score ?? "—"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowForm(false)}>
          <div className="rounded-xl border w-full max-w-xl" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
              <span className="font-bold">Yeni kayıtlı arama</span>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Arama adı</span>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
              </label>
              {([
                ["states", "Eyaletler (virgülle, örn TX,FL)", "text"], ["county", "County", "text"],
                ["srcContains", "Kaynak içerir (örn tax)", "text"], ["minScore", "Min skor", "number"],
                ["minAcres", "Min acres", "number"], ["maxAcres", "Max acres", "number"],
                ["minBid", "Min teklif $", "number"], ["maxBid", "Max teklif $", "number"],
              ] as [keyof typeof blankForm, string, string][]).map(([k, label, type]) => (
                <label key={k} className="block">
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>{label}</span>
                  <input type={type} value={form[k] as string} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
                </label>
              ))}
              <label className="flex items-center gap-2 col-span-2 text-sm">
                <input type="checkbox" checked={form.hasOwner} onChange={(e) => setForm((p) => ({ ...p, hasOwner: e.target.checked }))} />
                Sadece sahibi ulaşılabilir olanlar
              </label>
              <label className="block col-span-2">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Alarm e-postası (opsiyonel · STUB)</span>
                <input value={form.notify_email} onChange={(e) => setForm((p) => ({ ...p, notify_email: e.target.value }))} placeholder="you@example.com" className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
              </label>
            </div>
            <div className="px-5 py-3.5 border-t flex justify-end gap-2" style={{ borderColor: "var(--surface-high)" }}>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface-high)" }}>İptal</button>
              <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: "var(--primary)", color: "var(--background)", opacity: saving || !form.name ? 0.6 : 1 }}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-[10px] leading-relaxed rounded-lg border border-dashed p-3" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
        <span className="font-semibold" style={{ color: "var(--foreground)" }}>Cron + e-posta TODO:</span> vercel.json&apos;a günlük cron ekle (örn <code>{"{ \"path\": \"/api/saved-searches/run-all\", \"schedule\": \"0 13 * * *\" }"}</code>), her kayıtlı aramayı çalıştırıp <code>newMatches</code>&apos;i Resend (RESEND_API_KEY) ile <code>notify_email</code>&apos;e gönder. Şu an çalıştırma yeni eşleşmeleri sadece UI&apos;da gösterir.
      </div>
    </div>
  );
}
