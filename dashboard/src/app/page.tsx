"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Target, Mail, DollarSign, Map,
  Split, Wallet, BarChart3, Users, Zap, Shield, Star,
  ChevronRight, Eye, Send, TrendingUp, Layers,
} from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState<"starter" | "pro" | "agency">("pro");

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    // Lead'i gerçekten kaydet (önceden hiçbir yere POST etmiyordu → e-posta kayboluyordu)
    try {
      await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: "waitlist", propertyTitle: "Ana Sayfa Waitlist", name: email.split("@")[0] || "Waitlist", email, message: "Waitlist kaydı (ana sayfa)" }),
      });
    } catch { /* UX'i bloklama */ }
  };

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0f", color: "#f0f0f5" }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold">Terra<span style={{ color: "#8ed1df" }}>Lot</span></span>
          <div className="hidden md:flex items-center gap-8">
            {["Features", "Pricing", "How It Works"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="text-sm transition-colors hover:text-white" style={{ color: "#888" }}>{l}</a>
            ))}
          </div>
          <a href="#waitlist" className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105" style={{ background: "#8ed1df", color: "#000" }}>
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(142,209,223,0.15) 0%, transparent 60%)" }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8" style={{ background: "rgba(142,209,223,0.1)", color: "#8ed1df", border: "1px solid rgba(142,209,223,0.2)" }}>
            <Zap className="w-3.5 h-3.5" /> Coming Soon — Join the Waitlist
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            The All-in-One Platform for{" "}
            <span style={{ color: "#8ed1df" }}>Land Flippers</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: "#888" }}>
            Find off-market deals, send direct mail, manage subdivisions, track owner financing, and close more deals — all from one dashboard.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#waitlist" className="px-8 py-3.5 rounded-lg text-sm font-bold transition-all hover:scale-105 flex items-center gap-2" style={{ background: "#8ed1df", color: "#000" }}>
              Get Early Access <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#features" className="px-8 py-3.5 rounded-lg text-sm font-semibold transition-all hover:bg-white/5 flex items-center gap-2" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#ccc" }}>
              See Features
            </a>
          </div>
          <div className="mt-12 flex items-center justify-center gap-8 text-sm" style={{ color: "#666" }}>
            {["No spreadsheets", "No juggling 5 tools", "No missed payments"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color: "#8ed1df" }} /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#8ed1df" }}>The Problem</p>
            <h2 className="text-3xl md:text-4xl font-bold">You{"'"}re running a land business<br />with duct tape and spreadsheets</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { old: "Prycd for comps", pain: "No pipeline", icon: BarChart3 },
              { old: "Lob for mail", pain: "No tracking", icon: Mail },
              { old: "GeekPay for payments", pain: "No overview", icon: DollarSign },
            ].map(p => (
              <div key={p.old} className="rounded-xl p-6 text-center" style={{ background: "rgba(255,80,80,0.04)", border: "1px solid rgba(255,80,80,0.1)" }}>
                <p.icon className="w-8 h-8 mx-auto mb-3" style={{ color: "#ff5050" }} />
                <p className="font-semibold mb-1">{p.old}</p>
                <p className="text-sm" style={{ color: "#888" }}>{p.pain}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <ChevronRight className="w-6 h-6 mx-auto rotate-90 mb-4" style={{ color: "#8ed1df" }} />
            <p className="text-2xl font-bold">TerraLot replaces them <span style={{ color: "#8ed1df" }}>all</span>.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#8ed1df" }}>Features</p>
            <h2 className="text-3xl md:text-4xl font-bold">Everything you need to flip land,<br />in one place</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Target, title: "Acquisition Pipeline", desc: "Find off-market deals from tax deeds, direct mail, absentee lists, and driving for dollars. Track every lead from research to closing.", color: "#8ed1df" },
              { icon: Mail, title: "Direct Mail Campaigns", desc: "Send mailers with Lob API integration. Track response rates, cost per lead, and follow-up sequences automatically.", color: "#3980f4" },
              { icon: Map, title: "Parcel Mapping", desc: "Satellite views, parcel boundaries, topo maps, and property data overlays. See every deal on the map.", color: "#50dc8c" },
              { icon: Split, title: "Subdivision Tracker", desc: "Manage minor splits and major subdivisions. Track each sub-parcel from available to sold with ROI calculations.", color: "#ffb43c" },
              { icon: Wallet, title: "Owner Financing", desc: "Track every buyer's payments — monthly installments, late payments, defaults, and reclaims. Built-in amortization.", color: "#ff9632" },
              { icon: Users, title: "Referral Program", desc: "Manage referral partners — agents, investors, wholesalers. Track commissions, payouts, and conversion rates.", color: "#ff5050" },
              { icon: Eye, title: "Off-Market Hunting", desc: "Scrape county records, find absentee owners, identify tax-delinquent parcels. Your competitive edge.", color: "#8ed1df" },
              { icon: Send, title: "Buyer Website", desc: "Beautiful property listing pages with owner financing calculator. Capture leads and convert buyers 24/7.", color: "#3980f4" },
              { icon: TrendingUp, title: "Financial Dashboard", desc: "Revenue, expenses, ROI, cash flow — see your entire land business at a glance. Know your numbers.", color: "#50dc8c" },
            ].map(f => (
              <div key={f.title} className="rounded-xl p-6 transition-all hover:scale-[1.02]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <f.icon className="w-8 h-8 mb-4" style={{ color: f.color }} />
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#888" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#8ed1df" }}>How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold">From raw land to recurring revenue</h2>
          </div>
          <div className="space-y-0">
            {[
              { step: "01", title: "Find Off-Market Deals", desc: "Pull tax-delinquent lists, absentee owner data, and county records. Our tools help you find deals nobody else sees.", icon: Target },
              { step: "02", title: "Send Direct Mail", desc: "Launch targeted mail campaigns to motivated sellers. Track response rates and automate follow-ups.", icon: Mail },
              { step: "03", title: "Acquire & Subdivide", desc: "Close the deal, split the land if needed. Track every sub-parcel's status, cost basis, and target price.", icon: Split },
              { step: "04", title: "List & Sell", desc: "Publish to your branded buyer website with satellite maps, parcel boundaries, and financing calculator.", icon: Map },
              { step: "05", title: "Collect Payments", desc: "Owner-finance your sales and collect monthly payments. Track every buyer, every payment, every dollar.", icon: DollarSign },
            ].map((s, i) => (
              <div key={s.step} className="flex gap-6 py-8" style={{ borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                <div className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: "rgba(142,209,223,0.1)", color: "#8ed1df" }}>
                  {s.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#888" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6 text-center">
            {[
              { value: "50K+", label: "Land flippers in the US" },
              { value: "$200-500", label: "Monthly tool spend (avg)" },
              { value: "5+", label: "Tools you're juggling" },
              { value: "1", label: "Platform to replace them all" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold" style={{ color: "#8ed1df" }}>{s.value}</p>
                <p className="text-sm mt-1" style={{ color: "#888" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#8ed1df" }}>Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold">Less than what you{"'"}re paying now</h2>
            <p className="text-sm mt-3" style={{ color: "#888" }}>Replace 5+ tools with one platform</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                key: "starter" as const, name: "Starter", price: 99, desc: "For new land flippers getting started",
                features: ["Acquisition pipeline", "Up to 50 leads", "Direct mail integration", "Buyer website (1)", "Basic analytics", "Email support"],
              },
              {
                key: "pro" as const, name: "Pro", price: 199, desc: "For active flippers doing 5+ deals/year", badge: "Most Popular",
                features: ["Everything in Starter", "Unlimited leads", "Subdivision tracker", "Owner financing manager", "Referral program", "Mail campaign analytics", "Parcel mapping (satellite)", "Priority support"],
              },
              {
                key: "agency" as const, name: "Agency", price: 399, desc: "For teams and high-volume operators",
                features: ["Everything in Pro", "Multi-user (5 seats)", "White-label buyer site", "API access", "Custom domain", "Dedicated support", "Bulk mail pricing"],
              },
            ].map(p => {
              const popular = p.key === "pro";
              return (
                <div key={p.key} className="rounded-xl p-6 relative transition-all hover:scale-[1.02]"
                  style={{
                    background: popular ? "rgba(142,209,223,0.06)" : "rgba(255,255,255,0.03)",
                    border: popular ? "2px solid rgba(142,209,223,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                  {p.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase" style={{ background: "#8ed1df", color: "#000" }}>
                      {p.badge}
                    </span>
                  )}
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-sm mt-1 mb-4" style={{ color: "#888" }}>{p.desc}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold" style={{ color: popular ? "#8ed1df" : "#f0f0f5" }}>${p.price}</span>
                    <span className="text-sm" style={{ color: "#888" }}>/month</span>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
                        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#8ed1df" }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <a href="#waitlist" className="block text-center py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                    style={{
                      background: popular ? "#8ed1df" : "rgba(255,255,255,0.06)",
                      color: popular ? "#000" : "#ccc",
                      border: popular ? "none" : "1px solid rgba(255,255,255,0.1)",
                    }}>
                    Join Waitlist
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section id="waitlist" className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-2xl p-10" style={{ background: "rgba(142,209,223,0.04)", border: "1px solid rgba(142,209,223,0.15)" }}>
            <Layers className="w-12 h-12 mx-auto mb-4" style={{ color: "#8ed1df" }} />
            <h2 className="text-3xl font-bold mb-3">Get Early Access</h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "#888" }}>
              Be the first to try TerraLot. Early members get <strong style={{ color: "#8ed1df" }}>50% off</strong> for the first 6 months.
            </p>
            {submitted ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <CheckCircle2 className="w-5 h-5" style={{ color: "#50dc8c" }} />
                <span className="font-semibold" style={{ color: "#50dc8c" }}>You{"'"}re on the list! We{"'"}ll be in touch soon.</span>
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="flex gap-3 max-w-md mx-auto">
                <input
                  type="email" required placeholder="you@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg text-sm outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0f5" }}
                />
                <button type="submit" className="px-6 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 shrink-0" style={{ background: "#8ed1df", color: "#000" }}>
                  Join Waitlist
                </button>
              </form>
            )}
            <p className="text-xs mt-4" style={{ color: "#555" }}>No spam. We{"'"}ll only email you when we launch.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold">Terra<span style={{ color: "#8ed1df" }}>Lot</span></span>
          <p className="text-xs" style={{ color: "#555" }}>© 2026 TerraLot. All rights reserved.</p>
          <div className="flex gap-6 text-xs" style={{ color: "#666" }}>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:hello@terralot.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
