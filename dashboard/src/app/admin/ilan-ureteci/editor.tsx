"use client";

import { useState } from "react";
import {
  Check, Copy, ExternalLink, Loader2, Rocket, Sparkles, AlertCircle, Wallet,
} from "lucide-react";
import type { BuyerListing } from "@/lib/listing-builder";

// ─────────────────────────────────────────────────────────────────────────────
// İLAN ÜRETECİ — ÖNİZLEME & YAYINLA (client). Server composer'ın ürettiği
// BuyerListing'i alır; admin başlık/açıklamayı gözden geçirip düzenler, öne
// çıkanlar + owner-finance taksit senaryosunu görür, tek tıkla /p sayfasına
// yayınlar (/api/admin/listing-publish). Tablo yoksa persisted:false → /p yine
// otomatik üretilen metni gösterir.
// ─────────────────────────────────────────────────────────────────────────────

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

interface Props {
  parcelId: string;
  pUrl: string;
  initial: BuyerListing;
}

export default function IlanUreteciEditor({ parcelId, pUrl, initial }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [note, setNote] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const bullets = initial.bullets;
  const financing = initial.financing;

  async function publish() {
    setState("saving");
    setErr("");
    try {
      const res = await fetch("/api/admin/listing-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelRef: parcelId, title, description, bullets }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) {
        setErr(j?.error === "rate_limited" ? "Çok fazla istek — biraz bekle." : j?.error || "Yayınlanamadı.");
        setState("error");
        return;
      }
      setPersisted(!!j.persisted);
      setNote(j.note || "");
      setState("saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bağlantı hatası.");
      setState("error");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(pUrl, window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setErr("Panoya kopyalanamadı.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Meta rozetleri */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold" style={{ background: "rgba(139,92,246,0.14)", color: "#8b5cf6" }}>
          <Sparkles className="h-3.5 w-3.5" /> Composer taslağı
        </span>
        <span className="rounded-full px-2.5 py-1" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>{initial.region}</span>
        {initial.cashPrice != null && (
          <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: "rgba(22,163,74,0.14)", color: "#16a34a" }}>
            Nakit {usd(initial.cashPrice)}
          </span>
        )}
      </div>

      {/* Başlık (editable) */}
      <div>
        <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Başlık</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-bold outline-none"
          style={{ borderColor: "var(--outline)" }}
        />
      </div>

      {/* Açıklama (editable) */}
      <div>
        <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Açıklama</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={6}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none"
          style={{ borderColor: "var(--outline)" }}
        />
      </div>

      {/* Öne çıkanlar */}
      <div>
        <div className="mb-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>Öne çıkanlar</div>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#16a34a" }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Konum / GIS özeti */}
      <div className="rounded-lg border border-dashed px-3 py-2 text-xs leading-relaxed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
        <span className="font-semibold" style={{ color: "var(--foreground)" }}>Konum & arazi: </span>
        {initial.locationSummary}
      </div>

      {/* Owner-finance taksit senaryoları */}
      {financing.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <Wallet className="h-4 w-4" style={{ color: "#16a34a" }} /> Owner-finance taksit senaryoları
          </div>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-bold">Plan</th>
                  <th className="px-3 py-2 text-right font-bold">Peşinat</th>
                  <th className="px-3 py-2 text-right font-bold">Aylık</th>
                  <th className="px-3 py-2 text-right font-bold">Vade</th>
                  <th className="px-3 py-2 text-right font-bold">Faiz</th>
                  <th className="px-3 py-2 text-right font-bold">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {financing.map((p) => (
                  <tr key={p.id ?? `${p.termMonths}-${p.annualRatePct}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 font-medium">{p.label ?? `${p.termMonths} ay`}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(p.downPayment)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "#16a34a" }}>{usd(p.monthlyPayment)}/ay</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.termMonths} ay</td>
                    <td className="px-3 py-2 text-right tabular-nums">%{p.annualRatePct}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(p.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
            Kanonik owner-finance amortisman presetleri (flip-calc). Alıcı /p sayfasında kendi peşinat/aylık planını da kurabilir.
          </p>
        </div>
      )}

      {/* Yayın çubuğu */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: "var(--outline)" }}>
        <button
          onClick={publish}
          disabled={state === "saving"}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "#16a34a" }}
        >
          {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {state === "saving" ? "Yayınlanıyor…" : "Kaydet & Yayınla"}
        </button>
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
        >
          {copied ? <Check className="h-4 w-4" style={{ color: "#16a34a" }} /> : <Copy className="h-4 w-4" />}
          {copied ? "Kopyalandı" : "/p linkini kopyala"}
        </button>
        <a
          href={pUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
        >
          <ExternalLink className="h-4 w-4" /> Satış sayfasını aç
        </a>
      </div>

      {state === "saved" && (
        <div className="rounded-lg p-3 text-sm" style={{ background: persisted ? "rgba(22,163,74,0.1)" : "rgba(234,179,8,0.12)", color: persisted ? "#16a34a" : "#b45309" }}>
          {persisted ? "✓ Yayınlandı — /p sayfası artık bu metni gösterir." : "⚠ Optimistik kaydedildi (kalıcı DEĞİL)."}
          {note && <div className="mt-1 text-[11px] opacity-90">{note}</div>}
        </div>
      )}
      {state === "error" && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          <AlertCircle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--muted)" }}>{initial.disclaimer}</p>
    </div>
  );
}
