import Link from "next/link";
import { Reveal } from "./Reveal";

export default function CTASection() {
  return (
    <section className="relative py-32 overflow-hidden bg-ink">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1920&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-deep via-ink-deep/85 to-ink/70" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6">
        <Reveal>
          <h2 className="font-display text-5xl md:text-8xl font-semibold text-bone tracking-[-0.04em] leading-[0.95] max-w-4xl">
            Your piece of America
            <br />
            starts at <span className="text-cobalt-light">$99</span>
          </h2>
          <p className="mt-8 text-lg text-bone/65 max-w-xl">
            Browse parcels, reserve in minutes, own real US land on your terms.
          </p>
          <Link
            href="/listings"
            className="btn btn-lift inline-block mt-10 bg-cobalt text-white px-10 py-4 rounded-full font-semibold text-lg shadow-2xl shadow-cobalt/30"
          >
            Browse available land
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
