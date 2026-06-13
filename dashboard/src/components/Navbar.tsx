"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Phone, Heart } from "lucide-react";

const links = [
  { href: "/properties", label: "Browse Land" },
  { href: "/properties?featured=true", label: "Featured" },
  { href: "/blog", label: "Blog" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#financing", label: "Financing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)" }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Terra<span style={{ color: "var(--secondary)" }}>Vest</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link key={l.href} href={l.href} className="text-sm font-medium transition-colors hover:text-[var(--secondary)]" style={{ color: "var(--muted)" }}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/compare" className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 transition-colors hover:border-[var(--secondary)]/30 hover:bg-slate-50" title="Saved / Compare">
            <Heart className="w-4 h-4" style={{ color: "var(--muted)" }} />
          </Link>
          <a href="tel:+18001234567" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--secondary)] transition-colors" style={{ color: "var(--muted)" }}>
            <Phone className="w-4 h-4" />
            (800) 123-4567
          </a>
          <Link href="/properties" className="px-5 py-2 rounded text-sm font-semibold transition-all hover:opacity-90 bg-[var(--primary)] text-white">
            Find Land
          </Link>
        </div>

        <button className="md:hidden text-[var(--foreground)]" onClick={() => setOpen(!open)}>
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 px-6 py-4 space-y-3 bg-white">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium py-2 hover:text-[var(--secondary)]" style={{ color: "var(--muted)" }}>
              {l.label}
            </Link>
          ))}
          <Link href="/properties" onClick={() => setOpen(false)} className="block text-center px-5 py-2 rounded text-sm font-semibold mt-2 bg-[var(--primary)] text-white">
            Find Land
          </Link>
        </div>
      )}
    </nav>
  );
}
