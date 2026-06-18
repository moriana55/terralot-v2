import { MapPin, CalendarClock, FileText, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Buyer Overview" };

// ─────────────────────────────────────────────────────────────────────────────
// BUYER OVERVIEW
//
// Data-backed where a buyer↔contract model exists; honest empty state otherwise.
// Reads the Clerk identity when Clerk is live (real keys); under the interim gate
// there is no per-user identity, so we show the portal in "no contracts yet"
// mode. We deliberately render NO fabricated balances.
// ─────────────────────────────────────────────────────────────────────────────

const CLERK_LIVE = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.length &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("cGxhY2Vob2xkZXI");

async function getBuyerIdentity(): Promise<{ name: string | null; email: string | null }> {
  if (!CLERK_LIVE) return { name: null, email: null };
  try {
    // Lazy import so the build doesn't hard-depend on Clerk server runtime when
    // keys are placeholders.
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    return {
      name: u?.firstName ?? u?.fullName ?? null,
      email: u?.primaryEmailAddress?.emailAddress ?? null,
    };
  } catch {
    return { name: null, email: null };
  }
}

const links = [
  { href: "/buyer/parcels", icon: MapPin, label: "My Parcels", desc: "Land you own or are financing" },
  { href: "/buyer/payments", icon: CalendarClock, label: "Payment Schedule", desc: "Installments, due dates, balance" },
  { href: "/buyer/contracts", icon: FileText, label: "Contracts", desc: "Agreements & documents" },
];

export default async function BuyerOverview() {
  const buyer = await getBuyerIdentity();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {buyer.name ? `Welcome back, ${buyer.name}` : "Your TerraLot Portal"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {buyer.email ? buyer.email : "Track your land, payments, and contracts in one place."}
        </p>
      </div>

      {!CLERK_LIVE && (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border p-4 text-xs"
          style={{ background: "var(--status-info-soft)", borderColor: "var(--border-strong)", color: "var(--muted)" }}
        >
          <Wallet className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
          <span>
            Buyer accounts go live when authentication (Clerk) is enabled. The
            schedule and contract tools below are ready — they populate from your
            signed owner-finance agreement.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group tl-card p-5 transition-all hover:shadow-[var(--shadow-pop)]"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3" style={{ background: "var(--surface-high)" }}>
              <l.icon className="w-[18px] h-[18px]" style={{ color: "var(--primary)" }} />
            </span>
            <p className="font-semibold text-sm mb-1 flex items-center gap-1">
              {l.label}
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
