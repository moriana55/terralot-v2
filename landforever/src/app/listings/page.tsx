"use client";
import { useState, useMemo } from "react";
import ListingCard, { Listing } from "@/components/ListingCard";
import Reveal from "@/components/Reveal";
import Select from "@/components/Select";
import listingsData from "@/data/listings.json";

const listings = listingsData as Listing[];

export default function ListingsPage() {
  const [stateFilter, setStateFilter] = useState("All");
  const [maxPrice, setMaxPrice] = useState(20000);
  const [minAcres, setMinAcres] = useState(0);
  const [sort, setSort] = useState("price-asc");

  const states = useMemo(
    () => ["All", ...Array.from(new Set(listings.map((l) => l.state)))],
    []
  );

  const filtered = useMemo(() => {
    let out = listings.filter(
      (l) =>
        (stateFilter === "All" || l.state === stateFilter) &&
        l.totalPrice <= maxPrice &&
        l.acreage >= minAcres
    );
    out = [...out].sort((a, b) => {
      if (sort === "price-asc") return a.totalPrice - b.totalPrice;
      if (sort === "price-desc") return b.totalPrice - a.totalPrice;
      if (sort === "acres-desc") return b.acreage - a.acreage;
      return 0;
    });
    return out;
  }, [stateFilter, maxPrice, minAcres, sort]);

  return (
    <main className="pt-28 pb-24 bg-cream min-h-screen">
      {/* Header */}
      <div className="bg-forest text-cream py-16 mb-12">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-gold font-semibold uppercase tracking-widest text-sm mb-3">
              Available Land
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-balance max-w-2xl">
              Find your parcel of America
            </h1>
            <p className="mt-4 text-cream/70 max-w-xl">
              {listings.length} hand-selected parcels across the United States.
              All on simple monthly plans, starting at $99 down.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-forest/5 mb-10 grid md:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-semibold text-forest/60 uppercase tracking-wide mb-2">
              State
            </label>
            <Select
              value={stateFilter}
              onChange={setStateFilter}
              options={states.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest/60 uppercase tracking-wide mb-2">
              Max Price: ${maxPrice.toLocaleString()}
            </label>
            <input
              type="range"
              min={3000}
              max={20000}
              step={500}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-gold mt-3"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest/60 uppercase tracking-wide mb-2">
              Min Acres: {minAcres}
            </label>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={minAcres}
              onChange={(e) => setMinAcres(Number(e.target.value))}
              className="w-full accent-gold mt-3"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest/60 uppercase tracking-wide mb-2">
              Sort By
            </label>
            <Select
              value={sort}
              onChange={setSort}
              options={[
                { value: "price-asc", label: "Price: Low to High" },
                { value: "price-desc", label: "Price: High to Low" },
                { value: "acres-desc", label: "Acreage: Largest" },
              ]}
            />
          </div>
        </div>

        {/* Results */}
        <div className="mb-6 text-forest/60 text-sm">
          {filtered.length} parcel{filtered.length !== 1 ? "s" : ""} found
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24 text-forest/50">
            No parcels match your filters. Try widening your search.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-7">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
