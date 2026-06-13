export interface Property {
  id: string;
  title: string;
  slug: string;
  state: string;
  county: string;
  acres: number;
  price: number;
  costPrice: number;
  downPayment: number;
  monthlyPayment: number;
  term: number;
  paymentsReceived: number;
  images: string[];
  description: string;
  features: string[];
  coordinates: { lat: number; lng: number };
  zoning: string;
  terrain: string;
  roadAccess: string;
  utilities: string;
  apn: string;
  status: "available" | "pending" | "sold";
  featured: boolean;
  createdAt: string;
  soldDate: string | null;
  monthlyExpenses: number;
  useCases: string[];
  interestRate: number;
}

export const STATES = [
  "Arizona", "Arkansas", "California", "Colorado", "Florida", "Georgia",
  "Idaho", "Michigan", "Missouri", "Montana", "Nevada", "New Mexico",
  "North Carolina", "Oregon", "Tennessee", "Texas", "Utah", "Washington",
];

export const PROPERTY_TYPES = ["Residential", "Recreational", "Ranch", "Farm", "Commercial", "Hunting"];

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800&h=500&fit=crop",
];

function pickImages(seed: number): string[] {
  const start = seed % SAMPLE_IMAGES.length;
  return [
    SAMPLE_IMAGES[start],
    SAMPLE_IMAGES[(start + 1) % SAMPLE_IMAGES.length],
    SAMPLE_IMAGES[(start + 2) % SAMPLE_IMAGES.length],
  ];
}

