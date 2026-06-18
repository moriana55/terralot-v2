"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ScoreBadge, gradeOf } from "@/components/ScoreBadge";
import { Target, Plus, MapPin, Mail, CheckCircle2, AlertTriangle, Search, FileText, Gavel, Eye, EyeOff, Send, BarChart3, LayoutGrid, Calculator, DollarSign, TrendingUp, ExternalLink, Loader2, ShieldCheck, Star, Layers } from "lucide-react";

// --- Real row shape from Supabase: tax_delinquent_properties ---
interface TaxLeadRow {
  id: string;
  source: string | null;
  state: string | null;
  county: string | null;
  apn: string | null;
  owner_name: string | null;
  owner_address: string | null;
  property_address: string | null;
  legal_description: string | null;
  acres: number | null;
  minimum_bid: number | null;
  judgment_amount: number | null;
  sale_date: string | null;
  case_number: string | null;
  raw_url: string | null;
  scraped_at: string | null;
  created_at: string | null;
  deal_score: number | null;
  discount_pct: number | null;
  savings: number | null;
  liquidity_score: number | null;
  county_pop_growth: number | null;
  road_access: string | null;
  flood_score: number | null;
  dd_checked: boolean | null;
  final_score: number | null;
  flip_score: number | null;
  ownerfinance_score: number | null;
  confidence: number | null;
  lat: number | null;
  lng: number | null;
}

type OwnerType = "absentee" | "local" | "estate" | "corporate" | "tax_delinquent";

// Derive owner type from the real owner_name / source strings (no fabricated data).
function deriveOwnerType(row: TaxLeadRow): OwnerType {
  const n = (row.owner_name || "").toLowerCase();
  const src = (row.source || "").toLowerCase();
  if (n.includes("estate")) return "estate";
  if (n.includes("llc") || n.includes("inc") || n.includes("corp") || n.includes("holdings") || n.includes("trust")) return "corporate";
  if (n.includes("absentee")) return "absentee";
  if (src.includes("tax") || src.includes("delinquent") || src.includes("lgbs") || src.includes("mvba") || src.includes("pbfcm")) return "tax_delinquent";
  return "local";
}

function deriveTitle(row: TaxLeadRow): string {
  const acrePart = row.acres ? `${row.acres}-Acre` : "Parcel";
  const loc = [row.county, row.state].filter(Boolean).join(", ");
  return `${acrePart}${loc ? " — " + loc : ""}`;
}

const sourceConfig: Record<string, { label: string; icon: typeof Mail }> = {
  ZILLOW_LAND: { label: "Zillow Land", icon: Search },
  LGBS: { label: "LGBS Tax Sale", icon: Gavel },
  MVBA: { label: "MVBA Tax Sale", icon: Gavel },
  PBFCM: { label: "PBFCM Tax Sale", icon: Gavel },
  default: { label: "Scraped Lead", icon: Search },
};
function srcCfg(s: string | null) {
  return sourceConfig[(s || "").toUpperCase()] || sourceConfig.default;
}

const ownerTypeLabel: Record<OwnerType, { label: string; color: string }> = {
  absentee: { label: "Absentee", color: "#5aa9ff" },
  estate: { label: "Estate", color: "#b9770a" },
  corporate: { label: "Corporate", color: "#0e7d97" },
  tax_delinquent: { label: "Tax Delinquent", color: "#ba1a1a" },
  local: { label: "Local", color: "#0f9d58" },
};

const PAGE_SIZE = 60;

