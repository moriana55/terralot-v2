"use client";
import { useState } from "react";

interface Props {
  totalPrice: number;
  downPayment: number;
  monthly12: number;
  monthly24: number;
  monthly36: number;
  title: string;
}

export default function PaymentCalculator({
  totalPrice,
  downPayment,
  monthly12,
  monthly24,
  monthly36,
  title,
}: Props) {
  const [term, setTerm] = useState<12 | 24 | 36>(36);

  const monthly = term === 12 ? monthly12 : term === 24 ? monthly24 : monthly36;
  const financed = totalPrice - downPayment;
  const totalPaid = downPayment + monthly * term;

  return (
    <div className="bg-forest text-cream rounded-2xl p-7 shadow-xl">
      <h3 className="font-display text-2xl font-bold mb-1">Payment Plan</h3>
      <p className="text-cream/60 text-sm mb-6">
        Choose a term that works for you.
      </p>

      {/* Term selector */}
      <div className="grid grid-cols-3 gap-2 mb-6 bg-forest-deep/50 p-1.5 rounded-xl">
        {([12, 24, 36] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTerm(t)}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
              term === t
                ? "bg-gold text-forest-deep"
                : "text-cream/70 hover:text-cream"
            }`}
          >
            {t} mo
          </button>
        ))}
      </div>

      {/* Monthly */}
      <div className="text-center py-5 border-y border-cream/10 mb-5">
        <div className="text-cream/60 text-sm">Your monthly payment</div>
        <div className="font-display text-5xl font-bold text-gold mt-1">
          ${monthly}
          <span className="text-lg font-sans font-normal text-cream/50">
            /mo
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3 text-sm mb-7">
        <Row label="Down payment today" value={`$${downPayment}`} />
        <Row label="Amount financed" value={`$${financed.toLocaleString()}`} />
        <Row label={`${term} monthly payments`} value={`$${monthly} each`} />
        <Row
          label="Total over term"
          value={`$${totalPaid.toLocaleString()}`}
          bold
        />
      </div>

      <a
        href={`mailto:hello@landforever.com?subject=Reserve ${encodeURIComponent(
          title
        )}&body=I'd like to reserve this parcel with the ${term}-month plan ($${monthly}/mo).`}
        className="block w-full bg-gold hover:bg-gold-light text-forest-deep text-center py-4 rounded-full font-semibold transition-all hover:scale-[1.02]"
      >
        Reserve for ${downPayment} →
      </a>
      <p className="text-center text-cream/40 text-xs mt-3">
        No credit check · Secure card &amp; wire payments
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-cream/60">{label}</span>
      <span className={bold ? "font-bold text-cream" : "text-cream/90"}>
        {value}
      </span>
    </div>
  );
}
