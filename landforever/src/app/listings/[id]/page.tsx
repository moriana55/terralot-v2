import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import PaymentCalculator from "@/components/PaymentCalculator";
import listingsData from "@/data/listings.json";

const ParcelMap = dynamic(() => import("@/components/ParcelMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl bg-forest/10 animate-pulse" />
  ),
});

interface Listing {
  id: string;
  title: string;
  state: string;
  county: string;
  acreage: number;
  totalPrice: number;
  downPayment: number;
  monthly12: number;
  monthly24: number;
  monthly36: number;
  coordinates: { lat: number; lng: number };
  zoning: string;
  roadAccess: boolean;
  floodZone: boolean;
  images: string[];
  description: string;
}

const listings = listingsData as Listing[];

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export default function ListingDetail({
  params,
}: {
  params: { id: string };
}) {
  const listing = listings.find((l) => l.id === params.id);
  if (!listing) notFound();

  const facts = [
    { label: "Acreage", value: `${listing.acreage} acres` },
    { label: "State", value: listing.state },
    { label: "County", value: listing.county },
    { label: "Zoning", value: listing.zoning },
    { label: "Road Access", value: listing.roadAccess ? "Yes" : "No" },
    { label: "Flood Zone", value: listing.floodZone ? "Yes" : "No" },
    {
      label: "Coordinates",
      value: `${listing.coordinates.lat}, ${listing.coordinates.lng}`,
    },
  ];

  return (
    <main className="pt-24 pb-24 bg-cream min-h-screen">
      {/* Hero image */}
      <div className="relative h-[55vh] min-h-[400px]">
        <Image
          src={listing.images[0]}
          alt={listing.title}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest-deep/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <Link
              href="/listings"
              className="text-cream/70 hover:text-gold text-sm mb-3 inline-block"
            >
              ← Back to listings
            </Link>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="bg-gold text-forest-deep px-3 py-1 rounded-full text-xs font-bold">
                ${listing.downPayment} down
              </span>
              <span className="glass text-cream px-3 py-1 rounded-full text-xs font-semibold">
                {listing.acreage} acres
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-cream text-balance">
              {listing.title}
            </h1>
            <p className="text-cream/70 mt-2 text-lg">
              {listing.county}, {listing.state}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-12 grid lg:grid-cols-3 gap-10">
        {/* Left: details + map */}
        <div className="lg:col-span-2 space-y-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-forest mb-4">
              About this parcel
            </h2>
            <p className="text-forest/70 leading-relaxed text-lg">
              {listing.description}
            </p>
          </div>

          {/* Facts */}
          <div>
            <h2 className="font-display text-2xl font-bold text-forest mb-4">
              Parcel details
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {facts.map((f) => (
                <div
                  key={f.label}
                  className="bg-white rounded-xl p-4 border border-forest/5 flex justify-between"
                >
                  <span className="text-forest/55 text-sm">{f.label}</span>
                  <span className="text-forest font-semibold text-sm">
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          <div>
            <h2 className="font-display text-2xl font-bold text-forest mb-4">
              Location &amp; terrain
            </h2>
            <div className="h-[450px] w-full rounded-2xl overflow-hidden shadow-lg border border-forest/10">
              <ParcelMap
                lat={listing.coordinates.lat}
                lng={listing.coordinates.lng}
                title={listing.title}
              />
            </div>
            <p className="text-forest/50 text-sm mt-3">
              Gold outline shows the approximate parcel boundary. Drag to explore
              the 3D terrain.
            </p>
          </div>
        </div>

        {/* Right: sticky calculator */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-28">
            <PaymentCalculator
              totalPrice={listing.totalPrice}
              downPayment={listing.downPayment}
              monthly12={listing.monthly12}
              monthly24={listing.monthly24}
              monthly36={listing.monthly36}
              title={listing.title}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