const baseProperties: Property[] = [
  {
    id: "1", title: "5 Acres — Desert Vista Ranch", slug: "desert-vista-ranch-arizona",
    state: "Arizona", county: "Cochise", acres: 5, price: 7999, costPrice: 4800, downPayment: 199, monthlyPayment: 149, term: 48, paymentsReceived: 12,
    images: pickImages(0), description: "Stunning 5-acre parcel with panoramic mountain views in southeastern Arizona. Perfect for a homestead, off-grid retreat, or investment property. Gentle rolling terrain with native desert vegetation.",
    features: ["Mountain Views", "No HOA", "Off-Grid Friendly", "Year-Round Access"],
    coordinates: { lat: 31.89, lng: -109.68 }, zoning: "Rural Residential", terrain: "Desert / Rolling Hills",
    roadAccess: "Dirt Road (County Maintained)", utilities: "Off-Grid (Solar Recommended)", apn: "301-42-0180",
    status: "sold", featured: true, createdAt: "2026-05-01", soldDate: "2026-06-15", monthlyExpenses: 25,
    useCases: ["Off-Grid", "Homestead", "Solar"],
    interestRate: 9.9,
  },
  {
    id: "2", title: "10 Acres — Pine Ridge Retreat", slug: "pine-ridge-retreat-colorado",
    state: "Colorado", county: "Costilla", acres: 10, price: 12999, costPrice: 8450, downPayment: 299, monthlyPayment: 249, term: 48, paymentsReceived: 8,
    images: pickImages(1), description: "Beautiful 10-acre mountain property with mature pine trees and seasonal creek. Located in the San Luis Valley with views of the Sangre de Cristo Mountains.",
    features: ["Creek Access", "Pine Trees", "Mountain Views", "Wildlife"],
    coordinates: { lat: 37.12, lng: -105.45 }, zoning: "Agricultural", terrain: "Mountain / Forested",
    roadAccess: "Gravel Road", utilities: "Electric Available Nearby", apn: "710-15-0034",
    status: "sold", featured: true, createdAt: "2026-04-28", soldDate: "2026-07-10", monthlyExpenses: 35,
    useCases: ["Glamping", "Hunting", "Off-Grid"],
    interestRate: 10.9,
  },
  {
    id: "3", title: "2.5 Acres — Sunshine Meadow", slug: "sunshine-meadow-florida",
    state: "Florida", county: "Polk", acres: 2.5, price: 9499, costPrice: 5700, downPayment: 199, monthlyPayment: 179, term: 48, paymentsReceived: 0,
    images: pickImages(2), description: "Flat, buildable 2.5-acre lot in central Florida. Close to Orlando attractions, shopping, and dining. Paved road frontage with utilities at the lot line.",
    features: ["Paved Road", "Utilities Available", "Flat & Buildable", "Near Orlando"],
    coordinates: { lat: 27.95, lng: -81.62 }, zoning: "Residential", terrain: "Flat / Cleared",
    roadAccess: "Paved Road", utilities: "Water, Electric, Sewer at Lot Line", apn: "24-28-15-000",
    status: "available", featured: true, createdAt: "2026-05-10", soldDate: null, monthlyExpenses: 30,
    useCases: ["RV Camping", "Homestead", "Investment"],
    interestRate: 9.9,
  },
  {
    id: "4", title: "20 Acres — Lone Star Ranch", slug: "lone-star-ranch-texas",
    state: "Texas", county: "Hudspeth", acres: 20, price: 5999, costPrice: 3200, downPayment: 149, monthlyPayment: 119, term: 48, paymentsReceived: 15,
    images: pickImages(3), description: "Massive 20-acre spread in West Texas. Incredible value for land investors. Wide open spaces with distant mountain views and spectacular sunsets.",
    features: ["20 Full Acres", "Mountain Views", "No Restrictions", "Investment Grade"],
    coordinates: { lat: 31.45, lng: -105.23 }, zoning: "Unrestricted", terrain: "Desert / Flat",
    roadAccess: "Dirt Road", utilities: "Off-Grid", apn: "PSL-4521-007",
    status: "sold", featured: false, createdAt: "2026-05-05", soldDate: "2026-05-20", monthlyExpenses: 15,
    useCases: ["Investment", "Solar", "Off-Grid"],
    interestRate: 11.9,
  },
  {
    id: "5", title: "1 Acre — Ozark Hideaway", slug: "ozark-hideaway-arkansas",
    state: "Arkansas", county: "Sharp", acres: 1, price: 3999, costPrice: 2400, downPayment: 99, monthlyPayment: 79, term: 48, paymentsReceived: 5,
    images: pickImages(4), description: "Affordable 1-acre wooded lot in the Ozark Mountains. Quiet, private setting with mature hardwood trees. Great for a cabin, tiny home, or weekend getaway.",
    features: ["Wooded", "Private", "Affordable", "Cabin Ready"],
    coordinates: { lat: 36.21, lng: -91.56 }, zoning: "Residential", terrain: "Wooded / Hilly",
    roadAccess: "Gravel Road", utilities: "Electric Nearby", apn: "800-00312-000",
    status: "sold", featured: false, createdAt: "2026-05-12", soldDate: "2026-08-01", monthlyExpenses: 10,
    useCases: ["Hunting", "Glamping", "Off-Grid"],
    interestRate: 10.9,
  },
  {
    id: "6", title: "40 Acres — Silver Creek Ranch", slug: "silver-creek-ranch-montana",
    state: "Montana", county: "Garfield", acres: 40, price: 19999, costPrice: 12000, downPayment: 499, monthlyPayment: 399, term: 48, paymentsReceived: 3,
    images: pickImages(5), description: "Expansive 40-acre ranch property in eastern Montana. Rolling grasslands perfect for cattle, horses, or hunting. Remote and peaceful with big sky views.",
    features: ["40 Acres", "Ranch Ready", "Hunting Land", "Big Sky Views"],
    coordinates: { lat: 47.28, lng: -106.92 }, zoning: "Agricultural", terrain: "Grassland / Rolling",
    roadAccess: "County Road", utilities: "Well & Septic Needed", apn: "07-4281-00",
    status: "sold", featured: true, createdAt: "2026-04-20", soldDate: "2026-09-01", monthlyExpenses: 45,
    useCases: ["Homestead", "Ranch", "Hunting"],
    interestRate: 9.9,
  },
  {
    id: "7", title: "3 Acres — Red Rock Estates", slug: "red-rock-estates-new-mexico",
    state: "New Mexico", county: "Valencia", acres: 3, price: 4499, costPrice: 2700, downPayment: 99, monthlyPayment: 89, term: 48, paymentsReceived: 2,
    images: pickImages(6), description: "3-acre parcel south of Albuquerque with red rock formations and mesa views. Low-cost entry point with flexible zoning for residential or recreational use.",
    features: ["Mesa Views", "Low Cost", "Flexible Zoning", "Near Albuquerque"],
    coordinates: { lat: 34.63, lng: -106.75 }, zoning: "Rural", terrain: "Desert / Mesa",
    roadAccess: "Dirt Road", utilities: "Solar/Well Needed", apn: "1-012-046-312",
    status: "pending", featured: false, createdAt: "2026-05-08", soldDate: null, monthlyExpenses: 12,
    useCases: ["RV Camping", "Solar", "Investment"],
    interestRate: 11.9,
  },
  {
    id: "8", title: "8 Acres — Blue Ridge Parcel", slug: "blue-ridge-parcel-north-carolina",
    state: "North Carolina", county: "Wilkes", acres: 8, price: 14999, costPrice: 9750, downPayment: 349, monthlyPayment: 289, term: 48, paymentsReceived: 0,
    images: pickImages(7), description: "8-acre mountain property in the Blue Ridge foothills. Mix of open meadow and hardwood forest. Four-season climate with vibrant fall colors.",
    features: ["Blue Ridge Views", "Mixed Terrain", "4 Seasons", "Near Boone"],
    coordinates: { lat: 36.18, lng: -81.16 }, zoning: "Residential", terrain: "Mountain / Mixed",
    roadAccess: "Paved Road Nearby", utilities: "Electric Available", apn: "3862-14-9102",
    status: "available", featured: false, createdAt: "2026-05-15", soldDate: null, monthlyExpenses: 35,
    useCases: ["Glamping", "Off-Grid", "Homestead"],
    interestRate: 10.9,
  },
  {
    id: "9", title: "15 Acres — High Desert Homestead", slug: "high-desert-homestead-nevada",
    state: "Nevada", county: "Elko", acres: 15, price: 8999, costPrice: 5400, downPayment: 199, monthlyPayment: 169, term: 48, paymentsReceived: 10,
    images: pickImages(0), description: "15 acres of high desert terrain in northeastern Nevada. Breathtaking basin and range views. Perfect for off-grid living, stargazing, or long-term investment.",
    features: ["15 Acres", "Dark Sky Area", "Off-Grid Living", "Basin Views"],
    coordinates: { lat: 40.83, lng: -115.76 }, zoning: "Open Range", terrain: "High Desert",
    roadAccess: "BLM Road Access", utilities: "Off-Grid", apn: "009-230-012",
    status: "sold", featured: false, createdAt: "2026-05-03", soldDate: "2026-06-01", monthlyExpenses: 20,
    useCases: ["Investment", "Hunting", "Off-Grid"],
    interestRate: 9.9,
  },
  {
    id: "10", title: "5 Acres — Peach State Pines", slug: "peach-state-pines-georgia",
    state: "Georgia", county: "Emanuel", acres: 5, price: 11499, costPrice: 7475, downPayment: 249, monthlyPayment: 219, term: 48, paymentsReceived: 0,
    images: pickImages(1), description: "5-acre wooded lot in central Georgia. Tall pine trees and gentle terrain. Great for a homesite, hunting camp, or timber investment. Close to Swainsboro.",
    features: ["Pine Forest", "Hunting Land", "Near Town", "Timber Value"],
    coordinates: { lat: 32.60, lng: -82.33 }, zoning: "Agricultural/Residential", terrain: "Wooded / Flat",
    roadAccess: "Paved Road", utilities: "Electric at Road", apn: "063-010A",
    status: "available", featured: false, createdAt: "2026-05-11", soldDate: null, monthlyExpenses: 28,
    useCases: ["RV Camping", "Homestead", "Solar"],
    interestRate: 10.9,
  },
  {
    id: "11", title: "2 Acres — Pacific Northwest Hideout", slug: "pacific-nw-hideout-oregon",
    state: "Oregon", county: "Klamath", acres: 2, price: 6499, costPrice: 3900, downPayment: 149, monthlyPayment: 129, term: 48, paymentsReceived: 6,
    images: pickImages(2), description: "2-acre forested parcel near Klamath Falls. Surrounded by national forest with abundant outdoor recreation. Ideal for a cabin or tiny home retreat.",
    features: ["Forested", "Near National Forest", "Recreation", "Cabin Site"],
    coordinates: { lat: 42.22, lng: -121.73 }, zoning: "Residential/Forest", terrain: "Forested",
    roadAccess: "Gravel Road", utilities: "Electric Available", apn: "R-3911-02200",
    status: "sold", featured: false, createdAt: "2026-05-14", soldDate: "2026-07-20", monthlyExpenses: 18,
    useCases: ["Solar", "Investment", "Off-Grid"],
    interestRate: 11.9,
  },
  {
    id: "12", title: "25 Acres — Valley View Farm", slug: "valley-view-farm-tennessee",
    state: "Tennessee", county: "Wayne", acres: 25, price: 22999, costPrice: 14950, downPayment: 599, monthlyPayment: 449, term: 48, paymentsReceived: 4,
    images: pickImages(3), description: "25-acre farm property in southern Tennessee. Rolling pastureland with a spring-fed pond. Perfect for hobby farming, horses, or a country estate.",
    features: ["Spring-Fed Pond", "Pastureland", "Farm Ready", "Rolling Hills"],
    coordinates: { lat: 35.24, lng: -87.78 }, zoning: "Agricultural", terrain: "Pasture / Rolling",
    roadAccess: "Paved Road", utilities: "Water & Electric", apn: "077-019.00",
    status: "sold", featured: true, createdAt: "2026-05-02", soldDate: "2026-08-15", monthlyExpenses: 50,
    useCases: ["Ranch", "Homestead", "Hunting"],
    interestRate: 9.9,
  },
];

