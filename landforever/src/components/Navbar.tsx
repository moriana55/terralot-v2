"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Solid bar everywhere except the homepage hero (until scrolled)
  const solid = scrolled || !isHome;

  const links = [
    { href: "/listings", label: "Listings" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/about", label: "About" },
  ];

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-forest-deep/95 backdrop-blur-md py-3 shadow-lg"
          : "bg-transparent py-5"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-cream tracking-tight">
            Land<span className="text-gold">Forever</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-cream/80 hover:text-gold transition-colors text-sm font-medium tracking-wide"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/listings"
            className="bg-gold hover:bg-gold-light text-forest-deep px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
          >
            Browse Land
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-cream text-2xl"
          aria-label="Menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden bg-forest-deep/98 backdrop-blur-md px-6 py-4 flex flex-col gap-4"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-cream/90 hover:text-gold text-base font-medium"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/listings"
            onClick={() => setOpen(false)}
            className="bg-gold text-forest-deep px-5 py-2.5 rounded-full text-sm font-semibold text-center"
          >
            Browse Land
          </Link>
        </motion.div>
      )}
    </motion.header>
  );
}
