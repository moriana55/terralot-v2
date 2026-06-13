import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 mt-20" style={{ background: "var(--surface-low)" }}>
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
        <div>
          <h3 className="text-xl font-bold mb-4 text-[var(--foreground)]">Terra<span style={{ color: "var(--secondary)" }}>Vest</span></h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Affordable land ownership made simple. We specialize in vacant land with easy owner financing — no banks, no credit checks.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--primary)]">Browse Land</h4>
          <ul className="space-y-2">
            {["Arizona", "Colorado", "Florida", "Texas", "Montana", "All States"].map(s => (
              <li key={s}>
                <Link href="/properties" className="text-sm transition-colors hover:text-[var(--secondary)]" style={{ color: "var(--muted)" }}>{s}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--primary)]">Company</h4>
          <ul className="space-y-2">
            {["How It Works", "Financing", "About Us", "Blog", "FAQ"].map(s => (
              <li key={s}>
                <Link href="/" className="text-sm transition-colors hover:text-[var(--secondary)]" style={{ color: "var(--muted)" }}>{s}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--primary)]">Contact</h4>
          <ul className="space-y-3">
            <li className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <Phone className="w-4 h-4 shrink-0 text-[var(--secondary)]" />
              (800) 123-4567
            </li>
            <li className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <Mail className="w-4 h-4 shrink-0 text-[var(--secondary)]" />
              hello@terravest.com
            </li>
            <li className="flex items-start gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-[var(--secondary)]" />
              Austin, TX
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 py-6 text-center">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          © {new Date().getFullYear()} TerraVest LLC. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
