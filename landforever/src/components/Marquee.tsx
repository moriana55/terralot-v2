const WORDS = [
  "Texas",
  "New Mexico",
  "Arizona",
  "Colorado",
  "Florida",
  "Nevada",
  "Montana",
  "Utah",
  "Wyoming",
  "Oregon",
];

export default function Marquee() {
  const items = [...WORDS, ...WORDS];
  return (
    <section className="bg-forest-deep py-6 overflow-hidden border-y border-cream/10">
      <div className="marquee-track">
        {items.map((w, i) => (
          <span
            key={i}
            className="inline-flex items-center font-display text-3xl md:text-5xl font-bold mx-8"
          >
            <span className="text-cream/90">{w}</span>
            <span className="text-gold mx-8 text-2xl">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}
