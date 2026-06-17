import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-forest-deep text-cream/80 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 pb-12 border-b border-cream/10">
          <div className="md:col-span-2">
            <span className="text-2xl font-display font-bold text-cream">
              Land<span className="text-gold">Forever</span>
            </span>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/60">
              The American dream, made accessible to the world. Own real US land
              with low monthly payments — no credit check, legal deed recorded at
              the county.
            </p>
          </div>

          <div>
            <h4 className="text-cream font-semibold mb-4 text-sm uppercase tracking-wider">
              Explore
            </h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/listings" className="hover:text-gold">Available Land</Link></li>
              <li><Link href="/how-it-works" className="hover:text-gold">How It Works</Link></li>
              <li><Link href="/about" className="hover:text-gold">About Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream font-semibold mb-4 text-sm uppercase tracking-wider">
              Trust
            </h4>
            <ul className="space-y-3 text-sm text-cream/60">
              <li>Wyoming LLC</li>
              <li>County-Recorded Deeds</li>
              <li>Secure Card &amp; Wire Payments</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-cream/40">
          <p>© {new Date().getFullYear()} LandForever LLC. All rights reserved.</p>
          <p>landforever.com · International buyers welcome</p>
        </div>
      </div>
    </footer>
  );
}
