"use client";

import { useState } from "react";
import { Target, Plus, MapPin, DollarSign, Mail, Clock, CheckCircle2, AlertTriangle, Search, FileText, Gavel, Eye, EyeOff, Send, TrendingUp, BarChart3 } from "lucide-react";

type AcqStatus = "researching" | "mailed" | "responded" | "negotiating" | "under_contract" | "closed" | "dead";
type AcqSource = "tax_deed" | "direct_mail" | "cold_call" | "absentee_list" | "wholesaler" | "driving_for_dollars";
type MarketType = "off_market" | "on_market";

interface Acquisition {
  id: string;
  title: string;
  state: string;
  county: string;
  acres: number;
  ownerName: string;
  ownerType: "absentee" | "local" | "estate" | "corporate" | "tax_delinquent";
  askingPrice: number | null;
  offerPrice: number;
  estimatedValue: number;
  source: AcqSource;
  status: AcqStatus;
  marketType: MarketType;
  mailedDate: string | null;
  responseDate: string | null;
  followUpCount: number;
  notes: string;
  apn: string;
  roadAccess: boolean;
  waterRights: boolean;
  titleClear: boolean;
  taxDelinquent: boolean;
  yearsDelinquent: number | null;
  campaignId: string | null;
}

interface MailCampaign {
  id: string;
  name: string;
  targetState: string;
  targetCounty: string;
  listType: "absentee" | "tax_delinquent" | "estate" | "vacant_land";
  totalSent: number;
  responded: number;
  underContract: number;
  closed: number;
  sentDate: string;
  costPerLetter: number;
}

const campaigns: MailCampaign[] = [
  { id: "c1", name: "Torrance Co. Absentee #1", targetState: "New Mexico", targetCounty: "Torrance", listType: "absentee", totalSent: 500, responded: 23, underContract: 2, closed: 1, sentDate: "2026-04-01", costPerLetter: 0.85 },
  { id: "c2", name: "Navajo Tax Delinquent", targetState: "Arizona", targetCounty: "Navajo", listType: "tax_delinquent", totalSent: 300, responded: 18, underContract: 1, closed: 0, sentDate: "2026-05-10", costPerLetter: 0.85 },
  { id: "c3", name: "Hudspeth Co. Tax Sale", targetState: "Texas", targetCounty: "Hudspeth", listType: "tax_delinquent", totalSent: 200, responded: 12, underContract: 0, closed: 1, sentDate: "2026-03-15", costPerLetter: 0.85 },
  { id: "c4", name: "Costilla Absentee Owners", targetState: "Colorado", targetCounty: "Costilla", listType: "absentee", totalSent: 400, responded: 15, underContract: 1, closed: 0, sentDate: "2026-05-01", costPerLetter: 0.85 },
  { id: "c5", name: "Luna Co. Vacant Land", targetState: "New Mexico", targetCounty: "Luna", listType: "vacant_land", totalSent: 350, responded: 20, underContract: 1, closed: 0, sentDate: "2026-04-20", costPerLetter: 0.85 },
];

