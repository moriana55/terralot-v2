import type { Property } from "@/lib/data";

// YATIRIMCI PORTALI DEMO VERİSİ — public vitrin DEĞİL.
//
// /investor/* ekranları (portfolio, financials, payments) ürünü bir yatırımcıya
// göstermek için hazırlanmış örnek portföy rakamları gösterir; bu sayfalar
// SampleDataBanner ile "örnek veri" olduklarını açıkça belirtir. Canlı
// portföy/ödeme pipeline'ı Supabase/Stripe'a bağlanana kadar bu demo veri kullanılır.
//
// Public vitrin (/properties, ilan detay, /land-for-sale) artık GERÇEK Supabase
// verisinden beslenir ve bu dosyayı KULLANMAZ.
const DEMO_IMAGE = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=500&fit=crop";

export const investorDemoProperties: Property[] = [
  {
    id: "demo-1", title: "5 Acres — Desert Vista Ranch", slug: "demo-desert-vista-ranch",
    state: "Arizona", county: "Cochise", acres: 5, price: 7999, costPrice: 4800, downPayment: 199, monthlyPayment: 149, term: 48, paymentsReceived: 12,
    images: [DEMO_IMAGE], description: "Demo parcel.", features: ["Mountain Views", "No HOA"],
    coordinates: { lat: 31.89, lng: -109.68 }, zoning: "Rural Residential", terrain: "Desert",
    roadAccess: "Dirt Road", utilities: "Off-Grid", apn: "301-42-0180",
    status: "sold", featured: true, createdAt: "2026-05-01", soldDate: "2026-06-15", monthlyExpenses: 25,
    useCases: ["Off-Grid", "Homestead"], interestRate: 9.9,
  },
  {
    id: "demo-2", title: "10 Acres — Pine Ridge Retreat", slug: "demo-pine-ridge-retreat",
    state: "Colorado", county: "Costilla", acres: 10, price: 12999, costPrice: 8450, downPayment: 299, monthlyPayment: 249, term: 48, paymentsReceived: 8,
    images: [DEMO_IMAGE], description: "Demo parcel.", features: ["Creek Access", "Pine Trees"],
    coordinates: { lat: 37.12, lng: -105.45 }, zoning: "Agricultural", terrain: "Mountain",
    roadAccess: "Gravel Road", utilities: "Electric Available Nearby", apn: "710-15-0034",
    status: "sold", featured: true, createdAt: "2026-04-28", soldDate: "2026-07-10", monthlyExpenses: 35,
    useCases: ["Glamping", "Hunting"], interestRate: 10.9,
  },
  {
    id: "demo-3", title: "2.5 Acres — Sunshine Meadow", slug: "demo-sunshine-meadow",
    state: "Florida", county: "Polk", acres: 2.5, price: 9499, costPrice: 5700, downPayment: 199, monthlyPayment: 179, term: 48, paymentsReceived: 0,
    images: [DEMO_IMAGE], description: "Demo parcel.", features: ["Paved Road", "Utilities Available"],
    coordinates: { lat: 27.95, lng: -81.62 }, zoning: "Residential", terrain: "Flat",
    roadAccess: "Paved Road", utilities: "Water, Electric, Sewer at Lot Line", apn: "24-28-15-000",
    status: "available", featured: true, createdAt: "2026-05-10", soldDate: null, monthlyExpenses: 30,
    useCases: ["RV Camping", "Homestead"], interestRate: 9.9,
  },
  {
    id: "demo-4", title: "20 Acres — Lone Star Ranch", slug: "demo-lone-star-ranch",
    state: "Texas", county: "Hudspeth", acres: 20, price: 5999, costPrice: 3200, downPayment: 149, monthlyPayment: 119, term: 48, paymentsReceived: 15,
    images: [DEMO_IMAGE], description: "Demo parcel.", features: ["20 Full Acres", "No Restrictions"],
    coordinates: { lat: 31.45, lng: -105.23 }, zoning: "Unrestricted", terrain: "Desert",
    roadAccess: "Dirt Road", utilities: "Off-Grid", apn: "PSL-4521-007",
    status: "sold", featured: false, createdAt: "2026-05-05", soldDate: "2026-05-20", monthlyExpenses: 15,
    useCases: ["Investment", "Solar"], interestRate: 11.9,
  },
  {
    id: "demo-5", title: "40 Acres — Silver Creek Ranch", slug: "demo-silver-creek-ranch",
    state: "Montana", county: "Garfield", acres: 40, price: 19999, costPrice: 12000, downPayment: 499, monthlyPayment: 399, term: 48, paymentsReceived: 3,
    images: [DEMO_IMAGE], description: "Demo parcel.", features: ["40 Acres", "Hunting Land"],
    coordinates: { lat: 47.28, lng: -106.92 }, zoning: "Agricultural", terrain: "Grassland",
    roadAccess: "County Road", utilities: "Well & Septic Needed", apn: "07-4281-00",
    status: "sold", featured: true, createdAt: "2026-04-20", soldDate: "2026-09-01", monthlyExpenses: 45,
    useCases: ["Homestead", "Ranch"], interestRate: 9.9,
  },
  {
    id: "demo-6", title: "25 Acres — Valley View Farm", slug: "demo-valley-view-farm",
    state: "Tennessee", county: "Wayne", acres: 25, price: 22999, costPrice: 14950, downPayment: 599, monthlyPayment: 449, term: 48, paymentsReceived: 4,
    images: [DEMO_IMAGE], description: "Demo parcel.", features: ["Spring-Fed Pond", "Pastureland"],
    coordinates: { lat: 35.24, lng: -87.78 }, zoning: "Agricultural", terrain: "Pasture",
    roadAccess: "Paved Road", utilities: "Water & Electric", apn: "077-019.00",
    status: "pending", featured: true, createdAt: "2026-05-02", soldDate: null, monthlyExpenses: 50,
    useCases: ["Ranch", "Homestead"], interestRate: 9.9,
  },
];
