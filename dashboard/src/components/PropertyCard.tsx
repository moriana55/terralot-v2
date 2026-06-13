import Link from "next/link";
import { MapPin, Maximize } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import type { Property } from "@/lib/data";

export default function PropertyCard({ property: p }: { property: Property }) {
  return (
    <Link href={`/properties/${p.id}`} className="group block rounded-xl overflow-hidden border border-slate-200 transition-all hover:shadow-xl bg-white">
      <div className="relative h-48 overflow-hidden">
        <img
          src={p.images[0]}
          alt={p.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {p.featured && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-[var(--secondary)] text-white">
            Featured
          </span>
        )}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {p.status === "pending" && (
            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-[var(--error)] text-white">
              Sale Pending
            </span>
          )}
          <FavoriteButton propertyId={p.id} size="sm" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span className="text-white text-lg font-bold">${p.price.toLocaleString()}</span>
          <span className="text-white text-xs font-semibold px-2 py-0.5 rounded bg-[var(--secondary)]">
            ${p.monthlyPayment}/mo
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-sm mb-2 group-hover:text-[var(--secondary)] transition-colors line-clamp-1 text-[var(--foreground)]">{p.title}</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[var(--secondary)]" />
            {p.county}, {p.state}
          </span>
          <span className="flex items-center gap-1">
            <Maximize className="w-3 h-3 text-[var(--secondary)]" />
            {p.acres} acres
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.useCases?.slice(0, 3).map(uc => {
            const icons: Record<string, string> = { "Off-Grid": "⚡", "Homestead": "🏡", "Solar": "☀️", "Glamping": "⛺", "Hunting": "🦌", "RV Camping": "🚐", "Investment": "📈", "Ranch": "🐎" };
            return (
              <span key={uc} className="text-[10px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 font-semibold" style={{ color: "var(--secondary)" }}>
                {icons[uc] || "🏞️"} {uc}
              </span>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--secondary)]">
            ${p.downPayment} down
          </span>
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>
            Owner Financing Available
          </span>
        </div>
      </div>
    </Link>
  );
}