const acquisitions: Acquisition[] = [
  {
    id: "a1", title: "Torrance County 40-Acre", state: "New Mexico", county: "Torrance",
    acres: 40, ownerName: "Margaret Ellis (Estate)", ownerType: "estate",
    askingPrice: null, offerPrice: 15000, estimatedValue: 42000,
    source: "direct_mail", status: "negotiating", marketType: "off_market",
    mailedDate: "2026-04-10", responseDate: "2026-04-28", followUpCount: 3,
    notes: "Heir wants quick sale. Estate probated. Clear title confirmed. Counter-offered $18K, we offered $16K.", apn: "TC-4420-001",
    roadAccess: true, waterRights: false, titleClear: true, taxDelinquent: false, yearsDelinquent: null, campaignId: "c1",
  },
  {
    id: "a2", title: "Navajo County 80-Acre Ranch", state: "Arizona", county: "Navajo",
    acres: 80, ownerName: "Richard & Carol Dunn", ownerType: "absentee",
    askingPrice: 55000, offerPrice: 28000, estimatedValue: 72000,
    source: "direct_mail", status: "mailed", marketType: "off_market",
    mailedDate: "2026-05-15", responseDate: null, followUpCount: 0,
    notes: "Owners in Florida, haven't visited in 10 years. Tax current. Sending 2nd mailer in 30 days.", apn: "NV-8810-003",
    roadAccess: true, waterRights: false, titleClear: true, taxDelinquent: false, yearsDelinquent: null, campaignId: "c2",
  },
  {
    id: "a3", title: "Hudspeth County Tax Deed", state: "Texas", county: "Hudspeth",
    acres: 20, ownerName: "County Tax Sale", ownerType: "tax_delinquent",
    askingPrice: 3200, offerPrice: 3200, estimatedValue: 14000,
    source: "tax_deed", status: "closed", marketType: "off_market",
    mailedDate: null, responseDate: null, followUpCount: 0,
    notes: "Won at county auction. Deed recorded. Ready for subdivision into 4 x 5-acre lots.", apn: "HC-2204-009",
    roadAccess: true, waterRights: false, titleClear: true, taxDelinquent: true, yearsDelinquent: 3, campaignId: null,
  },
  {
    id: "a4", title: "Costilla County Mountain View", state: "Colorado", county: "Costilla",
    acres: 35, ownerName: "James Franklin", ownerType: "absentee",
    askingPrice: null, offerPrice: 12000, estimatedValue: 38000,
    source: "direct_mail", status: "responded", marketType: "off_market",
    mailedDate: "2026-05-01", responseDate: "2026-05-20", followUpCount: 1,
    notes: "Owner called, interested. Wants $18K. Counter at $14K. Motivated — paying taxes on land he never uses.", apn: "CC-3305-011",
    roadAccess: true, waterRights: true, titleClear: true, taxDelinquent: false, yearsDelinquent: null, campaignId: "c4",
  },
  {
    id: "a5", title: "Cochise County Desert Flat", state: "Arizona", county: "Cochise",
    acres: 40, ownerName: "Southwest Holdings LLC", ownerType: "corporate",
    askingPrice: 22000, offerPrice: 10000, estimatedValue: 28000,
    source: "absentee_list", status: "dead", marketType: "off_market",
    mailedDate: "2026-04-05", responseDate: null, followUpCount: 2,
    notes: "No road access. Landlocked. Passed after due diligence.", apn: "CO-5501-007",
    roadAccess: false, waterRights: false, titleClear: true, taxDelinquent: false, yearsDelinquent: null, campaignId: null,
  },
  {
    id: "a6", title: "Luna County 60-Acre", state: "New Mexico", county: "Luna",
    acres: 60, ownerName: "Patricia Moore", ownerType: "absentee",
    askingPrice: null, offerPrice: 9000, estimatedValue: 30000,
    source: "cold_call", status: "under_contract", marketType: "off_market",
    mailedDate: null, responseDate: "2026-05-10", followUpCount: 2,
    notes: "Verbal agreement at $11K. Purchase agreement sent. Title search in progress. Closing target: June 15.", apn: "LN-7702-015",
    roadAccess: true, waterRights: false, titleClear: false, taxDelinquent: false, yearsDelinquent: null, campaignId: "c5",
  },
  {
    id: "a7", title: "Mohave County Split Candidate", state: "Arizona", county: "Mohave",
    acres: 100, ownerName: "Tax Delinquent Sale", ownerType: "tax_delinquent",
    askingPrice: 8500, offerPrice: 8500, estimatedValue: 65000,
    source: "tax_deed", status: "researching", marketType: "off_market",
    mailedDate: null, responseDate: null, followUpCount: 0,
    notes: "Upcoming auction June 15. Minor split possible (4 x 25 acres). Checking road access and zoning.", apn: "MH-1103-022",
    roadAccess: true, waterRights: false, titleClear: false, taxDelinquent: true, yearsDelinquent: 5, campaignId: null,
  },
  {
    id: "a8", title: "Valencia County 10-Acre", state: "New Mexico", county: "Valencia",
    acres: 10, ownerName: "Robert & Helen Shaw", ownerType: "absentee",
    askingPrice: null, offerPrice: 4000, estimatedValue: 12000,
    source: "driving_for_dollars", status: "mailed", marketType: "off_market",
    mailedDate: "2026-05-25", responseDate: null, followUpCount: 0,
    notes: "Found vacant lot with overgrown vegetation. Looked up owner — lives in California. Sent yellow letter.", apn: "VL-9901-004",
    roadAccess: true, waterRights: false, titleClear: true, taxDelinquent: false, yearsDelinquent: null, campaignId: null,
  },
];

