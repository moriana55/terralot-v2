import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VegaLand — Affordable Land with Owner Financing",
    template: "%s | VegaLand",
  },
  description: "Own land in America with easy owner financing. No banks, no credit checks — low down payments and fixed monthly payments on vacant land across the US.",
  keywords: ["land for sale", "owner financed land", "cheap land", "vacant land for sale", "buy land monthly payments", "no credit check land"],
};

// Placeholder key ile clerk-js yüklenemiyor — gerçek key gelince otomatik aktif olur
const CLERK_ENABLED = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("cGxhY2Vob2xkZXI");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inner = (
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
  return CLERK_ENABLED ? <ClerkProvider>{inner}</ClerkProvider> : inner;
}
