"use client";

import { useState } from "react";
import { 
  MapPin, 
  ArrowRight,
  Copy,
  Check,
  Sun,
  ShieldCheck,
  DollarSign,
  Layers,
  FileText,
  Landmark,
  Calendar,
  HelpCircle
} from "lucide-react";

interface LandSanctuary {
  id: string;
  name: string;
  location: string;
  acres: string;
  coords: string;
  cashPrice: number;
  baseDown: number;
  narrative: string;
  offgridThesis: string;
  investmentThesis: string;
  image: string;
  specs: {
    annualTax: string;
    solarHours: string;
    waterDepth: string;
    zoning: string;
  };
  svgPoints: { x: number; y: number; label: string; coords: string }[];
  svgPolygon: string;
}

const SANCTUARIES: LandSanctuary[] = [
  {
    id: "01",
    name: "The Juniper Ridge Sanctuary",
    location: "Mohave County, Arizona",
    acres: "1.25 Acres",
    coords: "35.1244° N, 114.5422° W",
    cashPrice: 14500,
    baseDown: 1000,
    narrative: "A raw, untethered expanse of 1.25 acres in the high Arizona desert. There are no utility poles to disrupt the horizon, and no paved roads to carry city noise. Access is a simple track winding through sagebrush—an open canvas for a self-sustaining solar cabin or an off-grid sanctuary under the mountain skies.",
    offgridThesis: "Perfect for rain catchment systems, custom solar arrays, and composting setups. RVs and tiny homes are welcome. Deep-aquifer well water is permitted in the basin.",
    investmentThesis: "Arizona's sun belt continues to see steady demand as urban areas expand. Land remains a stable, inflation-resistant asset with minimal carrying costs (annual property tax is under $30).",
    image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1600&auto=format&fit=crop&q=80",
    specs: {
      annualTax: "$28",
      solarHours: "6.57 Saat / Gün",
      waterDepth: "450 Feet",
      zoning: "Cochise Owner-Builder (Denetim Muaf)"
    },
    svgPolygon: "80,80 220,100 240,220 100,200",
    svgPoints: [
      { x: 80, y: 80, label: "A (Kuzey-Batı)", coords: "35.1248° N, -114.5428° W" },
      { x: 220, y: 100, label: "B (Kuzey-Doğu)", coords: "35.1246° N, -114.5416° W" },
      { x: 240, y: 220, label: "C (Güney-Doğu)", coords: "35.1240° N, -114.5414° W" },
      { x: 100, y: 200, label: "D (Güney-Batı)", coords: "35.1241° N, -114.5426° W" }
    ]
  },
  {
    id: "02",
    name: "Blanca Creek Basin",
    location: "Costilla County, Colorado",
    acres: "5.00 Acres",
    coords: "37.2411° N, 105.4199° W",
    cashPrice: 19800,
    baseDown: 1500,
    narrative: "Located in the heart of the San Luis Valley, this flat grasslands parcel is an exceptional canvas for off-grid living or long-term land holding. Wild elk graze nearby, and the quiet reservoir is just a short drive away. This property offers clear, unobstructed horizons for a fully-independent solar homestead.",
    offgridThesis: "100% off-grid capability. Ideal for large solar configurations and wind setups. Cistern storage or permitted well drilling provides simple water security.",
    investmentThesis: "Colorado mountain view parcels are highly sought after for recreational use and ecological retreats. Low holding taxes make this an effortless generational asset.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&auto=format&fit=crop&q=80",
    specs: {
      annualTax: "$32",
      solarHours: "5.50 Saat / Gün",
      waterDepth: "220 Feet",
      zoning: "Saguache Kodu Yok (Serbest Yapılaşma)"
    },
    svgPolygon: "70,110 240,70 210,230 90,210",
    svgPoints: [
      { x: 70, y: 110, label: "A (Kuzey-Batı)", coords: "37.2418° N, -105.4206° W" },
      { x: 240, y: 70, label: "B (Kuzey-Doğu)", coords: "37.2419° N, -105.4188° W" },
      { x: 210, y: 230, label: "C (Güney-Doğu)", coords: "37.2404° N, -105.4191° W" },
      { x: 90, y: 210, label: "D (Güney-Batı)", coords: "37.2403° N, -105.4204° W" }
    ]
  },
  {
    id: "03",
    name: "Mesa Vista Highlands",
    location: "Valencia County, New Mexico",
    acres: "10.00 Acres",
    coords: "34.6801° N, 106.7644° W",
    cashPrice: 24500,
    baseDown: 2000,
    narrative: "A sprawling estate designed for those who value absolute space and stillness. This parcel offers endless opportunities for horse grazing, private stargazing, or custom off-grid architectural projects. Located within reasonable driving distance of Albuquerque, it balances seclusion with access.",
    offgridThesis: "Sublime solar profile with over 300 days of sunshine annually. Perfect for geodesic domes, container homes, and independent power systems.",
    investmentThesis: "Purchasing a larger ten-acre tract offers significant hedge benefits against inflation, with highly favorable agricultural zoning and negligible carrying fees.",
    image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1600&auto=format&fit=crop&q=80",
    specs: {
      annualTax: "$18",
      solarHours: "6.20 Saat / Gün",
      waterDepth: "300 Feet",
      zoning: "Valencia Kırsal (Minimum İmar Kısıtı)"
    },
    svgPolygon: "90,60 210,90 230,240 60,180",
    svgPoints: [
      { x: 90, y: 60, label: "A (Kuzey-Batı)", coords: "34.6809° N, -106.7656° W" },
      { x: 210, y: 90, label: "B (Kuzey-Doğu)", coords: "34.6807° N, -106.7632° W" },
      { x: 230, y: 240, label: "C (Güney-Doğu)", coords: "34.6792° N, -106.7629° W" },
      { x: 60, y: 180, label: "D (Güney-Batı)", coords: "34.6795° N, -106.7659° W" }
    ]
  },
  {
    id: "04",
    name: "Ponderosa Pine Sanctuary",
    location: "Klamath County, Oregon",
    acres: "4.25 Acres",
    coords: "42.5322° N, 121.8901° W",
    cashPrice: 32000,
    baseDown: 2500,
    narrative: "Encircled by massive ponderosa pines, this quiet woodland property is the ultimate retreat for nature lovers. The air is fresh, clean, and scented with pine. Whether you build an alpine A-frame cabin, pitch a luxury canvas tent, or hold the land for future appreciation, this parcel feels like a national park.",
    offgridThesis: "Favorable residential zoning allowing cabins, seasonal camping, or eco-lodges. Water wells in this region are highly reliable and rich in minerals.",
    investmentThesis: "Oregon forest properties near major national parks command premium value. A rare opportunity to secure timberland on direct developer terms.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&auto=format&fit=crop&q=80",
    specs: {
      annualTax: "$45",
      solarHours: "5.00 Saat / Gün",
      waterDepth: "180 Feet",
      zoning: "Klamath Kırsal Orman (Kabin İzni Var)"
    },
    svgPolygon: "100,90 230,110 200,220 70,180",
    svgPoints: [
      { x: 100, y: 90, label: "A (Kuzey-Batı)", coords: "42.5329° N, -121.8912° W" },
      { x: 230, y: 110, label: "B (Kuzey-Doğu)", coords: "42.5328° N, -121.8890° W" },
      { x: 200, y: 220, label: "C (Güney-Doğu)", coords: "42.5314° N, -121.8893° W" },
      { x: 70, y: 180, label: "D (Güney-Batı)", coords: "42.5315° N, -121.8914° W" }
    ]
  }
];

