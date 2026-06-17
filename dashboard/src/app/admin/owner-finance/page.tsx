"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, Plus, Trash2, Loader2, ShieldCheck, X, ExternalLink } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// OWNER-FINANCE MARKETPLACE (admin) — manage listings + run credit-screening STUB.
// Public-ish read view lives at /owner-finance (status=active only).
// ─────────────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  parcel_ref: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  price: number;
  down_payment: number | null;
  down_pct: number | null;
  apr: number | null;
  term_months: number | null;
  monthly_payment: number | null;
  status: string;
  description: string | null;
  updated_at: string;
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--muted)", active: "var(--grade-a)", reserved: "var(--warn)", sold: "var(--accent-ink)", archived: "var(--outline)",
};

const blankForm = {
  title: "", state: "", county: "", acres: "", price: "", down_pct: "10", apr: "9.9", term_months: "60", status: "active", description: "", parcel_ref: "",
};

export default function OwnerFinancePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(blankForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/owner-finance");
    const j = await r.json();
    setListings(j.listings || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      _action: editId ? "update" : "create",
      id: editId || undefined,
      title: form.title || null,
      state: form.state || null,
      county: form.county || null,
      acres: form.acres ? Number(form.acres) : null,
      price: Number(form.price),
      down_pct: form.down_pct ? Number(form.down_pct) : null,
      apr: form.apr ? Number(form.apr) : null,
      term_months: form.term_months ? Number(form.term_months) : null,
      status: form.status,
      description: form.description || null,
      parcel_ref: form.parcel_ref || null,
    };
    await fetch("/api/owner-finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    setShowForm(false);
    setForm(blankForm);
    setEditId(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Listeyi sil?")) return;
    await fetch("/api/owner-finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete", id }) });
    load();
  };

  const edit = (l: Listing) => {
    setEditId(l.id);
    setForm({
      title: l.title || "", state: l.state || "", county: l.county || "", acres: l.acres?.toString() || "",
      price: l.price.toString(), down_pct: l.down_pct?.toString() || "", apr: l.apr?.toString() || "",
      term_months: l.term_months?.toString() || "", status: l.status, description: l.description || "", parcel_ref: l.parcel_ref || "",
    });
    setShowForm(true);
  };

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Owner-Finance Pazaryeri
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Taksitli satışa sunulan parseller. <Link href="/owner-finance" className="underline" style={{ color: "var(--accent-ink)" }}>Herkese açık görünüm →</Link>
          </p>
        </div>
        <button onClick={() => { setEditId(null); setForm(blankForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--primary)", color: "var(--background)" }}>
          <Plus className="w-4 h-4" /> Yeni Liste
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> yükleniyor…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
          <p className="text-sm font-medium mb-1">Henüz liste yok</p>
          <p className="text-xs">add_innovation_features_batch2.sql çalıştır, sonra &quot;Yeni Liste&quot; ile ekle.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                {["Parsel", "Fiyat", "Peşinat", "APR", "Vade", "Aylık", "Durum", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b hover:bg-[var(--surface-low)] cursor-pointer" style={{ borderColor: "var(--surface-high)" }} onClick={() => edit(l)}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{l.title || `${l.acres ? l.acres + "ac" : "Parcel"} — ${l.county}, ${l.state}`}</div>
                    {l.parcel_ref && <div className="text-[10px]" style={{ color: "var(--muted)" }}>ref {l.parcel_ref.slice(0, 8)}…</div>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold">{fmt(l.price)}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">{l.down_pct != null ? `${l.down_pct}%` : fmt(l.down_payment)}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">{l.apr != null ? `${l.apr}%` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">{l.term_months ?? "—"} ay</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums font-semibold" style={{ color: "var(--accent-ink)" }}>{fmt(l.monthly_payment)}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "var(--surface-high)", color: STATUS_COLORS[l.status] || "var(--muted)" }}>{l.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); del(l.id); }} className="p-1.5 rounded-md hover:bg-[var(--surface-high)]"><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowForm(false)}>
          <div className="rounded-xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
              <span className="font-bold">{editId ? "Listeyi düzenle" : "Yeni liste"}</span>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {([
                ["title", "Başlık", "text"], ["parcel_ref", "Parsel ref (lead id)", "text"],
                ["state", "Eyalet", "text"], ["county", "County", "text"],
                ["acres", "Acres", "number"], ["price", "Fiyat ($)", "number"],
                ["down_pct", "Peşinat %", "number"], ["apr", "APR %", "number"],
                ["term_months", "Vade (ay)", "number"],
              ] as [string, string, string][]).map(([k, label, type]) => (
                <label key={k} className="block">
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>{label}</span>
                  <input type={type} value={form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
                </label>
              ))}
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Durum</span>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }}>
                  {["draft", "active", "reserved", "sold", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block col-span-2">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Açıklama</span>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none" style={{ borderColor: "var(--outline)" }} />
              </label>
            </div>
            <div className="px-5 py-3.5 border-t flex justify-end gap-2" style={{ borderColor: "var(--surface-high)" }}>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface-high)" }}>İptal</button>
              <button onClick={save} disabled={saving || !form.price} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: "var(--primary)", color: "var(--background)", opacity: saving || !form.price ? 0.6 : 1 }}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      <CreditScreener />
    </div>
  );
}

// ── Credit screening STUB widget ──────────────────────────────────────────────
function CreditScreener() {
  const [f, setF] = useState({ monthlyIncome: "5000", monthlyDebt: "1200", downAmount: "2000", price: "20000", monthlyPaymentEst: "380", yearsEmployed: "3", priorDefaults: "0" });
  const [res, setRes] = useState<null | { score: number; tier: string; decision: string; factors: { label: string; value: string; ok: boolean }[]; disclaimer: string }>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const r = await fetch("/api/owner-finance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "screen", ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)])) }),
    });
    const j = await r.json();
    setRes(j.screening);
    setLoading(false);
  };

  const decColor = res?.decision === "APPROVE" ? "var(--grade-a)" : res?.decision === "REVIEW" ? "var(--warn)" : "var(--error)";

  return (
    <div className="mt-8 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
        <span className="text-sm font-bold">Alıcı Ön-Kredi Taraması (STUB)</span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>Self-reported girdilerden kural-tabanlı skor. Gerçek kredi kararı değil — bureau entegrasyonu TODO.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {([
          ["monthlyIncome", "Aylık gelir $"], ["monthlyDebt", "Aylık borç $"], ["downAmount", "Peşinat $"], ["price", "Fiyat $"],
          ["monthlyPaymentEst", "Tahmini ödeme $"], ["yearsEmployed", "İş tenür (yıl)"], ["priorDefaults", "Geçmiş temerrüt"],
        ] as [string, string][]).map(([k, label]) => (
          <label key={k} className="block">
            <span className="text-[10px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>{label}</span>
            <input type="number" value={f[k as keyof typeof f]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm border bg-transparent outline-none tabular-nums" style={{ borderColor: "var(--outline)" }} />
          </label>
        ))}
        <button onClick={run} disabled={loading} className="self-end px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "var(--primary)", color: "var(--background)" }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tara"}
        </button>
      </div>
      {res && (
        <div className="rounded-lg border p-4 flex flex-wrap items-center gap-6" style={{ borderColor: "var(--surface-high)" }}>
          <div>
            <div className="text-3xl font-extrabold tabular-nums" style={{ color: decColor }}>{res.score}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{res.tier}</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: decColor }}>{res.decision}</div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>karar</div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1">
            {res.factors.map((x) => (
              <div key={x.label} className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--muted)" }}>{x.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: x.ok ? "var(--grade-a)" : "var(--error)" }}>{x.value}</span>
              </div>
            ))}
          </div>
          <p className="w-full text-[10px] pt-2 border-t" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>{res.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
