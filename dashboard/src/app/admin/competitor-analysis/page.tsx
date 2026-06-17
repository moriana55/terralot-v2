"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Building2, Search, Compass, DollarSign, ArrowUpRight, TrendingUp, AlertTriangle, Layers, Percent, MapPin, Loader2, Calculator, HelpCircle } from "lucide-react";

interface CompetitorListing {
  id: string;
  competitor: string;
  title: string;
  state: string;
  county: string;
  acres: number;
  price: number; // Retail listing price
  downPayment: number;
  monthlyPayment: number;
  termMonths: number;
  docFee: number;
  apn: string;
  notes: string;
  ourSourceCost: number; // What we can win it for at a tax auction / direct mail
}

// Raw snake_case row from Supabase table: competitor_listings
interface CompetitorRow {
  id: string;
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  price: number | null;
  down_payment: number | null;
  monthly_payment: number | null;
  term_months: number | null;
  doc_fee: number | null;
  apn: string | null;
  notes: string | null;
  our_source_cost: number | null;
}

function mapRow(r: CompetitorRow): CompetitorListing {
  return {
    id: r.id,
    competitor: r.competitor || "Unknown",
    title: r.title || "Untitled listing",
    state: r.state || "—",
    county: r.county || "—",
    acres: r.acres ?? 0,
    price: r.price ?? 0,
    downPayment: r.down_payment ?? 0,
    monthlyPayment: r.monthly_payment ?? 0,
    termMonths: r.term_months ?? 0,
    docFee: r.doc_fee ?? 0,
    apn: r.apn || "—",
    notes: r.notes || "",
    ourSourceCost: r.our_source_cost ?? 0,
  };
}


