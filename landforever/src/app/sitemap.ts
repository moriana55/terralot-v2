import type { MetadataRoute } from "next";
import listings from "@/data/listings.json";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://landforever.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = ["", "/listings", "/how-it-works", "/about"].map(
    (path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );

  const listingPages = (listings as { id: string }[]).map((l) => ({
    url: `${SITE_URL}/listings/${l.id}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...listingPages];
}
