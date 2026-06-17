"use client";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const ITEMS = [
  {
    title: "A real, county-recorded deed",
    desc: "Not a membership, not a lease. Every parcel transfers with a legal deed recorded at the courthouse. Your name, on real American land.",
  },
  {
    title: "No credit check, no banks",
    desc: "We don't pull credit or require approval. Make the down payment and the land is yours to pay off on your terms.",
  },
  {
    title: "A hard asset that lasts",
    desc: "Land is finite. While currencies inflate, raw US land has held and grown its value across generations.",
  },
  {
    title: "Open to buyers worldwide",
    desc: "Foreign nationals can legally own US land. We accept card and wire payments from clients in any country.",
  },
];

export default function Trust() {
  return (
    <section className="bg-ink text-bone py-28">
      <div className="max-w-[1400px] mx-auto px-6 grid lg:grid-cols-[0.85fr_1.15fr] gap-16">
        {/* Left — sticky statement */}
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">
              Real ownership,
              <br />
              without the
              <br />
              <span className="text-cobalt-light">gatekeepers.</span>
            </h2>
            <p className="mt-6 text-bone/60 max-w-sm leading-relaxed">
              We strip out the auctions, the paperwork, and the bank approvals —
              so owning land is finally something anyone can do.
            </p>
          </div>
        </Reveal>

        {/* Right — divided numbered list (no cards) */}
        <Stagger className="divide-y divide-bone/12">
          {ITEMS.map((item, i) => (
            <StaggerItem key={item.title}>
              <div className="group flex gap-6 md:gap-10 py-7">
                <span className="font-mono text-cobalt-light/70 text-sm pt-1.5 tabular-nums">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl md:text-2xl font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-bone/55 leading-relaxed max-w-lg">
                    {item.desc}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
