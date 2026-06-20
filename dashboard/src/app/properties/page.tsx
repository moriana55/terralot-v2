"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, MapPin, SlidersHorizontal, X, Map, Grid3X3, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import Dropdown from "@/components/Dropdown";
import { getProperties, STATES, type Property } from "@/lib/data";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type SortOption = "newest" | "price-asc" | "price-desc" | "acres-asc" | "acres-desc";

export default function PropertiesPage() {
  return (
    <Suspense>
      <PropertiesContent />
    </Suspense>
  );
}

function PropertiesContent() {
  const params = useSearchParams();

  const [state, setState] = useState(params.get("state") || "");
  const [acresRange, setAcresRange] = useState(params.get("acres") || "");
  const [budgetRange, setBudgetRange] = useState(params.get("budget") || "");
  const [sort, setSort] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  // Gerçek ilanlar Supabase'den (/api/listings) gelir; çekilene kadar loading.
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProperties().then(rows => {
      if (!cancelled) { setProperties(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let result = properties.filter(p => p.status !== "sold");

    if (params.get("featured") === "true") result = result.filter(p => p.featured);
    if (state) result = result.filter(p => p.state === state);

    if (acresRange) {
      if (acresRange === "20+") result = result.filter(p => p.acres >= 20);
      else {
        const [min, max] = acresRange.split("-").map(Number);
        result = result.filter(p => p.acres >= min && p.acres <= max);
      }
    }

    if (budgetRange) {
      if (budgetRange === "20000+") result = result.filter(p => p.price >= 20000);
      else {
        const [min, max] = budgetRange.split("-").map(Number);
        result = result.filter(p => p.price >= min && p.price <= max);
      }
    }

    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(kw) ||
        p.county.toLowerCase().includes(kw) ||
        p.description.toLowerCase().includes(kw) ||
        p.features.some(f => f.toLowerCase().includes(kw))
      );
    }

    switch (sort) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "acres-asc": result.sort((a, b) => a.acres - b.acres); break;
      case "acres-desc": result.sort((a, b) => b.acres - a.acres); break;
      default: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [properties, state, acresRange, budgetRange, sort, keyword, params]);

  const clearFilters = () => {
    setState("");
    setAcresRange("");
    setBudgetRange("");
    setKeyword("");
  };

  const hasFilters = state || acresRange || budgetRange || keyword;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="pt-16">
        {/* Header */}
        <div className="border-b border-slate-200 py-8" style={{ background: "var(--surface-low)" }}>
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-extrabold text-[var(--foreground)] mb-2">Browse Land for Sale</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {filtered.length} {filtered.length === 1 ? "property" : "properties"} available
              {state && ` in ${state}`}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Search + Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search by keyword, county, features..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded text-sm border border-slate-200 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden h-11 px-4 rounded flex items-center gap-2 text-sm border border-slate-200 bg-white text-[var(--primary)]"
            >
              <SlidersHorizontal className="w-4 h-4 text-[var(--secondary)]" />
              Filters {hasFilters && `(${[state, acresRange, budgetRange].filter(Boolean).length})`}
            </button>

            <div className={`${showFilters ? "flex" : "hidden"} md:flex flex-col md:flex-row gap-3`}>
              <Dropdown
                placeholder="All States"
                value={state}
                onChange={setState}
                options={[{ value: "", label: "All States" }, ...STATES.map(s => ({ value: s, label: s }))]}
              />
              <Dropdown
                placeholder="Any Size"
                value={acresRange}
                onChange={setAcresRange}
                options={[
                  { value: "", label: "Any Size" },
                  { value: "0-5", label: "0 — 5 Acres" },
                  { value: "5-10", label: "5 — 10 Acres" },
                  { value: "10-20", label: "10 — 20 Acres" },
                  { value: "20+", label: "20+ Acres" },
                ]}
              />
              <Dropdown
                placeholder="Any Budget"
                value={budgetRange}
                onChange={setBudgetRange}
                options={[
                  { value: "", label: "Any Budget" },
                  { value: "0-5000", label: "Under $5,000" },
                  { value: "5000-10000", label: "$5K — $10K" },
                  { value: "10000-20000", label: "$10K — $20K" },
                  { value: "20000+", label: "$20K+" },
                ]}
              />
              <Dropdown
                placeholder="Sort"
                value={sort}
                onChange={v => setSort(v as SortOption)}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "price-asc", label: "Price: Low → High" },
                  { value: "price-desc", label: "Price: High → Low" },
                  { value: "acres-asc", label: "Size: Small → Large" },
                  { value: "acres-desc", label: "Size: Large → Small" },
                ]}
              />
            </div>

            {hasFilters && (
              <button onClick={clearFilters} className="h-11 px-4 rounded flex items-center gap-1 text-sm transition-colors hover:text-[var(--error)] text-[var(--muted)]">
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs" style={{ color: "var(--muted)" }}>{filtered.length} results</p>
            <div className="flex gap-1 rounded border border-slate-200 p-0.5 bg-slate-50">
              <button onClick={() => setViewMode("grid")} className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all"
                style={{ background: viewMode === "grid" ? "var(--secondary)" : "transparent", color: viewMode === "grid" ? "#ffffff" : "var(--muted)" }}>
                <Grid3X3 className="w-3.5 h-3.5" /> Grid
              </button>
              <button onClick={() => setViewMode("map")} className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all"
                style={{ background: viewMode === "map" ? "var(--secondary)" : "transparent", color: viewMode === "map" ? "#ffffff" : "var(--muted)" }}>
                <Map className="w-3.5 h-3.5" /> Map
              </button>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm" style={{ color: "var(--muted)" }}>
              <Loader2 className="w-5 h-5 animate-spin" /> Loading properties…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-[var(--muted)]" />
              <h3 className="text-lg font-bold mb-2 text-[var(--foreground)]">No properties found</h3>
              <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
                {hasFilters ? "Try adjusting your filters or search terms." : "No published listings yet — new properties are added weekly. Check back soon."}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="px-6 py-2 rounded text-sm font-semibold bg-[var(--primary)] text-white shadow-md">
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === "map" ? (
            <div className="grid lg:grid-cols-2 gap-5" style={{ height: "calc(100vh - 280px)" }}>
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <MapView properties={filtered} />
              </div>
              <div className="overflow-y-auto space-y-4 pr-2">
                {filtered.map(p => <PropertyCard key={p.id} property={p} />)}
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
