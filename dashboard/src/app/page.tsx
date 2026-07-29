"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Search, MapPin, Wallet, FileText,
  ShieldCheck, Percent, CalendarClock, Loader2, Mail,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { getProperties, type Property } from "@/lib/data";

// ─────────────────────────────────────────────────────────────────────────────
// ALICIYA DÖNÜK ANASAYFA (vitrin). Eski kök sayfa "land flipper'lara SaaS"
// satan bir waitlist landing'iydi — arazi ALICISI buraya gelince yazılım
// fiyatlandırması görüyordu ve Navbar'ın /#how-it-works, /#financing linkleri
// kopuktu. Bu sürüm: hero + öne çıkan ilanlar + nasıl çalışır + owner
// financing bölümü. Eski SaaS landing gerekirse git geçmişinde.
// ─────────────────────────────────────────────────────────────────────────────

const BUY_STEPS = [
  {
    icon: Search,
    title: "Browse Land",
    desc: "Explore vacant land across the US with satellite maps, parcel boundaries, and full property details.",
  },
  {
    icon: FileText,
    title: "Reserve for Free",
    desc: "Found the one? Submit a reservation request — no payment online, no credit check, no obligation.",
  },
  {
    icon: Wallet,
    title: "Sign & Pay Your Way",
    desc: "We send the purchase agreement. Pay cash for a discount, or start low monthly payments with owner financing.",
  },
  {
    icon: MapPin,
    title: "It's Your Land",
    desc: "Use it while you pay it off. Camp on it, build on it, or hold it as an investment.",
  },
];

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Clear Title Guaranteed" },
  { icon: Percent, label: "No Credit Check" },
  { icon: CalendarClock, label: "Flexible Terms up to 72 Months" },
  { icon: Wallet, label: "Low Down Payments" },
];

export default function Home() {
  const [featured, setFeatured] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProperties().then(rows => {
      if (cancelled) return;
      const available = rows.filter(p => p.status !== "sold");
      const picks = [...available.filter(p => p.featured), ...available.filter(p => !p.featured)].slice(0, 6);
      setFeatured(picks);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    // Lead tek huniye yazılır (parcel_inquiries) — admin "Alıcı Talepleri"nde görünür.
    try {
      await fetch("/api/parcel-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId: "waitlist",
          parcelTitle: "New Listing Alerts (anasayfa)",
          name: email.split("@")[0] || "Subscriber",
          email,
          message: "New listing alerts signup (homepage)",
          source: "ana-sayfa-bulten",
        }),
      });
    } catch { /* UX'i bloklama */ }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-60 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(0,108,73,0.08) 0%, transparent 60%)" }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border border-[var(--secondary)]/20 bg-[var(--secondary)]/5 text-[var(--secondary)]">
            <ShieldCheck className="w-3.5 h-3.5" /> Owner Financing — No Banks, No Credit Checks
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-[var(--foreground)]">
            Own Land in America,{" "}
            <span className="text-[var(--secondary)]">Starting Under $100/Month</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>
            Affordable vacant land with easy owner financing. Pick your parcel, reserve it for free,
            and start monthly payments — the land is yours to use from day one.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/properties" className="px-8 py-3.5 rounded text-sm font-bold transition-all hover:opacity-90 flex items-center gap-2 bg-[var(--primary)] text-white shadow-md">
              Browse Land for Sale <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="px-8 py-3.5 rounded text-sm font-semibold transition-colors hover:bg-slate-50 flex items-center gap-2 border border-slate-300 bg-white text-[var(--primary)]">
              How It Works
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm" style={{ color: "var(--muted)" }}>
            {TRUST_POINTS.map(t => (
              <span key={t.label} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--secondary)]" /> {t.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 px-6" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 text-[var(--secondary)]">Featured Land</p>
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">Fresh parcels, ready to reserve</h2>
            </div>
            <Link href="/properties" className="text-sm font-semibold flex items-center gap-1 text-[var(--secondary)] hover:underline shrink-0">
              View all properties <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: "var(--muted)" }}>
              <Loader2 className="w-5 h-5 animate-spin" /> Loading properties…
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-slate-300">
              <MapPin className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" />
              <p className="text-sm font-semibold mb-1 text-[var(--foreground)]">New listings are on the way</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                We add new parcels weekly. Leave your email below and we&apos;ll let you know first.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-[var(--secondary)]">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--foreground)]">Owning land is simpler than you think</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BUY_STEPS.map((s, i) => (
              <div key={s.title} className="rounded-xl p-6 border border-slate-200 bg-white transition-shadow hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--secondary)]/10">
                    <s.icon className="w-5 h-5 text-[var(--secondary)]" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Step {i + 1}</span>
                </div>
                <h3 className="font-bold mb-2 text-[var(--foreground)]">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Owner Financing */}
      <section id="financing" className="py-20 px-6 scroll-mt-16" style={{ background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-[var(--secondary)]">Owner Financing</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-5 text-[var(--foreground)]">No banks. No credit checks.<br />Just monthly payments.</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--muted)" }}>
              We finance the land ourselves, so you don&apos;t need a mortgage or a perfect credit score.
              Put down a small deposit, choose a term that fits your budget, and the parcel is reserved
              in your name while you pay it off.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Low down payments — often just a few hundred dollars",
                "Fixed monthly payments, terms from 12 to 72 months",
                "Pay it off early anytime with no penalty",
                "Prefer cash? Pay in full and save 10%",
              ].map(t => (
                <li key={t} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--muted)" }}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--secondary)]" /> {t}
                </li>
              ))}
            </ul>
            <Link href="/properties" className="inline-flex items-center gap-2 px-6 py-3 rounded text-sm font-bold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md">
              Find Your Parcel <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Örnek plan kartı — belirli bir ilana bağlı değil, temsili aralıklar */}
          <div className="rounded-2xl p-8 border border-slate-200 bg-white shadow-xl">
            <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "var(--muted)" }}>A Typical Deal Looks Like</p>
            <div className="space-y-4">
              {[
                { label: "Down payment", value: "$250 – $1,000" },
                { label: "Monthly payment", value: "$99 – $350" },
                { label: "Term", value: "12 – 72 months" },
                { label: "Credit check", value: "None" },
                { label: "Hidden fees", value: "None" },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-baseline gap-3 text-sm border-b border-slate-100 pb-3">
                  <span style={{ color: "var(--muted)" }}>{r.label}</span>
                  <span className="font-bold text-right text-[var(--foreground)]">{r.value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-5 leading-relaxed" style={{ color: "var(--muted)" }}>
              Exact terms are listed on every property page — what you see is what you pay.
            </p>
          </div>
        </div>
      </section>

      {/* Listing Alerts */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-2xl p-8 md:p-10 border border-[var(--secondary)]/15 bg-[var(--secondary)]/5">
            <Mail className="w-10 h-10 mx-auto mb-4 text-[var(--secondary)]" />
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-[var(--foreground)]">Be first to see new land</h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "var(--muted)" }}>
              The best parcels go fast. Get an email when we list new properties — nothing else.
            </p>
            {submitted ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--secondary)]" />
                <span className="font-semibold text-[var(--secondary)]">You&apos;re on the list!</span>
              </div>
            ) : (
              <form onSubmit={handleAlerts} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email" required placeholder="you@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 rounded text-sm border border-slate-300 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none"
                />
                <button type="submit" className="px-6 py-3 rounded text-sm font-bold transition-all hover:opacity-90 shrink-0 bg-[var(--primary)] text-white shadow-md">
                  Notify Me
                </button>
              </form>
            )}
            <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>No spam — only new listings. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
