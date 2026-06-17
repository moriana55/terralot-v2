import { Reveal } from "./Reveal";

const QUOTES = [
  {
    quote:
      "I never thought owning land in America was possible from Mexico City. The deed arrived with my name on it.",
    name: "Carlos M.",
    place: "Mexico City",
  },
  {
    quote:
      "No bank, no credit check, just $99 to start. I own 5 acres in Texas and I'm paying it off month by month.",
    name: "Aisha R.",
    place: "Dubai",
  },
  {
    quote:
      "The 3D maps let me see exactly what I was buying before I paid a cent. Transparent the whole way.",
    name: "James T.",
    place: "Manchester",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-ink-deep text-bone py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        <Reveal>
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.03em] leading-[1] max-w-3xl">
            Owners in <span className="text-cobalt-light">40+ countries</span>
          </h2>
        </Reveal>

        {/* Offset, asymmetric columns */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {QUOTES.map((q, i) => (
            <Reveal
              key={q.name}
              delay={i * 0.1}
              className={i === 1 ? "md:mt-16" : i === 2 ? "md:mt-8" : ""}
            >
              <figure className="border-t border-bone/20 pt-6">
                <blockquote className="font-display text-xl md:text-2xl font-medium tracking-tight leading-snug text-bone">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 text-sm">
                  <span className="font-semibold">{q.name}</span>
                  <span className="text-bone/40">·</span>
                  <span className="text-bone/50">{q.place}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
