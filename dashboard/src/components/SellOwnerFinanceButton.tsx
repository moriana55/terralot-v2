"use client";

import { useState } from "react";
import Link from "next/link";
import { Tag, Loader2, X, CheckCircle2, ExternalLink } from "lucide-react";
import { monthlyPayment } from "@/lib/flip-calc";

// ─────────────────────────────────────────────────────────────────────────────
// "OWNER-FINANCE İLE SAT" — al→sat döngüsünü kapatan buton (BUILD-PLANI #3).
//
// Ucuz arsa deal sayfasındaki GERÇEK veriden (marketValue/landValue, county,
// state, acres) bir owner-finance ilanı oluşturur. Resale fiyatı parselin
// piyasa değeridir (uydurma değil); peşinat/APR/vade owner-finance presetinden
// gelir; aylık ödeme flip-calc.ts amortismanıyla ÖNİZLEMEDE hesaplanır ve
// server (api/owner-finance) aynı formülle yeniden hesaplar. POST gerçek bir
// owner_finance_listings kaydı yazar → /owner-finance ve /admin/owner-finance'te
// görünür. Bağlanan döngü: ucuz-al (mektup) → pahalı-sat (taksit).
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  dealId: string;
  title: string;
  state: string | null;
  county: string | null;
  acres: number | null;
  marketValue: number | null; // resale = parselin gerçek piyasa/land değeri
  label?: string;             // buton metni (mailer'da "Bu parseli satışa koy")
}

const PRESETS = [
  { id: "default", label: "VegaLand Std", down_pct: 10, apr: 9.9, term_months: 60 },
  { id: "compass", label: "Compass-tarzı", down_pct: 10, apr: 7.9, term_months: 60 },
  { id: "landio", label: "LANDiO-tarzı", down_pct: 15, apr: 6.9, term_months: 84 },
];

const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

export default function SellOwnerFinanceButton({ dealId, title, state, county, acres, marketValue, label }: Props) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(marketValue && marketValue > 0 ? String(Math.round(marketValue)) : "");
  const [downPct, setDownPct] = useState(10);
  const [apr, setApr] = useState(9.9);
  const [term, setTerm] = useState(60);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | { id: string | null; monthly: number }>(null);
  const [err, setErr] = useState<string | null>(null);

  const priceNum = Number(price) || 0;
  const down = Math.round(priceNum * (downPct / 100));
  const financed = Math.max(0, priceNum - down);
  const monthlyPreview = monthlyPayment(financed, apr, term);

  async function create() {
    if (!priceNum) { setErr("Resale fiyatı gerekli (parselin piyasa değeri)."); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/owner-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _action: "create",
          title: `${title} — owner-finance`,
          parcel_ref: dealId,
          state, county, acres,
          price: priceNum,
          down_pct: downPct,
          apr, term_months: term,
          status: "active",
          description: `Taksitli (owner-finance) satış. Resale = parsel piyasa değeri ${fmt(marketValue)}. Ucuz arsa fırsatından oluşturuldu.`,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { setErr(j.error || "Oluşturulamadı"); setSaving(false); return; }
      setDone({ id: j.listing?.id ?? null, monthly: j.monthly ?? monthlyPreview });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "hata");
    }
    setSaving(false);
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setDone(null); setErr(null); }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: "var(--accent-ink,#8ED1DF)", color: "var(--background,#000)" }}>
        <Tag className="w-4 h-4" /> {label ?? "Owner-Finance ile Sat"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setOpen(false)}>
          <div className="rounded-xl border w-full max-w-lg" style={{ background: "var(--surface)", borderColor: "var(--surface-high,var(--outline))" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--outline)" }}>
              <span className="font-bold flex items-center gap-2"><Tag className="w-4 h-4" style={{ color: "var(--accent-ink)" }} /> Owner-Finance ile Sat</span>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>

            {done ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--grade-a,#16a34a)" }} />
                <p className="font-bold mb-1">İlan oluşturuldu</p>
                <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>
                  {fmt(priceNum)} resale · %{downPct} peşinat ({fmt(down)}) · %{apr} APR · {term}ay
                </p>
                <p className="text-sm mb-4">Aylık taksit: <b style={{ color: "var(--accent-ink)" }}>{fmt(done.monthly)}/ay</b></p>
                <div className="flex gap-2 justify-center">
                  <Link href="/admin/owner-finance" className="px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5" style={{ background: "var(--primary)", color: "var(--background)" }}>
                    İlanı gör <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-high,var(--outline))" }}>Kapat</button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                  Resale fiyatı parselin <b>gerçek piyasa değeri</b> ({fmt(marketValue)}). Şablon seç, aylık taksit aşağıda otomatik hesaplanır.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESETS.map((p) => {
                    const active = apr === p.apr && downPct === p.down_pct && term === p.term_months;
                    return (
                      <button key={p.id} type="button"
                        onClick={() => { setDownPct(p.down_pct); setApr(p.apr); setTerm(p.term_months); }}
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                        style={{ borderColor: active ? "var(--accent-ink)" : "var(--outline)", background: active ? "rgba(142,209,223,0.08)" : "transparent", color: active ? "var(--accent-ink)" : "var(--foreground)" }}>
                        {p.label} · %{p.apr}/{p.down_pct}%/{p.term_months}ay
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="block col-span-2">
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Resale fiyatı ($) — piyasa değeri</span>
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none tabular-nums" style={{ borderColor: "var(--outline)" }} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Peşinat % · {downPct}%</span>
                    <input type="range" min={5} max={30} step={1} value={downPct} onChange={(e) => setDownPct(Number(e.target.value))} className="w-full accent-[var(--accent-ink)]" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>APR % · {apr}%</span>
                    <input type="range" min={5} max={12} step={0.1} value={apr} onChange={(e) => setApr(Number(e.target.value))} className="w-full accent-[var(--accent-ink)]" />
                  </label>
                  <label className="block col-span-2">
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--muted)" }}>Vade (ay) · {term}</span>
                    <input type="range" min={24} max={120} step={12} value={term} onChange={(e) => setTerm(Number(e.target.value))} className="w-full accent-[var(--accent-ink)]" />
                  </label>
                </div>

                <div className="rounded-lg border p-3 mb-4 grid grid-cols-3 gap-2 text-center" style={{ borderColor: "var(--outline)", background: "var(--surface-low,transparent)" }}>
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Peşinat</div><div className="font-bold tabular-nums">{fmt(down)}</div></div>
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Finanse edilen</div><div className="font-bold tabular-nums">{fmt(financed)}</div></div>
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Aylık taksit</div><div className="font-bold tabular-nums" style={{ color: "var(--accent-ink)" }}>{fmt(monthlyPreview)}</div></div>
                </div>

                {err && <p className="text-xs mb-3" style={{ color: "var(--error)" }}>{err}</p>}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface-high,var(--outline))" }}>İptal</button>
                  <button onClick={create} disabled={saving || !priceNum} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: "var(--primary)", color: "var(--background)", opacity: saving || !priceNum ? 0.6 : 1 }}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} İlanı oluştur
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
