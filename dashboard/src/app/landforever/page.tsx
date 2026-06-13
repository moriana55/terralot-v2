"use client";

import { useState } from "react";
import { 
  MapPin, 
  ArrowRight,
  Plus
} from "lucide-react";

interface LandSanctuary {
  id: string;
  name: string;
  location: string;
  acres: string;
  coords: string;
  pricing: string;
  narrative: string;
  offgridThesis: string;
  investmentThesis: string;
  image: string;
}

const SANCTUARIES: LandSanctuary[] = [
  {
    id: "01",
    name: "The Juniper Ridge Sanctuary",
    location: "Mohave County, Arizona",
    acres: "1.25 Acres",
    coords: "35.1244° N, 114.5422° W",
    pricing: "Acquisition from $189 monthly or $14,500 cash value",
    narrative: "A raw, untethered expanse of 1.25 acres in the high Arizona desert. There are no utility poles to disrupt the horizon, and no paved roads to carry city noise. Access is a simple track winding through sagebrush—an open canvas for a self-sustaining solar cabin or an off-grid sanctuary under the mountain skies.",
    offgridThesis: "Perfect for rain catchment systems, custom solar arrays, and composting setups. RVs and tiny homes are welcome. Deep-aquifer well water is permitted in the basin.",
    investmentThesis: "Arizona's sun belt continues to see steady demand as urban areas expand. Land remains a stable, inflation-resistant asset with minimal carrying costs (annual property tax is under $30).",
    image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1600&auto=format&fit=crop&q=80"
  },
  {
    id: "02",
    name: "Blanca Creek Basin",
    location: "Costilla County, Colorado",
    acres: "5.00 Acres",
    coords: "37.2411° N, 105.4199° W",
    pricing: "Acquisition from $240 monthly or $19,800 cash value",
    narrative: "Located in the heart of the San Luis Valley, this flat grasslands parcel is an exceptional canvas for off-grid living or long-term land holding. Wild elk graze nearby, and the quiet reservoir is just a short drive away. This property offers clear, unobstructed horizons for a fully-independent solar homestead.",
    offgridThesis: "100% off-grid capability. Ideal for large solar configurations and wind setups. Cistern storage or permitted well drilling provides simple water security.",
    investmentThesis: "Colorado mountain view parcels are highly sought after for recreational use and ecological retreats. Low holding taxes make this an effortless generational asset.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&auto=format&fit=crop&q=80"
  },
  {
    id: "03",
    name: "Mesa Vista Highlands",
    location: "Valencia County, New Mexico",
    acres: "10.00 Acres",
    coords: "34.6801° N, 106.7644° W",
    pricing: "Acquisition from $299 monthly or $24,500 cash value",
    narrative: "A sprawling estate designed for those who value absolute space and stillness. This parcel offers endless opportunities for horse grazing, private stargazing, or custom off-grid architectural projects. Located within reasonable driving distance of Albuquerque, it balances seclusion with access.",
    offgridThesis: "Sublime solar profile with over 300 days of sunshine annually. Perfect for geodesic domes, container homes, and independent power systems.",
    investmentThesis: "Purchasing a larger ten-acre tract offers significant hedge benefits against inflation, with highly favorable agricultural zoning and negligible carrying fees.",
    image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1600&auto=format&fit=crop&q=80"
  },
  {
    id: "04",
    name: "Ponderosa Pine Sanctuary",
    location: "Klamath County, Oregon",
    acres: "4.25 Acres",
    coords: "42.5322° N, 121.8901° W",
    pricing: "Acquisition from $380 monthly or $32,000 cash value",
    narrative: "Encircled by massive ponderosa pines, this quiet woodland property is the ultimate retreat for nature lovers. The air is fresh, clean, and scented with pine. Whether you build an alpine A-frame cabin, pitch a luxury canvas tent, or hold the land for future appreciation, this parcel feels like a national park.",
    offgridThesis: "Favorable residential zoning allowing cabins, seasonal camping, or eco-lodges. Water wells in this region are highly reliable and rich in minerals.",
    investmentThesis: "Oregon forest properties near major national parks command premium value. A rare opportunity to secure timberland on direct developer terms.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&auto=format&fit=crop&q=80"
  }
];

