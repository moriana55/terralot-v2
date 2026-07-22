"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, MapPin, MessageSquare, CreditCard, ArrowLeft, BarChart3, Users, CircleDollarSign, Map, Mail, Wallet, Target, Globe, Tv, FileSearch, ChevronLeft, ChevronRight, ChevronDown, Cpu, Brain, TrendingDown, Rocket, Hammer, Calculator, Copy, BellRing, Send, MailPlus, Database, Swords, Radar, Sparkles, ShieldCheck, Radio, PhoneCall, Handshake } from "lucide-react";
import { CerberusLogo } from "@/components/DealHoundLogo";

// Ana navigasyon tek operasyon zincirini izler:
// radar → aktif pazar → satın alma → envanter/satış → sonuç.
// `wip: true` grubu route'ları silmeden ana operasyondan park eder; yalnızca
// NEXT_PUBLIC_SHOW_WIP="1" iken geliştirici/Lab görünümünde gösterilir.
const SECTIONS: { label: string | null; wip?: boolean; items: { href: string; icon: typeof MapPin; label: string }[] }[] = [
  {
    label: null,
    items: [
      { href: "/admin/harita", icon: Map, label: "Ana Harita" },
      { href: "/admin", icon: LayoutDashboard, label: "Operasyon Özeti" },
    ],
  },
  {
    label: "1 · Market Radar",
    items: [
      { href: "/admin/all-deals", icon: Target, label: "Ulusal Fırsatlar" },
      { href: "/admin/data-coverage", icon: Database, label: "Veri Kapsamı" },
      { href: "/admin/pazar-ortusme", icon: Radar, label: "Rakip & Pazar" },
      { href: "/admin/rakip-istihbarat", icon: Swords, label: "Rakip İstihbaratı" },
    ],
  },
  {
    label: "2 · Aktif Pazar · Mohave",
    items: [
      { href: "/admin/markets", icon: Globe, label: "Market Registry" },
      { href: "/admin/mohave", icon: MapPin, label: "Meadview & Golden Valley" },
      { href: "/admin/luna", icon: MapPin, label: "Luna (NM) Envanteri" },
      { href: "/admin/alinabilir-harita", icon: Map, label: "Fırsat Haritası" },
      { href: "/admin/off-market-harita", icon: Map, label: "7 Eyalet Haritası" },
      { href: "/admin/satilabilir-cekirdek", icon: Target, label: "Doğrulanmış Çekirdek" },
      { href: "/admin/mohave/kampanya", icon: Mail, label: "Mohave Kampanyası" },
      { href: "/admin/arama", icon: PhoneCall, label: "Sıcak Arama" },
      { href: "/admin/anlasma-hatti", icon: Handshake, label: "Anlaşma Hattı" },
    ],
  },
  {
    label: "3 · Satın Alma",
    items: [
      { href: "/admin/apn-sorgula", icon: FileSearch, label: "Parsel İnceleme" },
      { href: "/admin/apn-dogrula", icon: ShieldCheck, label: "APN / County Doğrulama" },
      { href: "/admin/canli-sorgu", icon: Radio, label: "Canlı County Sorgu" },
      { href: "/admin/off-market-leads", icon: MailPlus, label: "Malik & Outreach" },
    ],
  },
  {
    label: "4 · Envanter & Satış",
    items: [
      { href: "/admin/satis-sayfalari", icon: Globe, label: "Satış Sayfaları" },
      { href: "/admin/owner-finance", icon: CircleDollarSign, label: "Owner-Finance · Beta" },
      { href: "/admin/talepler", icon: MessageSquare, label: "Alıcı Talepleri" },
      { href: "/admin/payments", icon: CreditCard, label: "Tahsilatlar · Beta" },
    ],
  },
  {
    label: "5 · Raporlar",
    items: [
      { href: "/admin/portfoy", icon: BarChart3, label: "Portföy & KPI" },
    ],
  },
  {
    label: "🧪 Lab · Park Edilenler",
    wip: true,
    items: [
      { href: "/admin/sunum", icon: Sparkles, label: "Sunum" },
      { href: "/admin/sistem", icon: Brain, label: "Sistem & Yöntem" },
      { href: "/admin/presentation", icon: Tv, label: "Pitch & Plan" },
      { href: "/admin/scraper", icon: Cpu, label: "Cerberus Botları" },
      { href: "/admin/rakip-radar", icon: Radar, label: "Rakip Radar" },
      { href: "/admin/competitor-radar", icon: Radar, label: "Rakip Satış Radarı" },
      { href: "/admin/rakip-defteri", icon: Swords, label: "Rakip Defteri" },
      { href: "/admin/market-listings", icon: CircleDollarSign, label: "Piyasa İlanları (eski veri)" },
      { href: "/admin/cerberus", icon: Brain, label: "Cerberus Intel" },
      { href: "/admin/acquisitions", icon: Target, label: "Acquisitions" },
      { href: "/admin/outreach", icon: Send, label: "Owner Outreach" },
      { href: "/admin/saved-searches", icon: BellRing, label: "Saved Searches" },
      { href: "/admin/parcels", icon: Globe, label: "Parcel Explorer" },
      { href: "/admin/market", icon: BarChart3, label: "Market Analitik" },
      { href: "/admin/underwrite", icon: Brain, label: "AI Underwriting" },
      { href: "/admin/arbitrage", icon: TrendingDown, label: "Arbitrage Radar" },
      { href: "/admin/path-of-growth", icon: Rocket, label: "Path of Growth" },
      { href: "/admin/buildability", icon: Hammer, label: "Buildability AI" },
      { href: "/admin/lookalike", icon: Copy, label: "Lookalike County" },
      { href: "/admin/flip-sim", icon: Calculator, label: "Flip Simülatörü" },
      { href: "/admin/listings", icon: MapPin, label: "Listings" },
      { href: "/admin/leads", icon: MessageSquare, label: "Leads" },
      { href: "/admin/analytics", icon: BarChart3, label: "Financials" },
      { href: "/admin/contacts", icon: Users, label: "Contacts" },
      { href: "/admin/mailer", icon: Mail, label: "Direct Mail" },
      { href: "/admin/financing", icon: Wallet, label: "Owner Finance" },
      { href: "/admin/referrals", icon: CircleDollarSign, label: "Referrals" },
    ],
  },
];

const ACCENT = "#8ed1df";

// Geliştirici görünümü: NEXT_PUBLIC_SHOW_WIP="1" iken WIP (mock veri) gruplar görünür.
// Set değilse (prod / müşteri görünümü) sadece canlı gruplar gösterilir.
const SHOW_WIP = process.env.NEXT_PUBLIC_SHOW_WIP === "1";
const VISIBLE_SECTIONS = SHOW_WIP ? SECTIONS : SECTIONS.filter((s) => !s.wip);

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
      {/* print:hidden — yazdırmada (ör. parsel tek-sayfa sunumu) sidebar çıkmasın */}
      <aside
        className="shrink-0 flex flex-col transition-all duration-200 print:hidden"
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
          {VISIBLE_SECTIONS.map((sec, si) => {
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

      <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  );
}