const countysByState: Record<string, string[]> = {
  "Arizona": ["Cochise", "Mohave", "Coconino", "Yuma", "Apache"],
  "Colorado": ["Costilla", "Alamosa", "Park", "Huerfano", "Saguache"],
  "Texas": ["Hudspeth", "Culberson", "Presidio", "Brewster", "Val Verde"],
  "Nevada": ["Elko", "Nye", "Pershing", "Humboldt", "Washoe"],
  "New Mexico": ["Valencia", "Socorro", "Torrance", "Luna", "Cibola"],
  "Oregon": ["Klamath", "Lake", "Harney", "Deschutes", "Crook"],
  "Florida": ["Polk", "Putnam", "Levy", "Marion", "Citrus"],
  "Arkansas": ["Sharp", "Izard", "Fulton", "Randolph", "Stone"],
  "Montana": ["Garfield", "Valley", "Rosebud", "Custer", "Phillips"],
  "Georgia": ["Emanuel", "Burke", "Jefferson", "Screven", "Jenkins"],
  "Tennessee": ["Wayne", "Hickman", "Perry", "Lewis", "Decatur"],
  "Idaho": ["Owyhee", "Elmore", "Boise", "Custer", "Valley"],
  "Utah": ["Duchesne", "Box Elder", "Iron", "Tooele", "Uintah"]
};

