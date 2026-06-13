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
    default: "TerraLot — The All-in-One Platform for Land Flippers",
    template: "%s | TerraLot",
  },
  description: "Find off-market deals, send direct mail, manage subdivisions, track owner financing, and close more land deals — all from one dashboard.",
  keywords: ["land flipping software", "land investing platform", "owner financing management", "direct mail land", "land acquisition tool"],
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
