"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";

const Globe = dynamic(() => import("./Globe"), { ssr: false });
const EASE = [0.23, 1, 0.32, 1] as const;

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex flex-col bg-ink-deep overflow-hidden">
      {/* Background image — desaturated, low */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-ink-deep via-ink-deep/95 to-ink/70" />

      {/* Globe bleeding off the right edge */}
      <div className="absolute -right-[15%] top-1/2 -translate-y-1/2 w-[80%] h-[90%] opacity-60 md:opacity-90">
        <Globe />
      </div>

      {/* Top meta strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10 max-w-[1400px] mx-auto w-full px-6 pt-28 md:pt-32 flex items-center justify-between text-bone/50 text-xs font-mono uppercase tracking-[0.2em]"
      >
        <span>US Land · Installment Ownership</span>
        <span className="hidden md:block">Est. Wyoming LLC</span>
      </motion.div>

      {/* Main */}
      <div className="relative z-10 max-w-[1400px] mx-auto w-full px-6 flex-1 flex flex-col justify-center">
        <div className="max-w-4xl">
          <motion.h1
            initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: EASE }}
            className="font-display font-semibold text-bone leading-[0.92] tracking-[-0.04em] text-[15vw] md:text-[10vw] lg:text-[8.5vw]"
          >
            Own American
            <br />
            land for{" "}
            <span className="text-cobalt-light">$99</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
            className="mt-8 text-lg md:text-xl text-bone/70 leading-relaxed max-w-xl"
          >
            Real parcels across the United States, sold on simple monthly plans.
            Deed recorded at the county. No credit check, no banks.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.38, ease: EASE }}
            className="mt-10 flex flex-col sm:flex-row gap-4"
          >
            <Link
              href="/listings"
              className="btn btn-lift bg-cobalt text-white px-8 py-4 rounded-full font-semibold text-center shadow-xl shadow-cobalt/30"
            >
              Browse available land
            </Link>
            <Link
              href="/how-it-works"
              className="btn border border-bone/25 text-bone px-8 py-4 rounded-full font-semibold text-center hover:bg-bone/10"
            >
              How it works
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Bottom stat bar — full bleed, divided */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
        className="relative z-10 border-t border-bone/15"
      >
        <div className="max-w-[1400px] mx-auto w-full px-6 grid grid-cols-3 divide-x divide-bone/15">
          {[
            ["$99", "to get started"],
            ["12–36 mo", "flexible terms"],
            ["No", "credit check"],
          ].map(([big, small]) => (
            <div key={small} className="py-6 px-2 md:px-6 first:pl-0">
              <div className="font-display text-2xl md:text-4xl font-semibold text-bone tracking-tight">
                {big}
              </div>
              <div className="text-bone/50 text-sm mt-1">{small}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