export default function CompetitorAnalysisPage() {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<CompetitorListing[]>([]);
  const [rates, setRates] = useState<{ state: string; perAcre: number; n: number }[]>([]);

  useEffect(() => {
    fetch("/api/market-rates").then((r) => r.json()).then((j) => setRates(j.rates || [])).catch(() => {});
  }, []);

  // Pull real competitor listings from Supabase (fed by the competitor scraper module).
  const loadListings = async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("competitor_listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else {
      const mapped = ((data as CompetitorRow[]) || []).map(mapRow);
      setListings(mapped);
      setSelectedListingId(prev => prev || mapped[0]?.id || "");
    }
  };

  useEffect(() => {
    (async () => { setLoading(true); await loadListings(); setLoading(false); })();
  }, []);

  // Trigger the competitor scraper, then refresh from the table.
  const runCompetitorScraper = async () => {
    setScraping(true);
    try {
      await fetch("/api/competitor-scraper", { method: "POST" });
    } catch {
      /* worker may run out-of-band; we still refresh below */
    }
    await loadListings();
    setScraping(false);
  };

  const filteredListings = listings.filter(l => {
    const matchesCompetitor = selectedCompetitor === "all" || l.competitor === selectedCompetitor;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.county.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.state.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCompetitor && matchesSearch;
  });

  const activeListing = listings.find(l => l.id === selectedListingId) || listings[0];

  // Calculations for active listing
  const totalRetailFinanced = activeListing 
    ? activeListing.downPayment + activeListing.docFee + (activeListing.monthlyPayment * activeListing.termMonths)
    : 0;

  const netArbitrageProfit = activeListing ? totalRetailFinanced - activeListing.ourSourceCost : 0;
  const markupPercent = activeListing ? Math.round((netArbitrageProfit / activeListing.ourSourceCost) * 100) : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Competitor Intel & Sourcing Arbitrage</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Monitor and crawl retail land listings from Discount Lots and Rina Land. Analyze variables to structure high-margin owner financing offers.
          </p>
        </div>
        <button onClick={runCompetitorScraper} disabled={scraping}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--background)" }}>
          {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {scraping ? "Crawling Competitors..." : "Execute Competitor Scraper"}
        </button>
      </div>

      {/* Market $/acre benchmark — real, from competitor retail listings */}
      {rates.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">Piyasa $/acre — eyalet bazlı</h2>
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>rakip retail medyanı · değer çapraz-kontrolü</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {rates.map((r) => (
              <div key={r.state} className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface-low)" }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold">{r.state}</span>
                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>{r.n} ilan</span>
                </div>
                <p className="text-sm font-extrabold font-mono mt-1" style={{ color: "var(--accent-ink)" }}>${r.perAcre.toLocaleString()}</p>
                <p className="text-[9px]" style={{ color: "var(--muted)" }}>/acre</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Strategy Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            name: "Discount Lots",
            avgDown: "$0 - $295",
            typicalTerms: "60 - 84 mos",
            strategy: "High volume, $99 down/monthly anchors, heavy doc fee markup ($300).",
            status: "Low-Down Retailer",
            color: "var(--primary)"
          },
          {
            name: "Rina Land",
            avgDown: "$199 - $500",
            typicalTerms: "48 - 72 mos",
            strategy: "Off-grid rural plots, simple raw land contracts, targeting preppers.",
            status: "Off-Grid Specialist",
            color: "var(--tertiary)"
          },
          {
            name: "TerraLot (Us)",
            avgDown: "Flexible ($250)",
            typicalTerms: "36 - 60 mos",
            strategy: "Premium GIS-verified land, automated Stripe management, high comps integrity.",
            status: "Our Target Model",
            color: "var(--success)"
          }
        ].map(comp => (
          <div key={comp.name} className="rounded-xl border p-5 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: comp.color }}>
                {comp.status}
              </span>
              <Building2 className="w-4 h-4 text-stone-500" />
            </div>
            <h3 className="font-bold text-base">{comp.name}</h3>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{comp.strategy}</p>
            <div className="pt-2 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <div>
                <p style={{ color: "var(--muted)" }}>Peşinat Model:</p>
                <p className="font-bold">{comp.avgDown}</p>
              </div>
              <div>
                <p style={{ color: "var(--muted)" }}>Finansman Vadeleri:</p>
                <p className="font-bold">{comp.typicalTerms}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Listings + Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Table & Search */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted)" }} />
              <input type="text" placeholder="Filter by county or state..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg text-sm border outline-none bg-[var(--surface)]"
                style={{ borderColor: "var(--outline)", color: "var(--foreground)" }} />
            </div>
            <div className="flex gap-1 rounded-lg border p-0.5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              {["all", "Discount Lots", "Rina Land"].map(c => (
                <button key={c} onClick={() => setSelectedCompetitor(c)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize whitespace-nowrap"
                  style={{
                    background: selectedCompetitor === c ? "rgba(142,209,223,0.1)" : "transparent",
                    color: selectedCompetitor === c ? "var(--primary)" : "var(--muted)",
                  }}>
                  {c === "all" ? "All Competitors" : c}
                </button>
              ))}
            </div>
          </div>

          {/* List Table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface-low)" }}>
                  {["Competitor", "Location", "Acres", "Down/Monthly", "Our Sourcing", "Action"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loading || filteredListings.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs" style={{ color: "var(--muted)" }}>
                      {loading ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading competitor listings…</span>
                      ) : error ? (
                        <span style={{ color: "#ff5050" }}>Supabase error: {error}</span>
                      ) : (
                        <span>No competitor listings yet. Run <strong>Execute Competitor Scraper</strong> to crawl Discount Lots, Rina Land &amp; Landio.</span>
                      )}
                    </td>
                  </tr>
                )}
                {filteredListings.map(l => (
                  <tr key={l.id} 
                    className={`border-b transition-colors cursor-pointer ${selectedListingId === l.id ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"}`}
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => setSelectedListingId(l.id)}>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase" 
                        style={{ 
                          background: l.competitor === "Discount Lots" ? "rgba(142,209,223,0.1)" : "rgba(251,185,131,0.1)",
                          color: l.competitor === "Discount Lots" ? "var(--primary)" : "var(--tertiary)"
                        }}>
                        {l.competitor}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-xs truncate max-w-[150px]">{l.title}</p>
                        <p className="text-[10px]" style={{ color: "var(--muted)" }}>{l.county}, {l.state}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">{l.acres} ac</td>
                    <td className="py-3 px-4 text-xs">
                      <div>
                        <p className="font-semibold">${l.downPayment} down</p>
                        <p className="text-[10px]" style={{ color: "var(--muted)" }}>${l.monthlyPayment}/mo x {l.termMonths}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-emerald-400">${l.ourSourceCost}</td>
                    <td className="py-3 px-4">
                      <button className="text-[10px] font-bold uppercase text-[var(--primary)] hover:underline">
                        Calculate ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Visual Arbitrage Calculation */}
        <div className="space-y-4">
          {activeListing ? (
            <div className="rounded-xl border p-5 space-y-5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              <div className="border-b pb-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--primary)]">{activeListing.competitor} Contract</span>
                <h3 className="font-bold text-sm mt-1">{activeListing.title}</h3>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{activeListing.county} County, {activeListing.state} · APN: {activeListing.apn}</p>
              </div>

              {/* Dynamic Arbitrage Math Calculator display */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Arbitrage Financial Breakdown</h4>
                
                <div className="space-y-2 text-xs p-3 rounded-lg" style={{ background: "var(--surface-low)" }}>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Down Payment</span>
                    <span className="font-semibold">${activeListing.downPayment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Doc Setup Fee</span>
                    <span className="font-semibold text-amber-500">${activeListing.docFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>Financed Term</span>
                    <span className="font-semibold">${activeListing.monthlyPayment} × {activeListing.termMonths} mos</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <span>Total Retail Financed</span>
                    <span className="text-amber-500 font-mono">${totalRetailFinanced.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-center font-bold text-xs" style={{ color: "var(--muted)" }}>VS.</div>

                <div className="p-3 rounded-lg border border-emerald-500/20" style={{ background: "rgba(16,185,129,0.02)" }}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--muted)" }}>Our Sourcing Cost (Tax Deed)</span>
                    <span className="font-bold text-emerald-400 font-mono">${activeListing.ourSourceCost.toLocaleString()}</span>
                  </div>
                  <p className="text-[9px]" style={{ color: "var(--muted)" }}>Outstanding taxes + deed registration + title lookup</p>
                </div>

                {/* Final ROI Metric */}
                <div className="p-4 rounded-xl text-center space-y-1" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <p className="text-[9px] uppercase tracking-wider font-semibold text-emerald-500">Gross Arbitrage Spread</p>
                  <p className="text-2xl font-extrabold font-mono text-emerald-400">+${netArbitrageProfit.toLocaleString()}</p>
                  <p className="text-xs font-bold text-emerald-500 flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>{markupPercent}% Markup ROI</span>
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="p-3 rounded-lg text-xs italic" style={{ background: "rgba(255,255,255,0.02)", color: "var(--muted)" }}>
                <strong>Analiz Notu:</strong> {activeListing.notes}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center" style={{ color: "var(--muted)" }}>
              <p className="text-sm">Select a listing to calculate target ROI</p>
            </div>
          )}
        </div>
      </div>

      {/* Competitor Strategy & Sourcing Knowledge Base */}
      <div className="mt-8 border-t pt-8 animate-fadeIn" style={{ borderColor: "var(--outline)" }}>
        <div className="mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[var(--primary)]" />
            <span>Stratejik Arbitraj & İş Modeli Analizi</span>
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Discount Lots, Rina Land ve Landio gibi devlerin kullandığı finansal kaldıraç yöntemleri ve iş modelinin derinlemesine incelenmesi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Tax Deed Sırrı */}
          <div className="rounded-xl border p-5 space-y-3 transition-all hover:translate-y-[-2px] duration-200" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
              <h3 className="font-bold text-sm">1. Vergi İcrası İhalesi (Tax Deed) Sırrı</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              Piyasa değeri <strong className="text-white">$15,000</strong> olan bir araziyi nasıl <strong className="text-white">$1,100</strong> gibi komik rakamlara kapatabiliyoruz? 
              ABD&apos;deki yerel yönetimler (County) arazi ticareti yapmaz. Tek amaçları, yıllarca ödenmemiş emlak vergilerini (<em className="text-stone-300">back taxes</em>) tahsil edip bütçeyi dengelemektir. 
              İhale başlangıç bedeli sadece birikmiş vergi borcu kadardır. Biz bu açığı ve otomasyonumuzu kullanarak, rekabetin girmediği küçük parselleri doğrudan ihale veya &ldquo;Direct Mail&rdquo; teklifleriyle maliyetine topluyoruz.
            </p>
          </div>

          {/* Card 2: Default (Taksit İptali) Döngüsü */}
          <div className="rounded-xl border p-5 space-y-3 transition-all hover:translate-y-[-2px] duration-200" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">2. Default (Taksit İptali) Döngüsü</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              Senetli Satış (<em className="text-stone-300">Land Contract / Contract for Deed</em>) modelinin en büyük finansal kaldıracıdır. 
              Geleneksel konut kredisindeki gibi hantal icra/tahliye (<em className="text-stone-300">foreclosure</em>) süreçleri yoktur. Alıcı ödemeyi kestiğinde, sözleşme feshedilir ve mülkiyet hakkı anında satıcıda kalmaya devam eder. 
              Alıcının o güne kadar ödediği peşinat, dosya masrafları ve aylık taksitler tamamen kâr olarak hanemize yazılır. Arazi ise sıfır ek maliyetle anında tekrar satışa sunulur.
            </p>
          </div>

          {/* Card 3: Pazarlama Hileleri (Low Down / Doc Fees) */}
          <div className="rounded-xl border p-5 space-y-3 transition-all hover:translate-y-[-2px] duration-200" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <div className="flex items-center gap-2 text-[var(--primary)]">
              <DollarSign className="w-5 h-5" />
              <h3 className="font-bold text-sm">3. Pazarlama Hileleri (Low Down & Setup Fees)</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              Müşteriye sunulan reklamlar psikolojik olarak sıfır bariyer hedefler: <span className="text-white font-semibold">&ldquo;$1 Down, $0 Down&rdquo;</span>. 
              Ancak satın alma adımında eklenen <span className="text-amber-500 font-semibold">$300 Belge Hazırlama Ücreti (Doc/Setup Fee)</span> sayesinde, daha ilk günden arazinin asıl alış maliyetinin (sourcing cost) önemli bir kısmı peşin olarak tahsil edilmiş olur. 
              Bu sayede nakit akışı döngüsü daha 1. aydan kâra geçer ve pazarlama bütçesini kendi kendine fonlar.
            </p>
          </div>

          {/* Card 4: Neden Büyük Firmalar Boğuluyor? */}
          <div className="rounded-xl border p-5 space-y-3 transition-all hover:translate-y-[-2px] duration-200" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <div className="flex items-center gap-2 text-rose-400">
              <Layers className="w-5 h-5" />
              <h3 className="font-bold text-sm">4. Büyük Firmaların Operasyonel Körlüğü</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              Geleneksel gayrimenkul firmaları (Zillow, Redfin veya yerel emlak ofisleri) yüksek komisyonlar, manuel tapu incelemeleri ve hantal hukuk departmanları ile çalışır. 
              $5,000 - $20,000 bandındaki küçük arazilerle uğraşmak onlar için kârlı değildir. 
              Bizim sunduğumuz GIS (Coğrafi Bilgi Sistemleri) destekli otomatik imar/sel durumu sorgulama hattı ve dijital sözleşme yönetimi, bu pazarı sıfır operasyonel insan gücüyle tamamen domine etmemizi sağlar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