export default function AcquisitionsPage() {
  const [leads, setLeads] = useState<TaxLeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"pipeline" | "predictor">("pipeline");
  const [viewType, setViewType] = useState<"list" | "kanban">("list");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sort, setSort] = useState<"best" | "flip" | "ownerfinance" | "recent">("best");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [srcFilter, setSrcFilter] = useState<"all" | "tax" | "national" | "zillow">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [catalysts, setCatalysts] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<null | {
    total: number; evaluable: number; states: number; counties: number; taxCount: number;
    score45: number; score70: number; score90: number; struckOff: number; withOwner: number;
  }>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q");
    if (q) { setSearch(q); setSearchInput(q); }
    const src = sp.get("src");
    if (src === "tax" || src === "national" || src === "zillow") setSrcFilter(src);
  }, []);

  useEffect(() => {
    fetch("/api/acquisition-stats").then(r => r.json()).then(setStats).catch(() => {});
    fetch("/api/market-rates").then(r => r.json()).then((j) => {
      const m: Record<string, number> = {};
      (j.rates || []).forEach((r: { state: string; perAcre: number }) => { m[r.state] = r.perAcre; });
      setRates(m);
    }).catch(() => {});
    fetch("/api/growth-catalysts").then(r => r.json()).then((j) => setCatalysts(new Set(j.counties || []))).catch(() => {});
  }, []);

  const isCatalyst = (l: TaxLeadRow): boolean => {
    const st = l.state && /^[A-Za-z]{2}$/.test(l.state) ? l.state.toUpperCase() : (l.state ? FULL2[l.state] : null);
    return !!st && !!l.county && catalysts.has(`${st}/${l.county.toUpperCase().replace(/ COUNTY$/i, "").trim()}`);
  };

  const [chips, setChips] = useState({ catalyst: false, top: false, struck: false, starred: false });

  // Deal tracking (#6 lifecycle · #7 watchlist · #8 outreach · #9 portfolio)
  type Track = { lead_id: string; stage?: string; starred?: boolean; notes?: string; max_offer?: number | null; acquired_cost?: number | null; list_price?: number | null; sold_price?: number | null };
  const [tracking, setTracking] = useState<Record<string, Track>>({});
  useEffect(() => {
    if (!leads.length) return;
    const ids = leads.map(l => l.id).join(",");
    fetch(`/api/admin/deal-tracking?lead_ids=${encodeURIComponent(ids)}`)
      .then(r => r.json())
      .then(({ tracking: data }) => {
        const m: Record<string, Track> = {};
        (data as Track[] | null)?.forEach(t => { m[t.lead_id] = t; });
        setTracking(prev => ({ ...prev, ...m }));
      })
      .catch(() => {});
  }, [leads]);
  const saveTrack = async (leadId: string, patch: Partial<Track>) => {
    const next = { ...(tracking[leadId] || { lead_id: leadId }), ...patch, lead_id: leadId };
    setTracking(p => ({ ...p, [leadId]: next }));
    await fetch("/api/admin/deal-tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...next, updated_at: new Date().toISOString() }),
    });
  };
  const STAGES: [string, string][] = [["new", "Yeni"], ["researching", "Araştırılıyor"], ["offer", "Teklif verildi"], ["won", "Kazanıldı"], ["owned", "Sahipli"], ["listed", "Listede"], ["sold", "Satıldı"], ["dead", "Vazgeçildi"]];

  // #10 County Playbook — eyalet bazlı tax-sale kuralı (almadan önce bilinmesi gereken)
  const STATE_RULES: Record<string, { type: string; redemption: string; tip: string }> = {
    TX: { type: "Tax Deed (redeemable)", redemption: "6 ay (genel) / 2 yıl (homestead+tarım)", tip: "Redeem edilirse %25-50 ceza alırsın — yine de kârlı çıkabilirsin." },
    FL: { type: "Tax Deed", redemption: "Deed sonrası yok (lien aşamasında var)", tip: "Tiny lot çok; $/acre yanıltır, mutlak değere bak." },
    GA: { type: "Redeemable Deed", redemption: "12 ay (%20 premium)", tip: "Barment bildirimi ile redemption süresini kısaltabilirsin." },
    TN: { type: "Tax Deed", redemption: "1 yıl", tip: "Mahkeme onayı sonrası 1 yıl redemption." },
    AZ: { type: "Tax Lien", redemption: "3 yıl, sonra foreclose", tip: "Lien al, 3 yıl sonra deed için dava." },
    CO: { type: "Tax Lien", redemption: "3 yıl", tip: "Lien faizi yüksek; deed nadir." },
    NM: { type: "Tax Deed", redemption: "Yok", tip: "Temiz deed — redemption riski düşük." },
    NC: { type: "Upset-bid", redemption: "10 gün upset-bid dönemi", tip: "Teklifin 10 gün açık artırılabilir." },
    NY: { type: "Değişken (county)", redemption: "County'ye göre", tip: "Her county farklı; kuralı doğrula." },
    LA: { type: "Tax Sale (redeemable)", redemption: "3 yıl", tip: "Adjudicated property ucuz ama redemption uzun." },
    MD: { type: "Tax Lien", redemption: "6 ay", tip: "Lien sonrası foreclosure davası gerekir." },
  };
  const [ddLive, setDdLive] = useState<Record<string, { loading?: boolean; road?: string; roadNote?: string; flood?: string } | undefined>>({});

  // Investor-ready one-page deal sheet (print / PDF).
  const printDealSheet = (l: TaxLeadRow) => {
    const score = l.final_score ?? l.deal_score;
    const grade = score != null ? gradeOf(score).letter : "—";
    const disc = l.discount_pct != null ? `-${l.discount_pct}%` : "—";
    const cv = compValue(l);
    const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#5b6472">${k}</td><td style="padding:6px 0;text-align:right;font-weight:700">${v}</td></tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Deal Sheet — ${l.county}, ${l.state}</title>
    <style>body{font-family:-apple-system,Inter,Arial,sans-serif;color:#0a1a3f;max-width:720px;margin:32px auto;padding:0 24px}
    .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0a1a3f;padding-bottom:16px}
    .badge{width:64px;height:64px;border-radius:50%;border:4px solid #0f9d58;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#0f9d58}
    h1{margin:18px 0 2px;font-size:22px} .sub{color:#5b6472;margin:0 0 18px}
    table{width:100%;border-collapse:collapse;font-size:14px} h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#0e7d97;margin:22px 0 6px}
    .tag{display:inline-block;background:#eef4ff;color:#0e7d97;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;margin-right:6px}
    .foot{margin-top:32px;color:#9aa3b2;font-size:11px;border-top:1px solid #e5e9f0;padding-top:12px}</style></head>
    <body>
    <div class="hd"><div><div style="font-size:13px;letter-spacing:3px;font-weight:800;color:#0a1a3f">CERBERUS · TERRALOT</div><div style="color:#5b6472;font-size:12px">Off-Market Land Deal Sheet</div></div>
    <div class="badge">${grade}</div></div>
    <h1>${l.county}, ${l.state}</h1><p class="sub">${l.property_address || l.acres ? `${l.acres ?? "—"} acres` : "Parsel"} · ${l.source?.replace(/^TAX:/, "").replace(/:/g, " · ") || ""}</p>
    ${isCatalyst(l) ? '<span class="tag">🏭 Megaproje county</span>' : ""}${/STRUCK/i.test(l.source || "") ? '<span class="tag">Struck-off (rakipsiz)</span>' : ""}
    <h2>Finansal</h2><table>
    ${row("Minimum teklif", l.minimum_bid != null ? "$" + l.minimum_bid.toLocaleString() : "—")}
    ${row("Tahmini değer (judgment)", l.judgment_amount != null ? "$" + l.judgment_amount.toLocaleString() : "—")}
    ${row("İndirim", disc)}
    ${row("Tahmini kâr", l.savings != null ? "+$" + l.savings.toLocaleString() : "—")}
    ${cv ? row("Comp piyasa değeri (×$/acre)", "$" + cv.toLocaleString()) : ""}
    </table>
    <h2>Skor sinyalleri</h2><table>
    ${row("Cerberus skoru", (score ?? "—") + "/100 (" + grade + ")")}
    ${row("Likidite (talep)", (l.liquidity_score ?? "—") + "/100" + (l.county_pop_growth != null ? " · nüfus " + (l.county_pop_growth * 100).toFixed(1) + "%" : ""))}
    ${row("Yol durumu", l.dd_checked ? (l.road_access === "landlocked" ? "Landlocked (riskli)" : l.road_access || "—") : "Taranmadı")}
    ${row("Sahip", l.owner_name || "—")}
    ${row("APN", l.apn || "—")}
    ${l.sale_date ? row("Satış tarihi", l.sale_date) : ""}
    </table>
    <div class="foot">Cerberus deal-sourcing engine tarafından üretildi · ${new Date().toLocaleDateString("tr-TR")} · Veriler kamuya açık vergi-satış kayıtlarından, doğrulama alıcının sorumluluğundadır.</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const runDDLive = async (l: TaxLeadRow) => {
    if (!l.lat || !l.lng) return;
    setDdLive(p => ({ ...p, [l.id]: { loading: true } }));
    try {
      const r = await fetch(`/api/dd-check?lat=${l.lat}&lon=${l.lng}`);
      const j = await r.json();
      setDdLive(p => ({ ...p, [l.id]: { road: j.road?.accessType, roadNote: j.road?.accessNote, flood: j.flood?.riskLabel } }));
    } catch {
      setDdLive(p => ({ ...p, [l.id]: { road: "error" } }));
    }
  };
  const [exporting, setExporting] = useState(false);
  const exportCSV = async () => {
    setExporting(true);
    const { data } = await supabase
      .from("tax_delinquent_properties")
      .select("final_score,deal_score,discount_pct,savings,state,county,apn,owner_name,property_address,acres,minimum_bid,judgment_amount,road_access,source,sale_date,raw_url")
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(500);
    const rows = (data as TaxLeadRow[]) || [];
    const cols = ["grade", "final_score", "discount_pct", "savings", "state", "county", "apn", "owner_name", "property_address", "acres", "minimum_bid", "judgment_amount", "road_access", "megaproject", "source", "sale_date", "raw_url"];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [cols.join(",")];
    for (const r of rows) {
      const grade = r.final_score != null ? gradeOf(r.final_score).letter : "";
      lines.push([grade, r.final_score, r.discount_pct, r.savings, r.state, r.county, r.apn, r.owner_name, r.property_address, r.acres, r.minimum_bid, r.judgment_amount, r.road_access, isCatalyst(r) ? "yes" : "", r.source, r.sale_date, r.raw_url].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terralot-top-deals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  // Direct-mail list: only contactable owners with a real mailing address.
  const [mailExporting, setMailExporting] = useState(false);
  const exportMailList = async () => {
    setMailExporting(true);
    const { data } = await supabase
      .from("tax_delinquent_properties")
      .select("owner_name,owner_address,county,state,apn,minimum_bid,judgment_amount,final_score,sale_date,source")
      .not("owner_name", "is", null).not("owner_address", "is", null)
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(2000);
    const junk = /no owner|no address|n\/a|^unknown|absentee|county tax/i;
    const rows = ((data as TaxLeadRow[]) || []).filter(r => r.owner_address && !junk.test(r.owner_address) && r.owner_name && !junk.test(r.owner_name));
    const parseAddr = (a: string) => {
      const p = a.split(",").map(s => s.trim());
      const zip = p.length && /\d{5}/.test(p[p.length - 1]) ? p.pop()! : "";
      const st = p.length && /^[A-Z]{2}$/.test(p[p.length - 1]) ? p.pop()! : "";
      const street = p.shift() || "";
      const city = p.join(", ");
      return { street, city, st, zip };
    };
    const cols = ["owner_name", "mail_street", "mail_city", "mail_state", "mail_zip", "property_county", "property_state", "apn", "min_bid", "value", "grade", "sale_date"];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [cols.join(",")];
    for (const r of rows) {
      const m = parseAddr(r.owner_address!);
      const grade = r.final_score != null ? gradeOf(r.final_score).letter : "";
      lines.push([r.owner_name, m.street, m.city, m.st, m.zip, r.county, r.state, r.apn, r.minimum_bid, r.judgment_amount, grade, r.sale_date].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `terralot-mail-list-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    setMailExporting(false);
  };

  // Comp value from acreage × state retail $/acre (only when we have both).
  const FULL2: Record<string, string> = { Texas: "TX", Florida: "FL", Georgia: "GA", Tennessee: "TN", "North Carolina": "NC", "New York": "NY", Arizona: "AZ", "New Mexico": "NM", Colorado: "CO", California: "CA", Arkansas: "AR", Nevada: "NV", Kentucky: "KY" };
  const compValue = (l: TaxLeadRow): number | null => {
    if (!l.acres || l.acres <= 0) return null;
    const st = l.state && /^[A-Za-z]{2}$/.test(l.state) ? l.state.toUpperCase() : (l.state ? FULL2[l.state] : null);
    const rate = st ? rates[st] : null;
    return rate ? Math.round(l.acres * rate) : null;
  };

  // ROI predictor (a planning calculator — not stored data)
  const [lettersSim, setLettersSim] = useState(1000);
  const [responsePctSim, setResponsePctSim] = useState(1.5);
  const [convPctSim, setConvPctSim] = useState(10);
  const [acqCostSim, setAcqCostSim] = useState(3000);
  const [marketValSim, setMarketValSim] = useState(15000);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let query = supabase
        .from("tax_delinquent_properties")
        .select("*", { count: "exact" });
      const orderCol = sort === "flip" ? "flip_score" : sort === "ownerfinance" ? "ownerfinance_score" : sort === "best" ? "final_score" : null;
      query = orderCol
        ? query.order(orderCol, { ascending: false, nullsFirst: false }).order("deal_score", { ascending: false, nullsFirst: false })
        : query.order("created_at", { ascending: false });
      query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (stateFilter !== "all") query = query.eq("state", stateFilter);
      const srcPat = srcFilter === "tax" ? "TAX:%" : srcFilter === "national" ? "SOCRATA:%" : srcFilter === "zillow" ? "ZILLOW%" : null;
      if (srcPat) query = query.like("source", srcPat);
      if (search.trim()) {
        const q = search.trim().replace(/[%,]/g, "");
        query = query.or(`county.ilike.%${q}%,owner_name.ilike.%${q}%,apn.ilike.%${q}%`);
      }

      const { data, count, error: err } = await query;
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLeads([]);
      } else {
        setLeads((data as TaxLeadRow[]) || []);
        setTotal(count ?? 0);
        if (data && data.length && !selected) setSelected((data[0] as TaxLeadRow).id);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, stateFilter, sort, search, srcFilter]);

  const states = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(l => l.state && s.add(l.state));
    return Array.from(s).sort();
  }, [leads]);

  const sel = leads.find(l => l.id === selected) || leads[0];

  // Predictor
  const simResponses = Math.round(lettersSim * (responsePctSim / 100));
  const simDeals = Math.round(simResponses * (convPctSim / 100));
  const totalSimCost = lettersSim * 0.85;
  const totalSimAcqCost = simDeals * acqCostSim;
  const totalProjectedValue = simDeals * marketValSim;
  const netProjectedProfit = totalProjectedValue - (totalSimCost + totalSimAcqCost);

  const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${n.toLocaleString()}`);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Off-Market Land Hunting</p>
          <h1 className="text-2xl font-bold mt-1">Acquisition Pipeline</h1>
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <EyeOff className="w-3 h-3" /> {total.toLocaleString()} scraped leads · live from <code className="font-mono">tax_delinquent_properties</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportMailList} disabled={mailExporting} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 border" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}>
            {mailExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Mail Listesi
          </button>
          <button onClick={exportCSV} disabled={exporting} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 border" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />} Export CSV (top 500)
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>
      </div>

      {/* Sourcing funnel — real coverage from the whole dataset */}
      {stats && (
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Sourcing Funnel</p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {stats.states} states · {stats.counties.toLocaleString()} counties scanned · {stats.struckOff.toLocaleString()} struck-off · {stats.withOwner.toLocaleString()} contactable
            </p>
          </div>
          <div className="flex items-stretch gap-1.5 overflow-x-auto">
            {[
              { label: "Records scraped", value: stats.total, color: "#8ed1df" },
              { label: "Evaluable", value: stats.evaluable, color: "#5aa9ff" },
              { label: "Deals (45+)", value: stats.score45, color: "#ffb43c" },
              { label: "Hot (70+)", value: stats.score70, color: "#50dc8c" },
              { label: "Elite (90+)", value: stats.score90, color: "#30c070" },
            ].map((f, i, arr) => (
              <div key={f.label} className="flex items-center gap-1.5 flex-shrink-0">
                <div className="rounded-lg px-4 py-3 min-w-[120px]" style={{ background: "var(--surface-low)", borderLeft: `3px solid ${f.color}` }}>
                  <p className="text-2xl font-extrabold font-mono" style={{ color: f.color }}>{f.value.toLocaleString()}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{f.label}</p>
                </div>
                {i < arr.length - 1 && <span className="text-stone-600 text-lg">→</span>}
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
            {stats.total.toLocaleString()} kayıttan <strong style={{ color: "#50dc8c" }}>{stats.score70.toLocaleString()} sıcak fırsat</strong> süzüldü — deal_score ile sıralı, en iyiler altta.
          </p>
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--surface-low)] p-2 rounded-xl border" style={{ borderColor: "var(--outline)" }}>
        <div className="flex gap-1.5">
          {([["pipeline", "Lead Pipeline"], ["predictor", "ROI Predictor"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider"
              style={{ background: tab === t ? "var(--primary)" : "transparent", color: tab === t ? "#fff" : "var(--muted)" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "pipeline" && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg border p-0.5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              {([["best", "🔥 Best"], ["flip", "💸 Flip"], ["ownerfinance", "🏦 O.Finance"], ["recent", "Recent"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => { setSort(k); setPage(0); }}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{ background: sort === k ? "rgba(142,209,223,0.1)" : "transparent", color: sort === k ? "var(--primary)" : "var(--muted)" }}>
                  {label}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="County / owner / APN ara…"
                className="bg-[var(--surface)] border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none w-48" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
              {search && <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--muted)" }}>✕</button>}
            </form>
            <select value={srcFilter} onChange={e => { setSrcFilter(e.target.value as typeof srcFilter); setPage(0); }}
              className="bg-[var(--surface)] border rounded-lg px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}>
              <option value="all">Tüm kaynaklar</option>
              <option value="tax">Tax · TX</option>
              <option value="national">National</option>
              <option value="zillow">Zillow</option>
            </select>
            <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(0); }}
              className="bg-[var(--surface)] border rounded-lg px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}>
              <option value="all">All states (page)</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-1 rounded-lg border p-0.5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              {(["list", "kanban"] as const).map(vt => (
                <button key={vt} onClick={() => setViewType(vt)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize"
                  style={{ background: viewType === vt ? "rgba(142,209,223,0.1)" : "transparent", color: viewType === vt ? "var(--primary)" : "var(--muted)" }}>
                  <span className="flex items-center gap-1.5">
                    {vt === "kanban" ? <LayoutGrid className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                    {vt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(255,80,80,0.08)", color: "#ff5050", border: "1px solid rgba(255,80,80,0.2)" }}>
          Supabase error: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm gap-2" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading real leads…
        </div>
      ) : tab === "predictor" ? (
        <div className="max-w-md">
          {/* Campaign ROI Predictor — a planning calculator, clearly not stored data */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--primary)]" />
              <span>Campaign ROI Predictor</span>
            </h3>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>Planning tool — assumptions you enter, not stored deal data.</p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 text-stone-400">Total Letters to Send</label>
                <input type="number" value={lettersSim} onChange={e => setLettersSim(Number(e.target.value))}
                  className="w-full bg-[var(--surface-low)] border rounded p-2 outline-none" style={{ borderColor: "var(--outline)" }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-stone-400">Response Rate (%)</label>
                  <input type="number" step="0.1" value={responsePctSim} onChange={e => setResponsePctSim(Number(e.target.value))}
                    className="w-full bg-[var(--surface-low)] border rounded p-2 outline-none" style={{ borderColor: "var(--outline)" }} />
                </div>
                <div>
                  <label className="block mb-1 text-stone-400">Purchase Rate (%)</label>
                  <input type="number" step="0.5" value={convPctSim} onChange={e => setConvPctSim(Number(e.target.value))}
                    className="w-full bg-[var(--surface-low)] border rounded p-2 outline-none" style={{ borderColor: "var(--outline)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-stone-400">Avg Buy Offer ($)</label>
                  <input type="number" value={acqCostSim} onChange={e => setAcqCostSim(Number(e.target.value))}
                    className="w-full bg-[var(--surface-low)] border rounded p-2 outline-none" style={{ borderColor: "var(--outline)" }} />
                </div>
                <div>
                  <label className="block mb-1 text-stone-400">Avg Market Val ($)</label>
                  <input type="number" value={marketValSim} onChange={e => setMarketValSim(Number(e.target.value))}
                    className="w-full bg-[var(--surface-low)] border rounded p-2 outline-none" style={{ borderColor: "var(--outline)" }} />
                </div>
              </div>
              <div className="border-t pt-4 mt-2 space-y-2.5" style={{ borderColor: "var(--outline)" }}>
                <div className="flex justify-between"><span className="text-stone-400">Mail Cost ($0.85/pc)</span><span className="font-semibold">${totalSimCost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-stone-400">Est. Owner Responses</span><span className="font-semibold text-amber-500">{simResponses} calls</span></div>
                <div className="flex justify-between"><span className="text-stone-400">Est. Deals Closed</span><span className="font-semibold text-emerald-400">{simDeals} properties</span></div>
                <div className="flex justify-between"><span className="text-stone-400">Acquisition Capital</span><span className="font-semibold">${totalSimAcqCost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-stone-400">Projected Market Value</span><span className="font-semibold">${totalProjectedValue.toLocaleString()}</span></div>
                <div className="p-3 rounded-lg text-center mt-2" style={{ background: netProjectedProfit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: netProjectedProfit >= 0 ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">Estimated Campaign Profit</p>
                  <p className="text-xl font-extrabold font-mono" style={{ color: netProjectedProfit >= 0 ? "var(--success)" : "var(--error)" }}>${netProjectedProfit.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : viewType === "kanban" ? (
        /* Kanban grouped by owner type (a real attribute we can derive) */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {(["tax_delinquent", "absentee", "estate", "corporate", "local"] as OwnerType[]).map(ot => {
            const group = leads.filter(l => deriveOwnerType(l) === ot);
            const cfg = ownerTypeLabel[ot];
            return (
              <div key={ot} className="rounded-xl border flex flex-col min-w-[200px] h-[550px]" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
                <div className="p-3 border-b flex justify-between items-center" style={{ borderColor: "rgba(255,255,255,0.05)", background: "var(--surface-low)" }}>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>{group.length}</span>
                </div>
                <div className="flex-1 p-2 overflow-y-auto space-y-2.5">
                  {group.map(l => {
                    const active = selected === l.id;
                    return (
                      <div key={l.id} onClick={() => setSelected(l.id)}
                        className="rounded-lg p-3 border cursor-pointer transition-all hover:translate-y-[-1px] active:scale-[0.98]"
                        style={{ background: active ? "rgba(142,209,223,0.04)" : "var(--surface-high)", borderColor: active ? "var(--primary)" : "rgba(255,255,255,0.05)" }}>
                        <h4 className="font-semibold text-xs text-stone-200 truncate">{deriveTitle(l)}</h4>
                        <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-stone-500" /> {l.county}, {l.state}</p>
                        <div className="flex items-center justify-between text-[10px] text-stone-500 mt-3 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.02)" }}>
                          <span>{l.acres ?? "—"} ac</span>
                          <span className="text-emerald-400 font-bold">{fmt(l.minimum_bid)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {group.length === 0 && <div className="text-center text-[10px] text-stone-600 italic py-12">None on this page</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {([["catalyst", "🔥 Megaproje"], ["top", "A+ · A"], ["struck", "Struck-off"], ["starred", "⭐ Takipte"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setChips(c => ({ ...c, [k]: !c[k] }))}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
                  style={{ borderColor: chips[k] ? "var(--accent-ink)" : "var(--outline)", background: chips[k] ? "rgba(14,125,151,0.1)" : "transparent", color: chips[k] ? "var(--accent-ink)" : "var(--muted)" }}>
                  {label}
                </button>
              ))}
            </div>
            {(() => {
              const listFiltered = leads.filter(l => (!chips.catalyst || isCatalyst(l)) && (!chips.top || ((l.final_score ?? l.deal_score ?? 0) >= 70)) && (!chips.struck || /STRUCK/i.test(l.source || "")) && (!chips.starred || tracking[l.id]?.starred));
              if (listFiltered.length === 0) {
                return (
                  <div className="text-center py-16 px-6 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)" }}>
                    <Search className="w-7 h-7 mx-auto mb-3" style={{ color: "var(--muted)" }} />
                    <p className="text-sm font-semibold mb-1">{leads.length === 0 ? "Bu sayfada lead yok" : "Filtrelerle eşleşen lead yok"}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {leads.length === 0
                        ? "Arama/eyalet filtresini gevşet ya da scraper senkronunu çalıştır (/api/admin/sync-deals)."
                        : "Üstteki chip filtrelerini (Megaproje / A+ / Struck-off / Takipte) temizle."}
                    </p>
                  </div>
                );
              }
              return listFiltered.map(l => {
              const ot = deriveOwnerType(l);
              const src = srcCfg(l.source);
              const active = selected === l.id;
              return (
                <button key={l.id} onClick={() => setSelected(l.id)}
                  className="w-full text-left rounded-xl p-4 border transition-all"
                  style={{ background: active ? "rgba(142,209,223,0.04)" : "var(--surface)", borderColor: active ? "var(--primary)" : "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={sort === "flip" ? l.flip_score : sort === "ownerfinance" ? l.ownerfinance_score : (l.final_score ?? l.deal_score)} size={34} />
                      <h3 className="font-semibold text-sm">{deriveTitle(l)}</h3>
                      {l.road_access === "landlocked" && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(255,80,80,0.12)", color: "#ff5050" }}>LANDLOCKED</span>
                      )}
                      {l.flood_score != null && l.flood_score >= 80 && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(80,150,255,0.12)", color: "#5096ff" }}>FLOOD</span>
                      )}
                      {/STRUCK/i.test(l.source || "") && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(90,169,255,0.12)", color: "#5aa9ff" }}>STRUCK OFF</span>
                      )}
                      {isCatalyst(l) && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(15,157,88,0.14)", color: "var(--grade-a)" }}>🔥 MEGAPROJE</span>
                      )}
                      {tracking[l.id]?.starred && <Star className="w-3 h-3" style={{ color: "#ffb43c", fill: "#ffb43c" }} />}
                      {tracking[l.id]?.stage && tracking[l.id]?.stage !== "new" && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--surface-high)", color: "var(--accent-ink)" }}>{STAGES.find(s => s[0] === tracking[l.id]?.stage)?.[1]}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${ownerTypeLabel[ot].color}1a`, color: ownerTypeLabel[ot].color }}>
                      {ownerTypeLabel[ot].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs mb-2 flex-wrap" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.county}, {l.state}</span>
                    <span>{l.acres ?? "—"} acres</span>
                    <span className="flex items-center gap-1"><src.icon className="w-3 h-3" /> {src.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span>Bid: <strong>{fmt(l.minimum_bid)}</strong></span>
                    <span>Value: <strong>{fmt(l.judgment_amount)}</strong></span>
                    {l.discount_pct != null && l.discount_pct > 0 && (
                      <span style={{ color: "#50dc8c" }}>-{l.discount_pct}% · <strong>+{fmt(l.savings)}</strong></span>
                    )}
                    {l.county_pop_growth != null && (
                      <span style={{ color: l.county_pop_growth >= 0.02 ? "#50dc8c" : l.county_pop_growth < 0 ? "#ff5050" : "var(--muted)" }}>
                        {l.county_pop_growth >= 0 ? "📈" : "📉"} {(l.county_pop_growth * 100).toFixed(1)}% nüfus/5y
                      </span>
                    )}
                    {l.sale_date && <span style={{ color: "#ffb43c" }}>Sale: <strong>{l.sale_date}</strong></span>}
                    {l.confidence != null && (
                      <span title="Veri güveni" style={{ color: l.confidence >= 70 ? "var(--muted)" : "#ffb43c" }}>
                        🛈 %{l.confidence} güven
                      </span>
                    )}
                  </div>
                </button>
              );
              });
            })()}
            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40" style={{ borderColor: "var(--outline)" }}>← Prev</button>
              <span className="text-xs" style={{ color: "var(--muted)" }}>Page {page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40" style={{ borderColor: "var(--outline)" }}>Next →</button>
            </div>
          </div>

          {/* Detail sidebar */}
          <div>
            {sel ? (
              <div className="rounded-xl border p-5 space-y-4 sticky top-6" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-start gap-3">
                  <ScoreBadge score={sel.final_score ?? sel.deal_score} size={46} />
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight">{deriveTitle(sel)}</h3>
                    <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{sel.county}, {sel.state} · {sel.acres ?? "—"} acres</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${ownerTypeLabel[deriveOwnerType(sel)].color}1a`, color: ownerTypeLabel[deriveOwnerType(sel)].color }}>{ownerTypeLabel[deriveOwnerType(sel)].label}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(142,209,223,0.1)", color: "#8ed1df" }}>{srcCfg(sel.source).label}</span>
                </div>

                {/* Skor kırılımı — neden bu skor */}
                <div className="rounded-lg p-3 space-y-1.5" style={{ background: "var(--surface-low)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>Skor sinyalleri</p>
                  {[
                    { k: "İndirim", ok: (sel.discount_pct ?? 0) >= 50, v: sel.discount_pct != null ? `-${sel.discount_pct}%` : "—" },
                    { k: "Kâr", ok: (sel.savings ?? 0) >= 10000, v: sel.savings != null ? `+$${sel.savings.toLocaleString()}` : "—" },
                    { k: "Likidite (talep)", ok: (sel.liquidity_score ?? 0) >= 50, v: sel.liquidity_score != null ? `${sel.liquidity_score}/100${sel.county_pop_growth != null ? ` · nüfus ${(sel.county_pop_growth * 100).toFixed(1)}%` : ""}` : "—" },
                    { k: "Rekabet", ok: /STRUCK/i.test(sel.source || ""), v: /STRUCK/i.test(sel.source || "") ? "struck-off (rakipsiz)" : /^TAX:/.test(sel.source || "") ? "açık artırma" : "retail" },
                    { k: "Sahip iletişimi", ok: !!sel.owner_name && !/absentee|unknown|county tax/i.test(sel.owner_name), v: sel.owner_name && !/absentee|unknown|county tax/i.test(sel.owner_name) ? "var ✓" : "yok" },
                    ...(sel.dd_checked ? [{ k: "Yol", ok: sel.road_access !== "landlocked", v: sel.road_access === "landlocked" ? "landlocked ✗" : "erişim var ✓" }] : []),
                  ].map((s) => (
                    <div key={s.k} className="flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--muted)" }}>{s.k}</span>
                      <span className="font-semibold" style={{ color: s.ok ? "var(--grade-a)" : "var(--muted)" }}>{s.v}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p style={{ color: "var(--muted)" }}>Owner</p><p className="font-semibold">{sel.owner_name || "—"}</p></div>
                  <div><p style={{ color: "var(--muted)" }}>APN</p><p className="font-mono font-semibold">{sel.apn || "—"}</p></div>
                  <div className="col-span-2"><p style={{ color: "var(--muted)" }}>Owner Address</p><p className="font-semibold">{sel.owner_address || "—"}</p></div>
                  <div className="col-span-2"><p style={{ color: "var(--muted)" }}>Property Address</p><p className="font-semibold">{sel.property_address || "—"}</p></div>
                  <div><p style={{ color: "var(--muted)" }}>Case #</p><p className="font-mono font-semibold">{sel.case_number || "—"}</p></div>
                  <div><p style={{ color: "var(--muted)" }}>Sale Date</p><p className="font-semibold">{sel.sale_date || "—"}</p></div>
                </div>

                <div className="p-3 rounded-lg" style={{ background: "rgba(80,220,140,0.06)", border: "1px solid rgba(80,220,140,0.15)" }}>
                  <div className="grid grid-cols-2 gap-2 text-xs text-center">
                    <div><p style={{ color: "var(--muted)" }}>Min Bid</p><p className="font-bold">{fmt(sel.minimum_bid)}</p></div>
                    <div><p style={{ color: "var(--muted)" }}>Judgment</p><p className="font-bold">{fmt(sel.judgment_amount)}</p></div>
                  </div>
                  {(() => {
                    const cv = compValue(sel);
                    if (!cv) return null;
                    const disc = sel.minimum_bid && sel.minimum_bid > 0 ? Math.round(((cv - sel.minimum_bid) / cv) * 100) : null;
                    return (
                      <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: "rgba(80,220,140,0.18)" }}>
                        <span style={{ color: "var(--muted)" }}>≈ Piyasa ({sel.acres} ac × $/acre)</span>
                        <span className="font-bold">{fmt(cv)}{disc != null && disc > 0 && <span style={{ color: "var(--grade-a)" }}> · -{disc}%</span>}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    // MAO = değerin %60'ı (yeniden satış maliyeti + marj bırakır)
                    const arv = compValue(sel) ?? sel.judgment_amount;
                    if (!arv || arv <= 0) return null;
                    const mao = Math.round(arv * 0.6);
                    const ok = sel.minimum_bid != null && sel.minimum_bid <= mao;
                    return (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(80,220,140,0.18)" }}>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: "var(--muted)" }}>🎯 Max teklif (MAO)</span>
                          <span className="font-extrabold" style={{ color: "var(--accent-ink)" }}>{fmt(mao)}</span>
                        </div>
                        {sel.minimum_bid != null && (
                          <p className="text-[10px] mt-0.5" style={{ color: ok ? "var(--grade-a)" : "var(--danger)" }}>
                            {ok ? `✓ Min teklif (${fmt(sel.minimum_bid)}) MAO altında — kârlı aralık` : `⚠ Min teklif (${fmt(sel.minimum_bid)}) MAO üstünde — dikkat`}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Due diligence — real results when dd_checked, else honest pending */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                    <ShieldCheck className="w-3 h-3" /> Due Diligence {sel.dd_checked ? "" : "— bekliyor"}
                  </p>
                  {sel.dd_checked ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        {sel.road_access === "landlocked"
                          ? <><AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--danger)" }} /><span style={{ color: "var(--danger)" }}>Yol yok — landlocked (riskli)</span></>
                          : <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--grade-a)" }} /><span>Yol erişimi: <strong>{sel.road_access === "direct" ? "doğrudan" : sel.road_access === "near" ? "yakın" : sel.road_access}</strong></span></>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {sel.flood_score == null
                          ? <span style={{ color: "var(--muted)" }}>Sel: kontrol edilemedi (ABD-dışı IP)</span>
                          : sel.flood_score >= 80
                            ? <><AlertTriangle className="w-3.5 h-3.5" style={{ color: "#5096ff" }} /><span style={{ color: "#5096ff" }}>Sel bölgesi (yüksek risk)</span></>
                            : <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--grade-a)" }} /><span>Sel riski düşük</span></>}
                      </div>
                    </div>
                  ) : ddLive[sel.id] && !ddLive[sel.id]!.loading ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        {ddLive[sel.id]!.road === "landlocked"
                          ? <><AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--danger)" }} /><span style={{ color: "var(--danger)" }}>Yol yok — landlocked</span></>
                          : <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--grade-a)" }} /><span>Yol: <strong>{ddLive[sel.id]!.road}</strong></span></>}
                      </div>
                      <p style={{ color: "var(--muted)" }}>Sel riski: {ddLive[sel.id]!.flood || "—"}</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>Bu lead henüz taranmadı.</p>
                      {sel.lat && sel.lng && (
                        <button onClick={() => runDDLive(sel)} disabled={ddLive[sel.id]?.loading}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-60" style={{ borderColor: "var(--accent-ink)", color: "var(--accent-ink)" }}>
                          {ddLive[sel.id]?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} DD çalıştır (canlı)
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Raw-land comps engine — nearby comparables by county + acreage ±30% */}
                <CompsPanel state={sel.state} county={sel.county} acres={sel.acres} />

                {sel.legal_description && (
                  <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.03)", color: "var(--muted)" }}>
                    <FileText className="w-3 h-3 inline mr-1" /> {sel.legal_description}
                  </div>
                )}

                {/* #10 Eyalet playbook — redemption / sale-type kuralı */}
                {(() => {
                  const st = sel.state && /^[A-Za-z]{2}$/.test(sel.state) ? sel.state.toUpperCase() : (sel.state ? FULL2[sel.state] : null);
                  const rule = st ? STATE_RULES[st] : null;
                  if (!rule) return null;
                  return (
                    <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(255,180,60,0.08)", border: "1px solid rgba(255,180,60,0.2)" }}>
                      <p className="font-bold mb-1" style={{ color: "var(--warn)" }}>📋 {st} kuralı · {rule.type}</p>
                      <p style={{ color: "var(--muted)" }}><strong>Redemption:</strong> {rule.redemption}</p>
                      <p className="mt-1" style={{ color: "var(--muted)" }}>{rule.tip}</p>
                    </div>
                  );
                })()}

                {/* Pipeline yönetimi — #6 lifecycle · #7 watchlist · #8 outreach · #9 P&L */}
                {(() => {
                  const t = tracking[sel.id] || { lead_id: sel.id };
                  const owned = ["owned", "listed", "sold"].includes(t.stage || "");
                  const profit = t.sold_price != null && t.acquired_cost != null ? t.sold_price - t.acquired_cost - (sel.minimum_bid ?? 0) * 0 : null;
                  return (
                    <div className="rounded-lg p-3 space-y-2.5" style={{ background: "var(--surface-low)" }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Pipeline</p>
                        <button onClick={() => saveTrack(sel.id, { starred: !t.starred })} title="Watchlist">
                          <Star className="w-4 h-4" style={{ color: t.starred ? "#ffb43c" : "var(--muted)", fill: t.starred ? "#ffb43c" : "none" }} />
                        </button>
                      </div>
                      <select value={t.stage || "new"} onChange={e => saveTrack(sel.id, { stage: e.target.value })}
                        className="w-full bg-[var(--surface)] border rounded-lg px-2 py-1.5 text-xs outline-none" style={{ borderColor: "var(--outline)" }}>
                        {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      <input type="number" placeholder="Max teklifim ($)" defaultValue={t.max_offer ?? ""} onBlur={e => saveTrack(sel.id, { max_offer: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-[var(--surface)] border rounded-lg px-2 py-1.5 text-xs outline-none" style={{ borderColor: "var(--outline)" }} />
                      <textarea placeholder="Not…" defaultValue={t.notes ?? ""} onBlur={e => saveTrack(sel.id, { notes: e.target.value })} rows={2}
                        className="w-full bg-[var(--surface)] border rounded-lg px-2 py-1.5 text-xs outline-none resize-none" style={{ borderColor: "var(--outline)" }} />
                      {owned && (
                        <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: "var(--outline)" }}>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input type="number" placeholder="Alış $" defaultValue={t.acquired_cost ?? ""} onBlur={e => saveTrack(sel.id, { acquired_cost: e.target.value ? Number(e.target.value) : null })} className="bg-[var(--surface)] border rounded px-1.5 py-1 text-[11px] outline-none" style={{ borderColor: "var(--outline)" }} />
                            <input type="number" placeholder="Liste $" defaultValue={t.list_price ?? ""} onBlur={e => saveTrack(sel.id, { list_price: e.target.value ? Number(e.target.value) : null })} className="bg-[var(--surface)] border rounded px-1.5 py-1 text-[11px] outline-none" style={{ borderColor: "var(--outline)" }} />
                            <input type="number" placeholder="Satış $" defaultValue={t.sold_price ?? ""} onBlur={e => saveTrack(sel.id, { sold_price: e.target.value ? Number(e.target.value) : null })} className="bg-[var(--surface)] border rounded px-1.5 py-1 text-[11px] outline-none" style={{ borderColor: "var(--outline)" }} />
                          </div>
                          {profit != null && <p className="text-xs font-bold" style={{ color: profit >= 0 ? "var(--grade-a)" : "var(--danger)" }}>Kâr: {profit >= 0 ? "+" : ""}{fmt(profit)}</p>}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <button onClick={() => printDealSheet(sel)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90" style={{ background: "var(--primary)", color: "#fff" }}>
                  <FileText className="w-3.5 h-3.5" /> Deal Sheet (Yazdır / PDF)
                </button>
                {sel.raw_url && (
                  <a href={sel.raw_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90" style={{ background: "var(--surface-high)", color: "var(--foreground)" }}>
                    <ExternalLink className="w-3.5 h-3.5" /> View source listing
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-xl border p-12 flex flex-col items-center justify-center text-center" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.05)" }}>
                <Target className="w-10 h-10 mb-3" style={{ color: "var(--muted)" }} />
                <p className="font-semibold">Select a lead</p>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Click a lead to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Raw-land comps engine panel (Feature: /api/parcel-comps) ──────────────────
// Fetches nearby comparables for the selected lead (county + acreage ±30%).
interface CompRow { competitor: string | null; county: string | null; acres: number; price: number; perAcre: number; sold: boolean; date: string | null; rawUrl: string | null }
interface CompSummary { count: number; scope: string; medianPerAcre: number | null; adjustedValue: number | null; soldCount: number; hasSoldData: boolean; dateRange: { from: string; to: string } | null }

function CompsPanel({ state, county, acres }: { state: string | null; county: string | null; acres: number | null }) {
  const [comps, setComps] = useState<CompRow[]>([]);
  const [summary, setSummary] = useState<CompSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!state) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("state", state);
    if (county) params.set("county", county);
    if (acres) params.set("acres", String(acres));
    fetch(`/api/parcel-comps?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => { if (cancelled) return; setComps(j.comps || []); setSummary(j.summary || null); })
      .catch(() => { if (!cancelled) { setComps([]); setSummary(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [state, county, acres]);

  const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface-low)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <Layers className="w-3 h-3" /> Comps {summary ? `· ${summary.count}` : ""}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--muted)" }}><Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor…</div>
      ) : !summary || summary.count === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          {state ? `Bu county/acreage için comp yok (competitor_listings).` : "Eyalet bilinmiyor."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div><p style={{ color: "var(--muted)" }}>Medyan $/acre</p><p className="font-bold">{fmt(summary.medianPerAcre)}</p></div>
            <div><p style={{ color: "var(--muted)" }}>Düzelt. değer</p><p className="font-bold" style={{ color: "var(--grade-a)" }}>{fmt(summary.adjustedValue)}</p></div>
          </div>
          <p className="text-[10px] mb-2" style={{ color: "var(--muted)" }}>
            {summary.count} comp · {summary.scope === "county" ? "county" : "state geneli"} · ±30% acreage
            {summary.soldCount > 0 && summary.hasSoldData ? ` · ${summary.soldCount} satılmış` : ""}
            {summary.dateRange ? ` · ${summary.dateRange.from} → ${summary.dateRange.to}` : ""}
          </p>
          <button onClick={() => setOpen((o) => !o)} className="text-[11px] font-semibold" style={{ color: "var(--accent-ink)" }}>
            {open ? "Gizle" : `Comp'ları gör (${comps.length})`}
          </button>
          {open && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5">
              {comps.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] gap-2">
                  <span className="truncate" style={{ color: "var(--muted)" }}>
                    {c.sold && <span style={{ color: "var(--grade-a)" }}>● </span>}
                    {c.acres}ac{c.competitor ? ` · ${c.competitor}` : ""}{c.date ? ` · ${c.date.slice(0, 10)}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">{fmt(c.perAcre)}/ac</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
