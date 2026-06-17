import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Curated US megaprojects — chip fabs, EV/battery plants, AI data centers.
// Land near an announced megaproject appreciates fast (jobs + housing demand).
// Each entry: the county the project sits in → we flag deals in that county.
export interface Catalyst {
  company: string; project: string; sector: string;
  city: string; state: string; county: string;
  investmentB: number; year: number; lat: number; lng: number;
}

const CATALYSTS: Catalyst[] = [
  { company: "TSMC", project: "Arizona fab cluster", sector: "Çip", city: "Phoenix", state: "AZ", county: "Maricopa", investmentB: 65, year: 2024, lat: 33.73, lng: -112.10 },
  { company: "Intel", project: "Ohio One mega-site", sector: "Çip", city: "New Albany", state: "OH", county: "Licking", investmentB: 28, year: 2024, lat: 40.06, lng: -82.75 },
  { company: "Samsung", project: "Taylor fab", sector: "Çip", city: "Taylor", state: "TX", county: "Williamson", investmentB: 17, year: 2024, lat: 30.57, lng: -97.41 },
  { company: "Micron", project: "Clay megafab", sector: "Çip", city: "Clay", state: "NY", county: "Onondaga", investmentB: 100, year: 2025, lat: 43.18, lng: -76.17 },
  { company: "Texas Instruments", project: "Sherman fabs", sector: "Çip", city: "Sherman", state: "TX", county: "Grayson", investmentB: 30, year: 2025, lat: 33.64, lng: -96.61 },
  { company: "Ford / SK", project: "BlueOval City", sector: "EV/Batarya", city: "Stanton", state: "TN", county: "Haywood", investmentB: 5.6, year: 2025, lat: 35.46, lng: -89.40 },
  { company: "Ford / SK", project: "BlueOval SK Battery Park", sector: "Batarya", city: "Glendale", state: "KY", county: "Hardin", investmentB: 5.8, year: 2025, lat: 37.60, lng: -85.90 },
  { company: "Hyundai", project: "Metaplant America", sector: "EV", city: "Ellabell", state: "GA", county: "Bryan", investmentB: 7.6, year: 2025, lat: 32.13, lng: -81.45 },
  { company: "Toyota", project: "NC Battery plant", sector: "Batarya", city: "Liberty", state: "NC", county: "Randolph", investmentB: 13.9, year: 2025, lat: 35.83, lng: -79.62 },
  { company: "Panasonic", project: "De Soto battery", sector: "Batarya", city: "De Soto", state: "KS", county: "Johnson", investmentB: 4, year: 2025, lat: 38.97, lng: -94.97 },
  { company: "Rivian", project: "GA assembly plant", sector: "EV", city: "Social Circle", state: "GA", county: "Morgan", investmentB: 5, year: 2026, lat: 33.66, lng: -83.69 },
  { company: "OpenAI / Oracle", project: "Stargate AI data center", sector: "Veri Merkezi", city: "Abilene", state: "TX", county: "Taylor", investmentB: 100, year: 2025, lat: 32.45, lng: -99.73 },
  { company: "Meta", project: "Hyperion AI data center", sector: "Veri Merkezi", city: "Richland Parish", state: "LA", county: "Richland", investmentB: 10, year: 2026, lat: 32.42, lng: -91.76 },
];

export async function GET() {
  // county set for fast deal matching, key "ST/COUNTY"
  const counties = CATALYSTS.map((c) => `${c.state}/${c.county.toUpperCase()}`);
  return NextResponse.json({ catalysts: CATALYSTS, counties });
}