const coordinatesByState: Record<string, { lat: number; lng: number }> = {
  "Arizona": { lat: 34.04, lng: -111.09 },
  "Colorado": { lat: 39.55, lng: -105.78 },
  "Texas": { lat: 31.96, lng: -99.90 },
  "Nevada": { lat: 38.80, lng: -116.41 },
  "New Mexico": { lat: 34.51, lng: -105.87 },
  "Oregon": { lat: 43.80, lng: -120.55 },
  "Florida": { lat: 27.66, lng: -81.51 },
  "Arkansas": { lat: 35.20, lng: -91.83 },
  "Montana": { lat: 46.87, lng: -110.36 },
  "Georgia": { lat: 32.16, lng: -82.90 },
  "Tennessee": { lat: 35.51, lng: -86.58 },
  "Idaho": { lat: 44.06, lng: -114.74 },
  "Utah": { lat: 39.32, lng: -111.09 }
};

const adjs = ["Scenic", "Wild", "Sunny", "Golden", "Whispering", "Highland", "Rocky", "River", "Green", "Timber", "Red Rock", "Starlight", "Sunset", "Alpine"];
const nouns = ["Valley", "Ridge", "Meadow", "Hill", "Pines", "Homestead", "Plaza", "Canyon", "Vista", "Creek", "Estates", "Ranch", "Haven", "Retreat"];

