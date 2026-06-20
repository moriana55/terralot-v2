"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, MapPin, MessageSquare, CreditCard, ArrowLeft, BarChart3, Users, Handshake, CircleDollarSign, Activity, Map, Gauge, Mail, Split, Wallet, Target, Globe, EyeOff, Tv, FileSearch, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, Cpu, SlidersHorizontal, Brain, TrendingDown, Rocket, Hammer, Calculator, Copy, BellRing, Send, MailPlus } from "lucide-react";
import { CerberusLogo } from "@/components/DealHoundLogo";

const SECTIONS: { label: string | null; items: { href: string; icon: typeof MapPin; label: string }[] }[] = [
  {
    label: null,
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/admin/presentation", icon: Tv, label: "Pitch & Plan" },
    ],
  },
  {
    label: "Cerberus · Sourcing",
    items: [
      { href: "/admin/cerberus", icon: Brain, label: "Cerberus Intel" },
      { href: "/admin/scraper", icon: Cpu, label: "Cerberus Botları" },
      { href: "/admin/tax-leads", icon: FileSearch, label: "Tax Leads" },
      { href: "/admin/off-market-leads", icon: MailPlus, label: "Off-Market Leads" },
      { href: "/admin/real-deals", icon: CircleDollarSign, label: "★ Gerçek Dealler" },
      { href: "/admin/acquisitions", icon: Target, label: "Acquisitions" },
      { href: "/admin/outreach", icon: Send, label: "Owner Outreach" },
      { href: "/admin/deal-screener", icon: SlidersHorizontal, label: "Deal Screener" },
      { href: "/admin/saved-searches", icon: BellRing, label: "Saved Searches" },
      { href: "/admin/off-market", icon: EyeOff, label: "Off Market" },
      { href: "/admin/competitor-analysis", icon: BarChart3, label: "Competitor Intel" },
      { href: "/admin/market-listings", icon: CircleDollarSign, label: "Piyasa İlanları" },
      { href: "/admin/parcels", icon: Globe, label: "Parcel Explorer" },
      { href: "/admin/dd-checker", icon: ShieldCheck, label: "DD Checker" },
    ],
  },
  {
    label: "Cerberus · AI Intel",
    items: [
      { href: "/admin/market", icon: BarChart3, label: "Market Analitik" },
      { href: "/admin/underwrite", icon: Brain, label: "AI Underwriting" },
      { href: "/admin/arbitrage", icon: TrendingDown, label: "Arbitrage Radar" },
      { href: "/admin/path-of-growth", icon: Rocket, label: "Path of Growth" },
      { href: "/admin/buildability", icon: Hammer, label: "Buildability AI" },
      { href: "/admin/lookalike", icon: Copy, label: "Lookalike County" },
      { href: "/admin/flip-sim", icon: Calculator, label: "Flip Simülatörü" },
    ],
  },
  {
    label: "Satış & Portföy",
    items: [
      { href: "/admin/listings", icon: MapPin, label: "Listings" },
      { href: "/admin/leads", icon: MessageSquare, label: "Leads" },
      { href: "/admin/financing", icon: Wallet, label: "Owner Finance" },
      { href: "/admin/owner-finance", icon: CircleDollarSign, label: "OF Pazaryeri" },
      { href: "/admin/payments", icon: CreditCard, label: "Payments" },
      { href: "/admin/subdivisions", icon: Split, label: "Subdivisions" },
      { href: "/admin/analytics", icon: BarChart3, label: "Financials" },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/admin/network", icon: Gauge, label: "Network Hub" },
      { href: "/admin/contacts", icon: Users, label: "Contacts" },
      { href: "/admin/deals", icon: Handshake, label: "Deals" },
      { href: "/admin/referrals", icon: CircleDollarSign, label: "Referrals" },
      { href: "/admin/activity", icon: Activity, label: "Activity" },
      { href: "/admin/deal-map", icon: Map, label: "Deal Map" },
      { href: "/admin/national-map", icon: Globe, label: "Ulusal Harita" },
      { href: "/admin/mailer", icon: Mail, label: "Direct Mail" },
    ],
  },
];

const ACCENT = "#8ed1df";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Record<number, boolean>>({});
  const toggleGroup = (i: number) => setClosedGroups((p) => ({ ...p, [i]: !p[i] }));

  const Item = ({ n }: { n: { href: string; icon: typeof MapPin; label: string } }) => {
    const active = pathname === n.href;
    return (
      <Link
        key={n.href}
        href={n.href}
        title={collapsed ? n.label : undefined}
        className="group relative flex items-center gap-3 rounded-lg text-[13px] transition-all"
        style={{
          padding: collapsed ? "9px 0" : "8px 11px",
          background: active ? "var(--surface-high)" : "transparent",
          color: active ? "var(--primary)" : "var(--muted)",
          fontWeight: active ? 600 : 450,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {active && !collapsed && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: ACCENT }} />
        )}
        <n.icon className="w-[17px] h-[17px] shrink-0" style={{ color: active ? ACCENT : "currentColor" }} />
        {!collapsed && <span className="truncate">{n.label}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <aside
        className="shrink-0 flex flex-col transition-all duration-200"
        style={{ width: collapsed ? 60 : 234, background: "var(--surface)", borderRight: "1px solid var(--surface-high)" }}
      >
        {/* Header — Cerberus mark + TerraLot */}
        <div className="flex items-center gap-2.5 px-3.5 border-b min-h-[62px]" style={{ borderColor: "var(--surface-high)" }}>
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 rounded-lg p-1" style={{ background: "var(--primary)" }}>
              <CerberusLogo size={26} />
            </span>
            {!collapsed && (
              <span className="leading-none min-w-0">
                <span className="text-[15px] font-extrabold tracking-tight">
                  Terra<span style={{ color: ACCENT }}>Lot</span>
                </span>
                <span className="block text-[9px] uppercase tracking-[0.18em] mt-1" style={{ color: "var(--muted)" }}>Cerberus Engine</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-black/5 shrink-0"
            style={{ color: "var(--muted)" }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav — grouped */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
          {SECTIONS.map((sec, si) => {
            // active group stays open even if user collapsed it
            const hasActive = sec.items.some((n) => pathname === n.href);
            const open = collapsed || !sec.label || hasActive || !closedGroups[si];
            return (
              <div key={si} className={si > 0 ? "mt-4" : ""}>
                {sec.label && !collapsed && (
                  <button
                    onClick={() => toggleGroup(si)}
                    className="w-full flex items-center gap-1 px-3 mb-1.5 group/hdr"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.75 }}>{sec.label}</span>
                    <ChevronDown
                      className="w-3 h-3 ml-auto transition-transform"
                      style={{ color: "var(--muted)", opacity: 0.6, transform: open ? "none" : "rotate(-90deg)" }}
                    />
                  </button>
                )}
                {sec.label && collapsed && si > 0 && <div className="my-2 mx-3 border-t" style={{ borderColor: "var(--surface-high)" }} />}
                {open && <div className="space-y-0.5">{sec.items.map((n) => <Item key={n.href} n={n} />)}</div>}
              </div>
            );
          })}
        </nav>

        <div className="p-2 border-t" style={{ borderColor: "var(--surface-high)" }}>
          <Link
            href="/"
            title={collapsed ? "Siteye dön" : undefined}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-black/5"
            style={{ color: "var(--muted)", justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && "Siteye dön"}
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
