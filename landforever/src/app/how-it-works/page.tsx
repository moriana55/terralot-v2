import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import CTASection from "@/components/CTASection";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "How It Works — LandForever",
  description:
    "Browse, reserve, sign, and receive your deed. Owning US land in four simple steps. No credit check.",
};

export default function HowItWorksPage() {
  return (
    <main className="bg-cream">
      {/* Header */}
      <section className="relative pt-40 pb-24 bg-forest-deep overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep to-forest-deep/60" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <div className="text-gold font-semibold uppercase tracking-widest text-sm mb-3">
              The Process
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-cream text-balance">
              Owning land has never been this simple
            </h1>
            <p className="mt-6 text-lg text-cream/70 max-w-xl mx-auto">
              No banks. No credit checks. No middlemen. Just a clear path from
              browsing to a deed with your name on it.
            </p>
          </Reveal>
        </div>
      </section>

      <HowItWorks />
      <FAQ />
      <CTASection />
    </main>
  );
}
