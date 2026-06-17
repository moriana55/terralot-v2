import Link from "next/link";
import Image from "next/image";
import { Listing } from "./ListingCard";
import { Reveal } from "./Reveal";
import listings from "@/data/listings.json";

export default function FeaturedListings() {
  const all = listings as Listing[];
  const hero = all[3]; // 40 acres Colorado — the showpiece
  const rest = [all[0], all[1]];

  return (
    <section className="bg-bone py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.03em] text-ink max-w-2xl leading-[1]">
            Land that&apos;s ready to own
          </h2>
          <Link
            href="/listings"
            className="link-grow text-ink font-semibold whitespace-nowrap self-start md:self-auto"
          >
            View all parcels →
          </Link>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Showpiece — large */}
          <Reveal>
            <Link href={`/listings/${hero.id}`} className="group block">
              <div className="relative h-[380px] lg:h-[560px] rounded-3xl overflow-hidden">
                <Image
                  src={hero.images[0]}
                  alt={hero.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width:1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/90 via-ink-deep/20 to-transparent" />
                <div className="absolute top-5 left-5 flex gap-2">
                  <span className="bg-cobalt text-white px-3 py-1 rounded-full text-xs font-semibold">
                    ${hero.downPayment} down
                  </span>
                  <span className="bg-bone/15 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {hero.acreage} acres
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-7">
                  <div className="text-bone/70 text-sm font-mono uppercase tracking-wider">
                    {hero.county}, {hero.state}
                  </div>
                  <h3 className="font-display text-3xl md:text-4xl font-semibold text-bone tracking-tight mt-1">
                    {hero.title}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-bone/60 text-sm">from</span>
                    <span className="font-display text-2xl font-semibold text-cobalt-light">
                      ${hero.monthly36}/mo
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </Reveal>

          {/* Two compact stacked */}
          <div className="grid grid-rows-2 gap-6">
            {rest.map((l, i) => (
              <Reveal key={l.id} delay={0.08 * (i + 1)}>
                <Link href={`/listings/${l.id}`} className="group block h-full">
                  <div className="relative h-full min-h-[260px] rounded-3xl overflow-hidden flex">
                    <div className="relative w-2/5 shrink-0">
                      <Image
                        src={l.images[0]}
                        alt={l.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="20vw"
                      />
                    </div>
                    <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                      <div>
                        <div className="text-ink/45 text-xs font-mono uppercase tracking-wider">
                          {l.county}, {l.state}
                        </div>
                        <h3 className="font-display text-xl md:text-2xl font-semibold text-ink tracking-tight mt-1">
                          {l.title}
                        </h3>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-ink/45 text-xs">from</div>
                          <div className="font-display text-xl font-semibold text-ink">
                            ${l.monthly36}
                            <span className="text-sm font-normal text-ink/45">
                              /mo
                            </span>
                          </div>
                        </div>
                        <span className="bg-cobalt text-white px-3 py-1 rounded-full text-xs font-semibold">
                          ${l.downPayment} down
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
