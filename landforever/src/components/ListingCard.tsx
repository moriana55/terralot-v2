"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export interface Listing {
  id: string;
  title: string;
  state: string;
  county: string;
  acreage: number;
  totalPrice: number;
  downPayment: number;
  monthly36: number;
  images: string[];
  zoning: string;
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow border border-forest/5"
    >
      <Link href={`/listings/${listing.id}`}>
        <div className="relative h-56 overflow-hidden">
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute top-4 left-4 bg-gold text-forest-deep px-3 py-1 rounded-full text-xs font-bold">
            ${listing.downPayment} down
          </div>
          <div className="absolute top-4 right-4 glass text-cream px-3 py-1 rounded-full text-xs font-semibold">
            {listing.acreage} acres
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs text-gold-dark font-semibold uppercase tracking-wider mb-1">
            {listing.county}, {listing.state}
          </div>
          <h3 className="font-display text-xl font-bold text-forest mb-3">
            {listing.title}
          </h3>

          <div className="flex items-end justify-between pt-4 border-t border-forest/8">
            <div>
              <div className="text-xs text-forest/50">From</div>
              <div className="text-2xl font-display font-bold text-forest">
                ${listing.monthly36}
                <span className="text-sm font-sans font-normal text-forest/50">
                  /mo
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-forest/50">Total</div>
              <div className="text-lg font-semibold text-forest">
                ${listing.totalPrice.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-5 text-center bg-forest/5 group-hover:bg-gold group-hover:text-forest-deep text-forest py-2.5 rounded-full text-sm font-semibold transition-colors">
            View Parcel →
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
