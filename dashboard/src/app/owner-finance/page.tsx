"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, MapPin, Ruler, CalendarClock, Percent, Loader2, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC OWNER-FINANCE LISTINGS — read-only view of active installment offers.
// Pulls /api/owner-finance?status=active. English-facing (US market).
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
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>Owner Financing</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">Land you can own with low money down</h1>
          <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
            No banks, no credit hassle. Put a little down and pay monthly. Every parcel below is available on owner-financed terms.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading listings…
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
            <Wallet className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium mb-1">No owner-financed parcels available right now</p>
            <p className="text-xs">Check back soon — new inventory is added weekly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l) => {
              const down = l.down_pct != null ? `${l.down_pct}% down` : l.down_payment != null ? `${fmt(l.down_payment)} down` : "Low down";
              return (
                <div key={l.id} className="rounded-2xl border p-5 flex flex-col" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>Owner Financed</div>
                  <h2 className="text-lg font-bold mb-2 leading-snug">
                    {l.title || `${l.acres ? l.acres + "-Acre" : "Parcel"}${l.county ? " — " + l.county + ", " + (l.state || "") : ""}`}
                  </h2>
                  <div className="flex items-center gap-4 text-xs mb-3" style={{ color: "var(--muted)" }}>
                    {(l.county || l.state) && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {[l.county, l.state].filter(Boolean).join(", ")}</span>}
                    {l.acres != null && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> {l.acres} ac</span>}
                  </div>
                  {l.description && <p className="text-sm mb-4 flex-1" style={{ color: "var(--muted)" }}>{l.description}</p>}

                  <div className="rounded-xl p-4 mb-4" style={{ background: "var(--surface-high)" }}>
                    <div className="text-2xl font-extrabold tabular-nums" style={{ color: "var(--primary)" }}>{fmt(l.monthly_payment)}<span className="text-sm font-medium" style={{ color: "var(--muted)" }}>/mo</span></div>
                    <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                      <span>{down}</span>
                      {l.apr != null && <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" /> {l.apr}% APR</span>}
                      {l.term_months != null && <span className="flex items-center gap-0.5"><CalendarClock className="w-3 h-3" /> {l.term_months} mo</span>}
                    </div>
                    <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>Cash price {fmt(l.price)}</div>
                  </div>

                  <Link href="/land-for-sale" className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
                    Inquire <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