function generateMockProperties(count: number): Property[] {
  const result: Property[] = [];
  const states = Object.keys(countysByState);
  
  for (let i = 0; i < count; i++) {
    const state = states[i % states.length];
    const counties = countysByState[state];
    const county = counties[Math.floor((i * 7) % counties.length)];
    const stateCenter = coordinatesByState[state];
    
    // Slight offset coordinates to render distinct markers on Leaflet
    const lat = stateCenter.lat + ((i % 10) - 5) * 0.15 + (Math.sin(i) * 0.05);
    const lng = stateCenter.lng + (((i * 3) % 10) - 5) * 0.15 + (Math.cos(i) * 0.05);
    
    const adj = adjs[(i * 3) % adjs.length];
    const noun = nouns[(i * 7) % nouns.length];
    const acres = parseFloat(((i % 5 === 0) ? 20 + (i % 20) : 1 + (i % 15) * 1.5).toFixed(1));
    
    const pricePerAcre = 800 + ((i * 13) % 1200);
    const price = Math.round(acres * pricePerAcre);
    
    const downPayment = price < 5000 ? 99 : price < 10000 ? 199 : price < 20000 ? 299 : 499;
    const term = 48;
    const monthlyPayment = Math.round((price - downPayment) / term);
    
    const featured = i < 6;
    const apn = `${100 + (i % 899)}-${10 + (i % 89)}-${1000 + i}`;
    
    const featuresList = ["Mountain Views", "No HOA", "Off-Grid Friendly", "Year-Round Access", "Trees", "Paved Road Frontage", "Flat & Buildable", "Near National Forest"];
    const activeFeatures = [
      featuresList[i % featuresList.length],
      featuresList[(i + 2) % featuresList.length],
      featuresList[(i + 5) % featuresList.length]
    ];
    
    const costPrice = Math.round(price * (0.50 + ((i * 7) % 25) * 0.01));
    const isSold = i % 3 === 0;
    const isPending = !isSold && i % 5 === 0;
    const status: "available" | "pending" | "sold" = isSold ? "sold" : isPending ? "pending" : "available";
    const soldDate = isSold ? new Date(Date.now() - (i * 12 * 60 * 60 * 1000)).toISOString().split('T')[0] : null;
    const paymentsReceived = isSold ? Math.min(term, 1 + (i % 20)) : 0;
    const monthlyExpenses = Math.round(10 + (acres * 1.5) + (i % 20));

    result.push({
      id: `generated-${i}`,
      title: `${acres} Acres — ${adj} ${noun}`,
      slug: `${acres}-acres-${adj}-${noun}-${state}`.toLowerCase().replace(/\s+/g, "-"),
      state,
      county,
      acres,
      price,
      costPrice,
      downPayment,
      monthlyPayment,
      term,
      paymentsReceived,
      images: pickImages(i),
      description: `Incredible ${acres}-acre parcel located in ${county} County, ${state}. This pristine piece of American land offers beautiful natural landscapes with a variety of potential uses. Perfect for a residential homesite, recreational cabin, off-grid homestead, or long-term investment. Fully approved owner financing available with no credit check needed.`,
      features: activeFeatures,
      coordinates: { lat, lng },
      zoning: i % 3 === 0 ? "Agricultural" : i % 3 === 1 ? "Rural Residential" : "Unrestricted",
      terrain: i % 4 === 0 ? "Flat / Grassland" : i % 4 === 1 ? "Wooded / Flat" : i % 4 === 2 ? "Rolling / Desert" : "Mountain / Slope",
      roadAccess: i % 2 === 0 ? "Dirt Road" : "Gravel Road",
      utilities: i % 3 === 0 ? "Off-Grid (Solar & Well Needed)" : "Electric Nearby",
      apn,
      status,
      featured,
      createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      soldDate,
      monthlyExpenses,
      useCases: [
        ["Off-Grid", "Homestead", "Solar", "Glamping", "Hunting", "RV Camping", "Investment", "Ranch"][i % 8],
        ["Investment", "Off-Grid", "Hunting", "Solar", "Glamping", "Ranch", "Homestead", "RV Camping"][(i + 3) % 8],
      ],
      interestRate: [9.9, 10.9, 11.9][i % 3],
    });
  }
  
  return result;
}

