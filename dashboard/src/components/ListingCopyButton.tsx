"use client";

import { useState } from "react";
import { FileText, Loader2, Copy, Check, AlertCircle, Sparkles, FilePen } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// "📝 SATILIK İLAN METNİ ÜRET" — deal sayfasındaki GERÇEK veriden LANDiO-tarzı
// satışa-hazır ilan metni üretir (/api/admin/listing-copy). Region-aware:
// AZ çöl → off-grid/RV; FL platted → mobil/modüler ev + RV-living kısıtı.
//
// AI-vs-şablon: OPENAI_API_KEY varsa metin AI-cilalı (✨), yoksa deterministik
// şablon (📝). Her iki durumda da dürüst zoning/izin şerhi taşınır. Metin
// TASLAK — yayınlamadan gözden geçir; zone/izin alıcıya doğrulatılır.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  acres: number | null;
  county: string | null;
  state: string | null;
  situs: string | null;
  marketValue: number | null;
}

interface Listing {
  title: string;
  description: string;
  bullets: string[];
}

interface ApiResult {
  listing: Listing;
  source: "ai" | "template";
  aiAvailable: boolean;
  region: string;
  confidence: "high" | "medium" | "low";
  disclaimer?: string;
}

export default function ListingCopyButton({ acres, county, state, situs, marketValue }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setErr(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/listing-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acres, county, state, situs, marketValue }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.listing) {
        setErr(j?.error === "rate_limited" ? "Çok fazla istek — biraz bekle." : j?.error || "İlan metni üretilemedi.");
        setLoading(false);
        return;
      }
      setData(j as ApiResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bağlantı hatası.");
    }
    setLoading(false);
  }

  async function copyAll() {
    if (!data) return;
    const text = `${data.listing.title}\n\n${data.listing.description}\n\n${data.listing.bullets.map((b) => `• ${b}`).join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr("Panoya kopyalanamadı (tarayıcı izni gerekli).");
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {loading ? "Üretiliyor…" : "📝 Satılık ilan metni üret"}
      </button>

      {err && (
        <div className="mt-3 rounded-lg p-3 text-sm flex items-center gap-2" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {data && (
        <div className="mt-4 rounded-xl border p-5" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                style={
                  data.source === "ai"
                    ? { background: "rgba(139,92,246,0.14)", color: "#8b5cf6" }
                    : { background: "rgba(59,130,246,0.12)", color: "#3b82f6" }
                }
              >
                {data.source === "ai" ? <><Sparkles className="w-3 h-3" /> AI-CİLALI</> : <><FilePen className="w-3 h-3" /> ŞABLON</>}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-high,var(--outline))", color: "var(--muted)" }}>
                {data.region}
              </span>
            </div>
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: copied ? "rgba(22,163,74,0.14)" : "var(--surface-high,var(--outline))", color: copied ? "#16a34a" : "var(--foreground)" }}
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Kopyalandı</> : <><Copy className="w-3.5 h-3.5" /> 📋 Kopyala</>}
            </button>
          </div>

          <h3 className="font-bold text-base mb-2">{data.listing.title}</h3>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--foreground)" }}>{data.listing.description}</p>
          <ul className="space-y-1.5 mb-3">
            {data.listing.bullets.map((bl, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: "var(--foreground)" }}>
                <span style={{ color: "#8b5cf6" }}>•</span>
                <span>{bl}</span>
              </li>
            ))}
          </ul>

          <p className="text-[11px] mt-3 pt-3 border-t" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
            ⚠ Metin <b>taslak</b> — yayınlamadan gözden geçir; zone/izin alıcıya doğrulatılır.
            {!data.aiAvailable && " (OPENAI_API_KEY ayarlanınca AI-cilalı metin gelir.)"}
          </p>
        </div>
      )}
    </div>
  );
}
