import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TerraLot — Land Deal Research & Underwriting",
    template: "%s | TerraLot",
  },
  description: "Research, enrich, score, and review off-market and tax-deed land opportunities in one operational dashboard.",
  keywords: ["land flipping software", "land investing platform", "owner financing management", "direct mail land", "land acquisition tool"],
};

// Placeholder key ile clerk-js yüklenemiyor — gerçek key gelince otomatik aktif olur
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const CLERK_ENABLED = Boolean(
  clerkPublishableKey && !clerkPublishableKey.includes("cGxhY2Vob2xkZXI")
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inner = (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
  return CLERK_ENABLED ? <ClerkProvider>{inner}</ClerkProvider> : inner;
}
