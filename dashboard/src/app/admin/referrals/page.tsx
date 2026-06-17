"use client";

import { useState } from "react";
import { Users, Plus, DollarSign, TrendingUp, Gift, CheckCircle2, Clock, UserPlus, Copy, ExternalLink } from "lucide-react";

type PartnerType = "individual" | "agent" | "investor" | "wholesaler";
type ReferralStatus = "pending" | "qualified" | "converted" | "paid" | "expired";

interface ReferralPartner {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: PartnerType;
  company?: string;
  commissionRate: number;
  referralCode: string;
  totalReferred: number;
  totalConverted: number;
  totalEarned: number;
  pendingPayout: number;
  joinedDate: string;
}

interface Referral {
  id: string;
  partnerId: string;
  buyerName: string;
  buyerEmail: string;
  property: string;
  salePrice: number;
  commission: number;
  status: ReferralStatus;
  referredDate: string;
  convertedDate: string | null;
  paidDate: string | null;
}

const partners: ReferralPartner[] = [
  {
    id: "rp1", name: "Maria Gonzales", email: "maria@realestate.com", phone: "(512) 555-0111",
    type: "agent", company: "Southwest Realty", commissionRate: 10, referralCode: "MARIA10",
    totalReferred: 8, totalConverted: 5, totalEarned: 6450, pendingPayout: 1290, joinedDate: "2025-11-01",
  },
  {
    id: "rp2", name: "Tyler Brooks", email: "tyler.b@gmail.com", phone: "(480) 555-0222",
    type: "individual", commissionRate: 5, referralCode: "TYLER5",
    totalReferred: 3, totalConverted: 2, totalEarned: 1190, pendingPayout: 0, joinedDate: "2026-01-15",
  },
  {
    id: "rp3", name: "Desert Land Investors LLC", email: "deals@desertland.co", phone: "(623) 555-0333",
    type: "investor", company: "Desert Land Investors", commissionRate: 8, referralCode: "DESERT8",
    totalReferred: 12, totalConverted: 7, totalEarned: 8960, pendingPayout: 2380, joinedDate: "2025-09-20",
  },
  {
    id: "rp4", name: "Jake Simmons", email: "jake@landwholesale.com", phone: "(915) 555-0444",
    type: "wholesaler", company: "TX Land Wholesale", commissionRate: 7, referralCode: "JAKE7",
    totalReferred: 5, totalConverted: 3, totalEarned: 3150, pendingPayout: 1050, joinedDate: "2026-02-10",
  },
  {
    id: "rp5", name: "Amy Chen", email: "amy.chen@email.com", phone: "(720) 555-0555",
    type: "individual", commissionRate: 5, referralCode: "AMY5",
    totalReferred: 2, totalConverted: 1, totalEarned: 745, pendingPayout: 745, joinedDate: "2026-03-01",
  },
];

const referrals: Referral[] = [
  { id: "r1", partnerId: "rp1", buyerName: "James Wilson", buyerEmail: "james@email.com", property: "Lot A — North Ridge", salePrice: 12900, commission: 1290, status: "paid", referredDate: "2026-02-05", convertedDate: "2026-02-20", paidDate: "2026-03-01" },
  { id: "r2", partnerId: "rp1", buyerName: "Sarah Chen", buyerEmail: "sarah@email.com", property: "Block 1 — Trailhead", salePrice: 14900, commission: 1490, status: "converted", referredDate: "2026-03-10", convertedDate: "2026-03-25", paidDate: null },
  { id: "r3", partnerId: "rp3", buyerName: "Mike Torres", buyerEmail: "mike@email.com", property: "Block 2 — Creekside", salePrice: 15900, commission: 1272, status: "paid", referredDate: "2026-01-15", convertedDate: "2026-02-01", paidDate: "2026-02-15" },
  { id: "r4", partnerId: "rp4", buyerName: "David Park", buyerEmail: "david@email.com", property: "Lot 1 — Road Front", salePrice: 6900, commission: 483, status: "paid", referredDate: "2025-12-10", convertedDate: "2025-12-28", paidDate: "2026-01-10" },
  { id: "r5", partnerId: "rp3", buyerName: "Robert King", buyerEmail: "robert@email.com", property: "Desert Sun Parcel", salePrice: 9900, commission: 792, status: "converted", referredDate: "2026-04-01", convertedDate: "2026-04-20", paidDate: null },
  { id: "r6", partnerId: "rp2", buyerName: "Jennifer Adams", buyerEmail: "jen@email.com", property: "5 Acres — Desert Vista", salePrice: 7999, commission: 400, status: "paid", referredDate: "2026-01-20", convertedDate: "2026-02-05", paidDate: "2026-02-20" },
  { id: "r7", partnerId: "rp1", buyerName: "Mark Johnson", buyerEmail: "mark.j@email.com", property: "Mountain View 5-Acre", salePrice: 19900, commission: 1990, status: "pending", referredDate: "2026-05-20", convertedDate: null, paidDate: null },
  { id: "r8", partnerId: "rp5", buyerName: "Lisa Wang", buyerEmail: "lisa.w@email.com", property: "Pine Ridge Retreat", salePrice: 12999, commission: 650, status: "qualified", referredDate: "2026-05-15", convertedDate: null, paidDate: null },
  { id: "r9", partnerId: "rp3", buyerName: "Carlos Mendez", buyerEmail: "carlos@email.com", property: "Ozark Hideaway", salePrice: 3999, commission: 320, status: "expired", referredDate: "2025-10-01", convertedDate: null, paidDate: null },
  { id: "r10", partnerId: "rp4", buyerName: "Susan Miller", buyerEmail: "susan@email.com", property: "Lone Star Ranch", salePrice: 5999, commission: 420, status: "pending", referredDate: "2026-05-25", convertedDate: null, paidDate: null },
];

