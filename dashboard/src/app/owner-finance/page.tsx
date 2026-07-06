"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet, MapPin, Ruler, CalendarClock, Percent, Loader2, ArrowRight,
  CheckCircle2, ShieldCheck, Mail,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC OWNER-FINANCE LISTINGS — read-only view of active installment offers.
// Pulls /api/owner-finance?status=active. English-facing (US market).
// 3. tur: Navbar/Footer eklendi (sayfa çıplaktı), kopya anasayfa vaatleriyle
// hizalandı (12-72 ay vade, erken kapatma cezasız, %10 nakit indirimi),
// "Inquire" CTA'sı alakasız /land-for-sale yerine konu satırlı mailto oldu.
// ─────────────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
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
  description: string | null;
}

const TRUST_POINTS = [
  "No banks, no credit checks",
  "Terms from 12 to 72 months",
  "Pay it off early anytime — no penalty",
  "Prefer cash? Pay in full and save 10%",
];

const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

export default function PublicOwnerFinance() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner-finance?status=active")
      .then((r) => r.json())
      .then((j) => setListings(j.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-14">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-[var(--secondary)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--secondary)]">Owner Financing</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">Land you can own with low money down</h1>
          <p className="text-base max-w-2xl mb-5" style={{ color: "var(--muted)" }}>
            We finance the land ourselves, so you don&apos;t need a mortgage or a perfect credit score.
            Put a little down and pay monthly — every parcel below is available on owner-financed terms.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "var(--muted)" }}>
            {TRUST_POINTS.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--secondary)]" /> {t}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading listings…
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-dashed border-slate-300" style={{ color: "var(--muted)" }}>
            <Wallet className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium mb-1">No owner-financed parcels available right now</p>
            <p className="text-xs mb-6">Check back soon — new inventory is added weekly.</p>
            <Link href="/properties" className="inline-flex items-center gap-2 px-6 py-3 rounded text-sm font-bold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md">
              Browse All Land for Sale <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l) => {
              const down = l.down_pct != null ? `${l.down_pct}% down` : l.down_payment != null ? `${fmt(l.down_payment)} down` : "Low down";
              const mailSubject = encodeURIComponent(`Owner-finance inquiry: ${l.title || [l.county, l.state].filter(Boolean).join(", ") || "parcel"}`);
              return (
                <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col transition-shadow hover:shadow-lg">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[var(--secondary)]">Owner Financed</div>
                  <h2 className="text-lg font-bold mb-2 leading-snug">
                    {l.title || `${l.acres ? l.acres + "-Acre" : "Parcel"}${l.county ? " — " + l.county + ", " + (l.state || "") : ""}`}
                  </h2>
                  <div className="flex items-center gap-4 text-xs mb-3" style={{ color: "var(--muted)" }}>
                    {(l.county || l.state) && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {[l.county, l.state].filter(Boolean).join(", ")}</span>}
                    {l.acres != null && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> {l.acres} ac</span>}
                  </div>
                  {l.description && <p className="text-sm mb-4 flex-1" style={{ color: "var(--muted)" }}>{l.description}</p>}

                  <div className="rounded-xl p-4 mb-4 border border-slate-200 bg-slate-50">
                    <div className="text-2xl font-extrabold tabular-nums text-[var(--secondary)]">{fmt(l.monthly_payment)}<span className="text-sm font-medium" style={{ color: "var(--muted)" }}>/mo</span></div>
                    <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                      <span>{down}</span>
                      {l.apr != null && <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" /> {l.apr}% APR</span>}
                      {l.term_months != null && <span className="flex items-center gap-0.5"><CalendarClock className="w-3 h-3" /> {l.term_months} mo</span>}
                    </div>
                    <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>Cash price {fmt(l.price)}</div>
                  </div>

                  {/* Owner-finance ilanlarının kendi detay sayfası yok — dürüst CTA: konu satırlı e-posta. */}
                  <a href={`mailto:hello@terralot.com?subject=${mailSubject}`}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-bold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md">
                    <Mail className="w-4 h-4" /> Inquire About This Parcel
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* Anasayfadaki finansman bölümüyle aynı dil: bankasız, kontrolsüz, sabit taksit. */}
        <div className="mt-14 rounded-2xl p-8 border border-[var(--secondary)]/15 bg-[var(--secondary)]/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-[var(--secondary)]" />
              <h2 className="text-xl font-bold">Looking for more land?</h2>
            </div>
            <p className="text-sm max-w-xl" style={{ color: "var(--muted)" }}>
              Every property we list can be bought with owner financing — reserve for free,
              no payment online, and exact terms are shown on each property page.
            </p>
          </div>
          <Link href="/properties" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded text-sm font-bold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md shrink-0">
            Browse Land for Sale <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
