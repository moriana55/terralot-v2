"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, MapPin, CalendarClock, FileText, Menu, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// BUYER PORTAL SHELL
//
// A logged-in land buyer sees: their parcels, their owner-finance payment
// schedule, and their contracts/documents. Auth is enforced by middleware
// (the /buyer(.*) matcher). Real per-buyer data is gated behind the buyer↔
// contract model + Supabase RLS (owner applies the SQL in the PR notes); until
// then pages render honest empty/demo states rather than fake numbers.
// ─────────────────────────────────────────────────────────────────────────────

const nav = [
  { href: "/buyer", icon: LayoutDashboard, label: "Overview" },
  { href: "/buyer/parcels", icon: MapPin, label: "My Parcels" },
  { href: "/buyer/payments", icon: CalendarClock, label: "Payment Schedule" },
  { href: "/buyer/contracts", icon: FileText, label: "Contracts" },
];

function NavLinks({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <>
      {nav.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              background: active ? "var(--surface-high)" : "transparent",
              color: active ? "var(--primary)" : "var(--muted)",
              fontWeight: active ? 600 : 400,
            }}
          >
            <n.icon className="w-4 h-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const brand = (
    <Link href="/buyer" className="text-lg font-bold">
      Terra<span style={{ color: "var(--primary)" }}>Lot</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r flex-col" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
          {brand}
          <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--muted)" }}>Buyer Portal</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="p-4 border-t text-[10px]" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
          Secure owner-finance portal
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {brand}
        <button onClick={() => setMobileOpen(true)} style={{ color: "var(--muted)" }}>
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 flex flex-col border-r z-10" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              {brand}
              <button onClick={() => setMobileOpen(false)} style={{ color: "var(--muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <NavLinks pathname={pathname} onClose={() => setMobileOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