const statusConfig: Record<ReferralStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "rgba(168,130,255,0.1)", text: "#a882ff" },
  qualified: { label: "Qualified", bg: "rgba(255,180,60,0.1)", text: "#ffb43c" },
  converted: { label: "Converted", bg: "rgba(80,220,140,0.1)", text: "#50dc8c" },
  paid: { label: "Paid", bg: "rgba(80,220,140,0.15)", text: "#30c070" },
  expired: { label: "Expired", bg: "rgba(255,80,80,0.1)", text: "#ff5050" },
};

const typeConfig: Record<PartnerType, { label: string; color: string }> = {
  individual: { label: "Individual", color: "#8ed1df" },
  agent: { label: "Real Estate Agent", color: "#a882ff" },
  investor: { label: "Investor", color: "#ffb43c" },
  wholesaler: { label: "Wholesaler", color: "#50dc8c" },
};

export default function ReferralsPage() {
  const [view, setView] = useState<"partners" | "referrals">("partners");
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const totalEarned = partners.reduce((s, p) => s + p.totalEarned, 0);
  const totalPending = partners.reduce((s, p) => s + p.pendingPayout, 0);
  const totalConverted = referrals.filter(r => r.status === "converted" || r.status === "paid").length;
  const conversionRate = referrals.length > 0 ? Math.round((totalConverted / referrals.length) * 100) : 0;

  const sel = partners.find(p => p.id === selectedPartner);
  const partnerReferrals = sel ? referrals.filter(r => r.partnerId === sel.id) : [];

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(`https://terralot.com/ref/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Commission Tracking</p>
          <h1 className="text-2xl font-bold mt-1">Referral Program</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
          <UserPlus className="w-4 h-4" /> Add Partner
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Paid Out", value: `$${totalEarned.toLocaleString()}`, icon: DollarSign, color: "#50dc8c" },
          { label: "Pending Payouts", value: `$${totalPending.toLocaleString()}`, icon: Clock, color: "#ffb43c" },
          { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, color: "#a882ff" },
          { label: "Active Partners", value: partners.length.toString(), icon: Users, color: "var(--primary)" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        {(["partners", "referrals"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors capitalize"
            style={{ background: view === v ? "var(--primary)" : "var(--surface)", color: view === v ? "#fff" : "var(--muted)" }}>
            {v === "partners" ? "Partners" : "All Referrals"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {view === "partners" ? (
            <div className="space-y-3">
              {partners.map(p => {
                const tc = typeConfig[p.type];
                const active = selectedPartner === p.id;
                return (
                  <button key={p.id} onClick={() => setSelectedPartner(p.id)}
                    className="w-full text-left rounded-xl p-4 border transition-all"
                    style={{ background: active ? "rgba(142,209,223,0.04)" : "var(--surface)", borderColor: active ? "var(--primary)" : "rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${tc.color}15`, color: tc.color }}>
                          {p.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{p.name}</h3>
                          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{tc.label}{p.company ? ` · ${p.company}` : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: "#50dc8c" }}>${p.totalEarned.toLocaleString()}</p>
                        <p className="text-[10px]" style={{ color: "var(--muted)" }}>earned</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs mt-2">
                      <span style={{ color: "var(--muted)" }}>Referred: <strong>{p.totalReferred}</strong></span>
                      <span style={{ color: "var(--muted)" }}>Converted: <strong>{p.totalConverted}</strong></span>
                      <span style={{ color: "var(--muted)" }}>Rate: <strong>{p.commissionRate}%</strong></span>
                      <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <span style={{ color: "var(--primary)" }}>{p.referralCode}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyCode(p.referralCode); }}>
                          {copied === p.referralCode ? <CheckCircle2 className="w-3 h-3" style={{ color: "#50dc8c" }} /> : <Copy className="w-3 h-3" style={{ color: "var(--muted)" }} />}
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface-low)" }}>
                    {["Buyer", "Property", "Partner", "Commission", "Status", "Date"].map(h => (
                      <th key={h} className="text-left p-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(r => {
                    const partner = partners.find(p => p.id === r.partnerId);
                    const st = statusConfig[r.status];
                    return (
                      <tr key={r.id} className="border-t hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                        <td className="p-3">
                          <p className="font-semibold">{r.buyerName}</p>
                          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{r.buyerEmail}</p>
                        </td>
                        <td className="p-3 text-xs" style={{ color: "var(--muted)" }}>{r.property}</td>
                        <td className="p-3 text-xs font-semibold">{partner?.name}</td>
                        <td className="p-3 font-mono font-bold" style={{ color: "#50dc8c" }}>${r.commission.toLocaleString()}</td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                        </td>
                        <td className="p-3 text-xs" style={{ color: "var(--muted)" }}>{r.referredDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Partner Detail */}
        <div>
          {sel ? (
            <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${typeConfig[sel.type].color}15`, color: typeConfig[sel.type].color }}>
                  {sel.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{sel.name}</h3>
                  <p className="text-xs" style={{ color: typeConfig[sel.type].color }}>{typeConfig[sel.type].label}</p>
                </div>
              </div>

              <div className="space-y-1 text-xs" style={{ color: "var(--muted)" }}>
                <p>{sel.email}</p>
                <p>{sel.phone}</p>
                {sel.company && <p>{sel.company}</p>}
              </div>

              {/* Referral Link */}
              <div className="p-3 rounded-lg" style={{ background: "rgba(142,209,223,0.06)", border: "1px solid rgba(142,209,223,0.15)" }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--primary)" }}>Referral Link</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs flex-1 truncate" style={{ color: "var(--foreground)" }}>terralot.com/ref/{sel.referralCode}</code>
                  <button onClick={() => copyCode(sel.referralCode)} className="shrink-0">
                    {copied === sel.referralCode ? <CheckCircle2 className="w-4 h-4" style={{ color: "#50dc8c" }} /> : <Copy className="w-4 h-4" style={{ color: "var(--muted)" }} />}
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p style={{ color: "var(--muted)" }}>Commission Rate</p><p className="font-bold text-lg">{sel.commissionRate}%</p></div>
                <div><p style={{ color: "var(--muted)" }}>Joined</p><p className="font-semibold">{sel.joinedDate}</p></div>
                <div><p style={{ color: "var(--muted)" }}>Total Referred</p><p className="font-bold text-lg">{sel.totalReferred}</p></div>
                <div><p style={{ color: "var(--muted)" }}>Converted</p><p className="font-bold text-lg" style={{ color: "#50dc8c" }}>{sel.totalConverted}</p></div>
              </div>

              {/* Earnings */}
              <div className="p-3 rounded-lg" style={{ background: "rgba(80,220,140,0.06)", border: "1px solid rgba(80,220,140,0.15)" }}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "#50dc8c" }}>Total Earned</span>
                  <span className="font-bold" style={{ color: "#50dc8c" }}>${sel.totalEarned.toLocaleString()}</span>
                </div>
                {sel.pendingPayout > 0 && (
                  <div className="flex justify-between text-xs mt-1">
                    <span style={{ color: "#ffb43c" }}>Pending Payout</span>
                    <span className="font-bold" style={{ color: "#ffb43c" }}>${sel.pendingPayout.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Partner's Referrals */}
              {partnerReferrals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Recent Referrals</p>
                  <div className="space-y-2">
                    {partnerReferrals.slice(0, 5).map(r => {
                      const st = statusConfig[r.status];
                      return (
                        <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div>
                            <p className="font-semibold">{r.buyerName}</p>
                            <p style={{ color: "var(--muted)" }}>{r.property}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold" style={{ color: st.text }}>${r.commission}</p>
                            <span className="text-[9px] font-bold uppercase" style={{ color: st.text }}>{st.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sel.pendingPayout > 0 && (
                <button className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2" style={{ background: "var(--primary)", color: "#fff" }}>
                  <DollarSign className="w-3.5 h-3.5" /> Pay ${sel.pendingPayout.toLocaleString()}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border p-12 flex flex-col items-center justify-center text-center" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
              <Gift className="w-10 h-10 mb-3" style={{ color: "var(--muted)" }} />
              <p className="font-semibold">Select a partner</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Click a referral partner to view details and commissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
