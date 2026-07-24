import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeals } from "@/lib/unified-deals";
import { toBuyerParcel, type BuyerParcel } from "@/lib/buyer-parcel";
import { buildBuyerListing, type BuyerListing } from "@/lib/listing-builder";
import { readPublishedListing } from "@/lib/parcel-listing-store";
import { esriStaticUrl } from "@/lib/esri-static";
import ParcelView from "./parcel-view";

// ── PUBLIC buyer-facing parcel page — the WhatsApp link sent to US buyers. ──
// English, mobile-first, no auth (public by design). Reads deal data directly
// from the shared unified-deals lib (server-side, NOT via the gated admin API)
// and projects it through toBuyerParcel(), the whitelist choke point: no
// owner / margin / valuation / offer fields can reach this page.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function getParcel(id: string): Promise<BuyerParcel | null> {
  const deals = await getDeals();
  const deal = deals.find((d) => d.id === id);
  return deal ? toBuyerParcel(deal) : null;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function parcelTitle(p: BuyerParcel): string {
  const loc = [p.county && `${p.county} County`, p.state].filter(Boolean).join(", ");
  const head = `${p.acres.toFixed(p.acres % 1 ? 2 : 0)} Acres in ${loc || "the USA"}`;
  return p.price > 0 ? `${head} — ${usd(p.price)}` : head;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const p = await getParcel(decodeURIComponent(id));
  if (!p) return { title: "Parcel not found", robots: { index: false } };

  const title = parcelTitle(p);
  const description = [
    `${p.acres.toFixed(2)} acres of land`,
    p.region && p.region !== p.county ? `near ${p.region}` : "",
    p.county ? `in ${p.county} County, ${p.state}` : p.state,
    p.price > 0 ? `for ${usd(p.price)} — low down payment, flexible monthly terms, no credit check.` : "— ask us for current pricing.",
  ].filter(Boolean).join(" ");
  const ogImage = p.lat != null && p.lng != null
    ? esriStaticUrl(p.lat, p.lng, 1200, 1200, 630)
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "TerraLot Land",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function PublicParcelPage({ params }: Params) {
  const { id } = await params;
  const parcelId = decodeURIComponent(id);
  const parcel = await getParcel(parcelId);
  if (!parcel) notFound();

  // Zengin ilan içeriği (LANDiO-tarzı açıklama + öne çıkanlar + konum/GIS özeti).
  // Composer SADECE buyer-safe BuyerParcel alır → iç deal-ekonomisi sızamaz.
  const listing = buildBuyerListing(parcel);

  // Admin "Yayınla" ile sabitlenmiş bir override varsa onun metnini tercih et
  // (best-effort; tablo yoksa/hata olursa null → composer metni kalır).
  const override = await readPublishedListing(parcel.id);
  const richListing: BuyerListing = override
    ? { ...listing, title: override.title, description: override.description, bullets: override.bullets }
    : listing;

  return (
    <ParcelView
      parcel={parcel}
      title={parcelTitle(parcel)}
      listing={richListing}
      contactWhatsApp={process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || ""}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || ""}
    />
  );
}
