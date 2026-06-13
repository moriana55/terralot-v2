"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trash2, MapPin, Maximize, DollarSign, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { properties } from "@/lib/data";
import { getFavorites, toggleFavorite } from "@/lib/favorites";
import type { Property } from "@/lib/data";

export default function ComparePage() {
  const [favIds, setFavIds] = useState<string[]>([]);

  useEffect(() => {
    setFavIds(getFavorites());
    const handler = () => setFavIds(getFavorites());
    window.addEventListener("favorites-changed", handler);
    return () => window.removeEventListener("favorites-changed", handler);
  }, []);

  const favProperties = properties.filter(p => favIds.includes(p.id));

  const fields: { label: string; render: (p: Property) => string }[] = [
    { label: "State", render: p => p.state },
    { label: "County", render: p => p.county },
    { label: "Size", render: p => `${p.acres} acres` },
    { label: "Price", render: p => `$${p.price.toLocaleString()}` },
    { label: "Price / Acre", render: p => `$${Math.round(p.price / p.acres).toLocaleString()}` },
    { label: "Down Payment", render: p => `$${p.downPayment}` },
    { label: "Monthly", render: p => `$${p.monthlyPayment}/mo` },
    { label: "Term", render: p => `${p.term} months` },
    { label: "Total Cost", render: p => `$${(p.downPayment + p.monthlyPayment * p.term).toLocaleString()}` },
    { label: "Zoning", render: p => p.zoning },
    { label: "Terrain", render: p => p.terrain },
    { label: "Road Access", render: p => p.roadAccess },
    { label: "Utilities", render: p => p.utilities },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="pt-16">
        <div className="border-b border-white/5 py-8" style={{ background: "var(--surface-low)" }}>
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-2">Compare Properties</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {favProperties.length} {favProperties.length === 1 ? "property" : "properties"} saved for comparison
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {favProperties.length === 0 ? (
            <div className="text-center py-20">
              <DollarSign className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted)" }} />
              <h3 className="text-lg font-bold mb-2">No saved properties yet</h3>
              <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Click the heart icon on any property to save it for comparison.</p>
              <Link href="/properties" className="px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
                Browse Properties
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 pr-4 min-w-[140px]" style={{ color: "var(--muted)" }}></th>
                    {favProperties.map(p => (
                      <th key={p.id} className="text-left py-3 px-3 min-w-[220px]">
                        <div className="relative">
                          <img src={p.images[0]} alt={p.title} className="w-full h-28 object-cover rounded-lg mb-2" />
                          <button onClick={() => toggleFavorite(p.id)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                          </button>
                        </div>
                        <Link href={`/properties/${p.id}`} className="font-bold text-sm hover:text-[var(--primary)] transition-colors line-clamp-1">
                          {p.title}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f.label} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {f.label}
                      </td>
                      {favProperties.map(p => (
                        <td key={p.id} className="py-3 px-3 font-semibold">{f.render(p)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-4 pr-4"></td>
                    {favProperties.map(p => (
                      <td key={p.id} className="py-4 px-3">
                        <Link href={`/properties/${p.id}`}
                          className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--primary)" }}>
                          View Details <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
