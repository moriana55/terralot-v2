import Image from "next/image";
import Reveal from "@/components/Reveal";
import CTASection from "@/components/CTASection";

export const metadata = {
  title: "About — LandForever",
  description:
    "LandForever makes US land ownership accessible to the world. Wyoming LLC, county-recorded deeds, international buyers welcome.",
};

const VALUES = [
  {
    title: "Accessibility",
    desc: "Land ownership shouldn't require a bank, perfect credit, or a US passport. We open the door for everyone.",
  },
  {
    title: "Transparency",
    desc: "Every parcel comes with clear details, real maps, and honest pricing. What you see is what you own.",
  },
  {
    title: "Real Ownership",
    desc: "We deal in recorded deeds, not memberships or vague promises. Your name, on real American land.",
  },
];

export default function AboutPage() {
  return (
    <main className="bg-cream">
      {/* Header */}
      <section className="relative pt-40 pb-24 bg-forest-deep overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep to-forest-deep/60" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <div className="text-gold font-semibold uppercase tracking-widest text-sm mb-3">
              Our Story
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-cream text-balance">
              The American dream, made accessible to the world
            </h1>
          </Reveal>
        </div>
      </section>

      {/* Story */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="relative h-[420px] rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80"
                alt="Open US land"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-forest mb-5">
              Land for everyone, everywhere
            </h2>
            <div className="space-y-4 text-forest/70 leading-relaxed">
              <p>
                LandForever began with a simple frustration: buying land in
                America was supposed to be the ultimate symbol of stability, yet
                the process felt locked away — endless paperwork, big upfront
                cash, and a system that seemed built for insiders, not everyday
                people.
              </p>
              <p>
                So we set out to change that. Our mission is to make owning real
                US land genuinely easy. We handle the hard parts — sourcing,
                research, legal structure, and the paperwork — so that you can go
                from browsing to owning in minutes, not months. With as little as
                $99 down and clear monthly payments, the door is finally open to
                everyone.
              </p>
              <p>
                Operating through a Wyoming LLC with every deed recorded at the
                county, we pair the trust of US property law with a modern,
                borderless experience. Wherever you are in the world, your piece
                of America is closer than you think.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-offwhite">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <div className="text-gold-dark font-semibold uppercase tracking-widest text-sm mb-3">
              What We Stand For
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-forest">
              Our values
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-7">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-8 border border-forest/5 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center text-gold-dark font-display font-bold text-xl mb-5">
                    {i + 1}
                  </div>
                  <h3 className="font-display text-xl font-bold text-forest mb-3">
                    {v.title}
                  </h3>
                  <p className="text-forest/65 leading-relaxed">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-16 bg-forest text-cream">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            ["Wyoming", "LLC structure"],
            ["County", "recorded deeds"],
            ["$99", "to get started"],
            ["Global", "buyers welcome"],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="font-display text-3xl font-bold text-gold">
                {big}
              </div>
              <div className="text-cream/60 text-sm mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      <CTASection />
    </main>
  );
}
