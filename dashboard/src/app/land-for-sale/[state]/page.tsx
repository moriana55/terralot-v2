import { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { properties, STATES } from "@/lib/data";

const STATE_INFO: Record<string, { description: string; highlights: string[] }> = {
  arizona: {
    description: "Arizona offers vast desert landscapes with stunning mountain views and year-round sunshine. From the rolling hills of Cochise County to the high desert of Apache County, Arizona land is perfect for off-grid living, homesteading, and investment.",
    highlights: ["No state income tax on land gains", "Minimal zoning in rural areas", "Year-round dry climate", "Low property taxes"],
  },
  colorado: {
    description: "Colorado's diverse terrain ranges from the Rocky Mountains to rolling plains. Mountain properties offer breathtaking views, while eastern parcels provide affordable ranch land. Perfect for outdoor enthusiasts and nature lovers.",
    highlights: ["Mountain and valley views", "Four-season climate", "Strong appreciation rates", "Abundant outdoor recreation"],
  },
  florida: {
    description: "Florida offers flat, buildable land with easy utility access. Central Florida provides affordable lots near major attractions, while northern Florida offers more rural, wooded parcels at lower prices.",
    highlights: ["No state income tax", "Utilities often available", "Strong rental demand", "Year-round warm climate"],
  },
  texas: {
    description: "Everything is bigger in Texas, including the land deals. West Texas offers massive parcels at incredibly low prices, while Hill Country provides lush landscapes. Texas has no state income tax and minimal restrictions on rural land use.",
    highlights: ["No state income tax", "Unrestricted rural land", "Massive parcel sizes", "Strong property rights"],
  },
  montana: {
    description: "Montana's Big Sky Country delivers on its promise. Rolling grasslands, mountain backdrops, and incredible wildlife make Montana land ideal for ranching, hunting, and off-grid living.",
    highlights: ["Pristine natural beauty", "Abundant wildlife", "Large ranch parcels", "Low population density"],
  },
};

function stateFromSlug(slug: string): string | undefined {
  return STATES.find(s => s.toLowerCase().replace(/\s+/g, "-") === slug);
}

export async function generateStaticParams() {
  return STATES.map(s => ({ state: s.toLowerCase().replace(/\s+/g, "-") }));
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state: slug } = await params;
  const state = stateFromSlug(slug) || slug;
  return {
    title: `Land for Sale in ${state} — Affordable Lots with Owner Financing`,
    description: `Browse affordable vacant land for sale in ${state}. Owner financing available with no credit check. Payments starting at $79/month.`,
  };
}

export default async function StateLandingPage({ params }: { params: Promise<{ state: string }> }) {
  const { state: slug } = await params;
  const state = stateFromSlug(slug);
  const stateProperties = properties.filter(p => p.state === state);
  const info = STATE_INFO[slug] || {
    description: `Explore affordable land for sale in ${state || slug}. We offer a curated selection of vacant lots with easy owner financing — no banks, no credit checks.`,
    highlights: ["Owner financing available", "No credit check", "Clear title guaranteed", "Low monthly payments"],
  };
  const otherStates = STATES.filter(s => s !== state).slice(0, 6);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="pt-16">
        {/* Hero */}
        <section className="relative py-16 border-b border-white/5" style={{ background: "var(--surface-low)" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--muted)" }}>
              <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
              <span>/</span>
              <Link href="/properties" className="hover:text-[var(--primary)]">Land for Sale</Link>
              <span>/</span>
              <span style={{ color: "var(--foreground)" }}>{state}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Land for Sale in <span style={{ color: "var(--primary)" }}>{state}</span>
            </h1>
            <p className="text-sm max-w-2xl leading-relaxed mb-6" style={{ color: "var(--muted)" }}>{info.description}</p>
            <div className="flex flex-wrap gap-2">
              {info.highlights.map(h => (
                <span key={h} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--primary)]/20" style={{ background: "rgba(142,209,223,0.05)", color: "var(--primary)" }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Listings */}
        <section className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {stateProperties.length} {stateProperties.length === 1 ? "property" : "properties"} available in {state}
            </p>
            <Link href={`/properties?state=${state}`} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--primary)" }}>
              View with filters <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {stateProperties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stateProperties.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted)" }} />
              <h3 className="text-lg font-bold mb-2">No listings in {state} right now</h3>
              <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>New properties are added weekly. Check back soon or browse other states.</p>
              <Link href="/properties" className="px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
                Browse All Properties
              </Link>
            </div>
          )}
        </section>

        {/* Other States */}
        <section className="max-w-7xl mx-auto px-6 py-10 border-t border-white/5">
          <h2 className="text-xl font-bold mb-6">Explore Other States</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {otherStates.map(s => (
              <Link key={s} href={`/land-for-sale/${s.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-xl p-4 text-center text-sm font-semibold border border-white/5 transition-all hover:border-[var(--primary)]/30"
                style={{ background: "var(--surface)" }}>
                {s}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
