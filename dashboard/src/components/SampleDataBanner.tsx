import { Info } from "lucide-react";

/**
 * Honest "this is sample/demo data" affordance.
 *
 * Several investor-portal surfaces render a curated demo dataset (lib/data.ts)
 * rather than live numbers — they exist to walk an investor through the product
 * before the real payment/portfolio pipeline is wired to Supabase/Stripe.
 * This banner makes that explicit so the figures are never mistaken for live data.
 */
export function SampleDataBanner({ note }: { note?: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-6 text-xs"
      style={{
        background: "rgba(185,119,10,0.08)",
        border: "1px solid rgba(185,119,10,0.22)",
        color: "var(--warn)",
      }}
    >
      <Info className="w-3.5 h-3.5 mt-px shrink-0" />
      <span>
        <strong>Örnek veri</strong> — bu ekrandaki rakamlar ürünü göstermek için hazırlanmış
        demo verilerdir, canlı portföyü yansıtmaz.
        {note ? ` ${note}` : ""}
      </span>
    </div>
  );
}
