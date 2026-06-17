"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "./Reveal";

const FAQS = [
  {
    q: "Do I really own the land?",
    a: "Yes. Once your payment plan is complete, a legal deed is recorded in your name at the county courthouse. With our contract-for-deed structure, you hold equitable title from day one and full legal title upon final payment.",
  },
  {
    q: "Is there a credit check?",
    a: "Never. We don't pull credit reports or require bank approval. As long as you can make the down payment and monthly installments, the land is yours.",
  },
  {
    q: "Can I buy if I live outside the US?",
    a: "Absolutely. Foreign nationals can legally own US land. We work with buyers worldwide and accept both card and international wire payments.",
  },
  {
    q: "What happens if I miss a payment?",
    a: "We offer a grace period and will always reach out first. Our goal is for you to succeed as an owner — we'll work with you on a solution before any contract action.",
  },
  {
    q: "Are there extra fees or property taxes?",
    a: "Property taxes on raw rural land are typically very low (often $20–$200/year). We're fully transparent about any closing or document fees up front — no surprises.",
  },
  {
    q: "Can I build or live on the land?",
    a: "It depends on the parcel's zoning, which we list clearly for each property. Many of our parcels allow homes, RVs, cabins, or off-grid living. Always verify with the county for your specific plans.",
  },
];

function Item({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={i * 0.04}>
      <div className="border border-forest/10 rounded-xl overflow-hidden bg-white">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-forest/[0.02] transition-colors"
        >
          <span className="font-display font-semibold text-forest text-lg">
            {q}
          </span>
          <span
            className={`text-gold text-2xl shrink-0 transition-transform ${
              open ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="px-5 pb-5 text-forest/65 leading-relaxed">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export default function FAQ() {
  return (
    <section className="py-28 bg-offwhite">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal className="mb-14">
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.03em] text-ink leading-[1]">
            Questions, answered
          </h2>
        </Reveal>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Item key={f.q} {...f} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