export default function LandForeverPage() {
  const [activeTabs, setActiveTabs] = useState<Record<string, "offgrid" | "investment">>({
    "01": "offgrid",
    "02": "offgrid",
    "03": "offgrid",
    "04": "offgrid"
  });
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

  return (
    <div className="min-h-screen bg-[#faf8f5] text-zinc-950 font-sans antialiased overflow-x-hidden selection:bg-stone-200 pb-24">
      
      {/* Top clean header strip */}
      <div className="h-1.5 w-full bg-zinc-900" />

      {/* Brand Header */}
      <header className="max-w-6xl mx-auto px-8 py-8 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-extralight text-2xl tracking-[0.3em] uppercase leading-none text-zinc-900">
            LandForever
          </span>
          <span className="text-[8px] font-semibold tracking-[0.25em] text-zinc-500 uppercase mt-2">
            A Journal of Selected Earth
          </span>
        </div>
        
        <div className="flex items-center gap-8 text-[9px] font-semibold tracking-[0.2em] uppercase text-zinc-400">
          <span className="text-zinc-800">01 / The Collection</span>
          <span>02 / Philosophy</span>
          <span>03 / Contact</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center max-w-2xl mx-auto px-8">
        <h1 className="text-4xl md:text-5xl font-light font-serif tracking-tight text-zinc-950 mb-6 leading-none">
          Active Land Holdings. <br/>
          <span className="font-sans font-extralight italic text-zinc-400">Direct from developer.</span>
        </h1>
        <p className="text-xs md:text-sm text-zinc-550 font-light leading-relaxed">
          Explore our complete collection of raw, off-grid soil parcels across the American West. Digital deed transfers are guaranteed directly under your name.
        </p>
      </section>

      {/* Listings List (Vertical Scroll) */}
      <main className="max-w-6xl mx-auto px-8 space-y-32">
        {SANCTUARIES.map((item) => {
          const activeTab = activeTabs[item.id] || "offgrid";
          const email = emails[item.id] || "";
          const isInquired = inquiredIds[item.id] || false;

          return (
            <section 
              key={item.id} 
              className="border-t border-zinc-200 pt-16 grid grid-cols-1 lg:grid-cols-12 gap-16 items-start"
            >
              
              {/* Left Column: Framed Nature Photography (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-250/60 shadow-md relative">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Absolute overlay indicators */}
                  <div className="absolute bottom-6 left-6 flex items-center gap-3">
                    <span className="text-[10px] font-mono tracking-widest text-white uppercase bg-black/45 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/10">
                      {item.acres}
                    </span>
                    <span className="text-[10px] font-mono tracking-widest text-white uppercase bg-black/45 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {item.location.split(",")[1]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Editorial Typography and Narrative (5 cols) */}
              <div className="lg:col-span-5 space-y-8">
                
                {/* Header Title */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                    <span>Tract {item.id}</span>
                    <span>•</span>
                    <span>{item.location}</span>
                  </div>
                  
                  <h2 className="text-3xl font-light font-serif tracking-tight text-zinc-950 leading-tight">
                    {item.name}
                  </h2>
                  
                  <p className="text-xs text-zinc-850 font-serif italic font-light border-l border-zinc-400 pl-4 py-0.5 leading-relaxed">
                    {item.pricing}
                  </p>
                </div>

                {/* Narrative description */}
                <p className="text-xs text-zinc-650 leading-relaxed font-light">
                  {item.narrative}
                </p>

                {/* Toggle Thesis Option (Off-grid vs Investment) */}
                <div className="space-y-4">
                  <div className="flex gap-6 border-b border-stone-300/40 pb-2">
                    <button 
                      onClick={() => handleTabChange(item.id, "offgrid")}
                      className={`text-[10px] font-bold uppercase tracking-wider transition-colors pb-1.5 -mb-2 border-b ${
                        activeTab === 'offgrid' ? 'border-zinc-850 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      Off-Grid Potential
                    </button>
                    <button 
                      onClick={() => handleTabChange(item.id, "investment")}
                      className={`text-[10px] font-bold uppercase tracking-wider transition-colors pb-1.5 -mb-2 border-b ${
                        activeTab === 'investment' ? 'border-zinc-850 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      The Investment Case
                    </button>
                  </div>

                  <p className="text-xs text-zinc-650 leading-relaxed font-light min-h-[50px]">
                    {activeTab === 'offgrid' ? item.offgridThesis : item.investmentThesis}
                  </p>
                </div>

                {/* Minimalist Inquiry Form */}
                <div className="pt-8 border-t border-stone-300/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-900">Request coordinates & contract</span>
                    <span className="text-[9px] font-mono text-zinc-400">{item.coords}</span>
                  </div>
                  
                  {isInquired ? (
                    <div className="bg-zinc-900 text-white p-4 rounded-xl text-xs flex items-center justify-between">
                      <span>Documentation and satellite maps dispatched.</span>
                      <span className="text-[10px] font-mono opacity-60">Success</span>
                    </div>
                  ) : (
                    <form onSubmit={(e) => handleInquire(e, item.id)} className="flex gap-2">
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => handleEmailChange(item.id, e.target.value)}
                        placeholder="Enter email to receive satellite coordinates"
                        className="flex-1 bg-transparent border-b border-stone-400 py-2.5 text-xs text-zinc-850 placeholder-zinc-450 focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                      <button 
                        type="submit"
                        className="border border-zinc-900 hover:bg-zinc-950 hover:text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 flex items-center gap-1.5"
                      >
                        Acquire <ArrowRight className="w-3.5 h-3.5" />
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
      <section className="bg-zinc-900 text-stone-300 py-28 mt-24">
        <div className="max-w-4xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-16">
          
          <div className="space-y-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-stone-500 block">Philosophy</span>
            <h3 className="text-3xl font-light font-serif text-white tracking-tight leading-tight">
              The Off-Grid Movement
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              True self-reliance begins with the land. Modern infrastructure has centralized our necessities, leaving individuals dependent. Owning private acreage offers direct access to solar radiation, clean water basins, and space to build sustainable shelters, bringing autonomy back to the individual.
            </p>
          </div>

          <div className="space-y-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-stone-500 block">The Asset</span>
            <h3 className="text-3xl font-light font-serif text-white tracking-tight leading-tight">
              Tangible Security
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Paper wealth is subject to systemic inflation and regulatory oversight. Raw land is a finite, physically limited asset protected under absolute freehold rights. Holding acreage across the American West serves as an inflation-proof store of value that carries minimal tax liability and zero annual fees.
            </p>
          </div>

        </div>
      </section>

      {/* Minimalist Footer */}
      <footer className="bg-zinc-950 py-16 text-center space-y-4">
        <span className="text-xs font-extralight tracking-[0.3em] text-white uppercase block">
          LandForever
        </span>
        <p className="text-[9px] font-semibold tracking-wider text-stone-500 max-w-sm mx-auto leading-relaxed uppercase">
          © {new Date().getFullYear()} LandForever. Protected freehold soil deeds registered at official county offices.
        </p>
      </footer>
      
    </div>
  );
}