const statusConfig: Record<AcqStatus, { label: string; bg: string; text: string }> = {
  researching: { label: "Researching", bg: "rgba(142,209,223,0.1)", text: "#8ed1df" },
  mailed: { label: "Mailed", bg: "rgba(168,130,255,0.1)", text: "#a882ff" },
  responded: { label: "Responded", bg: "rgba(255,180,60,0.1)", text: "#ffb43c" },
  negotiating: { label: "Negotiating", bg: "rgba(255,150,50,0.1)", text: "#ff9632" },
  under_contract: { label: "Under Contract", bg: "rgba(80,220,140,0.1)", text: "#50dc8c" },
  closed: { label: "Closed", bg: "rgba(80,220,140,0.15)", text: "#30c070" },
  dead: { label: "Dead", bg: "rgba(255,80,80,0.1)", text: "#ff5050" },
};

const sourceConfig: Record<AcqSource, { label: string; icon: typeof Mail }> = {
  tax_deed: { label: "Tax Deed", icon: Gavel },
  direct_mail: { label: "Direct Mail", icon: Mail },
  cold_call: { label: "Cold Call", icon: Target },
  absentee_list: { label: "Absentee List", icon: Search },
  wholesaler: { label: "Wholesaler", icon: Target },
  driving_for_dollars: { label: "Driving for $$$", icon: Eye },
};

