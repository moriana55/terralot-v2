import { MapPin } from "lucide-react";
import { EmptyState } from "../EmptyState";

export const metadata = { title: "My Parcels" };

// A buyer's owned/financed parcels. Real data joins the buyer identity to
// Payment/Contract rows by buyerEmail (and, once added, a buyerUserId). Until a
// buyer is matched, render an honest empty state — no sample parcels are shown
// here, because a buyer must never see another buyer's land (IDOR).
export default function BuyerParcels() {
  const parcels: { id: string; title: string; county: string; state: string; acres: number }[] = [];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Parcels</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Land you own or are paying off on owner-finance terms.
        </p>
      </div>

      {parcels.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No parcels linked to your account yet"
          body="Once you sign an owner-finance agreement, your parcel appears here with its deed status, GPS location, and acreage. Already a buyer? Make sure you're signed in with the email on your contract."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parcels.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
              <h3 className="font-bold text-sm mb-1">{p.title}</h3>
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
                <MapPin className="w-3 h-3" /> {p.county}, {p.state} · {p.acres} ac
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
