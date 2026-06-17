import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "LandForever — Own US Land for $99 Down",
  description:
    "Own undervalued US land with low monthly payments. No credit check, legal deed recorded at county. International buyers welcome. The American dream, made accessible to the world.",
  openGraph: {
    title: "LandForever — Own US Land for $99 Down",
    description:
      "Own undervalued US land with low monthly payments. No credit check, legal deed recorded.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
