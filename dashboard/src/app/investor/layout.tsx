"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, MapPin, CreditCard, BarChart3,
  Handshake, FileText, TrendingUp, Rocket, Newspaper, Menu, X,
} from "lucide-react";

const nav = [
  { href: "/investor", icon: LayoutDashboard, label: "Overview" },
  { href: "/investor/portfolio", icon: MapPin, label: "Portfolio" },
  { href: "/investor/financials", icon: BarChart3, label: "Financials" },
  { href: "/investor/payments", icon: CreditCard, label: "Payments" },
  { href: "/investor/pipeline", icon: TrendingUp, label: "Deal Pipeline" },
  { href: "/investor/referrals", icon: Handshake, label: "Referrals" },
  { href: "/investor/documents", icon: FileText, label: "Documents" },
];

const devNav = [
  { href: "/kickoff", icon: Rocket, label: "Bot Planı" },
  { href: "/updates", icon: Newspaper, label: "Haftalık Güncelleme" },
];

function NavLinks({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <>
      {nav.map(n => {
        const active = pathname === n.href;
        return (
          <Link key={n.href} href={n.href} onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              background: active ? "rgba(142,209,223,0.08)" : "transparent",
              color: active ? "var(--primary)" : "var(--muted)",
              fontWeight: active ? 600 : 400,
            }}>
            <n.icon className="w-4 h-4" />
            {n.label}
          </Link>
        );
      })}
      <div className="pt-3 mt-2 border-t border-white/5">
        <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)", opacity: 0.5 }}>Geliştirme</p>
        {devNav.map(n => {
          const active = pathname === n.href;
          return (
            <Link key={n.href} href={n.href} onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: active ? "rgba(142,209,223,0.08)" : "transparent",
                color: active ? "var(--primary)" : "var(--muted)",
                fontWeight: active ? 600 : 400,
              }}>
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const avatar = (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(142,209,223,0.15)", color: "var(--primary)" }}>
        A
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">Ahmet</p>
        <p className="text-[10px] truncate" style={{ color: "var(--muted)" }}>Investor · Read-only</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-white/5 flex-col" style={{ background: "var(--surface-low)" }}>
        <div className="p-5 border-b border-white/5">
          <Link href="/investor" className="text-lg font-bold">
            Terra<span style={{ color: "var(--primary)" }}>Lot</span>
          </Link>
          <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--muted)" }}>Investor Portal</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="p-4 border-t border-white/5">{avatar}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/5" style={{ background: "var(--surface-low)" }}>
        <Link href="/investor" className="text-base font-bold">
          Terra<span style={{ color: "var(--primary)" }}>Lot</span>
        </Link>
        <button onClick={() => setMobileOpen(true)} style={{ color: "var(--muted)" }}>
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 flex flex-col border-r border-white/5 z-10" style={{ background: "var(--surface-low)" }}>
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <Link href="/investor" className="text-lg font-bold">
                Terra<span style={{ color: "var(--primary)" }}>Lot</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} style={{ color: "var(--muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <NavLinks pathname={pathname} onClose={() => setMobileOpen(false)} />
            </nav>
            <div className="p-4 border-t border-white/5">{avatar}</div>
          </div>
        </div>
      )}

      {/* Main content — add top padding on mobile for fixed header */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
