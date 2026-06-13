"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, MapPin, MessageSquare, CreditCard, ArrowLeft, BarChart3, Users, Handshake, CircleDollarSign, Activity, Map, Gauge, Mail, Split, Wallet, Target, Globe, EyeOff, Tv, FileSearch, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";

const nav = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/presentation", icon: Tv, label: "Pitch & Plan" },
  { href: "/admin/listings", icon: MapPin, label: "Listings" },
  { href: "/admin/leads", icon: MessageSquare, label: "Leads" },
  { href: "/admin/payments", icon: CreditCard, label: "Payments" },
  { href: "/admin/analytics", icon: BarChart3, label: "Financials" },
  { href: "/admin/subdivisions", icon: Split, label: "Subdivisions" },
  { href: "/admin/financing", icon: Wallet, label: "Owner Finance" },
  { href: "/admin/acquisitions", icon: Target, label: "Acquisitions" },
  { href: "/admin/parcels", icon: Globe, label: "Parcel Explorer" },
  { href: "/admin/off-market", icon: EyeOff, label: "Off Market" },
  { href: "/admin/tax-leads", icon: FileSearch, label: "Tax Leads" },
  { href: "/admin/dd-checker", icon: ShieldCheck, label: "DD Checker" },
];

const networkNav = [
  { href: "/admin/network", icon: Gauge, label: "Network Hub" },
  { href: "/admin/contacts", icon: Users, label: "Contacts" },
  { href: "/admin/deals", icon: Handshake, label: "Deals" },
  { href: "/admin/referrals", icon: CircleDollarSign, label: "Referrals" },
  { href: "/admin/activity", icon: Activity, label: "Activity" },
  { href: "/admin/deal-map", icon: Map, label: "Deal Map" },
  { href: "/admin/mailer", icon: Mail, label: "Direct Mail" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Sidebar */}
      <aside
        className="shrink-0 border-r border-white/5 flex flex-col transition-all duration-200"
        style={{ width: collapsed ? 56 : 224, background: "var(--surface-low)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 min-h-[60px]">
          {!collapsed && (
            <Link href="/" className="text-lg font-bold leading-none">
              Terra<span style={{ color: "var(--primary)" }}>Lot</span>
              <p className="text-[10px] uppercase tracking-widest mt-0.5 font-normal" style={{ color: "var(--muted)" }}>Admin Panel</p>
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 shrink-0"
            style={{ color: "var(--muted)", marginLeft: collapsed ? "auto" : 0, marginRight: collapsed ? "auto" : 0 }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {nav.map(n => {
            const active = pathname === n.href;
            return (
              <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? "rgba(142,209,223,0.08)" : "transparent",
                  color: active ? "var(--primary)" : "var(--muted)",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}>
                <n.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}

          <div className="pt-3 mt-2 border-t border-white/5">
            {!collapsed && (
              <p className="text-[9px] font-bold uppercase tracking-widest px-3 mb-2" style={{ color: "var(--muted)" }}>Network</p>
            )}
            {networkNav.map(n => {
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: active ? "rgba(142,209,223,0.08)" : "transparent",
                    color: active ? "var(--primary)" : "var(--muted)",
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}>
                  <n.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-2 border-t border-white/5">
          <Link href="/" title={collapsed ? "Back to Site" : undefined}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:text-[var(--primary)]"
            style={{ color: "var(--muted)", justifyContent: collapsed ? "center" : "flex-start" }}>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && "Back to Site"}
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
