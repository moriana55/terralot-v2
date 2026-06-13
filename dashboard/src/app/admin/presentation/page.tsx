"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Briefcase, Compass, Mail, RefreshCw, Calculator, Calendar, 
  ArrowRight, ShieldCheck, CheckCircle2, ChevronRight, AlertTriangle, 
  TrendingUp, DollarSign, PieChart, Layers, Users, Zap, MapPin, 
  Search, ShieldAlert, BadgePercent, Clock, Star, FileText
} from "lucide-react";

type SlideId = "summary" | "states" | "sourcing" | "default-loop" | "roi-calc" | "timeline";

interface StateData {
  name: string;
  platting: string;
  roadAccess: string;
  targetCounties: string[];
  pros: string[];
  cons: string[];
  score: number;
}

export default function PresentationPage() {
  const [activeSlide, setActiveSlide] = useState<SlideId>("summary");
  const [stateView, setStateView] = useState<"pilot" | "red" | "matrix">("pilot");

  // State comparative data
  const states: StateData[] = [
    {
      name: "New Mexico",
      platting: "35+ Acre splits are completely exempt from county subdivision reviews/platting (unincorporated areas).",
      roadAccess: "Easier in desert counties. Dirt road or deeded easement is generally sufficient.",
      targetCounties: ["Valencia", "Luna", "Socorro", "Torrance"],
      pros: [
        "Extremely low acquisition cost ($500-$2,000)",
        "35-acre split exemption avoids bureaucratic delays",
        "Very fast transactions with county clerk"
      ],
      cons: [
        "Lower price ceiling per acre",
        "Water/well depth issues in specific basins"
      ],
      score: 92
    },
    {
      name: "Texas",
      platting: "5+ Acre splits outside ETJs/municipal limits require no platting (varies slightly by county rules).",
      roadAccess: "Strict access laws. Landlocked parcels require explicit utility/road easement agreements.",
      targetCounties: ["Culberson", "Hudspeth", "Presidio", "Reeves"],
      pros: [
        "High demand, fast resale velocity",
        "Strong homesteading / off-grid culture",
        "No state income tax"
      ],
      cons: [
        "Higher starting auction prices",
        "Access easement verification can be complex"
      ],
      score: 88
    },
    {
      name: "Arizona",
      platting: "Splitting into 5 or fewer parcels of 10+ acres avoids public hearings and requires only simple staff review.",
      roadAccess: "Easements are frequently recorded on historic patent maps, but physical access may be rough.",
      targetCounties: ["Apache", "Navajo", "Cochise", "Mohave"],
      pros: [
        "Highly popular off-grid market",
        "Clean GIS mapping databases in most counties",
        "High search interest on land portals"
      ],
      cons: [
        "Water haul requirements are standard",
        "Strict rules on 'subdivided' definitions if >5 splits"
      ],
      score: 85
    },
    {
      name: "Missouri",
      platting: "No statewide zoning/subdivision laws in unincorporated rural counties; extremely loose local regulation.",
      roadAccess: "Usually deeded easements or existing county roads, minimal restrictions.",
      targetCounties: ["Ozark", "Shannon", "Texas County", "Douglas"],
      pros: [
        "High rainfall, abundant water (springs, creeks)",
        "Zero building code enforcement in rural zones",
        "Wooded terrain is highly attractive for recreational buyers"
      ],
      cons: [
        "High vegetation makes drone surveys difficult",
        "Title searches require careful easement checking"
      ],
      score: 90
    },
    {
      name: "Arkansas",
      platting: "Unincorporated areas are mostly free from county subdivision review for tracts over 5-10 acres.",
      roadAccess: "County roads are widespread, but mountain slopes can make access physically difficult.",
      targetCounties: ["Izard", "Sharp", "Fulton", "Carroll"],
      pros: [
        "Extremely cheap wooded parcels ($1k-$3k)",
        "Highly active recreational/hunting land market",
        "Low annual property taxes"
      ],
      cons: [
        "Slope/topography can limit buildable spots",
        "Slightly slower resale velocity than Texas"
      ],
      score: 87
    }
  ];

  // Financial Simulator State Variables
  const [capitalPool, setCapitalPool] = useState<number>(30000);
  const [avgAcqCost, setAvgAcqCost] = useState<number>(3000);
  const [markupMultiplier, setMarkupMultiplier] = useState<number>(2.5);
  const [termMonths, setTermMonths] = useState<number>(24);
  const [downPayment, setDownPayment] = useState<number>(299);
  const [defaultRate, setDefaultRate] = useState<number>(30); // in percent

  // Derived financial variables
  const numParcels = Math.floor(capitalPool / (avgAcqCost + 300)); // Sourcing cost + $300 closing/due diligence
  const totalCostBasis = numParcels * (avgAcqCost + 300);
  const avgSalePrice = avgAcqCost * markupMultiplier;
  const financingPrincipal = avgSalePrice - downPayment;
  const monthlyPaymentPerParcel = Math.round(financingPrincipal / termMonths);
  
  // Adjusted for default rate:
  // In typical land contract, default happens ~30% of the time.
  // When a default occurs, they keep the downpayment + payments paid so far (e.g. 6 months average),
  // and the parcel returns to inventory to be sold AGAIN.
  // Let's model a 12-month run:
  // We assume all parcels get sold within month 1-4.
  // Defaulted parcels return to inventory and get resold, generating another downpayment and starting the payments again.
  const resaleMultiplier = 1 + (defaultRate / 100); // e.g. 1.3 sales per parcel
  const totalSalesCount = Math.round(numParcels * resaleMultiplier);
  const initialDownpaymentRevenue = totalSalesCount * downPayment;
  
  // Total projected revenue over the full term:
  // Total term payments + downpayments
  const totalInstallmentRevenue = numParcels * financingPrincipal; // including defaulted and completed
  const totalProjectedRevenue = initialDownpaymentRevenue + totalInstallmentRevenue;
  
  // Net Margin & ROI
  const netProfit = totalProjectedRevenue - totalCostBasis;
  const netROI = Math.round((netProfit / totalCostBasis) * 100);
  const maxMRR = numParcels * monthlyPaymentPerParcel;

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0a0a0f", color: "#f0f0f5" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Interactive Pitch Deck
            </span>
            <span className="text-xs text-white/40">v2.0</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Terra<span className="text-cyan-400">Lot</span> Investor Presentation
          </h1>
          <p className="text-sm mt-1 text-white/50">
            A comprehensive, data-driven business roadmap and platform showcase for the US Land Installment model.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <Link 
            href="/admin/presentation/whitepaper"
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Resmi Rapor (Beyaz Sayfa)
          </Link>
          <button 
            onClick={() => {
              window.print();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-white/10 hover:bg-white/5 transition-all"
          >
            Export to PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-3 mb-2">SUNUM İÇERİĞİ</p>
          {[
            { id: "summary", label: "1. Vizyon & İş Modeli", icon: Briefcase },
            { id: "states", label: "2. Eyaletlerin Analizi", icon: Compass },
            { id: "sourcing", label: "3. Off-Market Alım Akışı", icon: Mail },
            { id: "default-loop", label: "4. Pazarlama & Default Döngüsü", icon: RefreshCw },
            { id: "roi-calc", label: "5. ROI & Gelir Simülatörü", icon: Calculator },
            { id: "timeline", label: "6. 30 Günlük Yol Haritası", icon: Calendar },
          ].map(s => {
            const Icon = s.icon;
            const active = activeSlide === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSlide(s.id as SlideId)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all"
                style={{
                  background: active ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.02)",
                  border: active ? "1px solid rgba(34,211,238,0.2)" : "1px solid rgba(255,255,255,0.05)",
                  color: active ? "#22d3ee" : "#a1a1aa",
                }}
              >
                <Icon className={`w-4 h-4 ${active ? "text-cyan-400 animate-pulse" : "text-white/40"}`} />
                {s.label}
              </button>
            );
          })}

          {/* Quick Client Pitch Banner */}
          <div className="mt-8 p-4 rounded-xl border border-yellow-500/10 bg-yellow-500/5 text-xs text-yellow-200/80 leading-relaxed">
            <span className="font-bold flex items-center gap-1 mb-1 text-yellow-400">
              <Star className="w-3.5 h-3.5" /> Sunum Tavsiyesi
            </span>
            Müşteriye modelin en güçlü yanını hatırlatın: Arsa somuttur, değer kaybetmez. Taksitle satıp default edilince mülkiyet bizde kalır ve tekrar satılır.
          </div>
        </div>

        {/* Slide Window */}
        <div className="lg:col-span-3 min-h-[500px] bg-white/[0.02] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col justify-between">
          
          {/* SLIDE 1: SUMMARY */}
          {activeSlide === "summary" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Briefcase className="text-cyan-400" /> Vizyon & İş Modeli Özeti
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Amerika genelindeki ucuz arsaları toplayıp global pazarda taksitle satma mekanizması.
                </p>
              </div>

              {/* Core metrics / numbers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">ALIŞ FİYATI</p>
                  <p className="text-3xl font-extrabold text-white mt-1">
                    %50-75 <span className="text-xs font-normal text-white/40">indirimli</span>
                  </p>
                  <p className="text-xs text-white/50 mt-1">County vergi ihalelerinden ve off-market mailer kampanyalarından.</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">TAKSİT SÜRESİ</p>
                  <p className="text-3xl font-extrabold text-cyan-400 mt-1">
                    12 - 36 <span className="text-xs font-normal text-white/40">ay</span>
                  </p>
                  <p className="text-xs text-white/50 mt-1">Kredi kontrolsüz, düşük peşinat ($99-499) ve cazip aylık ödemeler.</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">TAHMİNİ BRÜT ROI</p>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">
                    %150+ <span className="text-xs font-normal text-white/40">marj</span>
                  </p>
                  <p className="text-xs text-white/50 mt-1">Temerrüt durumunda arsanın geri alınıp tekrar satılması dahil.</p>
                </div>
              </div>

              {/* Problem / Solution Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="p-5 rounded-xl border border-red-500/10 bg-red-500/5">
                  <h3 className="font-bold text-red-400 flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4" /> Sektördeki Problem
                  </h3>
                  <ul className="space-y-2 text-xs text-white/70">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      Geleneksel emlakçılar boş ve ucuz arsalarla ilgilenmez (komisyon düşüktür).
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      Bankalar ham toprağa kredi vermez; alıcıların %80'i nakit sıkıntısı çeker.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      Rakipler eski excel tabloları kullanır, ödemeleri manuel takip eder.
                    </li>
                  </ul>
                </div>
                <div className="p-5 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
                  <h3 className="font-bold text-emerald-400 flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4" /> TerraLot Çözümü
                  </h3>
                  <ul className="space-y-2 text-xs text-white/70">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <strong>AI Veri Keşfi:</strong> Değerinin çok altındaki arsaları otomatik bulur.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <strong>Taksitle Demokratikleştirme:</strong> Alıcıya kendi finansmanını sağlar.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <strong>Yazılım Otomasyonu:</strong> Stripe entegreli taksit, otomatik kontrat ve tapu kaydı.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: STATES ANALYSIS */}
          {activeSlide === "states" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Compass className="text-cyan-400" /> Eyalet Analizleri & İmar Yasaları
                  </h2>
                  <p className="text-xs text-white/50 mt-1">
                    Hangi eyaletlerde iş yapıyoruz? Hangilerinde bürokrasi ve yasal engeller yüzünden eleniyoruz?
                  </p>
                </div>

                {/* Sub-tabs */}
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 shrink-0">
                  {[
                    { id: "pilot", label: "Pilot Bölgelerimiz (5 Eyalet)" },
                    { id: "red", label: "Kırmızı Bölgeler (Elendi)" },
                    { id: "matrix", label: "50 Eyalet Eleme Matrisi" }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setStateView(t.id as "pilot" | "red" | "matrix")}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={{
                        background: stateView === t.id ? "rgba(34,211,238,0.15)" : "transparent",
                        color: stateView === t.id ? "#22d3ee" : "#a1a1aa"
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab 1: Pilot Bölgeler */}
              {stateView === "pilot" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {states.map(s => (
                      <div key={s.name} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-white text-xs">{s.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                              {s.score}/100
                            </span>
                          </div>
                          <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider">İmar & Bölme Kuralı</p>
                          <p className="text-[11px] text-white/80 mt-1 leading-relaxed">
                            {s.platting}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-white/5">
                          <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1">Erişim & Yol</p>
                          <p className="text-[10px] text-white/60 leading-tight mb-2">{s.roadAccess}</p>
                          <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1">Hedef County</p>
                          <div className="flex flex-wrap gap-1">
                            {s.targetCounties.slice(0, 2).map(c => (
                              <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-[11px] text-white/70">
                    <strong>Neden bu 5 eyalet?</strong> Arsayı bölüp parselize ederken resmi belediye veya county meclis onayına (subdivision map approval) takılmadan, kırsal imar muafiyet limitleri dahilinde (New Mexico'da 35, Texas'ta 5 dönüm üstü) hızlıca işlem yapabiliyoruz.
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Kırmızı Bölgeler */}
              {stateView === "red" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <ShieldAlert className="w-4 h-4" /> California & New York
                    </div>
                    <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Aşırı Katı Çevre ve Bölünme Yasaları</p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      *Subdivision Map Act* uyarınca 2 dönümlük en küçük arsa bölmesi için bile su analizi, çevre raporları ve yol taahhüdü gerekir. Süreç **2 yıl** sürer, mühendislik giderleri $20k+ bulur. Giriş maliyeti çok yüksek, bürokrasi engelleyicidir.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <ShieldAlert className="w-4 h-4" /> Ohio & Pennsylvania
                    </div>
                    <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Yatırımcı Düşmanı İcra Yasaları</p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Eğer taksitli satış sözleşmesinde (Contract for Deed) alıcı borcun %20'sinden fazlasını ödemişse veya 5 yıl geçmişse, satıcı tek taraflı iptal yapamaz. Aylar süren ve $5,000+ avukatlık masrafı olan resmi **Foreclosure davası** açmak zorundadır.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <ShieldAlert className="w-4 h-4" /> Washington & Oregon
                    </div>
                    <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Kırsal İmar Bölünme Yasakları</p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      *Growth Management Act (GMA)* uyarınca kırsal arazilerin bölünmesi neredeyse tamamen yasaklanmıştır. Tarım arazileri sadece 20 veya 40 dönümlük dev bloklar halinde kalabilir. Parselasyon yapmak kanunen imkansızdır.
                    </p>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: 50 Eyalet Eleme Matrisi */}
              {stateView === "matrix" && (
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="py-2.5 px-4">Eyalet</th>
                        <th className="py-2.5 px-4 text-center">Arazi Maliyeti (1-10)</th>
                        <th className="py-2.5 px-4 text-center">Platting Kolaylığı (1-10)</th>
                        <th className="py-2.5 px-4 text-center">Alıcı Talebi (1-10)</th>
                        <th className="py-2.5 px-4 text-center">Hukuki Hızlı İptal (1-10)</th>
                        <th className="py-2.5 px-4 text-center font-bold text-cyan-400">Toplam Skor</th>
                        <th className="py-2.5 px-4">Yatırım Kararı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[
                        { name: "New Mexico (NM)", cost: 10, platting: 10, demand: 9, legal: 9, score: 38, decision: "PİLOT BÖLGE", color: "text-emerald-400 bg-emerald-500/10" },
                        { name: "Texas (TX)", cost: 8, platting: 9, demand: 10, legal: 9, score: 36, decision: "PİLOT BÖLGE", color: "text-emerald-400 bg-emerald-500/10" },
                        { name: "Missouri (MO)", cost: 9, platting: 10, demand: 8, legal: 9, score: 36, decision: "PİLOT BÖLGE", color: "text-emerald-400 bg-emerald-500/10" },
                        { name: "Arkansas (AR)", cost: 9, platting: 9, demand: 8, legal: 9, score: 35, decision: "PİLOT BÖLGE", color: "text-emerald-400 bg-emerald-500/10" },
                        { name: "Arizona (AZ)", cost: 8, platting: 8, demand: 10, legal: 8, score: 34, decision: "PİLOT BÖLGE", color: "text-emerald-400 bg-emerald-500/10" },
                        { name: "Florida (FL)", cost: 3, platting: 3, demand: 9, legal: 7, score: 22, decision: "Elendi (Pahalı/Wetlands)", color: "text-red-400 bg-red-500/5" },
                        { name: "California (CA)", cost: 1, platting: 1, demand: 9, legal: 5, score: 16, decision: "Elendi (İmar Engeli/Fahiş)", color: "text-red-400 bg-red-500/5" },
                        { name: "Ohio (OH)", cost: 6, platting: 6, demand: 4, legal: 2, score: 18, decision: "Elendi (İcra Mahkemesi Şartı)", color: "text-red-400 bg-red-500/5" },
                        { name: "Washington (WA)", cost: 2, platting: 1, demand: 7, legal: 4, score: 14, decision: "Elendi (Bölünme Yasak)", color: "text-red-400 bg-red-500/5" }
                      ].map(row => (
                        <tr key={row.name} className="hover:bg-white/[0.01]">
                          <td className="py-2.5 px-4 font-bold text-white">{row.name}</td>
                          <td className="py-2.5 px-4 text-center text-white/70">{row.cost}/10</td>
                          <td className="py-2.5 px-4 text-center text-white/70">{row.platting}/10</td>
                          <td className="py-2.5 px-4 text-center text-white/70">{row.demand}/10</td>
                          <td className="py-2.5 px-4 text-center text-white/70">{row.legal}/10</td>
                          <td className="py-2.5 px-4 text-center font-bold text-cyan-400 text-sm">{row.score}/40</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${row.color}`}>
                              {row.decision}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legal & Data Infrastructure Resources */}
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01] text-[10px] space-y-1.5 mt-3">
                <span className="font-bold text-white/60 uppercase tracking-widest flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400" /> Resmi Veri Altyapısı ve Araştırma Kaynakları
                </span>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-white/50">
                  <div>
                    <span className="font-bold text-white/70 block">1. Coğrafi Sınırlar (GIS)</span>
                    Land ID (id.land) & Eyalet GIS Haritaları
                  </div>
                  <div>
                    <span className="font-bold text-white/70 block">2. Sel ve Taşkın Analizi</span>
                    FEMA Flood Map Service Center
                  </div>
                  <div>
                    <span className="font-bold text-white/70 block">3. Toprak Uygunluğu</span>
                    USDA Web Soil Survey (Septik İzni)
                  </div>
                  <div>
                    <span className="font-bold text-white/70 block">4. Emsal Değerleme (Comps)</span>
                    LandWatch, Zillow & Redfin Satış Verileri
                  </div>
                  <div>
                    <span className="font-bold text-white/70 block">5. Hukuki Altyapı</span>
                    County Clerk & Recorder (Resmi Tapu Kayıtları)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: SOURCING */}
          {activeSlide === "sourcing" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Mail className="text-cyan-400" /> Off-Market Alım Süreci (Sourcing Engine)
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Açık artırma dışı, doğrudan mülk sahiplerinden değerinin çok altında tekliflerle arsa toplama döngümüz.
                </p>
              </div>

              {/* Workflow visual block */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {[
                  { step: "01", title: "Veri Çekme (List Pulling)", desc: "County kayıtlarından vergi borcu (tax delinquent) olan ve eyalet dışında yaşayan (absentee) sahipler listelenir." },
                  { step: "02", title: "Doğrudan Teklif (Direct Mail)", desc: "Lob / Click2Mail API entegrasyonu ile sahiplere piyasanın %25'i tutarında resmi satın alma teklif mektubu gönderilir." },
                  { step: "03", title: "Due Diligence (Hukuki Kontrol)", desc: "Gelen olumlu dönüşlerde yol erişimi, sel riski, tapu üstündeki icra/haciz durumları (clean title) kontrol edilir." },
                  { step: "04", title: "Hızlı Kapanış (Closing)", desc: "Special Warranty Deed ile noter onaylı devir gerçekleştirilir, arsa envanterimize eklenir." }
                ].map((s, i) => (
                  <div key={s.step} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] relative">
                    <div className="text-3xl font-extrabold text-cyan-500/20 absolute right-4 top-2">{s.step}</div>
                    <h3 className="font-bold text-white text-sm mb-2">{s.title}</h3>
                    <p className="text-xs text-white/60 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* Sourcing economics callout */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Kampanya Verimlilik Oranları (Benchmark)
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase">Mektup Dönüş Oranı</p>
                    <p className="text-lg font-bold mt-0.5">%0.8 - %1.5</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase">Teklif Kabul Oranı</p>
                    <p className="text-lg font-bold mt-0.5">%10 - %15</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase">Mektup Başı Maliyet</p>
                    <p className="text-lg font-bold mt-0.5">$0.65 - $0.85</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase">Ortalama Alım Maliyeti</p>
                    <p className="text-lg font-bold mt-0.5">$1,500 - $3,500</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 4: DEFAULT LOOP */}
          {activeSlide === "default-loop" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <RefreshCw className="text-cyan-400" /> Taksitli Satış ve Temerrüt (Default) Döngüsü
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Neden %30'luk temerrüt oranı bu iş modelinde zarar değil, tam tersine karı katlayan bir unsurdur?
                </p>
              </div>

              {/* Explain the contract loop */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] space-y-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    AŞAMA 1: LAND CONTRACT
                  </span>
                  <h3 className="font-bold text-white text-sm">Tapuyu Elde Tutma</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Satışlar **Contract for Deed** (Senetli/Taksitli Satış Sözleşmesi) ile yapılır. Tapu mülkiyeti (Deed), alıcı son taksitini ödeyene kadar bizim LLC'mizin üstünde kalır. Alıcıya sadece kullanım hakkı verilir.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] space-y-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    AŞAMA 2: TEMERRÜT (DEFAULT)
                  </span>
                  <h3 className="font-bold text-white text-sm">Hızlı İptal & Tahliye</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Alıcı ödemeyi geciktirirse (30+ gün) sözleşme tek taraflı iptal edilir. Mahkemeye gerek kalmaksızın, ödenen tüm peşinat ve taksitler **cayma bedeli / kiralama bedeli** olarak bizde kalır.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] space-y-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    AŞAMA 3: YENİDEN SATIŞ
                  </span>
                  <h3 className="font-bold text-white text-sm">Envantere Geri Dönüş</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Arsa sistemde otomatik olarak yeniden "Satılık" konumuna gelir. Tekrar peşinat alınarak yeni bir alıcıya satılır. Aynı arsa 2-3 kez satılarak maliyeti sıfırlanır ve kârlılık uçar.
                  </p>
                </div>
              </div>

              {/* Graphic summary */}
              <div className="p-4 rounded-xl border border-yellow-500/10 bg-yellow-500/5 text-xs text-yellow-200/90">
                <span className="font-bold text-yellow-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" /> Önemli Güvence
                </span>
                Biz bir kredi kuruluşu değiliz, dolayısıyla pahalı ve aylar süren **Foreclosure (haciz/satış)** süreçleriyle uğraşmayız. Contract for Deed yapısı bizi tamamen korur.
              </div>
            </div>
          )}

          {/* SLIDE 5: ROI CALCULATOR */}
          {activeSlide === "roi-calc" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calculator className="text-cyan-400" /> İnteraktif Yatırım & ROI Simülatörü
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Bütçeyi ve taksit parametrelerini değiştirerek platformun üreteceği nakit akışını test edin.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sliders Panel */}
                <div className="md:col-span-2 space-y-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/60 font-semibold">Toplam Yatırım Sermayesi (Sourcing Pool)</span>
                      <span className="text-cyan-400 font-bold">${capitalPool.toLocaleString()}</span>
                    </div>
                    <input 
                      type="range" min="10000" max="250000" step="5000" 
                      value={capitalPool} onChange={(e) => setCapitalPool(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Ort. Arsa Alış Maliyeti</span>
                        <span className="text-white font-bold">${avgAcqCost}</span>
                      </div>
                      <input 
                        type="range" min="1000" max="10000" step="500" 
                        value={avgAcqCost} onChange={(e) => setAvgAcqCost(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Satış Fiyatı Çarpanı</span>
                        <span className="text-white font-bold">{markupMultiplier}x</span>
                      </div>
                      <input 
                        type="range" min="2" max="4" step="0.1" 
                        value={markupMultiplier} onChange={(e) => setMarkupMultiplier(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Taksit Vadeti</span>
                        <span className="text-white font-bold">{termMonths} Ay</span>
                      </div>
                      <input 
                        type="range" min="12" max="36" step="12" 
                        value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Ort. Peşinat</span>
                        <span className="text-white font-bold">${downPayment}</span>
                      </div>
                      <input 
                        type="range" min="99" max="499" step="50" 
                        value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Temerrüt (Default) Oranı</span>
                        <span className="text-yellow-400 font-bold">%{defaultRate}</span>
                      </div>
                      <input 
                        type="range" min="10" max="50" step="5" 
                        value={defaultRate} onChange={(e) => setDefaultRate(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Outputs Panel */}
                <div className="p-5 rounded-xl border border-cyan-500/10 bg-cyan-500/5 space-y-4">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Simülasyon Çıktıları</h3>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-white/40">Alınan Arsa Adedi:</span>
                      <p className="text-lg font-bold text-white mt-0.5">{numParcels}</p>
                    </div>
                    <div>
                      <span className="text-white/40">Ort. Satış Fiyatı:</span>
                      <p className="text-lg font-bold text-white mt-0.5">${avgSalePrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-white/40">Parsel Başı Aylık:</span>
                      <p className="text-lg font-bold text-white mt-0.5">${monthlyPaymentPerParcel}/ay</p>
                    </div>
                    <div>
                      <span className="text-white/40">Hedef Toplam Gelir:</span>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">${totalProjectedRevenue.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <span className="text-xs text-white/40">Projelendirilen MRR (Aylık Düzenli Gelir):</span>
                    <p className="text-2xl font-extrabold text-cyan-400 mt-0.5">${maxMRR.toLocaleString()}/ay</p>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <span className="text-xs text-white/40">Tahmini Net ROI:</span>
                    <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">%{netROI} ROI</p>
                    <p className="text-[10px] text-white/50 mt-1">Net Kâr: ${(netProfit).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 6: TIMELINE */}
          {activeSlide === "timeline" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="text-cyan-400" /> 30 Günlük Aksiyon Planı ve Yol Haritası
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Yatırım kararı sonrasındaki ilk 30 günde yapılacak kurumsal ve operasyonel adımlar.
                </p>
              </div>

              {/* Gantt / Checklist */}
              <div className="space-y-3">
                {[
                  { week: "Hafta 1", task: "LLC Kurulumu & Banka Hesabı", desc: "Wyoming LLC kurulumunun tamamlanması, EIN numarasının alınması ve Mercury / Relay üzerinden kurumsal hesap açılışı.", done: false },
                  { week: "Hafta 1", task: "Stripe & Ödeme Altyapısı Entegrasyonu", desc: "Mevcut platformumuza Stripe Gateway entegre edilerek peşinat ve aylık otomatik kart çekim modüllerinin aktif edilmesi.", done: false },
                  { week: "Hafta 2", task: "Avukat Onaylı Sözleşmeler", desc: "Her eyalete özel, alıcı temerrüt durumunda hızlı geri alımı (contract for deed) güvenceye alan sözleşme şablonlarının hazırlanması.", done: false },
                  { week: "Hafta 2", task: "İlk 5 Arsa Alımı (Due Diligence)", desc: "Önceden belirlenen New Mexico ve Texas county'lerinde ihalelerden veya off-market mektup yöntemiyle ilk arsaların devralınması.", done: false },
                  { week: "Hafta 3", task: "İlanların Yayınlanması & Reklam Lansmanı", desc: "Alınan arsaların drone/uydu harita sınırlarının siteye girilmesi. Facebook ve Instagram reklam kampanyalarının LATAM/MENA hedefli başlatılması.", done: false }
                ].map((t, idx) => (
                  <div key={idx} className="flex gap-4 p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                    <div className="shrink-0 w-16 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {t.week}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-white">{t.task}</h4>
                      <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">{t.desc}</p>
                    </div>
                    <div className="shrink-0 flex items-center pr-2">
                      <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white/20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Info inside Slide Window */}
          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
            <span>TerraLot Land Installment Sales Platform</span>
            <div className="flex gap-2">
              <button 
                disabled={activeSlide === "summary"}
                onClick={() => {
                  const seq: SlideId[] = ["summary", "states", "sourcing", "default-loop", "roi-calc", "timeline"];
                  const idx = seq.indexOf(activeSlide);
                  if (idx > 0) setActiveSlide(seq[idx - 1]);
                }}
                className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-30"
              >
                Geri
              </button>
              <button 
                disabled={activeSlide === "timeline"}
                onClick={() => {
                  const seq: SlideId[] = ["summary", "states", "sourcing", "default-loop", "roi-calc", "timeline"];
                  const idx = seq.indexOf(activeSlide);
                  if (idx < seq.length - 1) setActiveSlide(seq[idx + 1]);
                }}
                className="px-3 py-1 rounded bg-cyan-500 text-black font-semibold hover:bg-cyan-400 disabled:opacity-30"
              >
                İleri
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
