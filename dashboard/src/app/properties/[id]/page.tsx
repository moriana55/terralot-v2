"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin, Maximize, ChevronLeft, ChevronRight, ArrowRight,
  Shield, CheckCircle2, Phone, Mail, DollarSign, Clock, Map,
  Trees, Route, Zap, FileText, Share2, CreditCard, Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import FavoriteButton from "@/components/FavoriteButton";
import InquiryModal from "@/components/InquiryModal";
import ReserveModal from "@/components/ReserveModal";
import { getPropertyById, getProperties, type Property } from "@/lib/data";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [property, setProperty] = useState<Property | null>(null);
  const [similar, setSimilar] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [calcTerm, setCalcTerm] = useState(48);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showReserve, setShowReserve] = useState(false);

  // İlan + benzer ilanlar Supabase'den (/api/listings) çekilir.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [prop, all] = await Promise.all([getPropertyById(id), getProperties()]);
      if (cancelled) return;
      setProperty(prop);
      if (prop) {
        setCalcTerm(prop.term || 48);
        const sim = all.filter(x => x.id !== prop.id && x.state === prop.state).slice(0, 3);
        if (sim.length < 3) {
          const more = all.filter(x => x.id !== prop.id && !sim.includes(x)).slice(0, 3 - sim.length);
          sim.push(...more);
        }
        setSimilar(sim);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-5 h-5 animate-spin" /> Loading property…
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Property Not Found</h1>
          <Link href="/properties" className="text-sm" style={{ color: "var(--primary)" }}>Back to listings</Link>
        </div>
      </div>
    );
  }

  const p = property;
  const principal = p.price - p.downPayment;
  const monthlyRate = p.interestRate / 100 / 12;
  const monthly = calcTerm > 0 && monthlyRate > 0
    ? Math.round(principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -calcTerm)))
    : calcTerm > 0 ? Math.round(principal / calcTerm) : 0;

  const details = [
    { icon: MapPin, label: "Location", value: `${p.county} County, ${p.state}` },
    { icon: Maximize, label: "Size", value: `${p.acres} Acres` },
    { icon: Map, label: "Zoning", value: p.zoning },
    { icon: Trees, label: "Terrain", value: p.terrain },
    { icon: Route, label: "Road Access", value: p.roadAccess },
    { icon: Zap, label: "Utilities", value: p.utilities },
    { icon: FileText, label: "APN", value: p.apn },
    { icon: DollarSign, label: "Price", value: `$${p.price.toLocaleString()}` },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="pt-16">
        {/* Breadcrumb */}
        <div className="border-b border-slate-200 py-3" style={{ background: "var(--surface-low)" }}>
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            <Link href="/" className="hover:text-[var(--secondary)]">Home</Link>
            <span>/</span>
            <Link href="/properties" className="hover:text-[var(--secondary)]">Properties</Link>
            <span>/</span>
            <span style={{ color: "var(--foreground)" }}>{p.title}</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left — Images + Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Gallery */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                <img src={p.images[imgIdx]} alt={p.title} className="w-full h-[400px] md:h-[500px] object-cover" />
                {p.images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx(i => (i - 1 + p.images.length) % p.images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 bg-black/40 hover:bg-black/60 transition-colors">
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={() => setImgIdx(i => (i + 1) % p.images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 bg-black/40 hover:bg-black/60 transition-colors">
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {p.images.map((_, i) => (
                        <button key={i} onClick={() => setImgIdx(i)}
                          className="w-2.5 h-2.5 rounded-full transition-all"
                          style={{ background: i === imgIdx ? "var(--secondary)" : "rgba(255,255,255,0.4)" }} />
                      ))}
                    </div>
                  </>
                )}
                {p.status === "pending" && (
                  <span className="absolute top-4 left-4 px-3 py-1.5 rounded text-xs font-bold uppercase bg-[var(--error)] text-white">
                    Sale Pending
                  </span>
                )}
              </div>

              {/* Thumbnails */}
              {p.images.length > 1 && (
                <div className="flex gap-3">
                  {p.images.map((img, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className="w-20 h-14 rounded overflow-hidden border-2 transition-all"
                      style={{ borderColor: i === imgIdx ? "var(--secondary)" : "transparent", opacity: i === imgIdx ? 1 : 0.6 }}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Title + Actions */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--foreground)]">{p.title}</h1>
                  <p className="flex items-center gap-1 mt-2 text-sm" style={{ color: "var(--muted)" }}>
                    <MapPin className="w-4 h-4 text-[var(--secondary)]" /> {p.county} County, {p.state}
                  </p>
                </div>
                <div className="flex gap-2">
                  <FavoriteButton propertyId={p.id} />
                  <button className="h-10 px-4 rounded flex items-center gap-2 text-sm border border-slate-300 bg-white text-[var(--primary)] transition-colors hover:bg-slate-50">
                    <Share2 className="w-4 h-4 text-[var(--secondary)]" /> Share
                  </button>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2">
                {p.features.map(f => (
                  <span key={f} className="px-3 py-1.5 rounded text-xs font-semibold border border-slate-200 bg-slate-50" style={{ color: "var(--muted)" }}>
                    {f}
                  </span>
                ))}
              </div>

              {/* Description */}
              <div>
                <h2 className="text-lg font-bold mb-3 text-[var(--foreground)]">About This Property</h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{p.description}</p>
              </div>

              {/* Property Details Grid */}
              <div>
                <h2 className="text-lg font-bold mb-4 text-[var(--foreground)]">Property Details</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {details.map(d => (
                    <div key={d.label} className="rounded p-4 border border-slate-200 bg-white">
                      <d.icon className="w-4 h-4 mb-2 text-[var(--secondary)]" />
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-[var(--muted)]">{d.label}</p>
                      <p className="text-sm font-bold text-[var(--foreground)]">{d.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Use Cases */}
              {p.useCases && p.useCases.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold mb-3 text-[var(--foreground)]">Best Use Cases</h2>
                  <div className="flex flex-wrap gap-2">
                    {p.useCases.map(uc => {
                      const icons: Record<string, string> = { "Off-Grid": "⚡", "Homestead": "🏡", "Solar": "☀️", "Glamping": "⛺", "Hunting": "🦌", "RV Camping": "🚐", "Investment": "📈", "Ranch": "🐎" };
                      return (
                        <span key={uc} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                          <span>{icons[uc] || "🏞️"}</span>
                          <span style={{ color: "var(--primary)" }}>{uc}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Map */}
              <div>
                <h2 className="text-lg font-bold mb-4 text-[var(--foreground)]">Location & Parcel View</h2>
                <div className="rounded-xl overflow-hidden border border-slate-200 h-[450px] relative">
                  <MapView properties={[p]} center={[p.coordinates.lat, p.coordinates.lng]} zoom={14} />
                  {/* Parcel Info Overlay */}
                  <div className="absolute bottom-3 left-3 z-[1000] rounded-lg px-4 py-3 backdrop-blur-sm border border-white/20" style={{ background: "rgba(0,0,0,0.75)" }}>
                    <div className="flex items-center gap-4 text-white">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/60">Area</p>
                        <p className="text-sm font-bold">{p.acres} Acres</p>
                        <p className="text-[10px] text-white/50">{(p.acres * 4046.86).toLocaleString(undefined, { maximumFractionDigits: 0 })} m²</p>
                      </div>
                      <div className="w-px h-8 bg-white/20" />
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/60">Approx. Dimensions</p>
                        <p className="text-sm font-bold">{Math.round(Math.sqrt(p.acres * 4046.86))}m × {Math.round(Math.sqrt(p.acres * 4046.86))}m</p>
                        <p className="text-[10px] text-white/50">{Math.round(Math.sqrt(p.acres * 43560))}ft × {Math.round(Math.sqrt(p.acres * 43560))}ft</p>
                      </div>
                      <div className="w-px h-8 bg-white/20" />
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/60">Price / Acre</p>
                        <p className="text-sm font-bold">${Math.round(p.price / p.acres).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    GPS: {p.coordinates.lat.toFixed(4)}, {p.coordinates.lng.toFixed(4)} — {p.county} County, {p.state}
                  </p>
                  <a href={`https://www.google.com/maps?q=${p.coordinates.lat},${p.coordinates.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--secondary)] hover:underline">
                    Google Maps <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right — Pricing Sidebar */}
            <div className="space-y-6">
              {/* Price Card */}
              <div className="rounded-xl p-6 border border-slate-200 bg-white shadow-xl sticky top-24">
                <div className="text-center mb-6">
                  <p className="text-3xl font-extrabold text-[var(--primary)]">${p.price.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{p.acres} Acres — ${Math.round(p.price / p.acres).toLocaleString()}/acre</p>
                </div>

                <div className="rounded p-4 mb-6 border border-slate-200 bg-slate-50">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Owner Financing</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[var(--secondary)]">${monthly}</span>
                    <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>/month</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    { label: "Down Payment", value: `$${p.downPayment}` },
                    { label: "Monthly", value: `$${monthly}/mo` },
                    { label: "Interest Rate", value: `${p.interestRate}%` },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                      <span style={{ color: "var(--muted)" }}>{r.label}</span>
                      <span className="font-semibold text-[var(--foreground)]">{r.value}</span>
                    </div>
                  ))}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: "var(--muted)" }}>Term</span>
                      <span className="font-semibold text-[var(--foreground)]">{calcTerm} months</span>
                    </div>
                    <input type="range" min={12} max={72} step={6} value={calcTerm} onChange={e => setCalcTerm(+e.target.value)}
                      className="w-full accent-[var(--secondary)]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={() => setShowReserve(true)}
                    className="w-full h-12 rounded flex items-center justify-center gap-2 text-sm font-bold transition-all hover:opacity-90 cursor-pointer shadow-md bg-[var(--primary)] text-white">
                    <CreditCard className="w-4 h-4" />
                    Reserve Now — ${p.downPayment} Down
                  </button>
                  <button onClick={() => setShowInquiry(true)}
                    className="w-full h-12 rounded flex items-center justify-center gap-2 text-sm font-semibold border border-slate-300 bg-white text-[var(--primary)] hover:bg-slate-50 transition-colors cursor-pointer">
                    <Mail className="w-4 h-4 text-[var(--secondary)]" />
                    Inquire About Parcel
                  </button>
                  <a href="tel:+18001234567"
                    className="w-full h-12 rounded flex items-center justify-center gap-2 text-sm font-semibold border border-slate-300 bg-white text-[var(--primary)] hover:bg-slate-50 transition-colors">
                    <Phone className="w-4 h-4 text-[var(--secondary)]" />
                    (800) 123-4567
                  </a>
                </div>

                <div className="mt-6 space-y-2">
                  {["Clear Title Guaranteed", "No Credit Check", "Low Interest Rates", "Money-Back Guarantee"].map(t => (
                    <div key={t} className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--secondary)]" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Similar Properties */}
          {similar.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-6 text-[var(--foreground)]">Similar Properties</h2>
              <div className="grid md:grid-cols-3 gap-5">
                {similar.map(s => <PropertyCard key={s.id} property={s} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {showInquiry && <InquiryModal property={p} onClose={() => setShowInquiry(false)} />}
      {showReserve && <ReserveModal property={p} onClose={() => setShowReserve(false)} />}
    </div>
  );
}
