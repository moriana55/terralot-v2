"use client";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Browse",
    desc: "Explore hand-picked US parcels with satellite maps and 3D terrain. No login, no friction.",
  },
  {
    n: "02",
    title: "Reserve",
    desc: "Lock in your parcel for $99 and pick a 12, 24, or 36-month plan that fits your budget.",
  },
  {
    n: "03",
    title: "Sign",
    desc: "Get a clear land contract instantly. No credit check, no bank approval, no fine print.",
  },
  {
    n: "04",
    title: "Own",
    desc: "Complete your payments and the deed is recorded in your name at the county. Done.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-bone-soft py-28" id="how">
      <div className="max-w-[1400px] mx-auto px-6">
        <Reveal className="mb-16 max-w-3xl">
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.03em] text-ink leading-[1]">
            From browsing to a deed
            <br />
            in four steps
          </h2>
        </Reveal>

        <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-ink/10 rounded-3xl overflow-hidden">
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <div className="bg-bone-soft h-full p-8 hover:bg-white transition-colors duration-300">
                <div className="font-mono text-cobalt text-sm tabular-nums">
                  {s.n}
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-semibold text-ink tracking-tight mt-6">
                  {s.title}
                </h3>
                <p className="mt-3 text-ink/55 leading-relaxed">{s.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