export default function LandForeverPage() {
  const [activeTabs, setActiveTabs] = useState<Record<string, "offgrid" | "investment">>({
    "01": "offgrid",
    "02": "offgrid",
    "03": "offgrid",
    "04": "offgrid"
  });

  // Slider State for terms financing months per listing: Default 36 months
  const [termMonths, setTermMonths] = useState<Record<string, number>>({
    "01": 36,
    "02": 36,
    "03": 36,
    "04": 36
  });

  const [copiedPoint, setCopiedPoint] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [inquiredIds, setInquiredIds] = useState<Record<string, boolean>>({});

  const handleTabChange = (id: string, tab: "offgrid" | "investment") => {
    setActiveTabs(prev => ({ ...prev, [id]: tab }));
  };

  const handleInquire = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const email = emails[id];
    if (!email) return;
    setInquiredIds(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setInquiredIds(prev => ({ ...prev, [id]: false }));
      setEmails(prev => ({ ...prev, [id]: "" }));
    }, 4000);
  };

  const handleEmailChange = (id: string, value: string) => {
    setEmails(prev => ({ ...prev, [id]: value }));
  };

  const copyCoordinates = (pointLabel: string, coords: string) => {
    navigator.clipboard.writeText(coords);
    setCopiedPoint(pointLabel);
    setTimeout(() => setCopiedPoint(null), 2000);
  };

  // Term cost markup calculations based on financed duration
  const getMonthsMarkup = (months: number) => {
    if (months <= 12) return 1.05;
    if (months <= 24) return 1.12;
    if (months <= 36) return 1.20;
    if (months <= 48) return 1.28;
    return 1.35; // 60 months
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1c1917] font-sans antialiased overflow-x-hidden relative selection:bg-stone-200 pb-28">
      
      {/* Decorative Kadastro Blueprint Grid lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{
        backgroundImage: `
          linear-gradient(to right, #000 1px, transparent 1px),
          linear-gradient(to bottom, #000 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px"
      }} />

      <div className="absolute top-0 left-0 w-full h-[600px] pointer-events-none opacity-[0.015] z-0" style={{
        background: "radial-gradient(circle at 50% 30%, #15803d 0%, transparent 70%)"
      }} />

      {/* Brand Header */}
      <header className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between border-b border-stone-200/50 relative z-10">
        <div className="flex flex-col">
          <span className="font-light text-2xl tracking-[0.25em] uppercase leading-none text-[#1c1917]">
            Land<span className="font-semibold text-emerald-800">Forever</span>
          </span>
          <span className="text-[7.5px] font-bold tracking-[0.3em] text-stone-400 uppercase mt-2">
            A Certified Deed Registry Collection
          </span>
        </div>
        
        <div className="flex items-center gap-6 text-[9px] font-bold tracking-[0.2em] uppercase text-stone-400">
          <span className="text-emerald-800 font-extrabold border-b border-emerald-800 pb-1">01 / Active Collection</span>
          <span className="hover:text-stone-700 transition-colors cursor-pointer">02 / Deed Protocol</span>
          <span className="hover:text-stone-700 transition-colors cursor-pointer">03 / Guarantee Escrow</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 text-center max-w-3xl mx-auto px-6 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 mb-6">
          <Landmark className="w-3 h-3" /> Protected Soil Registry
        </div>
        
        <h1 className="text-4xl md:text-5xl font-light font-serif tracking-tight text-[#1c1917] mb-6 leading-tight">
          Physical Autonomy. <br/>
          <span className="font-sans font-extralight italic text-stone-400">Direct-to-owner land registry.</span>
        </h1>
        <p className="text-xs md:text-sm text-stone-500 font-normal leading-relaxed max-w-xl mx-auto">
          We source off-market, clean-title acreage across the American West. Every parcel features certified road access, verified water basins, and strict zoning compliance.
        </p>
      </section>

      {/* Interactive Deed Registry Flowchart (Yok Artık #1) */}
      <section className="max-w-4xl mx-auto px-6 mb-24 relative z-10">
        <div className="bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-2xl p-5 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 mb-4 text-center">Certified Deed Transfer Protocol</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "01", name: "Soil Selection", desc: "Select raw verified acreage" },
              { step: "02", name: "Instant Financing", desc: "Choose your monthly down/term" },
              { step: "03", name: "Escrow Close", desc: "Secure escrow dispatch" },
              { step: "04", name: "Official Recording", desc: "Deed recorded at County Office" }
            ].map((p, idx) => (
              <div key={idx} className="relative p-4 rounded-xl border border-stone-150 bg-[#fdfdfb] text-center md:text-left">
                <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{p.step}</span>
                <h3 className="text-xs font-bold text-stone-800 mt-2.5">{p.name}</h3>
                <p className="text-[10px] text-stone-400 mt-1 leading-snug">{p.desc}</p>
                {idx < 3 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <ArrowRight className="w-4 h-4 text-stone-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Listings */}
      <main className="max-w-5xl mx-auto px-6 space-y-36 relative z-10">
        {SANCTUARIES.map((item) => {
          const activeTab = activeTabs[item.id] || "offgrid";
          const months = termMonths[item.id] || 36;
          
          // Calculator Mathematics (Yok Artık #2)
          const down = item.baseDown;
          const principal = item.cashPrice - down;
          const factor = getMonthsMarkup(months);
          const totalCost = down + Math.round(principal * factor);
          const monthlyPayment = Math.round((totalCost - down) / months);
          const cashSavings = Math.round(totalCost - item.cashPrice);

          const email = emails[item.id] || "";
          const isInquired = inquiredIds[item.id] || false;

          return (
            <section 
              key={item.id} 
              className="border-t border-stone-200 pt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
            >
              
              {/* Left Column: Visuals & Kadastro Map Simulation (Yok Artık #3) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Image Showcase */}
                <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-stone-150 border border-stone-200/60 shadow-md relative group">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full text-[9px] font-extrabold uppercase text-stone-700 shadow-sm border border-stone-100 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-emerald-800" /> {item.location}
                  </div>
                  <div className="absolute bottom-4 right-4 bg-stone-900/90 text-white px-3 py-1.5 rounded-full text-[9px] font-bold tracking-wider uppercase">
                    {item.acres}
                  </div>
                </div>

                {/* SVG Cadastre Wireframe Simulator */}
                <div className="bg-[#fcfbf9] border border-stone-200/50 rounded-2xl p-4 relative">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-700" /> Kadastro Sınır Şeması (İnteraktif)
                    </span>
                    <span className="text-[9px] font-mono text-stone-400">{item.coords}</span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    
                    {/* SVG Graphic */}
                    <div className="w-48 h-48 bg-white rounded-xl border border-stone-200/40 relative shadow-inner shrink-0 flex items-center justify-center">
                      <svg width="180" height="180" viewBox="0 0 300 300" className="w-full h-full">
                        <defs>
                          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f0ec" strokeWidth="1" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                        
                        {/* Polygon Boundary */}
                        <polygon 
                          points={item.svgPolygon} 
                          fill="rgba(16, 185, 129, 0.04)" 
                          stroke="#047857" 
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        
                        {/* Interactive dots */}
                        {item.svgPoints.map((pt, ptIdx) => (
                          <g key={ptIdx} className="cursor-pointer group/dot" onClick={() => copyCoordinates(`${item.id}-${pt.label}`, pt.coords)}>
                            <circle 
                              cx={pt.x} 
                              cy={pt.y} 
                              r="5" 
                              fill="#047857" 
                              className="transition-all hover:scale-150 hover:fill-amber-500" 
                            />
                            <circle 
                              cx={pt.x} 
                              cy={pt.y} 
                              r="10" 
                              fill="none" 
                              stroke="#047857" 
                              strokeWidth="1" 
                              className="animate-ping opacity-25" 
                            />
                          </g>
                        ))}
                      </svg>
                      <span className="absolute bottom-2 left-2 text-[8px] font-semibold text-stone-400 uppercase">Ölçek: 1:1,500</span>
                    </div>

                    {/* Coordinates Info & Click to copy */}
                    <div className="flex-1 w-full space-y-2">
                      <p className="text-[9px] leading-relaxed text-stone-400 font-medium uppercase">
                        Parselin köşe sınır kazıklarının resmi GPS koordinatları aşağıdadır. Haritaya aktarmak için tıklayıp kopyalayabilirsiniz.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {item.svgPoints.map((pt, ptIdx) => {
                          const isCopied = copiedPoint === `${item.id}-${pt.label}`;
                          return (
                            <button 
                              key={ptIdx} 
                              onClick={() => copyCoordinates(`${item.id}-${pt.label}`, pt.coords)}
                              className="p-1.5 rounded bg-white hover:bg-stone-50 border border-stone-200/50 text-[9px] font-semibold flex items-center justify-between text-left transition-colors"
                            >
                              <div>
                                <span className="font-mono text-stone-400 mr-1">{pt.label.split(" ")[0]}</span>
                                <span className="text-stone-700 block font-mono text-[8px]">{pt.coords.split(",")[0]}</span>
                              </div>
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-stone-300" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Right Column: Calculations, specs, info (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Title and pricing summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">Tract {item.id}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-800 text-[8px] font-extrabold uppercase tracking-wider">
                      Ag-Exempt Eligible
                    </span>
                  </div>
                  <h2 className="text-3xl font-light font-serif tracking-tight text-[#1c1917]">
                    {item.name}
                  </h2>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    {item.narrative}
                  </p>
                </div>

                {/* Specs breakdown grid */}
                <div className="grid grid-cols-2 gap-2 bg-[#fdfdfb] border border-stone-200/40 p-3 rounded-xl">
                  <div>
                    <span className="text-[8px] font-bold text-stone-400 uppercase block">YILLIK VERGİ YÜKÜ</span>
                    <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-stone-400" /> {item.specs.annualTax}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-stone-400 uppercase block">GÜNLÜK GÜNEŞ ALIMI</span>
                    <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-amber-500" /> {item.specs.solarHours}
                    </span>
                  </div>
                  <div className="mt-2 border-t pt-2 border-stone-100">
                    <span className="text-[8px] font-bold text-stone-400 uppercase block">KUYU DERİNLİĞİ</span>
                    <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" /> {item.specs.waterDepth}
                    </span>
                  </div>
                  <div className="mt-2 border-t pt-2 border-stone-100">
                    <span className="text-[8px] font-bold text-stone-400 uppercase block">BÖLGE İMAR STATÜSÜ</span>
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 truncate" title={item.specs.zoning}>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {item.specs.zoning.split(" ")[0]}
                    </span>
                  </div>
                </div>

                {/* Toggles for thesis */}
                <div className="space-y-2 border-t border-stone-200/50 pt-4">
                  <div className="flex gap-4 border-b border-stone-200/30 pb-1.5">
                    <button 
                      onClick={() => handleTabChange(item.id, "offgrid")}
                      className={`text-[9px] font-bold uppercase tracking-wider pb-1 -mb-2 border-b ${
                        activeTab === 'offgrid' ? 'border-emerald-800 text-emerald-800' : 'border-transparent text-stone-400 hover:text-stone-600'
                      }`}
                    >
                      Off-Grid Potential
                    </button>
                    <button 
                      onClick={() => handleTabChange(item.id, "investment")}
                      className={`text-[9px] font-bold uppercase tracking-wider pb-1 -mb-2 border-b ${
                        activeTab === 'investment' ? 'border-emerald-800 text-emerald-800' : 'border-transparent text-stone-400 hover:text-stone-600'
                      }`}
                    >
                      The Investment Case
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-stone-500 font-medium">
                    {activeTab === 'offgrid' ? item.offgridThesis : item.investmentThesis}
                  </p>
                </div>

                {/* Interactive Financing Motor (Yok Artık #2) */}
                <div className="p-4 rounded-xl border border-emerald-800/10 bg-emerald-500/[0.02] space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Esnek Taksit Hesaplayıcı
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                      {months} Ay Vade
                    </span>
                  </div>

                  {/* Range Slider */}
                  <div className="space-y-1">
                    <input 
                      type="range" 
                      min="12" 
                      max="60" 
                      step="12"
                      value={months}
                      onChange={(e) => setTermMonths(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                    />
                    <div className="flex justify-between text-[8px] font-bold text-stone-400 uppercase px-1">
                      <span>12 Ay</span>
                      <span>24 Ay</span>
                      <span>36 Ay</span>
                      <span>48 Ay</span>
                      <span>60 Ay</span>
                    </div>
                  </div>

                  {/* Calculations Details */}
                  <div className="grid grid-cols-3 gap-2 text-center border-t border-emerald-800/5 pt-3">
                    <div>
                      <p className="text-[8px] font-bold text-stone-400 uppercase">Peşinat (Down)</p>
                      <p className="text-sm font-extrabold text-stone-800">${down}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-stone-400 uppercase">Aylık Taksit</p>
                      <p className="text-sm font-extrabold text-emerald-800">${monthlyPayment}/ay</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-stone-400 uppercase">Peşin Fiyatı</p>
                      <p className="text-sm font-extrabold text-stone-850">${item.cashPrice}</p>
                    </div>
                  </div>

                  {/* Cash Incentive Badge */}
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-emerald-800/5 text-[10px]">
                    <span className="text-stone-500 font-medium">Nakit alımda toplam kazanç:</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                      <DollarSign className="w-3 h-3" /> {cashSavings} tasarruf
                    </span>
                  </div>
                </div>

                {/* Inquiry Dispatch Form */}
                <div className="pt-4 border-t border-stone-200/50 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 block">
                    Uydu koordinatlarını ve tapu sözleşmesini isteyin
                  </span>
                  
                  {isInquired ? (
                    <div className="bg-stone-900 text-white p-3 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
                      <span className="font-medium">Kadastro belgeleri e-postanıza gönderildi.</span>
                      <span className="text-[10px] font-mono opacity-50 uppercase">Gönderildi</span>
                    </div>
                  ) : (
                    <form onSubmit={(e) => handleInquire(e, item.id)} className="flex gap-2">
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => handleEmailChange(item.id, e.target.value)}
                        placeholder="E-posta adresiniz..."
                        className="flex-1 bg-white border border-stone-200 px-3 py-2 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-emerald-800 transition-colors"
                      />
                      <button 
                        type="submit"
                        className="bg-emerald-800 text-white hover:bg-emerald-900 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 flex items-center gap-1 shadow-sm"
                      >
                        İncele <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>

              </div>

            </section>
          );
        })}
      </main>

      {/* Editorial Content: The Soil Thesis */}
      <section className="bg-stone-900 text-stone-300 py-28 mt-24 relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0" style={{
          backgroundImage: `
            linear-gradient(to right, #fff 1px, transparent 1px),
            linear-gradient(to bottom, #fff 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px"
        }} />

        <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
          
          <div className="space-y-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-500 block">Registry Philosophy</span>
            <h3 className="text-3xl font-light font-serif text-white tracking-tight leading-tight">
              Autonomy on Earth
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              True self-reliance begins with the land. Modern infrastructure has centralized our necessities, leaving individuals dependent. Owning private acreage offers direct access to solar radiation, clean water basins, and space to build sustainable shelters, bringing autonomy back to the individual.
            </p>
          </div>

          <div className="space-y-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-500 block">Safe Asset Class</span>
            <h3 className="text-3xl font-light font-serif text-white tracking-tight leading-tight">
              Inflation Protection
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Paper wealth is subject to systemic inflation and regulatory oversight. Raw land is a finite, physically limited asset protected under absolute freehold rights. Holding acreage across the American West serves as an inflation-proof store of value that carries minimal tax liability and zero annual fees.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-950 py-16 text-center space-y-4 relative z-10 border-t border-stone-800">
        <span className="text-xs font-light tracking-[0.3em] text-white uppercase block">
          Land<span className="font-semibold text-emerald-500">Forever</span>
        </span>
        <p className="text-[8px] font-semibold tracking-wider text-stone-500 max-w-sm mx-auto leading-relaxed uppercase">
          © {new Date().getFullYear()} LandForever. Certified freehold deeds registered at local official county registry offices.
        </p>
      </footer>
      
    </div>
  );
}
