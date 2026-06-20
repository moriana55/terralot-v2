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

// Görsel olmayan ilanlar için yedek görsel (Supabase'de images boş gelirse).
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=500&fit=crop";

// ── Supabase → vitrin Property eşlemesi ───────────────────────────────────────
// /api/listings route'undan dönen ham satır (Property tablosu) bu şekli verir.
// Tablo kolonları vitrinin beklediği şekle burada çevrilir; özellikle
// lat/lng -> coordinates ve status (AVAILABLE/PENDING/SOLD) -> küçük harf.
export interface RawListing {
  id: string;
  title: string;
  slug: string;
  state: string;
  county: string;
  acres: number;
  price: number;
  costPrice?: number | null;
  downPayment: number;
  monthlyPayment: number;
  term?: number | null;
  paymentsReceived?: number | null;
  images?: string[] | null;
  description?: string | null;
  features?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  zoning?: string | null;
  terrain?: string | null;
  roadAccess?: string | null;
  utilities?: string | null;
  apn?: string | null;
  status?: string | null;
  featured?: boolean | null;
  createdAt?: string | null;
  monthlyExpenses?: number | null;
  useCases?: string[] | null;
  interestRate?: number | null;
}

export function mapListing(r: RawListing): Property {
  const rawStatus = (r.status || "available").toLowerCase();
  const status: Property["status"] =
    rawStatus === "sold" || rawStatus === "pending" ? rawStatus : "available";
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    state: r.state,
    county: r.county,
    acres: r.acres,
    price: r.price,
    costPrice: r.costPrice ?? 0,
    downPayment: r.downPayment,
    monthlyPayment: r.monthlyPayment,
    term: r.term ?? 48,
    paymentsReceived: r.paymentsReceived ?? 0,
    images: r.images && r.images.length > 0 ? r.images : [FALLBACK_IMAGE],
    description: r.description ?? "",
    features: r.features ?? [],
    coordinates: { lat: r.lat ?? 0, lng: r.lng ?? 0 },
    zoning: r.zoning ?? "",
    terrain: r.terrain ?? "",
    roadAccess: r.roadAccess ?? "",
    utilities: r.utilities ?? "",
    apn: r.apn ?? "",
    status,
    featured: r.featured ?? false,
    createdAt: r.createdAt ?? new Date().toISOString(),
    soldDate: null,
    monthlyExpenses: r.monthlyExpenses ?? 0,
    useCases: r.useCases ?? [],
    interestRate: r.interestRate ?? 0,
  };
}

// İstemci tarafı veri çekme yardımcıları. Tüm hatalar yutulur ve boş dizi/null
// döner — vitrin sayfaları ASLA çökmemeli (Supabase erişilemez/boş olsa bile).
async function fetchListings(params?: Record<string, string>): Promise<Property[]> {
  try {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await fetch(`/api/listings${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = (json.properties ?? []) as RawListing[];
    return rows.map(mapListing);
  } catch {
    return [];
  }
}

// Vitrin liste sayfaları (/properties, /land-for-sale/[state], /compare) için
// tüm yayındaki ilanları getirir.
export async function getProperties(): Promise<Property[]> {
  return fetchListings();
}

// İlan detay sayfası — cuid id veya slug ile tekil ilan getirir.
export async function getPropertyById(id: string): Promise<Property | null> {
  const rows = await fetchListings({ id });
  return rows[0] ?? null;
}


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

// Off-market vitrini şu an gerçek bir Supabase kaynağına bağlı DEĞİL.
// (Property tablosu yalnızca yayındaki satılık ilanları tutar; özel/erişim-kodlu
// off-market deal'ları için ayrı bir tablo yok.) Mock veriyi vitrine dökmemek
// için boş bırakıldı — sayfa dürüst boş-durum gösterir. Gerçek off-market
// kaynağı eklendiğinde burası onunla doldurulmalı.
export const offMarketProperties: OffMarketProperty[] = [];