export const properties: Property[] = [
  ...baseProperties,
  ...generateMockProperties(180)
];

export interface OffMarketProperty {
  id: string;
  title: string;
  state: string;
  county: string;
  acres: number;
  price: number;
  estimatedValue: number;
  description: string;
  source: "Tax Deed" | "Direct Mail" | "Wholesaler" | "Probate" | "Foreclosure";
  accessCode: string;
  status: "available" | "under_contract" | "sold" | "withdrawn";
  visibility: "private" | "vip_only" | "code_access";
  addedDate: string;
  expiresAt: string | null;
  images: string[];
  lat: number;
  lng: number;
  apn: string;
  discount: number;
  notes: string;
}

export const offMarketProperties: OffMarketProperty[] = [
  {
    id: "om-1", title: "12 Acres — Hidden Canyon Estate", state: "Arizona", county: "Yavapai", acres: 12, price: 18500, estimatedValue: 32000,
    description: "Secluded 12-acre canyon property with year-round creek access. Previous owner defaulted on tax payments. Stunning red rock formations and mature cottonwood trees. Ideal for a private retreat or eco-lodge development.",
    source: "Tax Deed", accessCode: "AZ12HC", status: "available", visibility: "code_access",
    addedDate: "2026-05-20", expiresAt: "2026-07-20", images: pickImages(0), lat: 34.58, lng: -112.47, apn: "401-22-018A", discount: 42, notes: "Tax deed auction win. Title is clean. Buyer must close within 30 days."
  },
  {
    id: "om-2", title: "6 Acres — Emerald Pines Lot", state: "Oregon", county: "Josephine", acres: 6, price: 11900, estimatedValue: 21000,
    description: "Gorgeous 6-acre wooded lot surrounded by BLM land. Direct mail response from elderly owner looking for quick sale. Power and well already on property.",
    source: "Direct Mail", accessCode: "OR06EP", status: "available", visibility: "vip_only",
    addedDate: "2026-05-25", expiresAt: null, images: pickImages(1), lat: 42.44, lng: -123.56, apn: "R-3520-01100", discount: 43, notes: "Seller motivated. Can close in 2 weeks. Well tested at 15 GPM."
  },
  {
    id: "om-3", title: "30 Acres — Prairie Wind Ranch", state: "Texas", county: "Val Verde", acres: 30, price: 14000, estimatedValue: 27000,
    description: "30 acres of prime hunting land near the Rio Grande. Wholesaler deal with existing fence line and improved road. Abundant wildlife including deer and quail.",
    source: "Wholesaler", accessCode: "TX30PW", status: "under_contract", visibility: "code_access",
    addedDate: "2026-05-15", expiresAt: "2026-06-30", images: pickImages(2), lat: 29.88, lng: -101.12, apn: "PSL-7832-011", discount: 48, notes: "Assignment contract. $2k earnest money deposited. Closing scheduled June 28."
  },
  {
    id: "om-4", title: "4 Acres — Magnolia Bluff", state: "Georgia", county: "Burke", acres: 4, price: 8200, estimatedValue: 15500,
    description: "4-acre elevated lot with panoramic views of the Savannah River valley. Probate sale — heirs want fast disposition. Paved road frontage, power at lot line.",
    source: "Probate", accessCode: "GA04MB", status: "available", visibility: "code_access",
    addedDate: "2026-06-01", expiresAt: "2026-08-01", images: pickImages(3), lat: 33.05, lng: -81.97, apn: "064-015B", discount: 47, notes: "Probate court approved. Attorney handling closing. Clean title confirmed."
  },
  {
    id: "om-5", title: "18 Acres — Timberline Pass", state: "Colorado", county: "Huerfano", acres: 18, price: 22000, estimatedValue: 38000,
    description: "18 acres of mountain terrain at 8,200ft elevation. Bank foreclosure — priced well below market. Mix of aspen and spruce forest with seasonal stream.",
    source: "Foreclosure", accessCode: "CO18TP", status: "available", visibility: "private",
    addedDate: "2026-05-28", expiresAt: "2026-07-15", images: pickImages(4), lat: 37.68, lng: -105.01, apn: "720-18-0091", discount: 42, notes: "Bank REO. Requires cash purchase. No owner financing available on this one."
  },
  {
    id: "om-6", title: "8 Acres — Sawgrass Flats", state: "Florida", county: "Levy", acres: 8, price: 15500, estimatedValue: 28000,
    description: "8 flat acres with county water available. Tax deed purchase from county surplus auction. Previously used as horse pasture. Fenced on three sides.",
    source: "Tax Deed", accessCode: "FL08SF", status: "available", visibility: "code_access",
    addedDate: "2026-06-02", expiresAt: null, images: pickImages(5), lat: 29.38, lng: -82.71, apn: "15-12-17-000", discount: 45, notes: "Quiet title action completed. Ready for immediate resale or development."
  },
  {
    id: "om-7", title: "50 Acres — Mustang Flats", state: "Nevada", county: "Nye", acres: 50, price: 19000, estimatedValue: 35000,
    description: "Massive 50-acre spread in central Nevada. Direct mail acquisition from absentee owner. Unobstructed mountain views with dark sky designation area.",
    source: "Direct Mail", accessCode: "NV50MF", status: "sold", visibility: "code_access",
    addedDate: "2026-04-10", expiresAt: null, images: pickImages(6), lat: 38.04, lng: -116.18, apn: "010-451-003", discount: 46, notes: "Sold to VIP buyer for $32k. Closed April 28."
  },
  {
    id: "om-8", title: "10 Acres — Copper Ridge", state: "New Mexico", county: "Luna", acres: 10, price: 6500, estimatedValue: 12000,
    description: "10 desert acres near Deming with easy I-10 access. Wholesaler assignment from distressed seller. Flat, buildable terrain with mountain backdrop.",
    source: "Wholesaler", accessCode: "NM10CR", status: "available", visibility: "vip_only",
    addedDate: "2026-06-03", expiresAt: "2026-07-03", images: pickImages(7), lat: 32.27, lng: -107.76, apn: "3-024-142-389", discount: 46, notes: "Assignment fee $1,500 included in price. Seller wants to close by end of month."
  },
  {
    id: "om-9", title: "15 Acres — Whispering Oaks", state: "Tennessee", county: "Perry", acres: 15, price: 17500, estimatedValue: 31000,
    description: "15 rolling acres with mature oak forest and spring-fed creek. Probate sale from estate. Road frontage on both sides. Surveyed and ready.",
    source: "Probate", accessCode: "TN15WO", status: "withdrawn", visibility: "code_access",
    addedDate: "2026-04-20", expiresAt: null, images: pickImages(0), lat: 35.63, lng: -87.87, apn: "078-023.01", discount: 44, notes: "Withdrawn — heir dispute. May become available again in 60 days."
  },
  {
    id: "om-10", title: "7 Acres — Summit View", state: "Montana", county: "Rosebud", acres: 7, price: 9800, estimatedValue: 18000,
    description: "7 acres of Montana grassland with distant mountain views. Foreclosure acquisition from local bank. Gentle slope, good drainage, county road access.",
    source: "Foreclosure", accessCode: "MT07SV", status: "available", visibility: "code_access",
    addedDate: "2026-06-04", expiresAt: "2026-08-04", images: pickImages(1), lat: 46.25, lng: -106.48, apn: "08-4392-01", discount: 46, notes: "Bank wants to move fast. Will accept reasonable offers. Cash preferred."
  },
];