export default function AcquisitionsPage() {
  const [tab, setTab] = useState<"pipeline" | "campaigns">("pipeline");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = filter === "all" ? acquisitions : acquisitions.filter(a => a.status === filter);
  const sel = acquisitions.find(a => a.id === selected);
  const offMarketCount = acquisitions.filter(a => a.marketType === "off_market").length;

  const pipeline = acquisitions.filter(a => !["closed", "dead"].includes(a.status));
  const pipelineValue = pipeline.reduce((s, a) => s + a.estimatedValue, 0);
  const totalMailSent = campaigns.reduce((s, c) => s + c.totalSent, 0);
  const totalResponses = campaigns.reduce((s, c) => s + c.responded, 0);
  const responseRate = totalMailSent > 0 ? ((totalResponses / totalMailSent) * 100).toFixed(1) : "0";
  const closedDeals = acquisitions.filter(a => a.status === "closed");
  const totalSaved = closedDeals.reduce((s, a) => s + (a.estimatedValue - a.offerPrice), 0);
  const mailCost = campaigns.reduce((s, c) => s + c.totalSent * c.costPerLetter, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Off-Market Land Hunting</p>
          <h1 className="text-2xl font-bold mt-1">Acquisition Pipeline</h1>
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <EyeOff className="w-3 h-3" /> {offMarketCount}/{acquisitions.length} deals are off-market
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--primary)", color: "#000" }}>
          <Plus className="w-4 h-4" /> New Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Pipeline Value", value: `$${pipelineValue.toLocaleString()}`, icon: DollarSign, color: "var(--primary)" },
          { label: "Active Leads", value: pipeline.length.toString(), icon: Target, color: "#a882ff" },
          { label: "Mail Sent", value: totalMailSent.toLocaleString(), icon: Send, color: "#ffb43c" },
          { label: "Response Rate", value: `${responseRate}%`, icon: BarChart3, color: "#8ed1df" },
          { label: "Equity Captured", value: `$${totalSaved.toLocaleString()}`, icon: TrendingUp, color: "#50dc8c" },
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

      {/* Tab Toggle */}
      <div className="flex gap-2">
        {(["pipeline", "campaigns"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors capitalize"
            style={{ background: tab === t ? "var(--primary)" : "var(--surface)", color: tab === t ? "#000" : "var(--muted)" }}>
            {t === "pipeline" ? "Deal Pipeline" : "Mail Campaigns"}
          </button>
        ))}
      </div>

      {tab === "campaigns" ? (
        <div className="space-y-4">
          <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Campaign Performance</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Total mail cost: <strong style={{ color: "var(--foreground)" }}>${mailCost.toLocaleString()}</strong></p>
            </div>
            <div className="space-y-3">
              {campaigns.map(c => {
                const responseRate = ((c.responded / c.totalSent) * 100).toFixed(1);
                const roi = c.closed > 0 ? "Active" : "Pending";
                return (
                  <div key={c.id} className="rounded-lg p-4 border" style={{ background: "var(--surface-low)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm">{c.name}</h3>
                        <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: "var(--muted)" }}>
                          <MapPin className="w-3 h-3" /> {c.targetCounty}, {c.targetState} · {c.sentDate}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{
                        background: c.listType === "tax_delinquent" ? "rgba(255,80,80,0.1)" : c.listType === "absentee" ? "rgba(168,130,255,0.1)" : "rgba(142,209,223,0.1)",
                        color: c.listType === "tax_delinquent" ? "#ff5050" : c.listType === "absentee" ? "#a882ff" : "#8ed1df",
                      }}>
                        {c.listType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-3 text-xs text-center">
                      <div><p style={{ color: "var(--muted)" }}>Sent</p><p className="font-bold text-lg">{c.totalSent}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>Responded</p><p className="font-bold text-lg" style={{ color: "#ffb43c" }}>{c.responded}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>Response %</p><p className="font-bold text-lg" style={{ color: "#8ed1df" }}>{responseRate}%</p></div>
                      <div><p style={{ color: "var(--muted)" }}>Under Contract</p><p className="font-bold text-lg" style={{ color: "#a882ff" }}>{c.underContract}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>Closed</p><p className="font-bold text-lg" style={{ color: "#50dc8c" }}>{c.closed}</p></div>
                    </div>
                    {/* Funnel bar */}
                    <div className="mt-3 h-2 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full" style={{ width: `${(c.responded / c.totalSent) * 100}%`, background: "#ffb43c" }} />
                      <div className="h-full" style={{ width: `${(c.underContract / c.totalSent) * 100}%`, background: "#a882ff" }} />
                      <div className="h-full" style={{ width: `${(c.closed / c.totalSent) * 100}%`, background: "#50dc8c" }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                      <span>Cost: ${(c.totalSent * c.costPerLetter).toFixed(0)}</span>
                      <span>Cost per response: ${c.responded > 0 ? ((c.totalSent * c.costPerLetter) / c.responded).toFixed(2) : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Pipeline Funnel */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>Pipeline Funnel</p>
            <div className="flex gap-2">
              {(["researching", "mailed", "responded", "negotiating", "under_contract", "closed"] as AcqStatus[]).map(status => {
                const count = acquisitions.filter(a => a.status === status).length;
                const st = statusConfig[status];
                return (
                  <div key={status} className="flex-1 rounded-lg p-3 text-center cursor-pointer transition-all hover:scale-[1.02]"
                    style={{ background: st.bg }} onClick={() => setFilter(filter === status ? "all" : status)}>
                    <p className="text-lg font-bold" style={{ color: st.text }}>{count}</p>
                    <p className="text-[10px] font-semibold uppercase" style={{ color: st.text }}>{st.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "All" },
              ...Object.entries(statusConfig).map(([k, v]) => ({ key: k, label: v.label })),
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: filter === f.key ? "var(--primary)" : "var(--surface)", color: filter === f.key ? "#000" : "var(--muted)" }}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lead List */}
            <div className="lg:col-span-2 space-y-3">
              {filtered.map(a => {
                const st = statusConfig[a.status];
                const src = sourceConfig[a.source];
                const margin = a.estimatedValue - a.offerPrice;
                const marginPct = Math.round((margin / a.offerPrice) * 100);
                const active = selected === a.id;
                return (
                  <button key={a.id} onClick={() => setSelected(a.id)}
                    className="w-full text-left rounded-xl p-4 border transition-all"
                    style={{ background: active ? "rgba(142,209,223,0.04)" : "var(--surface)", borderColor: active ? "var(--primary)" : "rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{a.title}</h3>
                        {a.marketType === "off_market" && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(255,80,80,0.1)", color: "#ff5050" }}>
                            <EyeOff className="w-2.5 h-2.5 inline mr-0.5" />OFF MKT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs mb-2" style={{ color: "var(--muted)" }}>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.county}, {a.state}</span>
                      <span>{a.acres} acres</span>
                      <span className="flex items-center gap-1"><src.icon className="w-3 h-3" /> {src.label}</span>
                      {a.taxDelinquent && <span className="text-[10px] font-bold" style={{ color: "#ff5050" }}>TAX DELINQ.</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span>Offer: <strong>${a.offerPrice.toLocaleString()}</strong></span>
                      <span>Est. Value: <strong>${a.estimatedValue.toLocaleString()}</strong></span>
                      <span style={{ color: "#50dc8c" }}>Margin: <strong>+{marginPct}% (${margin.toLocaleString()})</strong></span>
                      {a.followUpCount > 0 && <span style={{ color: "var(--muted)" }}>{a.followUpCount} follow-ups</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            <div>
              {sel ? (() => {
                const st = statusConfig[sel.status];
                const src = sourceConfig[sel.source];
                const margin = sel.estimatedValue - sel.offerPrice;
                const marginPct = Math.round((margin / sel.offerPrice) * 100);
                const campaign = sel.campaignId ? campaigns.find(c => c.id === sel.campaignId) : null;
                return (
                  <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{sel.title}</h3>
                        {sel.marketType === "off_market" && <EyeOff className="w-4 h-4" style={{ color: "#ff5050" }} />}
                      </div>
                      <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{sel.county}, {sel.state} · {sel.acres} acres</p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(142,209,223,0.1)", color: "#8ed1df" }}>
                        <src.icon className="w-3 h-3 inline mr-1" />{src.label}
                      </span>
                      {sel.taxDelinquent && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(255,80,80,0.1)", color: "#ff5050" }}>
                          Tax Delinquent {sel.yearsDelinquent ? `(${sel.yearsDelinquent}yr)` : ""}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p style={{ color: "var(--muted)" }}>Owner</p><p className="font-semibold">{sel.ownerName}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>Owner Type</p><p className="font-semibold capitalize">{sel.ownerType.replace("_", " ")}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>APN</p><p className="font-mono font-semibold">{sel.apn}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>Follow-ups</p><p className="font-semibold">{sel.followUpCount}</p></div>
                    </div>

                    {/* Financials */}
                    <div className="p-3 rounded-lg" style={{ background: "rgba(80,220,140,0.06)", border: "1px solid rgba(80,220,140,0.15)" }}>
                      <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        <div><p style={{ color: "var(--muted)" }}>Offer</p><p className="font-bold">${sel.offerPrice.toLocaleString()}</p></div>
                        <div><p style={{ color: "var(--muted)" }}>Est. Value</p><p className="font-bold">${sel.estimatedValue.toLocaleString()}</p></div>
                        <div><p style={{ color: "#50dc8c" }}>Margin</p><p className="font-bold" style={{ color: "#50dc8c" }}>+{marginPct}%</p></div>
                      </div>
                    </div>

                    {/* Due Diligence */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Due Diligence</p>
                      <div className="space-y-1.5">
                        {[
                          { label: "Road Access", ok: sel.roadAccess },
                          { label: "Water Rights", ok: sel.waterRights },
                          { label: "Title Clear", ok: sel.titleClear },
                        ].map(c => (
                          <div key={c.label} className="flex items-center gap-2 text-xs">
                            {c.ok ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#50dc8c" }} /> : <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#ff5050" }} />}
                            <span style={{ color: c.ok ? "var(--foreground)" : "#ff5050" }}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Campaign Link */}
                    {campaign && (
                      <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(168,130,255,0.06)", border: "1px solid rgba(168,130,255,0.15)" }}>
                        <p className="font-semibold" style={{ color: "#a882ff" }}>
                          <Mail className="w-3 h-3 inline mr-1" /> Campaign: {campaign.name}
                        </p>
                        <p style={{ color: "var(--muted)" }} className="mt-1">
                          {campaign.totalSent} sent · {campaign.responded} responses · {campaign.sentDate}
                        </p>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="text-xs space-y-1 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      {sel.mailedDate && <p style={{ color: "var(--muted)" }}><Mail className="w-3 h-3 inline mr-1" /> Mailed: {sel.mailedDate}</p>}
                      {sel.responseDate && <p style={{ color: "var(--muted)" }}><CheckCircle2 className="w-3 h-3 inline mr-1" /> Response: {sel.responseDate}</p>}
                    </div>

                    {sel.notes && (
                      <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.03)", color: "var(--muted)" }}>
                        <FileText className="w-3 h-3 inline mr-1" /> {sel.notes}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="rounded-xl border p-12 flex flex-col items-center justify-center text-center" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                  <Target className="w-10 h-10 mb-3" style={{ color: "var(--muted)" }} />
                  <p className="font-semibold">Select a lead</p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Click a lead to view details and due diligence</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
