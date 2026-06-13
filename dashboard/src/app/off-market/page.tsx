"use client";

import { useState } from "react";
import { Lock, ArrowRight, MapPin, Ruler, DollarSign, TrendingDown, AlertCircle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { offMarketProperties, OffMarketProperty } from "@/lib/data";

export default function OffMarketAccess() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [property, setProperty] = useState<OffMarketProperty | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const found = offMarketProperties.find(p => p.accessCode.toLowerCase() === code.trim().toLowerCase() && p.status !== "withdrawn");
    if (found) {
      setProperty(found);
    } else {
      setError("Invalid access code. Please check your code and try again.");
    }
  }

  if (property) {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <button onClick={() => { setProperty(null); setCode(""); }} className="flex items-center gap-2 text-sm mb-8 transition-colors hover:text-[var(--primary)]" style={{ color: "var(--muted)" }}>
            <ChevronLeft className="w-4 h-4" /> Back to code entry
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="rounded-2xl overflow-hidden mb-3">
                <img src={property.images[activeImage]} alt={property.title} className="w-full h-72 object-cover" />
              </div>
              <div className="flex gap-2">
                {property.images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className="rounded-lg overflow-hidden border-2 transition-colors"
                    style={{ borderColor: activeImage === i ? "var(--primary)" : "transparent" }}>
                    <img src={img} alt="" className="w-20 h-14 object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{
                    background: property.status === "available" ? "rgba(142,209,223,0.1)" : "rgba(251,185,131,0.1)",
                    color: property.status === "available" ? "var(--success)" : "var(--tertiary)",
                  }}>
                  {property.status === "under_contract" ? "Under Contract" : property.status}
                </span>
                {property.expiresAt && (
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                    Expires {new Date(property.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold mb-4">{property.title}</h1>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { icon: MapPin, label: "Location", value: `${property.county}, ${property.state}` },
                  { icon: Ruler, label: "Size", value: `${property.acres} Acres` },
                  { icon: DollarSign, label: "Price", value: `$${property.price.toLocaleString()}` },
                  { icon: TrendingDown, label: "Below Market", value: `${property.discount}% Discount` },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-white/5 p-4" style={{ background: "var(--surface)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{item.label}</span>
                    </div>
                    <p className="text-sm font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/5 p-5 mb-6" style={{ background: "var(--surface)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Asking Price</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Est. Market Value</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold" style={{ color: "var(--primary)" }}>${property.price.toLocaleString()}</span>
                  <span className="text-xl font-bold line-through" style={{ color: "var(--muted)" }}>${property.estimatedValue.toLocaleString()}</span>
                </div>
                <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-low)" }}>
                  <div className="h-full rounded-full" style={{ width: `${100 - property.discount}%`, background: "var(--primary)" }} />
                </div>
                <p className="text-xs mt-2 font-semibold" style={{ color: "#4ade80" }}>You save ${(property.estimatedValue - property.price).toLocaleString()}</p>
              </div>

              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--muted)" }}>{property.description}</p>

              <div className="flex gap-3 text-xs" style={{ color: "var(--muted)" }}>
                <span>APN: {property.apn}</span>
                <span>Source: {property.source}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Link href="/" className="text-lg font-bold mb-12">
        Terra<span style={{ color: "var(--primary)" }}>Lot</span>
      </Link>

      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(142,209,223,0.1)" }}>
          <Lock className="w-7 h-7" style={{ color: "var(--primary)" }} />
        </div>

        <h1 className="text-3xl font-bold mb-3">Exclusive Off-Market Deals</h1>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "var(--muted)" }}>
          These properties are not listed publicly. Enter your unique access code to view a private deal below market value.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input type="text" placeholder="Enter access code" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
              maxLength={6}
              className="w-full h-14 text-center text-2xl font-mono tracking-[0.3em] rounded-xl border border-white/10 focus:border-[var(--primary)]/50 focus:outline-none uppercase"
              style={{ background: "var(--surface)", color: "var(--foreground)" }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 justify-center text-sm" style={{ color: "var(--error)" }}>
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button type="submit" disabled={code.length < 4}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--primary)", color: "var(--background)" }}>
            View Property <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs mt-8" style={{ color: "var(--muted)" }}>
          Don&apos;t have a code? <Link href="/" className="underline" style={{ color: "var(--primary)" }}>Browse our public listings</Link>
        </p>
      </div>
    </div>
  );
}
